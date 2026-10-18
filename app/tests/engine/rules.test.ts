import { describe, expect, it } from 'vitest';
import {
  canSignOff,
  effectiveRecommendation,
  evaluate,
  needsReview,
} from '../../src/engine/rules';
import type { Requirement, Topic } from '../../src/packs/types';
import { opt, packOf, rec, sessionOf, topic } from './helpers';

const single = topic('src', [opt('a'), opt('b'), opt('c')], { title: 'Source' });
const multi = topic('feat', [opt('x'), opt('y'), opt('z')], { decision_type: 'multi', title: 'Features' });
const withMod = topic('base', [opt('p'), opt('q')], {
  title: 'Base',
  modifiers: [
    {
      id: 'zone',
      decision_key: 'k.zone',
      on_value: 'zone_on',
      off_value: 'zone_off',
      title: 'Zone',
      label: 'Zone',
      hint: '',
      on_adr_context: '',
      off_adr_context: '',
    },
  ],
});

/** A topic with one option "gated" carrying the requirement under test. */
function gated(req: Omit<Requirement, 'reason_id'>, severity: 'block' | 'warn' = 'block') {
  return topic('gated', [opt('gated', { requires: [{ ...req, severity, reason_id: 'why' }] })], {
    title: 'Gated',
    rule_reasons: { why: 'because of the earlier choice' },
  });
}

function stateFor(req: Omit<Requirement, 'reason_id' | 'severity'>, decisions: ReturnType<typeof rec>[], severity: 'block' | 'warn' = 'block') {
  const g = gated({ ...req, severity }, severity);
  const pack = packOf([single, multi, withMod, g]);
  return evaluate(pack, g, g.options[0]!, sessionOf(decisions));
}

describe('evaluate: operators', () => {
  it('in: met when the single value is listed', () => {
    expect(stateFor({ decision_key: 'k.src', in: ['a', 'b'] }, [rec(single, ['a'])]).state).toBe('ok');
  });
  it('in: unmet when the value is not listed', () => {
    const r = stateFor({ decision_key: 'k.src', in: ['a', 'b'] }, [rec(single, ['c'])]);
    expect(r).toEqual({ state: 'blocked', reasons: ['because of the earlier choice'] });
  });
  it('not_in: met when the value is absent from the list', () => {
    expect(stateFor({ decision_key: 'k.src', not_in: ['c'] }, [rec(single, ['a'])]).state).toBe('ok');
  });
  it('not_in: unmet when the value is listed', () => {
    expect(stateFor({ decision_key: 'k.src', not_in: ['c'] }, [rec(single, ['c'])]).state).toBe('blocked');
  });
  it('any_of: met when any chosen value is listed', () => {
    expect(stateFor({ decision_key: 'k.feat', any_of: ['y', 'z'] }, [rec(multi, ['x', 'y'])]).state).toBe('ok');
  });
  it('any_of: unmet when no chosen value is listed', () => {
    expect(stateFor({ decision_key: 'k.feat', any_of: ['z'] }, [rec(multi, ['x', 'y'])]).state).toBe('blocked');
  });
  it('none_of: met when no chosen value is listed', () => {
    expect(stateFor({ decision_key: 'k.feat', none_of: ['z'] }, [rec(multi, ['x', 'y'])]).state).toBe('ok');
  });
  it('none_of: unmet when any chosen value is listed', () => {
    expect(stateFor({ decision_key: 'k.feat', none_of: ['y'] }, [rec(multi, ['x', 'y'])]).state).toBe('blocked');
  });
});

