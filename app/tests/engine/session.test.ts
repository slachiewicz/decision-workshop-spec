import { describe, expect, it } from 'vitest';
import {
  MemoryStorage,
  SessionImportError,
  exportFileName,
  exportSession,
  importSession,
  lockSession,
  newSession,
  setDecision,
} from '../../src/engine/session';
import { opt, packOf, topic } from './helpers';

const t = topic('src', [opt('a'), opt('b')], { required: true });
const pack = packOf([t]);
const NOW = '2026-10-18T09:00:00Z';
const LATER = '2026-10-18T09:30:00Z';

describe('newSession and setDecision', () => {
  it('creates an empty session from the pack', () => {
    const s = newSession(pack, { session_id: 'x', client_name: 'Acme', now: NOW, facilitator: 'Sam' });
    expect(s).toMatchObject({
      kind: 'decision-workshop-session',
      schema_version: 1,
      pack: 'test',
      pack_release: '1.0.0',
      facilitator: 'Sam',
      show_proposed: false,
      decisions: [],
      locked: false,
      created_at: NOW,
      updated_at: NOW,
    });
    expect('facilitator' in newSession(pack, { session_id: 'x', client_name: 'A', now: NOW })).toBe(false);
  });

  it('upserts a record without mutating the input', () => {
    const s0 = newSession(pack, { session_id: 'x', client_name: 'Acme', now: NOW });
    const s1 = setDecision(s0, t, { status: 'decided', chosen: ['a'] }, LATER);
    expect(s0.decisions).toHaveLength(0);
    expect(s1.decisions).toHaveLength(1);
    expect(s1.decisions[0]).toMatchObject({ topic_id: 'src', decision_key: 'k.src', chosen: ['a'], decided_at: LATER });
    expect(s1.updated_at).toBe(LATER);
    const s2 = setDecision(s1, t, { notes: 'because' }, '2026-10-18T10:00:00Z');
    expect(s2.decisions).toHaveLength(1);
    expect(s2.decisions[0]).toMatchObject({ chosen: ['a'], notes: 'because', decided_at: '2026-10-18T10:00:00Z' });
  });

  it('refuses edits once locked', () => {
    const s = setDecision(newSession(pack, { session_id: 'x', client_name: 'Acme', now: NOW }), t, { status: 'decided', chosen: ['a'] }, NOW);
    const locked = lockSession(pack, s, LATER);
    expect(locked.locked).toBe(true);
    expect(() => setDecision(locked, t, { notes: 'x' }, LATER)).toThrow('locked');
  });

  it('refuses to lock while sign-off is not allowed', () => {
    expect(() => lockSession(pack, newSession(pack, { session_id: 'x', client_name: 'Acme', now: NOW }), LATER)).toThrow();
  });
});

describe('export and import', () => {
  const s = setDecision(newSession(pack, { session_id: 'x', client_name: 'Café Ltd.', now: NOW }), t, { status: 'decided', chosen: ['b'] }, LATER);

  it('round-trips', () => {
    expect(importSession(exportSession(s))).toEqual(s);
  });
  it('wraps the session with kind and schema_version', () => {
    expect(JSON.parse(exportSession(s))).toMatchObject({ kind: 'decision-workshop-session', schema_version: 1 });
  });
  it('rejects bad input', () => {
    const file = JSON.parse(exportSession(s));
    expect(() => importSession('{nope')).toThrow(SessionImportError);
    expect(() => importSession(JSON.stringify({ ...file, kind: 'other' }))).toThrow(/Not a decision workshop/);
    expect(() => importSession(JSON.stringify({ ...file, schema_version: 2 }))).toThrow(/schema_version/);
    expect(() => importSession(JSON.stringify({ ...file, session: { ...file.session, schema_version: 2 } }))).toThrow(SessionImportError);
    expect(() => importSession(JSON.stringify({ ...file, session: { ...file.session, decisions: 'x' } }))).toThrow(/decisions/);
    expect(() => importSession('[]')).toThrow(SessionImportError);
  });
  it('names the file <pack>-<client-slug>-<date>.json', () => {
    expect(exportFileName(s, '2026-10-18')).toBe('test-cafe-ltd-2026-10-18.json');
  });
});

describe('MemoryStorage', () => {
  it('saves, loads, lists and removes copies', async () => {
    const store = new MemoryStorage();
    const s = newSession(pack, { session_id: 'one', client_name: 'Acme', now: NOW });
    await store.save(s);
    await store.save(newSession(pack, { session_id: 'two', client_name: 'Beta', now: LATER }));
    const loaded = await store.load('one');
    expect(loaded).toEqual(s);
    loaded!.client_name = 'changed';
    expect((await store.load('one'))!.client_name).toBe('Acme');
    expect((await store.list()).map((x) => x.session_id)).toEqual(['two', 'one']);
    await store.remove('one');
    expect(await store.load('one')).toBeUndefined();
    expect(await store.list()).toHaveLength(1);
  });
});
