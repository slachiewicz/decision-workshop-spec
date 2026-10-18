import { useId } from 'react';
import { effectiveRecommendation, evaluate, findRecord, needsReview, visibleTopics } from '../engine/rules';
import { setDecision } from '../engine/session';
import type { DecisionRecord, Maturity, Option, Topic, ValueFieldKey } from '../packs/types';
import { nowIso, useWorkshop } from './context';
import { StatusDot, statusText, useTopicStatus } from './Rail';
import { hrefs } from './useHashRoute';

type Patch = Partial<Omit<DecisionRecord, 'topic_id' | 'decision_key'>>;

const MATURITY: Record<Exclude<Maturity, 'ga'>, string> = {
  preview: 'Preview',
  beta: 'Beta',
  gated: 'Gated access',
  deprecated: 'Deprecated',
};

function ValueField({
  field,
  topic,
  option,
  rec,
  onChange,
}: {
  field: ValueFieldKey;
  topic: Topic;
  option?: Option;
  rec: DecisionRecord | undefined;
  onChange: (id: string, v: string) => void;
}) {
  const uid = useId();
  const { pack } = useWorkshop();
  const meta = option?.value_field_labels?.[field.id] ?? topic.value_field_labels?.[field.id];
  const label = meta?.label ?? field.id;
  const value = rec?.values[field.id] ?? '';
  const hintId = `${uid}-hint`;
  return (
    <div className="field">
      <label htmlFor={uid}>
        {label}
        {field.required ? ' (required)' : ''}
      </label>
      {field.type === 'select' ? (
        <select id={uid} value={value} onChange={(e) => onChange(field.id, e.target.value)} aria-describedby={meta?.hint ? hintId : undefined} aria-required={field.required || undefined}>
          <option value="">Not set</option>
          {(pack.choices[field.choices_ref ?? ''] ?? []).map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      ) : (
        <input id={uid} type="text" value={value} onChange={(e) => onChange(field.id, e.target.value)} aria-describedby={meta?.hint ? hintId : undefined} aria-required={field.required || undefined} />
      )}
      {meta?.hint && (
        <p className="hint" id={hintId}>
          {meta.hint}
        </p>
      )}
    </div>
  );
}

function OptionCard({
  topic,
  option,
  rec,
  recommended,
  multi,
  mapper,
  onToggle,
  onValue,
  onNote,
}: {
  topic: Topic;
  option: Option;
  rec: DecisionRecord | undefined;
  recommended: boolean;
  multi: boolean;
  mapper: boolean;
  onToggle: (o: Option) => void;
  onValue: (id: string, v: string) => void;
  onNote: (value: string, v: string) => void;
}) {
  const { pack, session } = useWorkshop();
  const uid = useId();
  const result = evaluate(pack, topic, option, session);
  const checked = rec?.chosen.includes(option.value) ?? false;
  const blocked = result.state === 'blocked';
  const disabled = session.locked || (blocked && !checked);
  const noteId = `${uid}-note`;
  return (
    <div
      className={`card state-${result.state}${checked ? ' selected' : ''}`}
      data-option={option.value}
      data-recommended={recommended}
      data-state={result.state}
    >
      <label className="card-head">
        <input
          type={multi ? 'checkbox' : 'radio'}
          name={`opt-${topic.id}`}
          checked={checked}
          disabled={disabled}
          onChange={() => onToggle(option)}
          aria-describedby={result.reasons.length ? `${uid}-reasons` : undefined}
        />
        <span className="card-title">{option.label}</span>
        {recommended && <span className="badge badge-rec">Recommended</span>}
        {option.maturity !== 'ga' && <span className={`badge badge-${option.maturity}`}>{MATURITY[option.maturity]}</span>}
        {result.state === 'warn' && <span className="badge badge-warn">Warning</span>}
        {result.state === 'pending' && <span className="badge badge-pending">Depends on another topic</span>}
        {blocked && <span className="badge badge-blocked">Not available</span>}
      </label>
      <p className="desc">{option.description}</p>
      <p className="tradeoff">
        <strong>Trade-off:</strong> {option.tradeoff}
      </p>
      {result.reasons.length > 0 && (
        <ul className={`reasons reasons-${result.state}`} id={`${uid}-reasons`}>
          {result.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
      <div className="proscons">
        <div>
          <h4>Pros</h4>
          <ul>
            {option.pros.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
        <div>
          <h4>Cons</h4>
          <ul>
            {option.cons.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      </div>
      {option.sources.length > 0 && (
        <p className="sources">
          <span className="muted">Sources (as of {option.as_of}): </span>
          {option.sources.map((s, i) => (
            <span key={s.url}>
              {i > 0 && ' · '}
              <a href={s.url} target="_blank" rel="noopener noreferrer">
                {s.title}
                <span className="sr"> (opens in a new tab)</span>
              </a>
            </span>
          ))}
        </p>
      )}
      {checked && (
        <div className="card-extra">
          {(option.value_fields ?? []).map((f) => (
            <ValueField key={f.id} field={f} topic={topic} option={option} rec={rec} onChange={onValue} />
          ))}
          <div className="field">
            <label htmlFor={noteId}>
              {mapper ? `Source systems that use ${option.label}` : `Note on ${option.label}`}
            </label>
            {mapper ? (
              <input id={noteId} type="text" value={rec?.option_notes[option.value] ?? ''} onChange={(e) => onNote(option.value, e.target.value)} aria-describedby={`${noteId}-h`} />
            ) : (
              <textarea id={noteId} rows={2} value={rec?.option_notes[option.value] ?? ''} onChange={(e) => onNote(option.value, e.target.value)} />
            )}
            {mapper && (
              <p className="hint" id={`${noteId}-h`}>
                Separate names with commas, for example &quot;SAP ERP, Salesforce&quot;. They label the sources on the canvas.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NamingForm({ topic, rec, onChange, disabled }: { topic: Topic; rec: DecisionRecord | undefined; onChange: (id: string, v: string) => void; disabled: boolean }) {
  const uid = useId();
  return (
    <div className="naming">
      {(topic.naming_sections ?? []).map((sec) => (
        <fieldset key={sec.id} className="panel" disabled={disabled}>
          <legend>{sec.title}</legend>
          <p className="muted">{sec.blurb}</p>
          {sec.fields.map((f) => (
            <div className="field" key={f.id}>
              <label htmlFor={`${uid}-${f.id}`}>{f.label}</label>
              <input id={`${uid}-${f.id}`} type="text" value={rec?.naming[f.id] ?? f.default} onChange={(e) => onChange(f.id, e.target.value)} aria-describedby={`${uid}-${f.id}-h`} />
              <p className="hint" id={`${uid}-${f.id}-h`}>
                {f.hint}
              </p>
            </div>
          ))}
        </fieldset>
      ))}
    </div>
  );
}

export function TopicPage({ tid }: { tid: string }) {
  const { pack, session, apply } = useWorkshop();
  const statusOf = useTopicStatus();
  const sid = session.session_id;
  const topic = pack.topics.find((t) => t.id === tid);

  if (!topic) {
    return (
      <div className="page">
        <h1 tabIndex={-1}>Topic not found</h1>
        <p>This pack has no topic called &quot;{tid}&quot; yet.</p>
        <p>
          <a href={hrefs.part(sid, 1)}>Back to the first part</a>
        </p>
      </div>
    );
  }

  const rec = findRecord(session, topic.id);
  const rating = effectiveRecommendation(pack, topic, session);
  const review = needsReview(pack, topic, session);
  const list = visibleTopics(pack, session);
  const idx = list.findIndex((t) => t.id === topic.id);
  const prev = list[idx - 1];
  const next = list[idx + 1];
  const group = pack.manifest.groups.find((g) => g.topics.includes(topic.id));
  const status = statusOf(topic);
  const isConfirm = topic.decision_type === 'confirm' || topic.options.length === 0;
  const multi = topic.decision_type === 'multi';
  const mapper = topic.renderer === 'source_mapper';
  const locked = session.locked;

  const update = (fn: (cur: DecisionRecord | undefined) => Patch) =>
    apply((s) => setDecision(s, topic, fn(findRecord(s, topic.id)), nowIso()));
  const patch = (p: Patch) => update(() => p);

  const toggle = (o: Option) =>
    update((cur) => {
      const had = cur?.chosen ?? [];
      const chosen = multi ? (had.includes(o.value) ? had.filter((v) => v !== o.value) : [...had, o.value]) : [o.value];
      return { chosen, status: chosen.length ? 'decided' : 'open' };
    });
  const setValue = (id: string, v: string) => update((cur) => ({ values: { ...cur?.values, [id]: v } }));
  const setNote = (value: string, v: string) => update((cur) => ({ option_notes: { ...cur?.option_notes, [value]: v } }));
  const setNaming = (id: string, v: string) => update((cur) => ({ naming: { ...cur?.naming, [id]: v } }));
  const confirm = () =>
    update((cur) => {
      const naming = { ...cur?.naming };
      for (const sec of topic.naming_sections ?? []) for (const f of sec.fields) naming[f.id] ??= f.default;
      return { status: 'decided', chosen: [], naming };
    });

  return (
    <div className="page">
      <p className="eyebrow">
        {group ? `Part ${group.part}: ${group.title}` : 'Topic'} · Topic {idx + 1} of {list.length}
      </p>
      <h1 tabIndex={-1}>{topic.title}</h1>
      <p className="status-pill" data-status={status}>
        <StatusDot status={status} />
        <span aria-live="polite">Status: {statusText(status)}</span>
      </p>

      {review && (
        <div className="banner banner-warn" role="alert">
          <strong>Needs review.</strong> An earlier decision now rules out the option chosen here. Pick another option, or revisit the earlier decision.
        </div>
      )}

      <p className="situation">{topic.situation}</p>

      {topic.intake.length > 0 && (
        <details className="intake">
          <summary>Ask first ({topic.intake.length})</summary>
          <ul>
            {topic.intake.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </details>
      )}

      {(rating.values.length > 0 || rating.note) && (
        <div className="reco" data-testid="recommendation">
          <span className="badge badge-rec">Recommendation</span>{' '}
          {rating.values.length > 0 ? (
            <>
              <strong>{rating.values.map((v) => topic.options.find((o) => o.value === v)?.label ?? v).join(', ')}.</strong>{' '}
              {topic.recommendation_note}
            </>
          ) : (
            <>{rating.note}.</>
          )}
        </div>
      )}
      {rating.values.length === 0 && !rating.note && topic.recommendation_note && !isConfirm && (
        <div className="reco">
          <span className="badge badge-neutral">It depends</span> {topic.recommendation_note}
        </div>
      )}

      <fieldset className="options" disabled={locked}>
        {!isConfirm && <legend>{multi ? 'Choose one or more options' : 'Choose one option'}</legend>}
        {topic.options.map((o) => (
          <OptionCard
            key={o.value}
            topic={topic}
            option={o}
            rec={rec}
            recommended={rating.values.includes(o.value)}
            multi={multi}
            mapper={mapper}
            onToggle={toggle}
            onValue={setValue}
            onNote={setNote}
          />
        ))}
      </fieldset>

      {topic.mode === 'naming' || topic.renderer === 'naming_form' ? (
        <NamingForm topic={topic} rec={rec} onChange={setNaming} disabled={locked} />
      ) : null}

      {(topic.value_fields ?? []).length > 0 && (
        <fieldset className="panel" disabled={locked}>
          <legend>Details</legend>
          {(topic.value_fields ?? []).map((f) => (
            <ValueField key={f.id} field={f} topic={topic} rec={rec} onChange={setValue} />
          ))}
        </fieldset>
      )}

      {topic.modifiers.length > 0 && (
        <fieldset className="panel" disabled={locked}>
          <legend>Options that can be switched on</legend>
          {topic.modifiers.map((m) => (
            <label key={m.id} className="switch">
              <input
                type="checkbox"
                role="switch"
                checked={rec?.modifiers[m.id] ?? false}
                onChange={(e) => update((cur) => ({ modifiers: { ...cur?.modifiers, [m.id]: e.target.checked } }))}
                aria-describedby={`mod-${m.id}-h`}
              />
              <span className="switch-ui" aria-hidden="true" />
              <span>
                <strong>{m.label}</strong>
                <span className="muted block" id={`mod-${m.id}-h`}>
                  {m.hint}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      )}

      <div className="field">
        <label htmlFor="topic-notes">Notes for this topic</label>
        <textarea id="topic-notes" rows={3} value={rec?.notes ?? ''} disabled={locked} onChange={(e) => patch({ notes: e.target.value })} />
        <p className="hint">If you depart from the recommendation or park this topic, record the reason here. It goes into the decision record.</p>
      </div>

      <div className="actions" role="group" aria-label="Decision actions">
        {isConfirm && (
          <button type="button" className="btn btn-primary" disabled={locked} onClick={confirm}>
            {rec?.status === 'decided' ? 'Confirmed' : 'Confirm'}
          </button>
        )}
        <button type="button" className="btn" disabled={locked} aria-pressed={rec?.status === 'parked'} onClick={() => patch({ status: 'parked' })}>
          Park for a later phase
        </button>
        <button type="button" className="btn" disabled={locked} aria-pressed={rec?.status === 'open'} onClick={() => patch({ status: 'open', chosen: [] })}>
          Leave open
        </button>
      </div>

      <nav className="pager" aria-label="Topic navigation">
        {prev ? (
          <a href={hrefs.topic(sid, prev.id)} rel="prev">
            <span aria-hidden="true">← </span>Previous: {prev.title}
          </a>
        ) : group ? (
          <a href={hrefs.part(sid, group.part)}>
            <span aria-hidden="true">← </span>Part introduction
          </a>
        ) : (
          <span />
        )}
        {next ? (
          <a href={hrefs.topic(sid, next.id)} rel="next">
            Next: {next.title}
            <span aria-hidden="true"> →</span>
          </a>
        ) : (
          <a href={hrefs.signoff(sid)}>
            Sign-off<span aria-hidden="true"> →</span>
          </a>
        )}
      </nav>
    </div>
  );
}
