// ADR renderer (docs/CONTRACT.md §4). Pure: `today` is passed in (YYYY-MM-DD).
import type { DecisionRecord, Option, Pack, Session, Topic, ValueFieldKey } from '../packs/types';
import {
  chosenOptions,
  effectiveRecommendation,
  evaluateParts,
  findRecord,
  visibleTopics,
} from './rules';

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
const sentenceEnd = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`);
const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

function labelsOf(topic: Topic, values: string[]): string[] {
  return values.map((v) => topic.options.find((o) => o.value === v)?.label ?? v);
}

/** Labels of the chosen options of a topic by id, or [] when it is undecided or absent. */
function chosenLabels(pack: Pack, session: Session, topicId: string): string[] {
  const topic = pack.topics.find((t) => t.id === topicId);
  const rec = findRecord(session, topicId);
  if (!topic || rec?.status !== 'decided') return [];
  return chosenOptions(topic, rec).map((o) => o.label);
}

function isFollowed(topic: Topic, rec: DecisionRecord, rec_values: string[]): boolean {
  if (rec_values.length === 0) return false;
  if (topic.decision_type === 'multi') return rec_values.every((v) => rec.chosen.includes(v));
  return rec.chosen.length === rec_values.length && rec_values.every((v) => rec.chosen.includes(v));
}

function valueFieldLines(pack: Pack, topic: Topic, rec: DecisionRecord, chosen: Option[]): string[] {
  const fields: { field: ValueFieldKey; option?: Option }[] = [
    ...(topic.value_fields ?? []).map((field) => ({ field })),
    ...chosen.flatMap((option) => (option.value_fields ?? []).map((field) => ({ field, option }))),
  ];
  const lines: string[] = [];
  for (const { field, option } of fields) {
    const label =
      option?.value_field_labels?.[field.id]?.label ?? topic.value_field_labels?.[field.id]?.label ?? field.id;
    const raw = rec.values[field.id] ?? '';
    if (!raw && !field.required) continue;
    let shown = raw;
    if (raw && field.type === 'select' && field.choices_ref) {
      shown = pack.choices[field.choices_ref]?.find((c) => c.value === raw)?.label ?? raw;
    }
    lines.push(`- ${label}: ${shown || '(not set)'}`);
  }
  return lines;
}

function namingTable(topic: Topic, rec: DecisionRecord): string {
  const rows = ['| Section | Field | Agreed pattern |', '| --- | --- | --- |'];
  for (const sec of topic.naming_sections ?? []) {
    for (const f of sec.fields) {
      const v = rec.naming[f.id];
      const isDefault = v === undefined || v === f.default;
      const shown = `${v ?? f.default}${isDefault ? ' (default)' : ''}`;
      rows.push(`| ${cell(sec.title)} | ${cell(f.label)} | ${cell(shown)} |`);
    }
  }
  return rows.join('\n');
}

function decidedSection(pack: Pack, session: Session, topic: Topic, rec: DecisionRecord): string {
  const out: string[] = [`### ${topic.title}`];
  const chosen = chosenOptions(topic, rec);
  const isConfirm = topic.decision_type === 'confirm' || topic.options.length === 0;

  out.push(`**Decision:** ${isConfirm ? 'Confirmed' : chosen.map((o) => o.label).join('; ')}`);

  const bullets = [
    ...valueFieldLines(pack, topic, rec, chosen),
    ...topic.modifiers.map((m) => `- ${m.title}: ${rec.modifiers[m.id] ? 'On' : 'Off'}`),
  ];
  if (bullets.length) out.push(bullets.join('\n'));

  if (topic.mode === 'naming') out.push(namingTable(topic, rec));

  // Context
  const rec_values = effectiveRecommendation(pack, topic, session).values;
  const notes = rec.notes.trim();
  let context: string;
  if (isConfirm) {
    context = clean(topic.adr_context);
  } else if (rec_values.length === 0) {
    context = chosen.map((o) => clean(o.adr_context)).join(' ');
  } else if (isFollowed(topic, rec, rec_values)) {
    context = clean(topic.adr_context);
  } else {
    const dev = `This departs from the suggested default (${labelsOf(topic, rec_values).join('; ')}).`;
    const reason = notes ? `Reason recorded: ${sentenceEnd(clean(notes))}` : 'No reason was recorded.';
    context = `${chosen.map((o) => clean(o.adr_context)).join(' ')} ${dev} ${reason}`;
  }
  out.push(`**Context:** ${context}`);

  for (const m of topic.modifiers) {
    const text = rec.modifiers[m.id] ? m.on_adr_context : m.off_adr_context;
    if (text) out.push(clean(text));
  }

  // Alternatives, ruled-out options, warnings
  const alternatives: string[] = [];
  const ruledOut: string[] = [];
  const warnings: string[] = [];
  const review: string[] = [];
  for (const o of topic.options) {
    const parts = evaluateParts(pack, topic, o, session);
    if (rec.chosen.includes(o.value)) {
      if (parts.warns.length) warnings.push(`${o.label} — ${parts.warns.join('; ')}`);
      if (parts.blocks.length) review.push(`${o.label} — ${parts.blocks.join('; ')}`);
    } else if (parts.state === 'blocked') {
      ruledOut.push(`${o.label} — ${parts.blocks.join('; ')}`);
    } else {
      alternatives.push(o.label);
    }
  }
  if (!isConfirm && alternatives.length) out.push(`**Alternatives considered:** ${alternatives.join('; ')}`);
  if (ruledOut.length) out.push(`**Not available (ruled out by earlier decisions):** ${ruledOut.join('; ')}`);
  if (warnings.length) out.push(`**Warnings:** ${warnings.join('; ')}`);
  if (review.length) out.push(`**Needs review (now ruled out by an earlier decision):** ${review.join('; ')}`);

  const maturity = chosen.filter((o) => o.maturity !== 'ga').map((o) => `${o.label}: ${o.maturity}`);
  if (maturity.length) out.push(`**Maturity:** ${maturity.join('; ')}`);

  if (notes) out.push(`**Notes:** ${clean(notes)}`);
  return out.join('\n\n');
}

