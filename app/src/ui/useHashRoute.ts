import { useCallback, useSyncExternalStore } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'part'; sid: string; n: number }
  | { name: 'topic'; sid: string; tid: string }
  | { name: 'signoff'; sid: string };

export function parseHash(hash: string): Route {
  const parts = hash
    .replace(/^#\/?/, '')
    .split('/')
    .filter(Boolean)
    .map((p) => {
      try {
        return decodeURIComponent(p);
      } catch {
        return p;
      }
    });
  if (parts[0] === 's' && parts[1]) {
    const sid = parts[1];
    if (parts[2] === 'part' && parts[3]) return { name: 'part', sid, n: Number(parts[3]) || 1 };
    if (parts[2] === 'topic' && parts[3]) return { name: 'topic', sid, tid: parts[3] };
    if (parts[2] === 'signoff') return { name: 'signoff', sid };
  }
  return { name: 'home' };
}

export const hrefs = {
  home: () => '#/',
  part: (sid: string, n: number) => `#/s/${encodeURIComponent(sid)}/part/${n}`,
  topic: (sid: string, tid: string) => `#/s/${encodeURIComponent(sid)}/topic/${encodeURIComponent(tid)}`,
  signoff: (sid: string) => `#/s/${encodeURIComponent(sid)}/signoff`,
};

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

export function useHashRoute(): { route: Route; hash: string; navigate: (href: string) => void } {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  const navigate = useCallback((href: string) => {
    window.location.hash = href.replace(/^#/, '');
  }, []);
  return { route: parseHash(hash), hash, navigate };
}
