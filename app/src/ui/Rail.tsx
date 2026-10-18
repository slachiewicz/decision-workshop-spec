import { findRecord, needsReview, visibleTopics } from '../engine/rules';
import type { Topic } from '../packs/types';
import { nowIso, useWorkshop } from './context';
import { hrefs, type Route } from './useHashRoute';

export type TopicStatus = 'decided' | 'open' | 'parked' | 'new' | 'review';

const STATUS_TEXT: Record<TopicStatus, string> = {
  decided: 'Decided',
  open: 'Left open',
  parked: 'Parked',
  new: 'Not visited',
  review: 'Needs review',
};

export function useTopicStatus() {
  const { pack, session } = useWorkshop();
  return (t: Topic): TopicStatus => {
    if (needsReview(pack, t, session)) return 'review';
    return findRecord(session, t.id)?.status ?? 'new';
  };
}

export function StatusDot({ status }: { status: TopicStatus }) {
  return (
    <>
      <span className={`dot dot-${status}`} aria-hidden="true" />
      <span className="sr">{STATUS_TEXT[status]}: </span>
    </>
  );
}

export function statusText(s: TopicStatus): string {
  return STATUS_TEXT[s];
}

export function Rail({ route }: { route: Exclude<Route, { name: 'home' }> }) {
  const { pack, session, apply } = useWorkshop();
  const statusOf = useTopicStatus();
  const visible = visibleTopics(pack, session);
  const visibleIds = new Set(visible.map((t) => t.id));
  const byId = new Map(pack.topics.map((t) => [t.id, t]));
  const done = visible.filter((t) => statusOf(t) !== 'new').length;
  const sid = session.session_id;
  const current = route.name === 'topic' ? route.tid : '';

  const groups = pack.manifest.groups
    .map((g) => ({ g, topics: g.topics.filter((id) => visibleIds.has(id)).map((id) => byId.get(id)!) }))
    .filter((x) => x.topics.length > 0);
  // Topics the manifest groups do not list still need a place in the rail.
  const listed = new Set(groups.flatMap((x) => x.topics.map((t) => t.id)));
  const extra = visible.filter((t) => !listed.has(t.id));

  return (
    <nav aria-label="Progress" className="rail">
      <p className="rail-count">
        <strong>{session.client_name}</strong>
        <span className="muted block">
          {done} of {visible.length} topics visited
        </span>
        <progress max={visible.length || 1} value={done} aria-label="Topics visited" />
      </p>
      {groups.map(({ g, topics }) => (
        <div key={g.part} className="rail-group">
          <h3>
            <a href={hrefs.part(sid, g.part)} aria-current={route.name === 'part' && route.n === g.part ? 'page' : undefined}>
              Part {g.part}: {g.title}
            </a>
          </h3>
          <ol>
            {topics.map((t) => (
              <li key={t.id}>
                <a href={hrefs.topic(sid, t.id)} aria-current={t.id === current ? 'page' : undefined}>
                  <StatusDot status={statusOf(t)} />
                  {t.title}
                </a>
              </li>
            ))}
          </ol>
        </div>
      ))}
      {extra.length > 0 && (
        <div className="rail-group">
          <h3>More topics</h3>
          <ol>
            {extra.map((t) => (
              <li key={t.id}>
                <a href={hrefs.topic(sid, t.id)} aria-current={t.id === current ? 'page' : undefined}>
                  <StatusDot status={statusOf(t)} />
                  {t.title}
                </a>
              </li>
            ))}
          </ol>
        </div>
      )}
      <p>
        <a className="btn btn-block" href={hrefs.signoff(sid)} aria-current={route.name === 'signoff' ? 'page' : undefined}>
          Sign-off and export
        </a>
      </p>
      <label className="check small">
        <input
          type="checkbox"
          checked={session.show_proposed}
          disabled={session.locked}
          onChange={(e) => apply((s) => ({ ...s, show_proposed: e.target.checked, updated_at: nowIso() }))}
        />
        <span>Show proposed decisions</span>
      </label>
    </nav>
  );
}
