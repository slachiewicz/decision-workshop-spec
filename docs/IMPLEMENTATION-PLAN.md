# Implementation plan

This plan builds the SPA from [SPEC.md](../SPEC.md) and fills the gaps listed in
[AUDIT.md](AUDIT.md). The result is a static Vite + React + TypeScript build that deploys to
Cloudflare Workers static assets or to Vercel unchanged.

Agents do the volume work. A deterministic check gates every hand-off. The driver session
keeps the contract work (schema, keys, example topics) and the merges.

## Cost rules

1. **Contract first, by the driver.** The schema, key registry and two example topics are
   small and settle every later argument. A cold-started agent writing them would cost more
   in rework than it saves.
2. **Cheapest model that passes the gate.** Use three tiers:

   | Tier | Used for |
   |---|---|
   | Small | Mechanical work: config, lint fixes, link-check repairs |
   | Mid | Content writing, engine, UI |
   | Top | One fact review per pack, run as a Claude Code subagent |

   Today these are Haiku, Sonnet and Fable or Opus. Never call Fable through the API.
3. **Pointer-only briefs.** Each agent gets the paths to read (schema, keys file, one example
   topic, its topic range), not the whole spec or conversation.
4. **Every agent has a gate it must pass before handing back.** `npm run check:<scope>`.
   If it can't pass, it reports the blocker instead of guessing.
5. **Parallel only where files don't overlap.** Each agent writes its own directory, in its
   own git worktree (`isolation: "worktree"`). The driver merges in order.
6. **Review diffs, not files.** Reviewers get `git diff` of the agent's branch plus the gate
   output.
7. **No re-run loops.** One retry after feedback. A second failure comes back to the driver.

## Phase 0: contract (driver, no agents)

**Output:** in the new app repo, or in `app/` inside this one:

- `packs/_schema/topic.schema.json`: the topic, option, modifier and `requires` grammar
  (`in`, `not_in`, `any_of`, `severity`), plus `maturity`, `as_of`, `sources[]`, and
  `status: proposed`.
- `packs/<pack>/keys.yaml` for both packs: every topic's `id`, `decision_key`, `order`,
  `cluster`, `weight`, `required`, `decision_type`, and every option's `value`. Also the
  `requires` rules and the adaptive maps for #15 and #16.
- `packs/<pack>/topics/01-medallion-layers.yaml` and `16-…yaml`: fully written example
  topics for both packs, one simple and one multi-select with a rule.
- `scripts/lint-packs.ts`, which checks:
  - the schema
  - that every key in `keys.yaml` has a topic file and the reverse
  - that every `requires` target exists
  - that every option has `sources[]`
  - that no option text exceeds the length limits
  - that every pack has the same topic IDs
- The canvas wireframe for each pack (SVG) and the effect-to-element table.
- The ADR executive-summary rule.

**Gate:** `npm run check:packs` passes on the two example topics.

**Effort:** one driver session.

## Phase 1: parallel build (5 agents, mid tier, worktrees)

The five agents run at the same time. None touches another's files.

| Agent | Writes | Reads | Gate |
|---|---|---|---|
| A. Fabric content, topics 2–14, 30–33, 36, 39 | `packs/fabric/topics/…` | [app/docs/briefs/content-writer.md](../app/docs/briefs/content-writer.md) | `check:packs --pack fabric --topics 2-14,30-33,36,39` |
| B. Fabric content, topics 15, 17–29, 34, 35, 37, 38 | `packs/fabric/topics/…` | same | `check:packs --pack fabric --topics 15,17-29,34-35,37-38` |
| C. Databricks content, topics 2–14, 30–33, 36, 39 | `packs/databricks/topics/…` | same | `check:packs --pack databricks --topics 2-14,30-33,36,39` |
| D. Databricks content, topics 15, 17–29, 34, 35, 37, 38 | `packs/databricks/topics/…` | same | `check:packs --pack databricks --topics 15,17-29,34-35,37-38` |
| E. Engine | `src/engine/` + `tests/engine/` | [app/docs/briefs/engine.md](../app/docs/briefs/engine.md) | `npm run typecheck && npm run check:engine` with golden ADR fixtures |

Brief for each content agent, about 15 lines:

