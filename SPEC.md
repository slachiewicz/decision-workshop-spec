# Architecture decision workshop: product and build spec

This spec covers two things. It reviews the Data Crafters Architecture Design Workshop
(<https://workshop.datacrafters.io/>), and it describes how to build an app of the same kind
with two platform packs, Microsoft Fabric and Databricks. The decisions for each pack are in
[CATALOG.md](CATALOG.md).

The review comes from the public production bundle (`assets/index-CEGv_OmL.js`, release
`2026.10.9`, built 2026-10-12). I read the code and the topic data. I did not complete a
session in the UI.

## 1. What the app is

The app is a guided architecture workshop in a single page. A team works through 29
platform decisions in five parts. Each decision shows its context, three to eight options
with trade-offs and a marked default. While the team decides, a diagram of the platform
builds up. At the end the app writes an Architecture Decision Record (ADR) covering every
decision, the reasons for it, and what was rejected or parked.

It does three jobs:

- **It turns workshop content into a product.** The consultancy's discovery workshop
  becomes a lead magnet: run it yourself, or book the experts.
- **It gives a fixed decision scope.** All 29 topics have to be decided, parked or left
  open. Nothing gets skipped by accident.
- **It produces a document people can act on.** The ADR is the deliverable, and the diagram
  is what draws people in.

### 1.1 User flow

1. Landing page with a preview of the finished diagram, plus two paths: run it yourself, or
   book a guided session.
2. `/login` with a six-digit access code that is published on the vendor's Substack. The
   check runs only in the browser (see 1.4). It is there to capture leads, not to secure
   anything.
3. Create a session with a client name.
4. Five parts, each opened by a short intro screen:
   - Architecture (decisions 1 to 7)
   - Platform Setup (8 to 14)
   - Consumption (15 to 21)
   - Access & Governance (22 to 26)
   - Operations & Wrap-up (27 to 29)
5. On each decision you can:
   - pick one or more options
   - add a note to an option
   - fill in fields that belong to an option, such as an Azure region or a starting SKU
   - turn a modifier on or off
   - park the decision, or mark it as open
6. Sign-off screen: counts of decided, open and parked topics, the full diagram, **Export ADR
   (PDF)**, and **Lock session**, which makes the session read-only.
7. Back up the session to JSON (`workshop-<client>-<date>.json`, kind
   `phoenix-workshop-session`, version 1), and import it again on another machine.

### 1.2 Decision anatomy (the topic schema)

Every decision is a data record. The UI and the ADR are both generated from it. These are
the fields the bundle uses:

| Field | Purpose |
|---|---|
| `id`, `order`, `cluster` | Identity, position, and which part it belongs to |
| `title`, `situation` | Heading and a short framing paragraph |
| `weight` | `fast`, `standard` or `deep`: sets how much detail the page shows |
| `mode` | `decide` (normal), `surface` (raise awareness, decide later), `naming` (a form) |
| `renderer` | `cards`, `source_mapper` or `naming_form` |
| `phase` | `now` or `later` |
| `required` | Whether sign-off is blocked until this is decided |
| `decision_type` | `single`, `multi` or `confirm` |
| `decision_key` | Stable key, such as `ops.environments`, that other topics refer to |
| `intake[]` | Discovery questions to ask before deciding: the facilitator's script |
| `recommendation`, `recommendation_note` | The default and a one-line reason |
| `adaptive_recommendation` | `{follows: <decision_key>, map: {value: [recommended]}}`: a default that depends on an earlier answer (built, but no topic uses it yet) |
| `options[]` | See below |
| `modifiers[]` | On/off add-ons to a decision, each with its own ADR text for on and off (for example the central Landing zone) |
| `value_fields[]` | Fields at topic level, such as the platform owner |
| `adr_context`, `adr_context_scope` | Reasoning written into the ADR, used only when the recommendation was followed |
| `canvas`, `canvas_element` | Whether and where the topic changes the diagram |
| `source_map`, `source_groups`, `mechanism_styles`, `latency_options`, `auth_kinds` | Data for the source mapper (topic 4 only) |
| `naming_sections[]` | Data for the naming form (topic 29 only) |

An option record has `value`, `label`, `description`, `tradeoff`, `pros[]`, `cons[]`,
`waf_pillars[]` (Azure Well-Architected tags), `requires[]`, `value_fields[]`,
`canvas_effect` and `adr_context`.

### 1.3 The three mechanisms that make it more than a form

1. **Cross-decision constraints (`requires`).** An option can depend on the answer to
   another decision:
   `{decision_key: "ops.environments", in: ["dev_prod","dev_test_prod"], reason: "..."}`.
   If the dependency isn't met, the option is greyed out with the reason shown. The ADR then
   lists it under "Not available (ruled out by earlier decisions)". These constraints exist
   today:
   - T-SQL transforms need a Warehouse.
   - A split dev/prod capacity needs at least two environments.
   - `fabric-cicd` needs a Git platform.
   - Deployment pipelines need at least two stages.
2. **Canvas effects.** Choosing an option sends a typed effect to the diagram. These effect
   types exist:
   - `layer_boxes`
   - `landing_zone`
   - `workspace_grouping` (per layer, first two layers shared, or single)
   - `layer_engines` (lakehouse or warehouse per layer)
   - `env_multiplier` (the "Prod only" or "Dev · Prod" badge)
   - `transform_band`
   - `bi_workspaces`
   - `lock` (RLS)
   - `footer_badge` (Git platform)

   Map bands for Platform Setup, Security & Governance and Operations collect short chips
   for the decisions in those groups.
3. **ADR generation from records.** For each topic the app writes:
   - **Decision:** the chosen labels, plus any value fields and modifiers
   - **Context:** the topic's `adr_context` (only if the recommendation was followed),
     otherwise the option's `adr_context`
   - **Alternatives considered:** the options not chosen
   - **Not available:** the options that were ruled out
   - a deviation paragraph when the recommendation wasn't followed
   - **Notes:** any notes the team added

   Above the topics sit an executive summary, then Open Items, then Decisions, then Parked
   for a Later Phase. The output is Markdown that is rendered and printed with
   `window.print()`. That print step is the PDF export.

### 1.4 Technical shape

- Built with Vite, React and Tailwind. One 600 KB JS bundle with all topic data compiled in.
  There is no backend.
- A fake API layer (`ApiError` with HTTP-like status codes 404 and 507, plus
  `exportADR`/`getTopics`) wraps `localStorage`. It looks like a port of an earlier app that
  had a server ("phoenix"), with the server swapped for the browser.
- Persistence: `localStorage["workshop.session.<id>"]` holds the whole session. The access
  grant, the current session id and the "groups seen" flags live in `sessionStorage`.
- Multi-tenant content: `byClient[<client>] = {manifest:{topics_include, topics_exclude,
  groups, copy}, topics}`, with a fallback to `default`. A platform or client variant is
  just another manifest. This is the hook a Databricks pack would use.
- App configuration holds the product name, the "prepared by" credit, the clusters, the map
  bands, the part intros and copy strings.

### 1.5 Review findings

What works well:

- **Content and engine are separate.** All 29 topics are data, so the engine has no idea it
  is talking about Fabric.
- **The `requires` constraints keep the ADR consistent.** It can't say "deployment
  pipelines" alongside "prod only".
- **"Parked" is a status, not a gap.** The ADR shows parked items as scheduled.
- **Intake questions turn the self-serve tool into a facilitator script.** This is the most
  valuable content in the app.
- **The recommendation-scoped `adr_context`** stops the ADR from claiming reasons the team
  never agreed to.

Weaknesses and risks:

- **"Nothing leaves your browser" is not quite true.** Google Analytics (`gtag`,
  `G-VY3W8ZZFPJ`) loads on every page. Session content stays local, but page views and
  usage do not.
- **The access code is only a lead-capture gate.** It is a constant in the bundle and the
  check runs in the browser.
- **The "PDF" is the browser's print dialog,** so how it looks depends on the browser. There
  is no Markdown or DOCX download, even though the generator produces Markdown inside.
- **`localStorage` only.** Clearing site data loses the session unless the team exported the
  JSON. There is no team collaboration and no comments.
- **`adaptive_recommendation` is built but not used.** Every default is fixed.
- **The content is tied to Fabric and Power BI** (topics 9, 10, 15 to 17), so it can't be
  reused for another platform without a separate topic pack.
- **There is no versioning across releases.** A session saved under one content release
  stays valid even if a later release renames option values. A migration exists only for the
  old `__parked__` sentinel.

## 2. Spec for building one

### 2.1 Goals

- One engine, several **platform packs** (`fabric`, `databricks`), chosen when a session is
  created.
- Content as files in the repo (YAML), checked by a schema in CI, so architects edit content
  without touching code.
- Output: the ADR as Markdown, a printable PDF and a JSON session file, plus the diagram as
  SVG.
- Local-first and private. If there is analytics, it must be opt-in, and the privacy claim
  must match what the code does.

Not in scope for v1: accounts, a server, real-time co-editing.

### 2.2 Architecture

```
packs/
  _schema/topic.schema.json        # JSON Schema for topic, option, modifier, requires
  fabric/
    pack.yaml                      # name, clusters, groups, map bands, copy, canvas preset
    topics/01-medallion-layers.yaml ... 29-naming-conventions.yaml
    sources.yaml                   # source mapper catalogue
  databricks/
    pack.yaml
    topics/...
    sources.yaml
src/
  engine/   rules.ts  (requires, adaptive recs, required-topic gating)
            adr.ts    (records -> Markdown)
            canvas.ts (decisions -> diagram model; pure function)
            session.ts(load/save/migrate; storage adapter)
  ui/       TopicPage, OptionCard, SourceMapper, NamingForm, Canvas, SignOff
```

- **Build:** Vite + React + TypeScript. Packs are loaded and checked at build time with
  `import.meta.glob('packs/*/pack.yaml')` and a schema check in CI.
- **State:** one `Session` object, saved after every edit through a `StorageAdapter`.
  Version 1 uses IndexedDB, falling back to localStorage. A file-system or sync adapter can
  be added later.
- **Canvas:** a pure function `buildCanvas(pack, decisions) -> CanvasModel` (nodes, bands,
  badges, callouts), drawn as SVG. Each pack declares its own base layout. Topic effects are
  typed patches applied to that layout. Effect types stay generic (`container_grouping`, not
  "workspace" or "catalog"), and `pack.yaml` supplies the labels and icons, so the engine
  never learns a platform's vocabulary.
- **ADR:** a pure function `renderAdr(pack, session) -> markdown`. The PDF comes from a print
  stylesheet, or from a headless renderer if the PDF must look the same everywhere. Offer
  `.md` and `.docx` (pandoc-style) downloads too.

### 2.3 Data model

```ts
type Status = 'decided' | 'open' | 'parked';
interface DecisionRecord {
  topic_id: string; decision_key: string; status: Status;
  chosen: string[];               // option values
  values: Record<string,string>;  // value_fields
  modifiers: Record<string,boolean>;
  option_notes: Record<string,string>;
  notes?: string;
  recommendation_followed?: boolean;
  decided_at: string;             // ISO
}
interface Session {
  kind: 'decision-workshop-session'; schema_version: 2;
  pack: 'fabric' | 'databricks'; pack_release: string;
  session_id: string; client_name: string; facilitator?: string;
  decisions: DecisionRecord[]; excluded_topics: string[];
  locked: boolean; created_at: string; updated_at: string;
}
```

Rejected and ruled-out options are not stored. They are computed when the ADR is rendered,
so they can't go stale when an earlier answer changes.

Options carry three fields that the live app lacks:

| Field | Purpose |
|---|---|
| `maturity` | `ga`, `preview`, `beta` or `gated`, printed next to the option and in the ADR |
| `as_of` | The date the option's facts were last checked against vendor docs |
| `sources[]` | Vendor doc URLs backing the option |

Store `pack_release` in every session and keep a migration table for each pack. A release
entry can rename a topic, rename an option value, or remove an option:

```yaml
- release: 2027.01
  topic_renames: {old_topic_id: new_topic_id}
  value_renames: {decision_key: {old_value: new_value}}
  removed: {decision_key: [value]}   # records holding these become "needs review"
```

A CI diff fails when a release removes or renames an option value without a migration entry.
That way an ADR made with an old export still renders after the content changes.

### 2.4 Engine rules

1. **Gating.** Each `requires[]` entry names a `decision_key` and one condition:
   - `in: [...]`: the current value is one of these (single-select decisions)
   - `not_in: [...]`: the current value is none of these
   - `any_of: [...]`: at least one chosen value is in the list (multi-select decisions)

   Each entry also has `severity: block | warn`. A `block` makes the option unavailable and
   shows the reason. A `warn` leaves it available with the reason shown, for combinations
   that are redundant or risky but not impossible. If the referenced decision was never made,
   show a soft warning ("depends on X, not decided yet") instead of blocking.
2. **Invalidation.** When an earlier answer changes and that makes an option already chosen
   in a later topic unavailable, flag the later topic as **needs review**. Don't silently
   clear it.
3. **Adaptive defaults.** `adaptive_recommendation.follows` picks the recommended option from
   an earlier answer. Use it for real pairs. For example, on Databricks, the BI serving
   pattern (#15) decides the recommended query mode (#16). If the adaptive pick is gated by
   another rule, show no recommendation and a warning, rather than recommending something the
   team can't choose.
4. **Sign-off.** Lock is enabled only when every `required` topic is decided, parked or
   explicitly open.
5. **ADR context.** Use the topic-level `adr_context` only when the recommendation was
   followed. Otherwise use the chosen option's `adr_context` and add a deviation paragraph
   that cites the team's note. If there is no note, the paragraph says "The team chose X
   over the recommended Y; no reason was recorded", so the gap is visible to readers.

### 2.5 Content authoring rules

- Each topic gets a 2 to 4 sentence situation, 2 to 4 intake questions, 2 to 6 options,
  and one recommendation with a one-line reason. Leave the recommendation empty when the
  honest answer is "it depends", as the Fabric pack does for 9 of its topics.
- Each option gets a description, a one-line trade-off, pros and cons, and ADR text written
  in the past tense ("X was selected because…").
- Every vendor fact carries a `sources[]` URL to the vendor docs, so a reviewer can check it
  when the platform changes. Both platforms rename features often.
- A CI lint checks:
  - every `requires.decision_key` exists
  - every value in `in`, `not_in` and `any_of` is a real option of that decision
  - every option has `maturity`, `as_of` and at least one `sources[]` URL
  - every `canvas_effect.type` is known to the pack's canvas
  - no topic is missing `adr_context`

### 2.6 Privacy and distribution

- No third-party scripts by default. If analytics is needed, use a cookieless, self-hosted
  tool behind a consent toggle, and word the landing-page claim to match.
- If an access code is a marketing gate, say so in the code. Don't present it as security.
- Serve a strict Content Security Policy (`script-src 'self'`), so a "nothing leaves your
  browser" claim is enforced by the browser and not only promised.
- Run a scheduled CI job that fetches every `sources[]` URL and flags 404s, redirects, and
  pages whose wording now says "preview", "deprecated" or "formerly". Content drifting out of
  date is the main maintenance cost, since both vendors rename features every few months.
- Ship as static files (any CDN). Optionally offer a single-file offline build for clients
  who must run it air-gapped.

### 2.7 Delivery plan

| Step | Output | Done when |
|---|---|---|
| 1. Schema + engine | `topic.schema.json`, rules/adr/canvas as pure modules with unit tests | Golden-file tests: a fixture session renders the expected ADR Markdown |
| 2. Fabric pack | 29 topics, sources catalogue, canvas preset | Lint passes; a full walkthrough produces an ADR with no empty sections |
| 3. Databricks pack | Same, from [CATALOG.md](CATALOG.md) | Lint passes; golden fixtures cover the default isolation model (catalog per domain × env); a Databricks architect reviews every option against its `sources[]` |
| 4. UI | Topic pages, source mapper, naming form, canvas, sign-off | Playwright run through all 29 topics on both packs, export checked |
| 5. Hardening | Session migration, IndexedDB adapter, PDF rendered by headless Chromium in CI, `.md`/`.docx` export, link-check job | Old-release fixture imports cleanly; PDF matches a golden render |

## 3. Platform packs

The engine and the five-part flow are the same for both. The packs differ in five places.

| Aspect | Fabric pack | Databricks pack |
|---|---|---|
| Unit of isolation drawn on the canvas | Workspace per layer × environment | Unity Catalog catalog per domain × environment, schema per layer, bound to workspaces |
| Compute and cost decision | Capacity SKU + surge protection; per-user Power BI licences | Serverless vs classic compute, SQL warehouse sizing, cluster policies, serverless usage policies |
| Consumption surface | Power BI (Direct Lake, apps) | Databricks SQL, AI/BI dashboards and Genie Agents, plus Power BI/Tableau over SQL warehouses |
| Governance plane | Entra groups, OneLake security, Purview labels | Unity Catalog grants, row filters / column masks / ABAC, system tables, lineage |
| Deployment tooling | `fabric-cicd`, deployment pipelines | Declarative Automation Bundles (formerly Databricks Asset Bundles), Terraform provider |

[CATALOG.md](CATALOG.md) lists all 29 decisions side by side, with the options and
default for each platform, plus proposed decisions 30 to 36 that the live app does not
cover.
