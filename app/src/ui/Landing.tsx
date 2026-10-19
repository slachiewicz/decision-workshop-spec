import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  importSession,
  newSession,
  type SessionSummary,
  type StorageAdapter,
} from '../engine/session';
import { newId, nowIso } from './context';
import { PACKS, loadPackById } from './packs';
import { hrefs } from './useHashRoute';

export function Landing({ storage }: { storage: StorageAdapter }) {
  const [packId, setPackId] = useState(PACKS[0]!.id);
  const [client, setClient] = useState('');
  const [facilitator, setFacilitator] = useState('');
  const [showProposed, setShowProposed] = useState(false);
  const [saved, setSaved] = useState<SessionSummary[]>([]);
  const [error, setError] = useState('');
  const [importError, setImportError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState('');
  const [notice, setNotice] = useState<{ text: string; href: string } | null>(null);

  const refresh = useCallback(() => {
    storage.list().then(setSaved, () => setSaved([]));
  }, [storage]);
  useEffect(refresh, [refresh]);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!client.trim()) {
      setError('Enter a client name to start.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const pack = await loadPackById(packId);
      const session = newSession(pack, {
        session_id: newId(),
        client_name: client.trim(),
        now: nowIso(),
        show_proposed: showProposed,
        ...(facilitator.trim() ? { facilitator: facilitator.trim() } : {}),
      });
      await storage.save(session);
      const first = pack.manifest.groups.find((g) => g.topics.some((id) => pack.topics.some((t) => t.id === id)));
      window.location.hash = hrefs.part(session.session_id, first?.part ?? 1).slice(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onImport(input: HTMLInputElement) {
    const file = input.files?.[0];
    if (!file) return;
    setImportError('');
    setNotice(null);
    try {
      const session = importSession(await file.text());
      if (!PACKS.some((p) => p.id === session.pack)) throw new Error(`This file uses an unknown pack "${session.pack}".`);
      const current = (await loadPackById(session.pack)).manifest.release;
      await storage.save(session);
      refresh();
      if (session.pack_release !== current) {
        setNotice({
          text: `This session was saved with pack release ${session.pack_release}; topics with changed options are marked Needs review.`,
          href: hrefs.part(session.session_id, 1),
        });
      } else {
        window.location.hash = hrefs.part(session.session_id, 1).slice(1);
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    } finally {
      // Let the same file be picked again.
      input.value = '';
    }
  }

  return (
    <div className="landing">
      <header className="hero">
        <span className="hero-pill">Microsoft Fabric and Databricks · 39 decisions</span>
        <h1 tabIndex={-1}>Decision workshop</h1>
        <p className="lead">
          Walk through the architecture decisions for a data platform, record what was agreed and why,
          and export a decision record at the end. Everything stays in this browser.
        </p>
        <ol className="steps">
          <li>
            <span className="step-n" aria-hidden="true">1</span>
            <span><strong>Pick a platform</strong>Fabric or Databricks, with vendor-sourced options.</span>
          </li>
          <li>
            <span className="step-n" aria-hidden="true">2</span>
            <span><strong>Decide together</strong>Defaults, trade-offs and rules that catch conflicts.</span>
          </li>
          <li>
            <span className="step-n" aria-hidden="true">3</span>
            <span><strong>Export the record</strong>An ADR in Markdown or PDF, plus a session file.</span>
          </li>
        </ol>
      </header>

      <section aria-labelledby="new-h" className="panel">
        <h2 id="new-h">Start a session</h2>
        <form onSubmit={create} noValidate>
          <fieldset className="plain">
            <legend>Platform</legend>
            <div className="choice-row">
              {PACKS.map((p) => (
                <label key={p.id} className={`choice${packId === p.id ? ' on' : ''}`} data-pack={p.id}>
                  <input type="radio" name="pack" value={p.id} checked={packId === p.id} onChange={() => setPackId(p.id)} />
                  <span>
                    <strong>{p.label}</strong>
                    <span className="muted block">{p.blurb}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="field">
            <label htmlFor="client">Client name</label>
            <input id="client" type="text" value={client} onChange={(e) => setClient(e.target.value)} autoComplete="off" required aria-required="true" />
          </div>
          <div className="field">
            <label htmlFor="facilitator">Facilitator (optional)</label>
            <input id="facilitator" type="text" value={facilitator} onChange={(e) => setFacilitator(e.target.value)} autoComplete="off" />
          </div>
          <label className="check">
            <input type="checkbox" checked={showProposed} onChange={(e) => setShowProposed(e.target.checked)} />
            <span>Show proposed decisions</span>
          </label>
          <p className="hint">Proposed topics are extra topics that are still being tested. Leave this off for a standard workshop.</p>
          {error && <p className="error" role="alert">{error}</p>}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Starting…' : 'Start session'}
          </button>
        </form>
      </section>

      <section aria-labelledby="saved-h" className="panel">
        <h2 id="saved-h">Saved sessions</h2>
        {saved.length === 0 ? (
          <p className="muted">No saved sessions on this device yet.</p>
        ) : (
          <ul className="session-list">
            {saved.map((s) => (
              <li key={s.session_id}>
                <div>
                  <strong>{s.client_name}</strong>
                  <span className="muted block">
                    {PACKS.find((p) => p.id === s.pack)?.label ?? s.pack} · updated {new Date(s.updated_at).toLocaleString()}
                  </span>
                </div>
                <div className="row">
                  <a className="btn" href={hrefs.part(s.session_id, 1)} aria-label={`Resume ${s.client_name}`}>
                    Resume
                  </a>
                  {confirmDelete === s.session_id ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={async () => {
                          await storage.remove(s.session_id);
                          setConfirmDelete('');
                          refresh();
                        }}
                      >
                        Confirm delete
                      </button>
                      <button type="button" className="btn btn-quiet" onClick={() => setConfirmDelete('')}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button type="button" className="btn btn-quiet" onClick={() => setConfirmDelete(s.session_id)} aria-label={`Delete ${s.client_name}`}>
                      Delete
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="imp-h" className="panel">
        <h2 id="imp-h">Import a session</h2>
        <div className="field">
          <label htmlFor="import">Session file (JSON)</label>
          <input id="import" type="file" accept=".json,application/json" onChange={(e) => void onImport(e.currentTarget)} />
        </div>
        {importError && <p className="error" role="alert">{importError}</p>}
        {notice && (
          <p className="hint" role="status">
            {notice.text} <a href={notice.href}>Open the session</a>
          </p>
        )}
      </section>
    </div>
  );
}
