import { renderAdr } from '../engine/adr';
import { buildCanvas } from '../engine/canvas';
import { canSignOff, findRecord, needsReview, visibleTopics } from '../engine/rules';
import { exportFileName, exportSession, lockSession } from '../engine/session';
import { Canvas } from './Canvas';
import { download, nowIso, today, useWorkshop } from './context';
import { markdownToHtml } from './markdown';
import { hrefs } from './useHashRoute';

export function SignOff() {
  const { pack, session, apply } = useWorkshop();
  const sid = session.session_id;
  const topics = visibleTopics(pack, session);
  const byId = new Map(topics.map((t) => [t.id, t]));
  const status = canSignOff(pack, session);
  const model = buildCanvas(pack, session);

  const counts = { decided: 0, open: 0, parked: 0, unvisited: 0, review: 0 };
  for (const t of topics) {
    const r = findRecord(session, t.id);
    if (needsReview(pack, t, session)) counts.review++;
    if (!r) counts.unvisited++;
    else counts[r.status]++;
  }

  const date = today();
  const md = () => renderAdr(pack, session, date);
  const base = exportFileName(session, date).replace(/\.json$/, '');

  const reasons: { id: string; text: string }[] = [
    ...status.missing.map((id) => ({ id, text: `${byId.get(id)?.title ?? id} is required and has no decision, parking or open note yet.` })),
    ...status.needsReview.map((id) => ({ id, text: `${byId.get(id)?.title ?? id} needs review: an earlier decision rules out its chosen option.` })),
  ];

  return (
    <>
      <div className="page no-print">
        <p className="eyebrow">{session.client_name}</p>
        <h1 tabIndex={-1}>Sign-off and export</h1>

        <h2>Where things stand</h2>
        <dl className="counts">
          <div>
            <dt>Decided</dt>
            <dd>{counts.decided}</dd>
          </div>
          <div>
            <dt>Left open</dt>
            <dd>{counts.open}</dd>
          </div>
          <div>
            <dt>Parked</dt>
            <dd>{counts.parked}</dd>
          </div>
          <div>
            <dt>Not visited</dt>
            <dd>{counts.unvisited}</dd>
          </div>
          <div>
            <dt>Need review</dt>
            <dd>{counts.review}</dd>
          </div>
        </dl>

        <h2>Platform canvas</h2>
        <div className="canvas-wide">
          <Canvas model={model} caption={`${pack.manifest.platform_label} canvas`} />
        </div>

        <h2>Export</h2>
        <div className="actions" role="group" aria-label="Export">
          <button type="button" className="btn" onClick={() => download(`${base}.md`, 'text/markdown;charset=utf-8', md())}>
            Download Markdown
          </button>
          <button type="button" className="btn" onClick={() => window.print()}>
            Print or save as PDF
          </button>
          <button type="button" className="btn" onClick={() => download(exportFileName(session, date), 'application/json', exportSession(session))}>
            Download JSON
          </button>
        </div>
        <p className="hint">The PDF uses your browser&apos;s print dialog. Choose &quot;Save as PDF&quot; as the destination.</p>

        <h2>Lock the session</h2>
        {session.locked ? (
          <>
            <p role="status">Signed off and locked. No further edits until it is unlocked.</p>
            <button type="button" className="btn" onClick={() => apply((s) => ({ ...s, locked: false, updated_at: nowIso() }))}>
              Unlock to edit
            </button>
          </>
        ) : (
          <>
            {reasons.length > 0 && (
              <div id="lock-reasons">
                <p>Sign-off is not available yet:</p>
                <ul>
                  {reasons.map((r) => (
                    <li key={r.id}>
                      <a href={hrefs.topic(sid, r.id)}>{r.text}</a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <button
              type="button"
              className="btn btn-primary"
              disabled={!status.ok}
              aria-describedby={reasons.length ? 'lock-reasons' : undefined}
              onClick={() => apply((s) => lockSession(pack, s, nowIso()))}
            >
              Lock session
            </button>
          </>
        )}
      </div>
      <div className="print-only adr" dangerouslySetInnerHTML={{ __html: markdownToHtml(md()) }} />
    </>
  );
}