describe('evaluate: severity and precedence', () => {
  it('warn severity gives state warn with the reason', () => {
    const r = stateFor({ decision_key: 'k.src', in: ['a'] }, [rec(single, ['b'])], 'warn');
    expect(r).toEqual({ state: 'warn', reasons: ['because of the earlier choice'] });
  });

  it('pending when the referenced decision is not visited, open or parked', () => {
    const none = stateFor({ decision_key: 'k.src', in: ['a'] }, []);
    expect(none).toEqual({ state: 'pending', reasons: ['Depends on Source, not decided yet'] });
    const open = stateFor({ decision_key: 'k.src', in: ['a'] }, [rec(single, [], { status: 'open' })]);
    expect(open.state).toBe('pending');
    const parked = stateFor({ decision_key: 'k.src', in: ['a'] }, [rec(single, ['a'], { status: 'parked' })]);
    expect(parked.state).toBe('pending');
  });

  it('modifier keys resolve to on_value or off_value', () => {
    const on = stateFor({ decision_key: 'k.zone', in: ['zone_on'] }, [rec(withMod, ['p'], { modifiers: { zone: true } })]);
    const off = stateFor({ decision_key: 'k.zone', in: ['zone_on'] }, [rec(withMod, ['p'], { modifiers: { zone: false } })]);
    const unset = stateFor({ decision_key: 'k.zone', in: ['zone_off'] }, [rec(withMod, ['p'])]);
    expect(on.state).toBe('ok');
    expect(off.state).toBe('blocked');
    expect(unset.state).toBe('ok');
    expect(stateFor({ decision_key: 'k.zone', in: ['zone_on'] }, []).reasons).toEqual(['Depends on Base, not decided yet']);
  });

  it('blocked beats warn beats pending, and all reasons are kept', () => {
    const t = topic('multi_rule', [
      opt('o', {
        requires: [
          { decision_key: 'k.src', in: ['a'], severity: 'warn', reason_id: 'w' },
          { decision_key: 'k.feat', any_of: ['z'], severity: 'block', reason_id: 'b' },
          { decision_key: 'k.never', in: ['q'], severity: 'block', reason_id: 'n' },
        ],
      }),
    ], { rule_reasons: { w: 'warn reason', b: 'block reason' } });
    const pack = packOf([single, multi, t]);
    const s = sessionOf([rec(single, ['b']), rec(multi, ['x'])]);
    expect(evaluate(pack, t, t.options[0]!, s)).toEqual({
      state: 'blocked',
      reasons: ['warn reason', 'block reason', 'Depends on k.never, not decided yet'],
    });
    const s2 = sessionOf([rec(single, ['b']), rec(multi, ['z'])]);
    expect(evaluate(pack, t, t.options[0]!, s2).state).toBe('warn');
    const s3 = sessionOf([rec(single, ['a']), rec(multi, ['z'])]);
    expect(evaluate(pack, t, t.options[0]!, s3).state).toBe('pending');
  });

  it('an option without requirements is ok', () => {
    const pack = packOf([single]);
    expect(evaluate(pack, single, single.options[0]!, sessionOf([]))).toEqual({ state: 'ok', reasons: [] });
  });
});

describe('needsReview', () => {
  const dep = topic('dep', [opt('r', { requires: [{ decision_key: 'k.src', in: ['a'], severity: 'block', reason_id: 'why' }] }), opt('s')], {
    rule_reasons: { why: 'needs a' },
  });
  const pack = packOf([single, dep]);

  it('flags a decided topic whose chosen option became blocked', () => {
    const s = sessionOf([rec(single, ['b']), rec(dep, ['r'])]);
    expect(needsReview(pack, dep, s)).toBe(true);
  });
  it('does not flag when the chosen option is fine, warn-only or pending', () => {
    expect(needsReview(pack, dep, sessionOf([rec(single, ['a']), rec(dep, ['r'])]))).toBe(false);
    expect(needsReview(pack, dep, sessionOf([rec(dep, ['r'])]))).toBe(false);
    expect(needsReview(pack, dep, sessionOf([rec(single, ['b']), rec(dep, ['s'])]))).toBe(false);
  });
  it('only looks at decided topics', () => {
    const s = sessionOf([rec(single, ['b']), rec(dep, ['r'], { status: 'parked' })]);
    expect(needsReview(pack, dep, s)).toBe(false);
  });
  it('stays flagged until the chosen option changes', () => {
    const s = sessionOf([rec(single, ['b']), rec(dep, ['r'])]);
    expect(needsReview(pack, dep, s)).toBe(true);
    expect(needsReview(pack, dep, sessionOf([rec(single, ['a']), rec(dep, ['r'])]))).toBe(false);
  });
});

