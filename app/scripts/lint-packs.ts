// Pack checker: the gate every content writer must pass before handing back.
//
//   npm run check:packs                                  every topic, both packs (release gate)
//   npm run check:packs -- --pack fabric --topics 1-14,30-33
//
// With --topics, only those topic files must exist; everything else is still cross-checked
// wherever both sides are present.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import Ajv2020 from 'ajv/dist/2020.js';
import type { PackKeys, PackManifest, TopicKey, TopicProse, Requirement } from '../src/packs/types';
import { mergePack, PackMergeError } from '../src/packs/merge';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'packs');
const PACKS = ['fabric', 'databricks'] as const;

// Vendor and project documentation only. Third-party summaries and the Data Crafters
// workshop are not acceptable sources.
const SOURCE_HOSTS = [
  'learn.microsoft.com', 'docs.databricks.com', 'www.databricks.com', 'databricks.com',
  'docs.getdbt.com', 'airflow.apache.org', 'delta.io', 'iceberg.apache.org', 'spark.apache.org',
  'azure.microsoft.com', 'blog.fabric.microsoft.com', 'registry.terraform.io', 'github.com',
];
const BANNED_HOSTS = ['datacrafters.io', 'workshop.datacrafters.io'];

const args = process.argv.slice(2);
const argVal = (flag: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const onlyPack = argVal('--pack');
const topicArg = argVal('--topics');
const selected = topicArg ? parseRanges(topicArg) : undefined;

function parseRanges(s: string): Set<number> {
  const out = new Set<number>();
  for (const part of s.split(',')) {
    const [a, b] = part.split('-').map(Number);
    if (a === undefined || Number.isNaN(a)) throw new Error(`bad --topics value: ${s}`);
    for (let n = a; n <= (b ?? a); n++) out.add(n);
  }
  return out;
}

const errors: string[] = [];
const err = (where: string, msg: string) => errors.push(`${where}: ${msg}`);

const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
const schema = (name: string) => JSON.parse(readFileSync(join(root, '_schema', name), 'utf8'));
const validate = {
  keys: ajv.compile(schema('keys.schema.json')),
  topic: ajv.compile(schema('topic.schema.json')),
  pack: ajv.compile(schema('pack.schema.json')),
};

function check(kind: keyof typeof validate, data: unknown, where: string): boolean {
  const v = validate[kind];
  if (v(data)) return true;
  for (const e of v.errors ?? []) err(where, `${e.instancePath || '/'} ${e.message}`);
  return false;
}

const load = (p: string) => parse(readFileSync(p, 'utf8'));

interface Loaded {
  manifest: PackManifest;
  keys: PackKeys;
  choices: Record<string, { value: string; label: string }[]>;
  proses: Map<string, TopicProse>;
}

function loadPack(pack: string): Loaded | undefined {
  const dir = join(root, pack);
  const manifest = load(join(dir, 'pack.yaml'));
  const keys = load(join(dir, 'keys.yaml'));
  const choices = load(join(dir, 'choices.yaml')) ?? {};
  const okM = check('pack', manifest, `${pack}/pack.yaml`);
  const okK = check('keys', keys, `${pack}/keys.yaml`);
  if (!okM || !okK) return undefined;

  const proses = new Map<string, TopicProse>();
  const topicDir = join(dir, 'topics');
  const files = existsSync(topicDir) ? readdirSync(topicDir).filter((f) => f.endsWith('.yaml')) : [];
  for (const f of files) {
    const where = `${pack}/topics/${f}`;
    const m = /^(\d{2})-([a-z0-9_]+)\.yaml$/.exec(f);
    if (!m) {
      err(where, 'file name must be NN-topic_id.yaml');
      continue;
    }
    const data = load(join(topicDir, f));
    if (!check('topic', data, where)) continue;
    const prose = data as TopicProse;
    const key = (keys as PackKeys).topics.find((t) => t.id === prose.id);
    if (!key) {
      err(where, `id "${prose.id}" is not in keys.yaml`);
      continue;
    }
    if (m[2] !== prose.id) err(where, `file name says "${m[2]}" but id is "${prose.id}"`);
    if (Number(m[1]) !== key.number) err(where, `file number ${m[1]} but keys.yaml number is ${key.number}`);
    proses.set(prose.id, prose);
  }
  return { manifest, keys, choices, proses };
}

function checkKeys(pack: string, L: Loaded) {
  const where = `${pack}/keys.yaml`;
  const { keys, manifest, choices } = L;
  const byKey = new Map<string, TopicKey>();
  const seen = { id: new Set<string>(), num: new Set<number>() };
  for (const t of keys.topics) {
    if (seen.id.has(t.id)) err(where, `duplicate topic id ${t.id}`);
    if (seen.num.has(t.number)) err(where, `duplicate number ${t.number}`);
    if (byKey.has(t.decision_key)) err(where, `duplicate decision_key ${t.decision_key}`);
    seen.id.add(t.id);
    seen.num.add(t.number);
    byKey.set(t.decision_key, t);
  }
  const modKeys = new Set(keys.topics.flatMap((t) => (t.modifiers ?? []).map((m) => m.decision_key)));

  for (const t of keys.topics) {
    const w = `${where} ${t.id}`;
    const values = t.options.map((o) => o.value);
    if (new Set(values).size !== values.length) err(w, 'duplicate option value');
    if (t.decision_type === 'confirm' && values.length) err(w, 'confirm topics have no options');
    if (t.decision_type !== 'confirm' && values.length < 2) err(w, 'needs at least 2 options');
    if (t.renderer === 'naming_form' && t.mode !== 'naming') err(w, 'naming_form renderer needs mode: naming');
    for (const r of t.recommendation) if (!values.includes(r)) err(w, `recommendation "${r}" is not an option`);
    if (t.decision_type === 'single' && t.recommendation.length > 1) err(w, 'single-select topic recommends more than one option');

    const ar = t.adaptive_recommendation;
    if (ar) {
      const target = byKey.get(ar.follows);
      if (!target) err(w, `adaptive_recommendation follows unknown key ${ar.follows}`);
      for (const [k, v] of Object.entries(ar.map)) {
        if (target && !target.options.some((o) => o.value === k)) err(w, `adaptive map key "${k}" is not an option of ${ar.follows}`);
        for (const x of v) if (!values.includes(x)) err(w, `adaptive map value "${x}" is not an option`);
      }
    }

    const fields = [...(t.value_fields ?? []), ...t.options.flatMap((o) => o.value_fields ?? [])];
    for (const f of fields) {
      if (f.choices_ref && !choices[f.choices_ref]) err(w, `choices_ref "${f.choices_ref}" not in choices.yaml`);
    }

    for (const o of t.options) {
      for (const r of o.requires ?? []) checkRequirement(`${w}.${o.value}`, r, byKey, modKeys, choices);
      const ce = o.canvas_effect;
      if (ce?.type === 'footer_badge' && !manifest.canvas.badge_labels[ce.label_id]) {
        err(`${w}.${o.value}`, `footer_badge label_id "${ce.label_id}" not in pack.yaml badge_labels`);
      }
    }
  }

  // Every topic appears in exactly one group.
  const grouped = manifest.groups.flatMap((g) => g.topics);
  for (const id of grouped) if (!seen.id.has(id)) err(`${pack}/pack.yaml`, `group lists unknown topic ${id}`);
  for (const id of seen.id) {
    const n = grouped.filter((g) => g === id).length;
    if (n !== 1) err(`${pack}/pack.yaml`, `topic ${id} appears in ${n} groups (want 1)`);
  }
}

function checkRequirement(w: string, r: Requirement, byKey: Map<string, TopicKey>, modKeys: Set<string>, choices: Loaded['choices']) {
  const choicesOf = (ref: string) => choices[ref]?.map((c) => c.value);
  const target = byKey.get(r.decision_key);
  if (!target) {
    if (!modKeys.has(r.decision_key)) err(w, `requires unknown decision_key ${r.decision_key}`);
    return;
  }
  const ops = (['in', 'not_in', 'any_of', 'none_of'] as const).filter((k) => r[k]);
  const op = ops[0]!;
  const multi = target.decision_type === 'multi';
  if (!r.field && multi !== (op === 'any_of' || op === 'none_of')) {
    err(w, `operator "${op}" does not fit ${target.decision_type}-select ${r.decision_key} (in/not_in for single, any_of/none_of for multi)`);
  }
  if (r.field) {
    const fields = [...(target.value_fields ?? []), ...target.options.flatMap((o) => o.value_fields ?? [])];
    const f = fields.find((x) => x.id === r.field);
    if (!f) return err(w, `requires field "${r.field}", which is not a value field of ${r.decision_key}`);
    if (op !== 'in' && op !== 'not_in') err(w, `field rules take in/not_in, not ${op}`);
    const list = f.choices_ref ? choicesOf(f.choices_ref) : undefined;
    for (const v of r[op] ?? []) if (list && !list.includes(v)) err(w, `requires ${r.field} "${v}", which is not in choices ${f.choices_ref}`);
    return;
  }
  for (const v of r[op] ?? []) {
    if (!target.options.some((o) => o.value === v)) err(w, `requires ${r.decision_key} value "${v}", which is not an option there`);
  }
}

function checkProse(pack: string, L: Loaded) {
  for (const t of L.keys.topics) {
    const p = L.proses.get(t.id);
    const where = `${pack}/topics/${String(t.number).padStart(2, '0')}-${t.id}.yaml`;
    if (!p) {
      if (!selected || selected.has(t.number)) err(where, 'missing');
      continue;
    }
    if (t.mode === 'naming') {
      if (!p.naming_sections) err(where, 'naming topic needs naming_sections');
    } else {
      if (p.naming_sections) err(where, 'naming_sections only belong on the naming topic');
      if (p.intake.length < 2) err(where, 'needs at least 2 intake questions');
    }
    if (t.recommendation.length && !p.recommendation_note.trim()) err(where, 'has a recommendation but no recommendation_note');
    if (!t.recommendation.length && p.recommendation_note.trim()) err(where, 'recommendation_note set but keys.yaml has no recommendation');

    const reasonIds = t.options.flatMap((o) => (o.requires ?? []).map((r) => r.reason_id));
    for (const id of reasonIds) if (!p.rule_reasons?.[id]) err(where, `rule_reasons.${id} missing`);
    for (const id of Object.keys(p.rule_reasons ?? {})) if (!reasonIds.includes(id)) err(where, `rule_reasons.${id} is not used by any rule`);

    for (const f of t.value_fields ?? []) if (!p.value_field_labels?.[f.id]) err(where, `value_field_labels.${f.id} missing`);
    for (const o of t.options) {
      const po = p.options.find((x) => x.value === o.value);
      for (const f of o.value_fields ?? []) {
        if (!po?.value_field_labels?.[f.id]) err(where, `options.${o.value}.value_field_labels.${f.id} missing`);
      }
    }

    for (const o of p.options) {
      for (const s of o.sources) {
        const host = new URL(s.url).hostname;
        if (BANNED_HOSTS.some((b) => host === b || host.endsWith(`.${b}`))) err(where, `${o.value}: source ${host} is not allowed`);
        else if (!SOURCE_HOSTS.includes(host)) err(where, `${o.value}: source host ${host} is not on the vendor list`);
      }
      if (o.as_of > new Date().toISOString().slice(0, 10)) err(where, `${o.value}: as_of is in the future`);
    }
  }

  try {
    const only = selected
      ? new Set(L.keys.topics.filter((t) => selected.has(t.number) && L.proses.has(t.id)).map((t) => t.id))
      : new Set([...L.proses.keys()]);
    mergePack(L.manifest, L.keys, [...L.proses.values()], L.choices, only);
  } catch (e) {
    if (e instanceof PackMergeError) for (const p of e.problems) err(`${pack} merge`, p);
    else throw e;
  }
}

function checkParity(a: Loaded, b: Loaded) {
  const sig = (L: Loaded) => L.keys.topics.map((t) => `${t.number}:${t.id}:${t.decision_key}:${t.cluster}:${t.status}`);
  const sa = new Set(sig(a));
  const sb = new Set(sig(b));
  for (const s of sa) if (!sb.has(s)) err('parity', `fabric has ${s}, databricks does not`);
  for (const s of sb) if (!sa.has(s)) err('parity', `databricks has ${s}, fabric does not`);
  const ga = a.manifest.groups.map((g) => g.topics.join(','));
  const gb = b.manifest.groups.map((g) => g.topics.join(','));
  if (ga.join('|') !== gb.join('|')) err('parity', 'pack.yaml groups differ between packs');
}

const loaded = new Map<string, Loaded>();
for (const pack of PACKS) {
  const L = loadPack(pack);
  if (!L) continue;
  loaded.set(pack, L);
  checkKeys(pack, L);
  if (!onlyPack || onlyPack === pack) checkProse(pack, L);
}
const fab = loaded.get('fabric');
const dbx = loaded.get('databricks');
if (fab && dbx) checkParity(fab, dbx);

const scope = `${onlyPack ?? 'both packs'}${topicArg ? `, topics ${topicArg}` : ', all topics'}`;
if (errors.length) {
  console.error(errors.join('\n'));
  console.error(`\ncheck:packs FAILED (${scope}): ${errors.length} problem(s)`);
  process.exit(1);
}
const counted = [...loaded.values()].reduce((n, L) => n + L.proses.size, 0);
console.log(`check:packs passed (${scope}): ${counted} topic file(s) checked`);