function summary(pack: Pack, session: Session, topics: Topic[]): string {
  const records = topics.map((t) => ({ topic: t, rec: findRecord(session, t.id) }));
  const decided = records.filter((r) => r.rec?.status === 'decided');
  const parked = records.filter((r) => r.rec?.status === 'parked').length;
  const open = topics.length - decided.length - parked;
  const sentences: string[] = [];

  sentences.push(
    `${decided.length} of ${topics.length} topics were decided, ${open} left open and ${parked} parked.`,
  );

  const pick = (id: string) => {
    const l = chosenLabels(pack, session, id);
    return l.length ? l.join(', ') : 'not yet decided';
  };
  sentences.push(
    `The platform uses ${pick('medallion_layers')}, isolated by ${pick('isolation_strategy')}, with ${pick('environments')}.`,
  );

  const departed = decided.filter(({ topic, rec }) => {
    const rv = effectiveRecommendation(pack, topic, session).values;
    return rv.length > 0 && !isFollowed(topic, rec!, rv);
  });
  if (departed.length) {
    sentences.push(
      `${departed.length} ${plural(departed.length, 'decision departs', 'decisions depart')} from the suggested default: ${departed.map((r) => r.topic.title).join(', ')}.`,
    );
  }

  const warned = decided.filter(({ topic, rec }) =>
    chosenOptions(topic, rec).some((o) => evaluateParts(pack, topic, o, session).warns.length > 0),
  );
  if (warned.length) {
    sentences.push(
      `${warned.length} ${plural(warned.length, 'choice carries', 'choices carry')} ${plural(warned.length, 'a warning', 'warnings')}: ${warned.map((r) => r.topic.title).join(', ')}.`,
    );
  }

  const risky = decided.flatMap(({ topic, rec }) =>
    chosenOptions(topic, rec).filter((o) => o.maturity === 'preview' || o.maturity === 'gated'),
  );
  if (risky.length) {
    sentences.push(
      `${risky.length} ${plural(risky.length, 'option relies', 'options rely')} on features in preview or gated access: ${risky.map((o) => o.label).join(', ')}.`,
    );
  }
  return sentences.join(' ');
}

export function renderAdr(pack: Pack, session: Session, today: string): string {
  const topics = visibleTopics(pack, session);
  const statusOf = (t: Topic) => findRecord(session, t.id)?.status;
  const decided = topics.filter((t) => statusOf(t) === 'decided');
  const parked = topics.filter((t) => statusOf(t) === 'parked');
  const open = topics.filter((t) => statusOf(t) !== 'decided' && statusOf(t) !== 'parked');

  const head = [
    '# Architecture Decision Record',
    `## ${session.client_name} · ${pack.manifest.platform_label} · ${today}`,
    `_Pack release ${pack.manifest.release}${session.facilitator ? ` · prepared with ${session.facilitator}` : ''}_`,
    '## Executive summary',
    summary(pack, session, topics),
  ];
  const out: string[] = [...head];

  if (open.length) {
    out.push('## Open items');
    for (const t of open) {
      const notes = findRecord(session, t.id)?.notes.trim();
      out.push(
        [`### ${t.title}`, '**Status:** Open, no decision recorded.', ...(notes ? [clean(notes)] : [])].join('\n\n'),
      );
    }
  }

  out.push('## Decisions');
  if (decided.length === 0) out.push('No decisions recorded yet.');
  for (const t of decided) out.push(decidedSection(pack, session, t, findRecord(session, t.id)!));

  if (parked.length) {
    out.push('## Parked for a later phase');
    for (const t of parked) {
      const notes = findRecord(session, t.id)?.notes.trim();
      out.push(
        [
          `### ${t.title}`,
          '**Status:** Parked for a later phase.',
          `**Reason:** ${notes ? clean(notes) : 'No reason was recorded.'}`,
        ].join('\n\n'),
      );
    }
  }

  out.push('## Appendix: sources');
  const seen = new Set<string>();
  const sources: string[] = [];
  for (const t of decided) {
    for (const o of chosenOptions(t, findRecord(session, t.id))) {
      for (const s of o.sources) {
        if (seen.has(s.url)) continue;
        seen.add(s.url);
        sources.push(`- [${s.title}](${s.url})`);
      }
    }
  }
  out.push(sources.length ? sources.join('\n') : 'No sources cited.');

  return out.join('\n\n') + '\n';
}