describe('effectiveRecommendation', () => {
  const follow = topic('pattern', [opt('native'), opt('ext'), opt('both')], { title: 'Pattern' });
  const adaptive: Topic = topic('mode', [opt('mv'), opt('imp'), opt('dq', { requires: [{ decision_key: 'k.pattern', in: ['ext'], severity: 'block', reason_id: 'ext_only' }] })], {
    recommendation: ['imp'],
    adaptive_recommendation: { follows: 'k.pattern', map: { native: ['mv'], ext: ['imp', 'mv'], both: [] } },
    rule_reasons: { ext_only: 'DirectQuery needs an external BI tool' },
  });
  const pack = packOf([follow, adaptive]);

  it('uses the base recommendation until the followed decision is made', () => {
    expect(effectiveRecommendation(pack, adaptive, sessionOf([])).values).toEqual(['imp']);
  });
  it('replaces it with the mapped value', () => {
    expect(effectiveRecommendation(pack, adaptive, sessionOf([rec(follow, ['native'])])).values).toEqual(['mv']);
    expect(effectiveRecommendation(pack, adaptive, sessionOf([rec(follow, ['ext'])])).values).toEqual(['imp', 'mv']);
  });
  it('keeps the base when the mapped list is empty or the value is unmapped', () => {
    expect(effectiveRecommendation(pack, adaptive, sessionOf([rec(follow, ['both'])])).values).toEqual(['imp']);
  });
  it('shows no recommendation, with a note, when a recommended option is blocked', () => {
    const t = topic('blk', [opt('d', { requires: [{ decision_key: 'k.pattern', in: ['ext'], severity: 'block', reason_id: 'r' }] }), opt('e')], {
      recommendation: ['d'],
      rule_reasons: { r: 'the pattern rules it out' },
    });
    const p = packOf([follow, t]);
    expect(effectiveRecommendation(p, t, sessionOf([rec(follow, ['native'])]))).toEqual({
      values: [],
      note: 'The usual default is ruled out by the pattern rules it out',
    });
    expect(effectiveRecommendation(p, t, sessionOf([rec(follow, ['ext'])])).values).toEqual(['d']);
  });
  it('a topic without a recommendation stays empty', () => {
    expect(effectiveRecommendation(pack, follow, sessionOf([])).values).toEqual([]);
  });
});

describe('canSignOff', () => {
  const req = topic('req', [opt('a')], { required: true });
  const opt1 = topic('optional', [opt('a')]);
  const prop = topic('prop', [opt('a')], { required: true, status: 'proposed' });
  const pack = packOf([req, opt1, prop]);

  it('needs every required core topic to have a record', () => {
    expect(canSignOff(pack, sessionOf([]))).toEqual({ ok: false, missing: ['req'], needsReview: [] });
  });
  it('accepts decided, open and parked', () => {
    for (const status of ['decided', 'open', 'parked'] as const) {
      expect(canSignOff(pack, sessionOf([rec(req, status === 'decided' ? ['a'] : [], { status })])).ok).toBe(true);
    }
  });
  it('counts required proposed topics only when show_proposed is on', () => {
    const s = sessionOf([rec(req, ['a'])]);
    expect(canSignOff(pack, s).ok).toBe(true);
    expect(canSignOff(pack, { ...s, show_proposed: true })).toEqual({ ok: false, missing: ['prop'], needsReview: [] });
  });
  it('is blocked while a topic needs review', () => {
    const dep = topic('dep', [opt('r', { requires: [{ decision_key: 'k.req', in: ['zzz'], severity: 'block', reason_id: 'x' }] })], { required: true });
    const p = packOf([req, dep]);
    const r = canSignOff(p, sessionOf([rec(req, ['a']), rec(dep, ['r'])]));
    expect(r).toEqual({ ok: false, missing: [], needsReview: ['dep'] });
  });
});
