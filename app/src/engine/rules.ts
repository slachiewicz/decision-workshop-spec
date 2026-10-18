// Rule evaluation (docs/CONTRACT.md §3). Pure functions over a Pack and a Session.
import type {
  DecisionRecord,
  Option,
  Pack,
  Requirement,
  RuleResult,
  Session,
  Topic,
} from '../packs/types';

/** RuleResult plus the reasons split by cause. The ADR needs warnings apart from the rest. */
export interface RuleParts extends RuleResult {
  blocks: string[];
  warns: string[];
  pendings: string[];
}

export interface Recommendation {
  /** Recommended option values after the adaptive map and the blocked check. */
  values: string[];
  /** Set when the usual default is ruled out; `values` is then empty. */
  note?: string;
}

export interface SignOffStatus {
  ok: boolean;
  /** Required visible topics with no record at all. */
  missing: string[];
  /** Topic ids flagged needs review. */
  needsReview: string[];
}

export function findRecord(session: Session, topicId: string): DecisionRecord | undefined {
  return session.decisions.find((d) => d.topic_id === topicId);
}

function findRecordByKey(session: Session, key: string): DecisionRecord | undefined {
  return session.decisions.find((d) => d.decision_key === key);
}

/** Topics in flow order: manifest groups first, then any topic the groups don't list. */
export function orderedTopics(pack: Pack): Topic[] {
  const byId = new Map(pack.topics.map((t) => [t.id, t]));
  const seen = new Set<string>();
  const out: Topic[] = [];
  for (const g of pack.manifest.groups) {
    for (const id of g.topics) {
      const t = byId.get(id);
      if (t && !seen.has(id)) {
        seen.add(id);
        out.push(t);
      }
    }
  }
  const rest = pack.topics.filter((t) => !seen.has(t.id)).sort((a, b) => a.number - b.number);
  return [...out, ...rest];
}

/** Topics a session shows: core always, proposed only when `show_proposed` is on. */
export function visibleTopics(pack: Pack, session: Session): Topic[] {
  return orderedTopics(pack).filter((t) => t.status === 'core' || session.show_proposed);
}

type Resolved = { known: true; values: string[] } | { known: false; title: string };

/** Current value(s) of a decision key: a topic's chosen options, or a modifier's on/off value. */
function resolve(pack: Pack, session: Session, key: string): Resolved {
  const owner = pack.topics.find((t) => t.modifiers.some((m) => m.decision_key === key));
  if (owner) {
    const rec = findRecord(session, owner.id);
    const mod = owner.modifiers.find((m) => m.decision_key === key)!;
    if (rec?.status !== 'decided') return { known: false, title: owner.title };
    return { known: true, values: [rec.modifiers[mod.id] ? mod.on_value : mod.off_value] };
  }
  const topic = pack.topics.find((t) => t.decision_key === key);
  const rec = topic ? findRecord(session, topic.id) : findRecordByKey(session, key);
  const title = topic?.title ?? key;
  if (!rec || rec.status !== 'decided') return { known: false, title };
  if (rec.chosen.length === 0 && topic?.decision_type !== 'confirm') return { known: false, title };
  return { known: true, values: rec.chosen };
}

function met(req: Requirement, values: string[]): boolean {
  const hit = (list: string[] | undefined) => (list ?? []).some((v) => values.includes(v));
  if (req.in) return hit(req.in);
  if (req.not_in) return !hit(req.not_in);
  if (req.any_of) return hit(req.any_of);
  if (req.none_of) return !hit(req.none_of);
  return true;
}

export function evaluateParts(pack: Pack, topic: Topic, option: Option, session: Session): RuleParts {
  const reasons: string[] = [];
  const blocks: string[] = [];
  const warns: string[] = [];
  const pendings: string[] = [];
  for (const req of option.requires ?? []) {
    const r = resolve(pack, session, req.decision_key);
    if (!r.known) {
      const text = `Depends on ${r.title}, not decided yet`;
      if (!pendings.includes(text)) {
        pendings.push(text);
        reasons.push(text);
      }
      continue;
    }
    if (met(req, r.values)) continue;
    const text = topic.rule_reasons?.[req.reason_id] ?? req.reason_id;
    (req.severity === 'block' ? blocks : warns).push(text);
    reasons.push(text);
  }
  const state = blocks.length ? 'blocked' : warns.length ? 'warn' : pendings.length ? 'pending' : 'ok';
  return { state, reasons, blocks, warns, pendings };
}

/**
 * Contract §3 names `evaluate(topic, option, session)`. A pending reason needs the title of
 * the topic it depends on, which only the pack knows, so `pack` comes first.
 */
export function evaluate(pack: Pack, topic: Topic, option: Option, session: Session): RuleResult {
  const { state, reasons } = evaluateParts(pack, topic, option, session);
  return { state, reasons };
}

/** Chosen options of a record, in the topic's option order. */
export function chosenOptions(topic: Topic, rec: DecisionRecord | undefined): Option[] {
  if (!rec) return [];
  return topic.options.filter((o) => rec.chosen.includes(o.value));
}

/** A decided topic whose chosen option now evaluates to `blocked`. Never cleared silently. */
export function needsReview(pack: Pack, topic: Topic, session: Session): boolean {
  const rec = findRecord(session, topic.id);
  if (rec?.status !== 'decided') return false;
  return chosenOptions(topic, rec).some((o) => evaluate(pack, topic, o, session).state === 'blocked');
}

export function effectiveRecommendation(pack: Pack, topic: Topic, session: Session): Recommendation {
  let values = topic.recommendation;
  const ad = topic.adaptive_recommendation;
  if (ad) {
    const r = resolve(pack, session, ad.follows);
    if (r.known) {
      const mapped = ad.map[r.values[0] ?? ''] ?? [];
      if (mapped.length) values = mapped;
    }
  }
  const blockedReasons: string[] = [];
  for (const v of values) {
    const opt = topic.options.find((o) => o.value === v);
    if (!opt) continue;
    const res = evaluateParts(pack, topic, opt, session);
    if (res.state === 'blocked') blockedReasons.push(...res.blocks);
  }
  if (blockedReasons.length) {
    return { values: [], note: `The usual default is ruled out by ${blockedReasons.join('; ')}` };
  }
  return { values };
}

export function canSignOff(pack: Pack, session: Session): SignOffStatus {
  const missing: string[] = [];
  const review: string[] = [];
  for (const t of visibleTopics(pack, session)) {
    if (t.required && !findRecord(session, t.id)) missing.push(t.id);
    if (needsReview(pack, t, session)) review.push(t.id);
  }
  return { ok: missing.length === 0 && review.length === 0, missing, needsReview: review };
}
