import { useCallback, useEffect, useRef, useState } from 'react';
import type { Pack, Session } from '../packs/types';
import { Canvas } from './Canvas';
import { WorkshopContext, useWide, useWorkshop, type Workshop } from './context';
import { Landing } from './Landing';
import { PartIntro } from './PartIntro';
import { Rail } from './Rail';
import { SignOff } from './SignOff';
import { createStorage } from './storage/indexeddb';
import { TopicPage } from './TopicPage';
import { hrefs, useHashRoute, type Route } from './useHashRoute';
import { loadPackById } from './packs';
import { buildCanvas } from '../engine/canvas';

const storage = createStorage();

type Theme = 'auto' | 'light' | 'dark';

function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const t = localStorage.getItem('dws.theme');
      if (t === 'light' || t === 'dark') return t;
    } catch {
      /* storage unavailable */
    }
    return 'auto';
  });
  useEffect(() => {
    const el = document.documentElement;
    if (theme === 'auto') el.removeAttribute('data-theme');
    else el.setAttribute('data-theme', theme);
    try {
      if (theme === 'auto') localStorage.removeItem('dws.theme');
      else localStorage.setItem('dws.theme', theme);
    } catch {
      /* storage unavailable */
    }
  }, [theme]);
  const next = () => setTheme((t) => (t === 'auto' ? 'light' : t === 'light' ? 'dark' : 'auto'));
  return [theme, next];
}

type Loaded =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; pack: Pack; session: Session };

function SessionLoader({ route }: { route: Exclude<Route, { name: 'home' }> }) {
  const sid = route.sid;
  const [state, setState] = useState<Loaded>({ status: 'loading' });
  const sessionRef = useRef<Session | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    (async () => {
      const session = await storage.load(sid);
      if (!session) throw new Error('No saved session with this id on this device.');
      const pack = await loadPackById(session.pack);
      if (cancelled) return;
      sessionRef.current = session;
      setState({ status: 'ready', pack, session });
    })().catch((e: unknown) => {
      if (!cancelled) setState({ status: 'error', message: e instanceof Error ? e.message : String(e) });
    });
    return () => {
      cancelled = true;
    };
  }, [sid]);

  const apply = useCallback((fn: (s: Session) => Session) => {
    const cur = sessionRef.current;
    if (!cur) return;
    let next: Session;
    try {
      next = fn(cur);
    } catch {
      return;
    }
    sessionRef.current = next;
    setState((st) => (st.status === 'ready' ? { ...st, session: next } : st));
    void storage.save(next);
  }, []);

  if (state.status === 'loading') return <p className="status-line" role="status">Loading session…</p>;
  if (state.status === 'error') {
    return (
      <div className="page narrow">
        <h1 tabIndex={-1}>Session not available</h1>
        <p role="alert">{state.message}</p>
        <p>
          <a href={hrefs.home()}>Back to the start page</a>
        </p>
      </div>
    );
  }
  const ws: Workshop = { pack: state.pack, session: state.session, apply, storage };
  return (
    <WorkshopContext.Provider value={ws}>
      <Shell route={route} />
    </WorkshopContext.Provider>
  );
}

function Shell({ route }: { route: Exclude<Route, { name: 'home' }> }) {
  const { pack, session } = useWorkshop();
  const wide = useWide();
  const showSide = route.name !== 'signoff';
  const model = buildCanvas(pack, session);

  const canvas = (
    <Canvas model={model} caption={`${pack.manifest.platform_label} canvas`} />
  );

  let page;
  if (route.name === 'part') page = <PartIntro n={route.n} />;
  else if (route.name === 'topic') page = <TopicPage tid={route.tid} />;
  else page = <SignOff />;

  return (
    <div className={`shell${wide && showSide ? ' shell-3' : wide ? ' shell-2' : ''}`}>
      {wide ? (
        <div className="side no-print">
          <Rail route={route} />
        </div>
      ) : (
        <details className="collapsible no-print">
          <summary>Progress</summary>
          <Rail route={route} />
        </details>
      )}
      <main id="main" className="main">
        {session.locked && (
          <div className="banner banner-info no-print" role="status">
            This session is signed off and locked. Unlock it on the{' '}
            <a href={hrefs.signoff(session.session_id)}>sign-off page</a> to make changes.
          </div>
        )}
        {page}
      </main>
      {showSide &&
        (wide ? (
          <aside className="side no-print" aria-label="Canvas">
            <h2 className="side-title">Canvas</h2>
            {canvas}
          </aside>
        ) : (
          <details className="collapsible no-print">
            <summary>Canvas</summary>
            {canvas}
          </details>
        ))}
    </div>
  );
}

export function App() {
  const { route, hash } = useHashRoute();
  const [theme, cycleTheme] = useTheme();

  useEffect(() => {
    // Move focus to the page heading after navigation, so keyboard and screen reader users land on it.
    const t = setTimeout(() => {
      const h = document.querySelector<HTMLElement>('main h1, #main h1');
      h?.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    }, 50);
    return () => clearTimeout(t);
  }, [hash]);

  return (
    <>
      <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.querySelector<HTMLElement>('h1')?.focus(); }}>
        Skip to content
      </a>
      <header className="topbar no-print">
        <a className="brand" href={hrefs.home()}>
          Decision workshop
        </a>
        <button type="button" className="btn btn-quiet" onClick={cycleTheme} aria-label={`Theme: ${theme}. Change theme`}>
          Theme: {theme}
        </button>
      </header>
      {route.name === 'home' ? (
        <main id="main" className="main">
          <Landing storage={storage} />
        </main>
      ) : (
        <SessionLoader key={route.sid} route={route} />
      )}
    </>
  );
}
