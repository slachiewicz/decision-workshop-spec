import { visibleTopics } from '../engine/rules';
import { useWorkshop } from './context';
import { StatusDot, useTopicStatus } from './Rail';
import { hrefs } from './useHashRoute';

export function PartIntro({ n }: { n: number }) {
  const { pack, session } = useWorkshop();
  const statusOf = useTopicStatus();
  const visible = visibleTopics(pack, session);
  const byId = new Map(visible.map((t) => [t.id, t]));
  const groups = pack.manifest.groups.filter((g) => g.topics.some((id) => byId.has(id)));
  const group = groups.find((g) => g.part === n) ?? groups[0];
  const sid = session.session_id;

  if (!group) {
    return (
      <div className="page">
        <h1 tabIndex={-1}>No topics yet</h1>
        <p>This pack has no topics with written content yet.</p>
      </div>
    );
  }
  const topics = group.topics.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
  const idx = groups.indexOf(group);
  const prev = groups[idx - 1];
  const next = groups[idx + 1];

  return (
    <div className="page">
      <p className="eyebrow">
        {session.client_name} · Part {group.part} of {pack.manifest.groups.length}
      </p>
      <h1 tabIndex={-1}>{group.title}</h1>
      <p className="lead">{group.blurb}</p>
      <h2>Topics in this part</h2>
      <ol className="topic-list">
        {topics.map((t) => (
          <li key={t.id}>
            <a href={hrefs.topic(sid, t.id)}>
              <StatusDot status={statusOf(t)} />
              {t.title}
            </a>
          </li>
        ))}
      </ol>
      <div className="row">
        <a className="btn btn-primary" href={hrefs.topic(sid, topics[0]!.id)}>
          Start with {topics[0]!.title}
        </a>
      </div>
      <nav className="pager" aria-label="Part navigation">
        {prev ? <a href={hrefs.part(sid, prev.part)}>Previous part: {prev.title}</a> : <span />}
        {next ? <a href={hrefs.part(sid, next.part)}>Next part: {next.title}</a> : <a href={hrefs.signoff(sid)}>Sign-off</a>}
      </nav>
    </div>
  );
}
