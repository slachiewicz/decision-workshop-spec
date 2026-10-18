import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPack } from '../../src/engine/load';
import type { DecisionRecord, Option, Pack, Session, Topic } from '../../src/packs/types';

const here = dirname(fileURLToPath(import.meta.url));
export const FIXTURES = join(here, 'fixtures');
export const GOLDEN = join(here, 'golden');
const packsDir = join(here, '..', '..', 'packs');

/** Load a shipped pack from disk, limited to the topics that have prose. */
export function loadShipped(id: string, only: string[]): Pack {
  const dir = join(packsDir, id);
  const topics = readdirSync(join(dir, 'topics'))
    .sort()
    .map((f) => readFileSync(join(dir, 'topics', f), 'utf8'));
  return loadPack(
    {
      manifest: readFileSync(join(dir, 'pack.yaml'), 'utf8'),
      keys: readFileSync(join(dir, 'keys.yaml'), 'utf8'),
      choices: readFileSync(join(dir, 'choices.yaml'), 'utf8'),
      topics,
    },
    new Set(only),
  );
}

// ---- synthetic packs ----

export function opt(value: string, extra: Partial<Option> = {}): Option {
  return {
    value,
    label: value.toUpperCase(),
    description: '',
    tradeoff: '',
    pros: [],
    cons: [],
    adr_context: `${value} was chosen.`,
    maturity: 'ga',
    as_of: '2026-10-18',
    sources: [],
    ...extra,
  };
}

export function topic(id: string, options: Option[], extra: Partial<Topic> = {}): Topic {
  return {
    number: 1,
    id,
    decision_key: `k.${id}`,
    cluster: 'architecture',
    status: 'core',
    weight: 'standard',
    mode: 'decide',
    renderer: 'cards',
    decision_type: 'single',
    required: false,
    recommendation: [],
    title: id.toUpperCase(),
    situation: '',
    intake: [],
    recommendation_note: '',
    adr_context: `${id} default context.`,
    options,
    modifiers: [],
    ...extra,
  };
}

export function packOf(topics: Topic[], canvas: Partial<Pack['manifest']['canvas']> = {}): Pack {
  return {
    manifest: {
      id: 'test',
      name: 'Test',
      platform_label: 'Test Platform',
      release: '1.0.0',
      groups: [{ part: 1, title: 'P', blurb: '', topics: topics.map((t) => t.id) }],
      canvas: {
        container_label: 'Box',
        landing_label: 'Landing',
        layer_engine_labels: { a: 'Engine A', b: 'Engine B' },
        serving_label: 'Serve',
        badge_labels: { git: 'Git badge' },
        ...canvas,
      },
    },
    topics,
    choices: {},
  };
}

export function rec(t: Topic, chosen: string[], extra: Partial<DecisionRecord> = {}): DecisionRecord {
  return {
    topic_id: t.id,
    decision_key: t.decision_key,
    status: 'decided',
    chosen,
    values: {},
    modifiers: {},
    naming: {},
    option_notes: {},
    notes: '',
    decided_at: '2026-10-18T10:00:00Z',
    ...extra,
  };
}

export function sessionOf(decisions: DecisionRecord[], extra: Partial<Session> = {}): Session {
  return {
    kind: 'decision-workshop-session',
    schema_version: 1,
    pack: 'test',
    pack_release: '1.0.0',
    session_id: 's1',
    client_name: 'Acme',
    show_proposed: false,
    decisions,
    locked: false,
    created_at: '2026-10-18T09:00:00Z',
    updated_at: '2026-10-18T10:00:00Z',
    ...extra,
  };
}
