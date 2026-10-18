// Canvas model (docs/CONTRACT.md §5). Pure: the UI draws the model and adds no logic.
import type { CanvasEffect, Cluster, Pack, Session } from '../packs/types';
import { chosenOptions, findRecord, orderedTopics } from './rules';

export type BandCluster = 'platform_setup' | 'access_governance' | 'operations';
export type LockScope = 'model' | 'storage' | 'all';

export interface CanvasModel {
  sources: { label: string; mechanism?: string }[];
  landing?: { label: string };
  environments: string[];
  containers: { label: string; layers: string[] }[];
  layers: { id: string; label: string; engine?: string }[];
  transform_band: boolean;
  serving: { pattern: string; label: string };
  locks: LockScope[];
  bands: { cluster: BandCluster; chips: string[] }[];
  footer_badges: string[];
  /**
   * Parts of the diagram no decision has filled in yet, drawn dashed and grey. Names:
   * layers, landing, containers, environments, sources, engines, transform_band, serving.
   */
  undecided: string[];
}

const BAND_CLUSTERS: BandCluster[] = ['platform_setup', 'access_governance', 'operations'];
const DEFAULT_LAYERS = ['bronze', 'silver', 'gold'];
const CHIP_MAX = 24;

const titleCase = (id: string) =>
  id
    .split('_')
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(' ');

const shorten = (s: string) => (s.length <= CHIP_MAX ? s : `${s.slice(0, CHIP_MAX - 1)}…`);

export function buildCanvas(pack: Pack, session: Session): CanvasModel {
  const labels = pack.manifest.canvas;
  const effects: CanvasEffect[] = [];
  const sources: CanvasModel['sources'] = [];
  const chips = new Map<Cluster, string[]>();

  for (const topic of orderedTopics(pack)) {
    if (topic.status === 'proposed' && !session.show_proposed) continue;
    const rec = findRecord(session, topic.id);
    if (rec?.status !== 'decided') continue;
    const chosen = chosenOptions(topic, rec);

    for (const o of chosen) if (o.canvas_effect) effects.push(o.canvas_effect);
    // A modifier's effect applies while the modifier is on.
    for (const m of topic.modifiers) if (m.canvas_effect && rec.modifiers[m.id]) effects.push(m.canvas_effect);

    if (topic.canvas_element === 'sources') {
      // Source system names live in option_notes; the option label is the mechanism.
      for (const o of chosen) {
        // One box per named system: the field takes a comma-, semicolon- or line-separated list.
        const names = (rec.option_notes[o.value] ?? '').split(/[,;\n]/).map((n) => n.trim()).filter(Boolean);
        if (names.length) for (const label of names) sources.push({ label, mechanism: o.label });
        else sources.push({ label: o.label });
      }
    }

    if ((BAND_CLUSTERS as string[]).includes(topic.cluster)) {
      const list = chips.get(topic.cluster) ?? [];
      for (const o of chosen) list.push(shorten(o.label));
      chips.set(topic.cluster, list);
    }
  }

  const undecided = new Set(['layers', 'landing', 'containers', 'environments', 'engines', 'transform_band', 'serving']);
  if (sources.length === 0) undecided.add('sources');

  let layerIds = DEFAULT_LAYERS;
  let landing: CanvasModel['landing'];
  let pattern: 'per_layer' | 'first_pair_shared' | 'single' | 'per_domain' = 'per_layer';
  let environments = ['prod'];
  let engines: { default: string; first?: string; last?: string } | undefined;
  let transformBand = false;
  let servingPattern = 'default';
  const locks: LockScope[] = [];
  const badges: string[] = [];

  for (const e of effects) {
    switch (e.type) {
      case 'layer_boxes':
        layerIds = e.layers;
        undecided.delete('layers');
        break;
      case 'landing_zone':
        landing = e.on ? { label: labels.landing_label } : undefined;
        undecided.delete('landing');
        break;
      case 'container_grouping':
        pattern = e.pattern;
        undecided.delete('containers');
        break;
      case 'env_multiplier':
        environments = e.envs;
        undecided.delete('environments');
        break;
      case 'layer_engines':
        engines = e;
        undecided.delete('engines');
        break;
      case 'transform_band':
        transformBand = e.on;
        undecided.delete('transform_band');
        break;
      case 'serving_lane':
        servingPattern = e.pattern;
        undecided.delete('serving');
        break;
      case 'lock':
        if (!locks.includes(e.scope)) locks.push(e.scope);
        break;
      case 'footer_badge': {
        const b = labels.badge_labels[e.label_id] ?? e.label_id;
        if (!badges.includes(b)) badges.push(b);
        break;
      }
    }
  }

  const engineLabel = (id: string) => labels.layer_engine_labels[id] ?? id;
  const layers = layerIds.map((id, i) => {
    const layer: CanvasModel['layers'][number] = { id, label: titleCase(id) };
    if (engines) {
      const last = i === layerIds.length - 1;
      const pick = i === 0 && engines.first ? engines.first : last && engines.last ? engines.last : engines.default;
      layer.engine = engineLabel(pick);
    }
    return layer;
  });

  const cl = labels.container_label;
  let containers: CanvasModel['containers'];
  switch (pattern) {
    case 'single':
      containers = [{ label: cl, layers: layerIds }];
      break;
    case 'first_pair_shared': {
      const pair = layerIds.slice(0, 2);
      containers = [
        { label: `${pair.map(titleCase).join(' + ')} ${cl}`, layers: pair },
        ...layerIds.slice(2).map((id) => ({ label: `${titleCase(id)} ${cl}`, layers: [id] })),
      ];
      break;
    }
    case 'per_domain':
      containers = [
        { label: `${cl} per domain`, layers: layerIds },
        { label: `${cl} per domain`, layers: layerIds },
      ];
      break;
    default:
      containers = layerIds.map((id) => ({ label: `${titleCase(id)} ${cl}`, layers: [id] }));
  }

  return {
    sources,
    ...(landing ? { landing } : {}),
    environments,
    containers,
    layers,
    transform_band: transformBand,
    serving: { pattern: servingPattern, label: labels.serving_label },
    locks,
    bands: BAND_CLUSTERS.map((cluster) => ({ cluster, chips: chips.get(cluster) ?? [] })),
    footer_badges: badges,
    undecided: [...undecided],
  };
}
