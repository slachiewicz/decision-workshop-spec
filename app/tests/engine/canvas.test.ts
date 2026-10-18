import { describe, expect, it } from 'vitest';
import { buildCanvas } from '../../src/engine/canvas';
import type { CanvasEffect, Topic } from '../../src/packs/types';
import { opt, packOf, rec, sessionOf, topic } from './helpers';

/** A one-option topic that carries the effect, decided. */
function withEffect(id: string, effect: CanvasEffect, extra: Partial<Topic> = {}) {
  const t = topic(id, [opt('v', { canvas_effect: effect })], extra);
  return { t, r: rec(t, ['v']) };
}

function canvasFor(effects: { t: Topic; r: ReturnType<typeof rec> }[], session = {}) {
  const pack = packOf(effects.map((e) => e.t));
  return buildCanvas(pack, sessionOf(effects.map((e) => e.r), session));
}

describe('buildCanvas defaults', () => {
  it('draws dashed bronze/silver/gold, one prod environment and nothing else', () => {
    const m = buildCanvas(packOf([]), sessionOf([]));
    expect(m.layers.map((l) => l.id)).toEqual(['bronze', 'silver', 'gold']);
    expect(m.environments).toEqual(['prod']);
    expect(m.containers.map((c) => c.layers)).toEqual([['bronze'], ['silver'], ['gold']]);
    expect(m.landing).toBeUndefined();
    expect(m.transform_band).toBe(false);
    expect(m.serving).toEqual({ pattern: 'default', label: 'Serve' });
    expect(m.locks).toEqual([]);
    expect(m.footer_badges).toEqual([]);
    expect(m.sources).toEqual([]);
    expect(m.bands).toEqual([
      { cluster: 'platform_setup', chips: [] },
      { cluster: 'access_governance', chips: [] },
      { cluster: 'operations', chips: [] },
    ]);
    expect(m.undecided).toContain('layers');
  });
});

describe('buildCanvas effects', () => {
  it('layer_boxes sets the layers and clears the undecided mark', () => {
    const m = canvasFor([withEffect('l', { type: 'layer_boxes', layers: ['raw', 'serving'] })]);
    expect(m.layers.map((l) => l.label)).toEqual(['Raw', 'Serving']);
    expect(m.undecided).not.toContain('layers');
  });

  it('landing_zone works as a modifier, only while the modifier is on', () => {
    const t = topic('l', [opt('v')], {
      modifiers: [
        { id: 'lz', decision_key: 'k.lz', on_value: 'on', off_value: 'off', canvas_effect: { type: 'landing_zone', on: true }, title: '', label: '', hint: '', on_adr_context: '', off_adr_context: '' },
      ],
    });
    const pack = packOf([t]);
    expect(buildCanvas(pack, sessionOf([rec(t, ['v'], { modifiers: { lz: true } })])).landing).toEqual({ label: 'Landing' });
    expect(buildCanvas(pack, sessionOf([rec(t, ['v'], { modifiers: { lz: false } })])).landing).toBeUndefined();
  });

  const layers: CanvasEffect = { type: 'layer_boxes', layers: ['bronze', 'silver', 'gold'] };
  it.each([
    ['per_layer', [['bronze'], ['silver'], ['gold']], ['Bronze Box', 'Silver Box', 'Gold Box']],
    ['first_pair_shared', [['bronze', 'silver'], ['gold']], ['Bronze + Silver Box', 'Gold Box']],
    ['single', [['bronze', 'silver', 'gold']], ['Box']],
    ['per_domain', [['bronze', 'silver', 'gold'], ['bronze', 'silver', 'gold']], ['Box per domain', 'Box per domain']],
  ] as const)('container_grouping %s', (pattern, grouped, names) => {
    const m = canvasFor([withEffect('l', layers), withEffect('c', { type: 'container_grouping', pattern })]);
    expect(m.containers.map((c) => c.layers)).toEqual(grouped);
    expect(m.containers.map((c) => c.label)).toEqual(names);
    expect(m.undecided).not.toContain('containers');
  });

  it('env_multiplier sets environments', () => {
    expect(canvasFor([withEffect('e', { type: 'env_multiplier', envs: ['dev', 'test', 'prod'] })]).environments).toEqual(['dev', 'test', 'prod']);
  });

  it('layer_engines applies default, first and last, using the label map', () => {
    const m = canvasFor([
      withEffect('l', { type: 'layer_boxes', layers: ['bronze', 'silver', 'gold'] }),
      withEffect('s', { type: 'layer_engines', default: 'a', last: 'b' }),
    ]);
    expect(m.layers.map((l) => l.engine)).toEqual(['Engine A', 'Engine A', 'Engine B']);
    const m2 = canvasFor([
      withEffect('l', { type: 'layer_boxes', layers: ['bronze', 'silver', 'gold'] }),
      withEffect('s', { type: 'layer_engines', default: 'a', first: 'b' }),
    ]);
    expect(m2.layers.map((l) => l.engine)).toEqual(['Engine B', 'Engine A', 'Engine A']);
  });

  it('transform_band toggles on and off', () => {
    expect(canvasFor([withEffect('t', { type: 'transform_band', on: true })]).transform_band).toBe(true);
    expect(canvasFor([withEffect('t', { type: 'transform_band', on: false })]).transform_band).toBe(false);
  });

  it('serving_lane sets the pattern', () => {
    expect(canvasFor([withEffect('s', { type: 'serving_lane', pattern: 'native' })]).serving).toEqual({ pattern: 'native', label: 'Serve' });
  });

  it('lock adds scopes without duplicates', () => {
    const m = canvasFor([
      withEffect('a', { type: 'lock', scope: 'model' }),
      withEffect('b', { type: 'lock', scope: 'storage' }),
      withEffect('c', { type: 'lock', scope: 'model' }),
    ]);
    expect(m.locks).toEqual(['model', 'storage']);
  });

  it('footer_badge uses the pack label', () => {
    expect(canvasFor([withEffect('f', { type: 'footer_badge', label_id: 'git' })]).footer_badges).toEqual(['Git badge']);
  });

  it('ignores topics that are not decided', () => {
    const e = withEffect('e', { type: 'env_multiplier', envs: ['dev', 'prod'] });
    const m = canvasFor([{ t: e.t, r: { ...e.r, status: 'parked' } }]);
    expect(m.environments).toEqual(['prod']);
  });

  it('ignores proposed topics unless show_proposed is on', () => {
    const e = withEffect('e', { type: 'env_multiplier', envs: ['dev', 'prod'] }, { status: 'proposed' });
    expect(canvasFor([e]).environments).toEqual(['prod']);
    expect(canvasFor([e], { show_proposed: true }).environments).toEqual(['dev', 'prod']);
  });
});

