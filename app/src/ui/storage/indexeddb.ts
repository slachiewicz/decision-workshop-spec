// StorageAdapter chain: IndexedDB, then localStorage (`dws.session.<id>`), then memory.
// Every call is wrapped so a failing backend never breaks the app.
import { MemoryStorage, type SessionSummary, type StorageAdapter } from '../../engine/session';
import type { Session } from '../../packs/types';

const DB = 'decision-workshop';
const STORE = 'sessions';

function summary(s: Session): SessionSummary {
  return { session_id: s.session_id, pack: s.pack, client_name: s.client_name, updated_at: s.updated_at };
}

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error('IndexedDB request failed'));
  });
}

export class IndexedDbStorage implements StorageAdapter {
  private dbPromise: Promise<IDBDatabase> | undefined;

  private db(): Promise<IDBDatabase> {
    this.dbPromise ??= new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB unavailable'));
      const open = indexedDB.open(DB, 1);
      open.onupgradeneeded = () => open.result.createObjectStore(STORE, { keyPath: 'session_id' });
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error ?? new Error('IndexedDB open failed'));
      open.onblocked = () => reject(new Error('IndexedDB blocked'));
    });
    // A one-time failure must not stick: let the next call try to open again.
    this.dbPromise.catch(() => {
      this.dbPromise = undefined;
    });
    return this.dbPromise;
  }

  private async store(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    return (await this.db()).transaction(STORE, mode).objectStore(STORE);
  }

  async load(id: string): Promise<Session | undefined> {
    return (await req((await this.store('readonly')).get(id))) as Session | undefined;
  }

  async save(session: Session): Promise<void> {
    await req((await this.store('readwrite')).put(session));
  }

  async list(): Promise<SessionSummary[]> {
    const all = (await req((await this.store('readonly')).getAll())) as Session[];
    return all.map(summary).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }

  async remove(id: string): Promise<void> {
    await req((await this.store('readwrite')).delete(id));
  }
}

const PREFIX = 'dws.session.';

export class LocalStorageAdapter implements StorageAdapter {
  async load(id: string): Promise<Session | undefined> {
    const raw = localStorage.getItem(PREFIX + id);
    return raw ? (JSON.parse(raw) as Session) : undefined;
  }

  async save(session: Session): Promise<void> {
    localStorage.setItem(PREFIX + session.session_id, JSON.stringify(session));
  }

  async list(): Promise<SessionSummary[]> {
    const out: SessionSummary[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(PREFIX)) continue;
      try {
        out.push(summary(JSON.parse(localStorage.getItem(key) ?? '') as Session));
      } catch {
        /* skip a corrupt entry */
      }
    }
    return out.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }

  async remove(id: string): Promise<void> {
    localStorage.removeItem(PREFIX + id);
  }
}

/**
 * Saves to the first adapter that works. Reads look across all of them, so a session saved to
 * localStorage after a transient IndexedDB error is still found, newest copy winning.
 */
export class ChainStorage implements StorageAdapter {
  constructor(private readonly adapters: StorageAdapter[]) {}

  async load(id: string): Promise<Session | undefined> {
    let best: Session | undefined;
    for (const a of this.adapters) {
      try {
        const s = await a.load(id);
        if (s && (!best || s.updated_at > best.updated_at)) best = s;
      } catch {
        /* try the next adapter */
      }
    }
    return best;
  }

  async save(session: Session): Promise<void> {
    for (const a of this.adapters) {
      try {
        await a.save(session);
        return;
      } catch {
        /* try the next adapter */
      }
    }
  }

  async list(): Promise<SessionSummary[]> {
    const byId = new Map<string, SessionSummary>();
    for (const a of this.adapters) {
      try {
        for (const item of await a.list()) {
          const seen = byId.get(item.session_id);
          if (!seen || item.updated_at > seen.updated_at) byId.set(item.session_id, item);
        }
      } catch {
        /* try the next adapter */
      }
    }
    return [...byId.values()].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }

  async remove(id: string): Promise<void> {
    for (const a of this.adapters) {
      try {
        await a.remove(id);
      } catch {
        /* keep going */
      }
    }
  }
}

export function createStorage(): StorageAdapter {
  return new ChainStorage([new IndexedDbStorage(), new LocalStorageAdapter(), new MemoryStorage()]);
}
