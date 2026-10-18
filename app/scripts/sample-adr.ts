// Render an example ADR per pack: every topic decided with its suggested default (or the
// first option the rules allow), proposed topics shown, one topic parked and one left open.
//   npm run sample:adr      writes docs/examples/<pack>-adr.md
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPack } from '../src/engine/load';
import { newSession, setDecision } from '../src/engine/session';
import { orderedTopics, effectiveRecommendation, evaluate } from '../src/engine/rules';
import { renderAdr } from '../src/engine/adr';

const app = join(dirname(fileURLToPath(import.meta.url)), '..');
const NOW = '2026-10-19T09:00:00.000Z';
const TODAY = '2026-10-19';
const PARKED = 'backup_restore';
const OPEN = 'ownership';

for (const id of ['fabric', 'databricks']) {
  const dir = join(app, 'packs', id);
  const read = (f: string) => readFileSync(join(dir, f), 'utf8');
  const topics = readdirSync(join(dir, 'topics')).sort().map((f) => read(join('topics', f)));
  const pack = loadPack({ manifest: read('pack.yaml'), keys: read('keys.yaml'), choices: read('choices.yaml'), topics });

  let s = newSession(pack, { session_id: `example-${id}`, client_name: 'Example Co', now: NOW, facilitator: 'Example facilitator', show_proposed: true });
  for (const t of orderedTopics(pack)) {
    if (t.id === PARKED) {
      s = setDecision(s, t, { status: 'parked', notes: 'Revisit after the first production release.' }, NOW);
      continue;
    }
    if (t.id === OPEN) {
      s = setDecision(s, t, { status: 'open', notes: 'Waiting for the data office to name domain owners.' }, NOW);
      continue;
    }
    if (t.decision_type === 'confirm') {
      const naming = Object.fromEntries((t.naming_sections ?? []).flatMap((sec) => sec.fields.map((f) => [f.id, f.default])));
      s = setDecision(s, t, { status: 'decided', chosen: [], naming }, NOW);
      continue;
    }
    const allowed = t.options.filter((o) => evaluate(pack, t, o, s).state !== 'blocked').map((o) => o.value);
    const rec = effectiveRecommendation(pack, t, s).values.filter((v) => allowed.includes(v));
    const chosen = rec.length ? rec : allowed.slice(0, 1);
    const values: Record<string, string> = {};
    const fields = [...(t.value_fields ?? []), ...t.options.filter((o) => chosen.includes(o.value)).flatMap((o) => o.value_fields ?? [])];
    for (const f of fields) {
      if (f.type === 'select' && f.choices_ref) values[f.id] = pack.choices[f.choices_ref]?.[0]?.value ?? '';
      else if (f.required) values[f.id] = f.id === 'cloud_region' ? 'westeurope' : 'Example value';
    }
    s = setDecision(s, t, { status: 'decided', chosen, values }, NOW);
  }
  const out = join(app, 'docs', 'examples', `${id}-adr.md`);
  writeFileSync(out, renderAdr(pack, s, TODAY));
  console.log(`wrote ${out}`);
}
