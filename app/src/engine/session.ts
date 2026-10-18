// Session state helpers and storage (docs/CONTRACT.md §2). No clock, no randomness: the
// caller passes `now` and the session id.
import type { DecisionRecord, Pack, Session, Topic } from '../packs/types';
import { canSignOff } from './rules';

export interface NewSessionOptions {
  session_id: string;
  client_name: string;
  /** ISO timestamp. */
  now: string;
  facilitator?: string;
  show_proposed?: boolean;
}

export function newSession(pack: Pack, opts: NewSessionOptions): Session {
  const s: Session = {
    kind: 'decision-workshop-session',
    schema_version: 1,
    pack: pack.manifest.id,
    pack_release: pack.manifest.release,
    session_id: opts.session_id,
    client_name: opts.client_name,
    show_proposed: opts.show_proposed ?? false,
    decisions: [],
    locked: false,
    created_at: opts.now,
    updated_at: opts.now,
  };
  if (opts.facilitator) s.facilitator = opts.facilitator;
  return s;
}

export function blankRecord(topic: Topic): DecisionRecord {
  return {
    topic_id: topic.id,
    decision_key: topic.decision_key,
    status: 'open',
    chosen: [],
    values: {},
    modifiers: {},
    naming: {},
    option_notes: {},
    notes: '',
    decided_at: '',
  };
}

/**
 * Upsert the record for `topic`, merging `patch` over the existing record. `decided_at` is
 * set to `now` whenever the resulting status is 'decided' and the patch doesn't give one.
 * Returns a new session; the input is not mutated. A locked session rejects edits.
 */
export function setDecision(
  session: Session,
  topic: Topic,
  patch: Partial<Omit<DecisionRecord, 'topic_id' | 'decision_key'>>,
  now: string,
): Session {
  if (session.locked) throw new Error('Session is locked');
  const existing = session.decisions.find((d) => d.topic_id === topic.id);
  const rec: DecisionRecord = {
    ...(existing ?? blankRecord(topic)),
    ...patch,
    topic_id: topic.id,
    decision_key: topic.decision_key,
  };
  if (rec.status === 'decided' && patch.decided_at === undefined) rec.decided_at = now;
  const decisions = existing
    ? session.decisions.map((d) => (d.topic_id === topic.id ? rec : d))
    : [...session.decisions, rec];
  return { ...session, decisions, updated_at: now };
}

/** Lock the session when sign-off is allowed; throws otherwise. */
export function lockSession(pack: Pack, session: Session, now: string): Session {
  if (!canSignOff(pack, session).ok) throw new Error('Session cannot be signed off yet');
  return { ...session, locked: true, updated_at: now };
}

// ---- export and import ----

export interface ExportFile {
  kind: 'decision-workshop-session';
  schema_version: 1;
  session: Session;
}

export class SessionImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionImportError';
  }
}

export function exportSession(session: Session): string {
  const file: ExportFile = { kind: 'decision-workshop-session', schema_version: 1, session };
  return JSON.stringify(file, null, 2) + '\n';
}

/** `<pack>-<client-slug>-<YYYY-MM-DD>.json` */
export function exportFileName(session: Session, today: string): string {
  const slug =
    session.client_name
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'client';
  return `${session.pack}-${slug}-${today}.json`;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function importSession(text: string): Session {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new SessionImportError('Not a JSON file');
  }
  if (!isRecord(data) || data.kind !== 'decision-workshop-session') {
    throw new SessionImportError('Not a decision workshop session file');
  }
  if (data.schema_version !== 1) {
    throw new SessionImportError(`Unsupported schema_version ${String(data.schema_version)}`);
  }
  const s = data.session;
  if (!isRecord(s) || s.kind !== 'decision-workshop-session' || s.schema_version !== 1) {
    throw new SessionImportError('The session inside the file is malformed');
  }
  for (const k of ['pack', 'pack_release', 'session_id', 'client_name', 'created_at', 'updated_at']) {
    if (typeof s[k] !== 'string') throw new SessionImportError(`Session field "${k}" is missing`);
  }
  if (!Array.isArray(s.decisions)) throw new SessionImportError('Session field "decisions" is missing');
  for (const d of s.decisions) {
    if (!isRecord(d) || typeof d.topic_id !== 'string' || !Array.isArray(d.chosen)) {
      throw new SessionImportError('A decision record is malformed');
    }
  }
  return s as unknown as Session;
}

// ---- storage ----

export interface SessionSummary {
  session_id: string;
  pack: string;
  client_name: string;
  updated_at: string;
}

export interface StorageAdapter {
  load(id: string): Promise<Session | undefined>;
  save(session: Session): Promise<void>;
  list(): Promise<SessionSummary[]>;
  remove(id: string): Promise<void>;
}

export class MemoryStorage implements StorageAdapter {
  private readonly store = new Map<string, Session>();

  async load(id: string): Promise<Session | undefined> {
    const s = this.store.get(id);
    return s ? structuredClone(s) : undefined;
  }

  async save(session: Session): Promise<void> {
    this.store.set(session.session_id, structuredClone(session));
  }

  async list(): Promise<SessionSummary[]> {
    return [...this.store.values()]
      .map(({ session_id, pack, client_name, updated_at }) => ({ session_id, pack, client_name, updated_at }))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }

  async remove(id: string): Promise<void> {
    this.store.delete(id);
  }
}