describe('buildCanvas sources and bands', () => {
  it('lists chosen ingestion mechanisms, naming the source system from option notes', () => {
    const t = topic('ing', [opt('copy'), opt('mirror')], { decision_type: 'multi', canvas_element: 'sources', renderer: 'source_mapper' });
    const m = buildCanvas(packOf([t]), sessionOf([rec(t, ['copy', 'mirror'], { option_notes: { copy: 'SAP ERP' } })]));
    expect(m.sources).toEqual([{ label: 'SAP ERP', mechanism: 'COPY' }, { label: 'MIRROR' }]);
    expect(m.undecided).not.toContain('sources');
  });

  it('draws one source per name when several systems share a mechanism', () => {
    const t = topic('ing', [opt('copy')], { decision_type: 'multi', canvas_element: 'sources', renderer: 'source_mapper' });
    const m = buildCanvas(packOf([t]), sessionOf([rec(t, ['copy'], { option_notes: { copy: 'SAP ERP, Salesforce;\nWorkday ,' } })]));
    expect(m.sources.map((s) => s.label)).toEqual(['SAP ERP', 'Salesforce', 'Workday']);
  });

  it('adds shortened chips to the band of the topic cluster', () => {
    const t = topic('g', [opt('a', { label: 'A very long option label that overflows' }), opt('b', { label: 'Short' })], {
      cluster: 'access_governance',
      decision_type: 'multi',
    });
    const arch = topic('x', [opt('a')], { cluster: 'architecture' });
    const m = buildCanvas(packOf([t, arch]), sessionOf([rec(t, ['a', 'b']), rec(arch, ['a'])]));
    const band = m.bands.find((b) => b.cluster === 'access_governance')!;
    expect(band.chips).toEqual(['A very long option labe…', 'Short']);
    expect(band.chips[0]).toHaveLength(24);
    expect(m.bands.find((b) => b.cluster === 'operations')!.chips).toEqual([]);
  });
});