> Write topics N–M for pack P. Match the shape and tone of the example topic. Write only from
> vendor docs (Microsoft Learn MCP, docs.databricks.com), never from the Data Crafters site.
> Put every docs URL you used in `sources[]`, with `as_of: 2026-10-18`. Mark preview or
> gated features in `maturity`. Use the keys in `keys.yaml` exactly, and don't add keys. Run
> the gate. Hand back the gate output and a list of facts you couldn't verify.

**Merge:** the driver merges A to E in order. If one agent's work breaks another's, the
lint's cross-file checks catch it at merge.

## Phase 2: fact review (2 agents, top tier, read-only)

One reviewer per pack. Each gets the merged pack directory and each agent's "couldn't
verify" list. It returns findings only, grouped must, should and nice, each with a docs URL.
The driver applies the fixes, or hands them to one small-tier agent if there are many
mechanical edits.

**Gate:** no must-fix findings remain; `check:packs` passes on both packs.

This is the only top-tier spend apart from the driver. Keep it to one pass per pack.

## Phase 3: UI (1 agent, mid tier, worktree)

One agent, so the design stays consistent. It builds:

- the landing page, with the pack picker (Fabric or Databricks)
- the topic page (cards, value fields, modifiers, notes, park and open)
- the source mapper and the naming form
- the canvas drawn from the engine's model
- the sign-off page, with lock and export (`.md`, print PDF, JSON)
- light and dark themes, keyboard navigation, WCAG 2.2 AA contrast

Routing uses hash routes, so the build has no host-specific behaviour.

**Gate:**

- `npm run build` stays within budget: initial JS ≤ 250 KB gzip, with the packs split into
  their own chunks
- `playwright test` walks all topics in both packs, exports the ADR and compares it with a
  golden file
- `axe` reports no serious issues

## Phase 4: hosting and hardening (1 agent, small tier)

- `wrangler.jsonc` with `assets.directory = "./dist"` and
  `not_found_handling = "single-page-application"`, plus `public/_headers` carrying the CSP
  (`default-src 'self'; script-src 'self'; object-src 'none'; frame-ancestors 'none'`).
- `vercel.json` with the `/(.*)` → `/index.html` rewrite and the same headers.
- GitHub Actions on Linux runners only: `check` on every PR; a weekly link check over every
  `sources[]` URL that opens an issue listing broken or renamed pages; deploy on a tag.
- `LICENSE` (MIT for code) and `packs/LICENSE` (CC BY 4.0 for content). Both are defaults
  until you confirm them; see AUDIT §5.

**Gate:**

- `wrangler deploy --dry-run` succeeds
- `vercel build` succeeds locally
- a preview deploy serves a deep link (`/#/topic/region`) and returns the CSP header

## Phase 5: acceptance (driver)

1. Walk both packs end to end in the built app, export both ADRs, and read them.
2. Get one fresh-context review of the finished app and ADRs from a reviewer at least as
   strong as the driver, and check its verdict against evidence.
3. Have a Databricks architect and a Fabric architect each review their pack's ADR. This is
   human work, outside the agents.

## Agent count and order

```
Phase 0  driver ────────────┐
Phase 1  A  B  C  D  E      │ parallel, 5 worktrees
Phase 2  R-fabric R-dbx     │ parallel, read-only
Phase 3  UI                 │ starts when E is merged; uses the example topics until content lands
Phase 4  hosting            │ may run alongside phase 3
Phase 5  driver + humans ───┘
```

That's 9 agents in total: 5 mid-tier writers, 2 top-tier reviewers, 1 mid-tier UI agent and
1 small-tier hosting agent. It fits the medium workflow guideline (under 10 agents). Content
(A to D) is about 80% of the token spend, so the briefs and the example topics matter more
than anything else for cost.

## Risks

| Risk | Mitigation |
|---|---|
| Agents copy Data Crafters' wording from memory or a fetch | The brief forbids that source. The reviewer spot-checks distinctive phrases against the live bundle |
| Vendor renames between writing and release | `as_of` + `maturity` on every option; the weekly link check |
| Two writers drift in tone or depth | The example topics set the standard; the lint enforces length limits; one reviewer per pack |
| Canvas becomes the long pole | Wireframe and effect table fixed in phase 0. The UI agent builds against the model, not the content |
| Engine and content disagree on keys | `keys.yaml` is the only source of truth; the lint checks both directions |
