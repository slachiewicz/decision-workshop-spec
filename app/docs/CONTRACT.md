# Engine and UI contract

This is the phase 0 contract. Phase 1 and 3 agents build against it and against
`src/packs/types.ts`. Where the two disagree, `types.ts` wins and this file gets fixed.

## 1. Pack layout

```
packs/
  _schema/{keys,topic,pack}.schema.json
  <pack>/
    pack.yaml       manifest: name, release, parts (groups) in flow order, canvas labels
    keys.yaml       structure: topic ids, decision keys, option values, rules, canvas effects
    choices.yaml    choice lists for select value fields
    topics/NN-<topic_id>.yaml   prose for one topic
```

Ownership:

- **`keys.yaml`** belongs to the driver. Content writers never edit it.
- **Topic files** belong to whoever is assigned that range of topics.
- **Both packs** must have identical topic ids, numbers, decision keys, clusters, statuses
  and group order. The lint checks this.

`mergePack()` in `src/packs/merge.ts` joins keys and prose into `Topic[]`. The app loads
packs at build time with `import.meta.glob('/packs/*/**/*.yaml', { query: '?raw' })` and
parses them with `yaml`. Each pack becomes its own chunk.

## 2. Session state

```ts
interface DecisionRecord {
  topic_id: string;
  decision_key: string;
  status: 'decided' | 'open' | 'parked';
  chosen: string[];                          // option values; [] for confirm topics
  values: Record<string, string>;            // value fields, by field id
  modifiers: Record<string, boolean>;        // by modifier id
  naming: Record<string, string>;            // naming form fields, by field id
  option_notes: Record<string, string>;
  notes: string;
  decided_at: string;                        // ISO timestamp
}
interface Session {
  kind: 'decision-workshop-session';
  schema_version: 1;
  pack: string;
  pack_release: string;
  session_id: string;
  client_name: string;
  facilitator?: string;
  show_proposed: boolean;                    // topics with status: proposed
  decisions: DecisionRecord[];
  locked: boolean;
  created_at: string;
  updated_at: string;
}
```

Derived values are computed and never stored:

- `recommendation_followed`
- the rejected options
- the options ruled out by rules
- the "needs review" flags

Persistence goes through `StorageAdapter { load(id), save(session), list(), remove(id) }`.
v1 uses IndexedDB and falls back to `localStorage` under the key
`dws.session.<session_id>`. Every read and write is wrapped in try/catch, and the app still
works in memory if storage is unavailable.

Export and import format: `{ kind, schema_version, session }`. The file is named
`<pack>-<client-slug>-<YYYY-MM-DD>.json`.

## 3. Rule evaluation

`evaluate(pack, topic, option, session) -> { state: 'ok' | 'blocked' | 'warn' | 'pending', reasons: string[] }`
(`pack` is needed for the title in a pending reason). Implemented in `src/engine/rules.ts`.

For each `requires` entry on the option:

1. If the referenced decision is `decided`, its current value is `chosen[0]` for a
   single-select topic or `chosen` for a multi-select topic. If the key is a modifier key,
   the value is that modifier's `on_value` or `off_value`.
2. The operator decides whether the requirement is met:
   - `in`: the value is in the list
   - `not_in`: the value isn't in the list
   - `any_of`: the intersection with the list is non-empty
   - `none_of`: the intersection with the list is empty
3. If it isn't met:
   - `severity: block` makes the result `blocked`, with the reason from the topic's
     `rule_reasons[reason_id]`.
   - `severity: warn` makes it `warn`, with that reason.
4. Operators apply across selection types too. On a multi-select topic, `in` and `not_in`
   act like `any_of` and `none_of`. On a single-select topic, `any_of` and `none_of` treat
   the value as a one-element set. A modifier key is pending until the topic that owns the
   modifier is decided.
5. If the referenced decision is open, parked or not yet visited, the result is `pending`,
   with the reason "Depends on <title>, not decided yet". The option stays selectable.

Precedence: `blocked`, then `warn`, then `pending`, then `ok`. All reasons are shown.

- **Needs review:** a decided topic that has a chosen option now evaluating to `blocked`
  is flagged *needs review*. It is never cleared silently.
- **Adaptive recommendation:** look up the followed decision's current value in `map`. If
  the result is non-empty, it replaces `recommendation`. If any recommended option is
  `blocked`, show no recommendation for that topic, with the note "The usual default is
  ruled out by <reason>".
- **Sign-off:** lock is enabled when every `required` core topic (and every required
  proposed topic, if `show_proposed` is on) is `decided`, `open` or `parked`, and no topic
  needs review.

## 4. ADR (Markdown)

`renderAdr(pack, session, today) -> string`. It is a pure function, with golden-file tests.

```
# Architecture Decision Record
## <client_name> · <pack platform_label> · <today>
_Pack release <release> · prepared with <facilitator if set>_

## Executive summary
<summary paragraph, rules below>

## Open items              (only if any; topics in flow order)
## Decisions               (decided topics in flow order)
## Parked for a later phase (only if any)
## Appendix: sources        (every source URL cited by a chosen option, deduplicated)
```

**Executive summary rule.** These sentences are generated, in this order, and a sentence
is skipped when its count is 0:

