import { createContext, useContext, useSyncExternalStore } from 'react';
import type { StorageAdapter } from '../engine/session';
import type { Pack, Session } from '../packs/types';

export interface Workshop {
  pack: Pack;
  session: Session;
  /** Replace the session with `fn(latest)` and persist it. */
  apply: (fn: (s: Session) => Session) => void;
  storage: StorageAdapter;
}

export const WorkshopContext = createContext<Workshop | null>(null);

export function useWorkshop(): Workshop {
  const w = useContext(WorkshopContext);
  if (!w) throw new Error('useWorkshop outside a session');
  return w;
}

export const nowIso = () => new Date().toISOString();

/** Local calendar date, YYYY-MM-DD. */
export function today(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function newId(): string {
  try {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {
    /* insecure context */
  }
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

const WIDE = '(min-width: 1100px)';
export function useWide(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(WIDE);
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    },
    () => window.matchMedia(WIDE).matches,
    () => false,
  );
}

export function download(name: string, mime: string, text: string): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
