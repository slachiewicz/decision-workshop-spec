import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderAdr } from '../../src/engine/adr';
import { importSession } from '../../src/engine/session';
import { FIXTURES, GOLDEN, loadShipped, opt, packOf, rec, sessionOf, topic } from './helpers';

const TODAY = '2026-10-18';

describe.each(['fabric', 'databricks'])('golden ADR: %s', (id) => {
  it('renders the fixture session byte for byte', () => {
    const pack = loadShipped(id, ['medallion_layers', 'query_mode']);
    const session = importSession(
      JSON.stringify({
        kind: 'decision-workshop-session',
        schema_version: 1,
        session: JSON.parse(readFileSync(join(FIXTURES, `${id}-session.json`), 'utf8')),
      }),
    );
    const out = renderAdr(pack, session, TODAY);
    const file = join(GOLDEN, `${id}-adr.md`);
    if (process.env.UPDATE_GOLDEN === '1' || !existsSync(file)) writeFileSync(file, out);
    expect(out).toBe(readFileSync(file, 'utf8'));
  });
});

describe('renderAdr structure', () => {
  const layers = topic('medallion_layers', [opt('three', { label: 'Three' }), opt('two', { label: 'Two' })], {
    title: 'Layers',
    recommendation: ['three'],
    required: true,
  });
  const iso = topic('isolation_strategy', [opt('a', { label: 'Per layer' })], { title: 'Isolation' });
  const env = topic('environments', [opt('dp', { label: 'Dev and prod' })], { title: 'Environments' });

  it('writes the heading, summary and omits empty sections', () => {
    const pack = packOf([layers, iso, env]);
    const md = renderAdr(pack, sessionOf([rec(layers, ['three']), rec(iso, ['a']), rec(env, ['dp'])], { facilitator: 'Sam' }), TODAY);
    expect(md).toContain('# Architecture Decision Record\n\n## Acme · Test Platform · 2026-10-18\n\n_Pack release 1.0.0 · prepared with Sam_');
    expect(md).toContain('3 of 3 topics were decided, 0 left open and 0 parked. The platform uses Three, isolated by Per layer, with Dev and prod.');
    expect(md).not.toContain('## Open items');
    expect(md).not.toContain('## Parked');
    expect(md).not.toContain('depart');
    expect(md).toContain('## Appendix: sources\n\nNo sources cited.');
    expect(md.endsWith('\n')).toBe(true);
  });

  it('says "not yet decided" and lists unvisited, open and parked topics', () => {
    const extra = topic('extra', [opt('a')], { title: 'Extra' });
    const park = topic('park', [opt('a')], { title: 'Park me' });
    const pack = packOf([layers, iso, env, extra, park]);
    const md = renderAdr(pack, sessionOf([rec(layers, ['three']), rec(extra, [], { status: 'open', notes: 'ask the CIO' }), rec(park, [], { status: 'parked', notes: 'phase 2' })]), TODAY);
    expect(md).toContain('1 of 5 topics were decided, 3 left open and 1 parked.');
    expect(md).toContain('isolated by not yet decided, with not yet decided.');
    expect(md).toContain('## Open items\n\n### Isolation\n\n**Status:** Open, no decision recorded.');
    expect(md).toContain('### Extra\n\n**Status:** Open, no decision recorded.\n\nask the CIO');
    expect(md).toContain('## Parked for a later phase\n\n### Park me\n\n**Status:** Parked for a later phase.\n\n**Reason:** phase 2');
  });

  it('counts proposed topics only when show_proposed is on', () => {
    const prop = topic('prop', [opt('a')], { status: 'proposed', title: 'Proposed one' });
    const pack = packOf([layers, prop]);
    const s = sessionOf([rec(layers, ['three'])]);
    expect(renderAdr(pack, s, TODAY)).toContain('1 of 1 topics');
    expect(renderAdr(pack, { ...s, show_proposed: true }, TODAY)).toContain('1 of 2 topics');
  });

  it('records a departure with and without a reason', () => {
    const pack = packOf([layers]);
    const withReason = renderAdr(pack, sessionOf([rec(layers, ['two'], { notes: 'Small estate' })]), TODAY);
    expect(withReason).toContain('**Context:** two was chosen. This departs from the suggested default (Three). Reason recorded: Small estate.');
    expect(withReason).toContain('1 decision departs from the suggested default: Layers.');
    expect(withReason).toContain('**Alternatives considered:** Three');
    expect(withReason).toContain('**Notes:** Small estate');
    const without = renderAdr(pack, sessionOf([rec(layers, ['two'])]), TODAY);
    expect(without).toContain('departs from the suggested default (Three). No reason was recorded.');
  });

  it('uses the topic context when the recommendation is followed, and option context when there is none', () => {
    const followed = renderAdr(packOf([layers]), sessionOf([rec(layers, ['three'])]), TODAY);
    expect(followed).toContain('**Context:** medallion_layers default context.');
    const free = topic('free', [opt('a'), opt('b')], { title: 'Free' });
    const md = renderAdr(packOf([free]), sessionOf([rec(free, ['a'])]), TODAY);
    expect(md).toContain('**Context:** a was chosen.');
  });

  it('multi-select counts as followed when it contains every recommended option', () => {
    const m = topic('m', [opt('a'), opt('b'), opt('c')], { decision_type: 'multi', recommendation: ['a', 'b'], title: 'Multi' });
    const pack = packOf([m]);
    expect(renderAdr(pack, sessionOf([rec(m, ['a', 'b', 'c'])]), TODAY)).toContain('**Context:** m default context.');
    expect(renderAdr(pack, sessionOf([rec(m, ['a', 'c'])]), TODAY)).toContain('departs from the suggested default (A; B)');
  });

  it('lists ruled-out options, warnings, maturity and needs-review options', () => {
    const base = topic('base', [opt('x'), opt('y')], { title: 'Base' });
    const t = topic(
      'rules',
      [
        opt('okay'),
        opt('hard', { requires: [{ decision_key: 'k.base', in: ['x'], severity: 'block', reason_id: 'needs_x' }] }),
        opt('soft', { maturity: 'preview', requires: [{ decision_key: 'k.base', in: ['x'], severity: 'warn', reason_id: 'prefer_x' }] }),
        opt('gone', { maturity: 'gated', requires: [{ decision_key: 'k.base', in: ['x'], severity: 'block', reason_id: 'needs_x' }] }),
      ],
      { decision_type: 'multi', title: 'Rules', rule_reasons: { needs_x: 'Base must be X', prefer_x: 'X is preferred' } },
    );
    const md = renderAdr(packOf([base, t]), sessionOf([rec(base, ['y']), rec(t, ['okay', 'soft', 'gone'])]), TODAY);
    expect(md).toContain('**Not available (ruled out by earlier decisions):** HARD — Base must be X');
    expect(md).toContain('**Warnings:** SOFT — X is preferred');
    expect(md).toContain('**Needs review (now ruled out by an earlier decision):** GONE — Base must be X');
    expect(md).toContain('**Maturity:** SOFT: preview; GONE: gated');
    expect(md).toContain('2 options rely on features in preview or gated access: SOFT, GONE.');
    expect(md).toContain('1 choice carries a warning: Rules.');
    expect(md.split('### Rules')[1]).not.toContain('**Alternatives considered:**');
  });

  it('renders value fields and modifiers, and cites sources once', () => {
    const s1 = { url: 'https://learn.microsoft.com/a', title: 'Doc A' };
    const t = topic(
      'reg',
      [
        opt('p', {
          sources: [s1],
          value_fields: [
            { id: 'region', type: 'select', required: true, choices_ref: 'regions' },
            { id: 'owner', type: 'text', required: true },
            { id: 'skip', type: 'text', required: false },
          ],
          value_field_labels: { region: { label: 'Region' }, owner: { label: 'Owner' } },
        }),
        opt('q', { sources: [s1, { url: 'https://learn.microsoft.com/b', title: 'Doc B' }] }),
      ],
      {
        title: 'Region topic',
        decision_type: 'multi',
        modifiers: [
          { id: 'mod', decision_key: 'k.mod', on_value: 'on', off_value: 'off', title: 'Landing zone', label: '', hint: '', on_adr_context: 'Landing is on.', off_adr_context: 'Landing is off.' },
        ],
      },
    );
    const pack = { ...packOf([t]), choices: { regions: [{ value: 'we', label: 'West Europe' }] } };
    const md = renderAdr(pack, sessionOf([rec(t, ['p', 'q'], { values: { region: 'we' }, modifiers: { mod: true } })]), TODAY);
    expect(md).toContain('**Decision:** P; Q\n\n- Region: West Europe\n- Owner: (not set)\n- Landing zone: On');
    expect(md).not.toContain('skip');
    expect(md).toContain('Landing is on.');
    expect(md).not.toContain('Landing is off.');
    expect(md.match(/learn\.microsoft\.com\/a/g)).toHaveLength(1);
    expect(md).toContain('- [Doc B](https://learn.microsoft.com/b)');
  });

  it('renders the naming topic as a table and marks defaults', () => {
    const n = topic('naming', [], {
      title: 'Naming',
      mode: 'naming',
      renderer: 'naming_form',
      decision_type: 'confirm',
      naming_sections: [
        { id: 'ws', title: 'Workspaces', blurb: '', fields: [
          { id: 'prod', label: 'Prod', hint: '', default: 'ws-{env}' },
          { id: 'dev', label: 'Dev|Test', hint: '', default: 'dev-{x}' },
        ] },
      ],
    });
    const md = renderAdr(packOf([n]), sessionOf([rec(n, [], { naming: { prod: 'acme-prod' } })]), TODAY);
    expect(md).toContain('**Decision:** Confirmed');
    expect(md).toContain('| Section | Field | Agreed pattern |\n| --- | --- | --- |\n| Workspaces | Prod | acme-prod |\n| Workspaces | Dev\\|Test | dev-{x} (default) |');
  });

  it('is deterministic', () => {
    const pack = packOf([layers]);
    const s = sessionOf([rec(layers, ['two'])]);
    expect(renderAdr(pack, s, TODAY)).toBe(renderAdr(pack, s, TODAY));
  });
});