1. "<N> of <M> topics were decided, <O> left open and <P> parked." M counts only the
   visible topics, so proposed topics count only when `show_proposed` is on.
2. "The platform uses <labels of medallion_layers>, isolated by <isolation_strategy label>,
   with <environments label>." This uses the chosen labels, or "not yet decided".
3. "<D> decisions depart from the suggested default: <titles>."
4. "<W> choices carry warnings: <titles>."
5. "<R> options rely on features in preview or gated access: <labels>."

**Per decided topic:**

```
### <title>
**Decision:** <chosen labels, joined with "; ">
<value fields as "- <label>: <value label or text>">
<modifiers as "- <modifier title>: On|Off">
**Context:** <adr_context — see below>
<modifier on_/off_adr_context for each modifier>
**Alternatives considered:** <labels of options not chosen and not blocked>
**Not available (ruled out by earlier decisions):** <label — reason> (only if any)
**Warnings:** <label — reason> (only if any)
**Maturity:** <label: preview|gated|beta|deprecated> (only for non-GA chosen options)
**Notes:** <notes> (only if set)
```

Context selection:

- If the recommendation was followed, use the topic's `adr_context`. When the followed
  default came from an `adaptive_recommendation` map and differs from the base
  recommendation, use the chosen options' `adr_context` instead, because the topic's text
  explains the base default. Followed means the
  chosen set equals the recommendation, or for multi-select, contains all of it.
- Otherwise, use each chosen option's `adr_context`, joined, then the deviation sentence:
  "This departs from the suggested default (<recommended labels>). Reason recorded:
  <notes>". If there are no notes, the second sentence is "No reason was recorded."
- If the topic has no recommendation, use the chosen options' `adr_context`.

The naming topic renders its fields as a table, with columns Section, Field and Agreed
pattern. A field still at its default is marked "(default)".

**Open:** "**Status:** Open, no decision recorded." plus the notes. **Parked:** "**Status:**
Parked for a later phase." plus "**Reason:**" and the notes.

PDF = the same Markdown rendered to HTML with a print stylesheet; phase 4 adds a headless
Chromium render in CI for a golden PDF.

## 5. Canvas

`buildCanvas(pack, session) -> CanvasModel` is a pure function. The UI draws the model as
SVG and does no logic of its own. Wireframes: [canvas/fabric.svg](canvas/fabric.svg) and
[canvas/databricks.svg](canvas/databricks.svg).

```ts
interface CanvasModel {
  sources: { label: string; mechanism?: string }[];       // from the ingestion topic's chosen values
  landing?: { label: string };                            // landing_zone effect on
  environments: string[];                                 // from env_multiplier; default ['prod']
  containers: { label: string; layers: string[] }[];      // from container_grouping × layer_boxes
  layers: { id: string; label: string; engine?: string }[];
  transform_band: boolean;
  serving: { pattern: string; label: string };
  locks: ('model' | 'storage' | 'all')[];
  bands: { cluster: 'platform_setup' | 'access_governance' | 'operations'; chips: string[] }[];
  footer_badges: string[];
  undecided: string[];   // canvas parts whose topic isn't decided yet; drawn dashed
}
```

Effects and what they do to the model:

| Effect | Change to the model |
|---|---|
| `layer_boxes { layers }` | Sets `layers`. Default before any decision: bronze, silver, gold, drawn dashed |
| `landing_zone { on }` (modifier) | Sets `landing`, labelled with `pack.canvas.landing_label` |
| `container_grouping { pattern }` | `per_layer`: one container per layer. `first_pair_shared`: layers 1 and 2 share one, then one per layer. `single`: one for all layers. `per_domain`: one per domain, drawn as two stacked containers with the label "<container_label> per domain" |
| `env_multiplier { envs }` | Sets `environments`. The containers repeat per environment, with Gold drawn only in prod when `envs` is a single entry |
| `layer_engines { default, first?, last? }` | Sets `engine` on each layer, using the label from `pack.canvas.layer_engine_labels`. `first` and `last` override the outer layers |
| `transform_band { on }` | Shows a band labelled "Transformations" across the containers |
| `serving_lane { pattern }` | Sets `serving.pattern`. The UI draws the lane variant with that name |
| `lock { scope }` | Adds a lock icon: `model` on the serving lane, `storage` on the Silver and Gold layers, `all` on both |
| `footer_badge { label_id }` | Adds `pack.canvas.badge_labels[label_id]` to the footer |

Source names: the source-mapper UI stores the name of each source system in
`option_notes[<mechanism value>]`, as a comma-, semicolon- or line-separated list. The
canvas draws one source per name, with the option label as `mechanism`.

Chips: every decided topic whose cluster has a band adds its chosen labels, shortened to
24 characters, to that band. Undecided parts of the canvas are drawn dashed and grey, and
each one fills in when its topic is decided.

## 6. UI routes (hash routing)

| Route | Screen |
|---|---|
| `#/` | Landing page: pack picker, resume a saved session, import a JSON file |
| `#/s/<session_id>/part/<n>` | Part intro |
| `#/s/<session_id>/topic/<topic_id>` | Topic page |
| `#/s/<session_id>/signoff` | Sign-off: counts, canvas, export (MD, PDF, JSON), lock |

Hash routes need no host rewrite, so the same `dist/` serves from Cloudflare, Vercel or a
file share.
