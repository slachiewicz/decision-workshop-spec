# Build-readiness audit

This audit asks one question: is the Fabric and Databricks decision content complete enough
to build the SPA described in [SPEC.md](../SPEC.md)? It checks [CATALOG.md](../CATALOG.md) at
commit `a61f836` against what the engine needs and against the depth of the live workshop
(release 2026.10.9).

## Verdict

**The scope is nearly complete. The content is not ready to build from.**

The decision set (29 + 7 proposed) covers what an enterprise platform review asks about.
Three gaps remain (section 2). The catalogue is a design summary, though: option labels and
defaults. The app needs every option written out in full, with stable IDs, ADR text and
sources. By volume, the catalogue holds about a tenth of what one pack needs.

The engine and UI can start now, against a schema and two example topics. Content writing is
the critical path.

## 1. Content depth against the live workshop

The live Fabric pack, measured from the production bundle, compared with this catalogue:

| Content item | Live Fabric pack | CATALOG.md (each pack) |
|---|---|---|
| Topics | 29 | 29 + 7 proposed, titles only |
| Options | 94 | Labels only, no IDs |
| Situation paragraph per topic | 29 | 0 |
| Intake (discovery) questions | 56 (8 topics have none) | 0 |
| Pros / cons | 279 / 207 | 0 |
| Topic ADR context (used when the default is taken) | 29 | 0 |
| Recommendation note | Every topic that has a default | 0 |
| Modifiers | 1 | 3, labels only |
| Option value fields (region, SKU, cadence…) | 6 | Named, no choice lists |
| Source mapper: source types / mechanisms / auth kinds | 15 / 8 / 7 | Databricks mechanisms named; no source types, auth kinds or default mechanism per source |
| Naming form fields with defaults | 11 | Databricks patterns named, no field list |
| Total content | about 21,000 words | about 2,100 words for both packs |

To match the live depth, each pack needs about 36 topics, 120 options, 90 intake questions
and 600 pros and cons, plus the source and naming catalogues. That is about 20,000 to
25,000 words per pack, and every option needs a doc URL.

**Copyright constraint.** The live pack's text belongs to Data Crafters, and the bundle has
no licence. The Fabric pack must be written fresh from vendor docs. It can follow the same
decision scope, which is factual, but must not copy the live pack's wording.

## 2. Decision scope

**Covered:** architecture, ingestion, storage, transformation, region, compute, licensing,
environments, Git, CI/CD, DR, BI pattern, query mode, distribution, self-service, sharing,
AI, ML, access, row security, personal data, retention, audit, cost, monitoring, naming,
network, identities, account topology, orchestration, data quality, secrets, table format.

**Still missing.** Add these as proposed decisions 37 to 39:

| # | Decision | Why it matters | Fabric | Databricks |
|---|---|---|---|---|
| 37 | Ownership and stewardship | Every ADR reviewer asks who owns each data product. The live app records only a platform owner | Fabric domains + workspace admins / Purview data products | UC catalog owners + domain owner groups / Unity Catalog discovery metadata |
| 38 | Discovery and lineage | Separate from audit. It decides where people find data and how impact is traced | OneLake catalog / Purview Unified Catalog | Unity Catalog lineage + Catalog Explorer / external catalog |
| 39 | Backup and point-in-time restore | DR (#14) covers losing a region, not a bad `DELETE`. Teams confuse the two | Warehouse restore points, OneLake soft delete, Git for items | Delta time travel + retention settings, `UNDROP`, Deep Clone backups |

Check every fact in these three rows against vendor docs during content writing. I haven't
verified them this session.

**Weak parallels to fix while writing:**

- #9 compute strategy: on Databricks the cost-defining choice is serverless versus classic
  *per workload type* (jobs, SQL, notebooks). Model it as a multi-select with one row per
  workload type, not one strategy.
- #10 licensing: Fabric is about money (Pro, PPU, F64), while Databricks is about
  entitlements. Name the topic "Who gets access to what, and what it costs" in both packs, so
  the ADR reads the same.
- #15 and #16: the Databricks pair needs a real `adaptive_recommendation` map. It's described
  in prose only.

## 3. Machine-readiness

Before writing content, the engine needs identifiers. The catalogue has none yet.

| Gap | Effect | Fix |
|---|---|---|
| No `decision_key` or option `value` IDs for the Databricks pack or for 30 to 36 | `requires` rules point at keys that don't exist (`access.groups`, `isolation`, `bundles_ci`) | Phase 0: write a key registry, one row per topic and option, in `packs/<pack>/keys.yaml` |
| `requires` rules written in prose | Can't be linted | Encode in the schema grammar from SPEC §2.4 |
| Canvas for Databricks described in bullets only | Nothing to build against | One SVG wireframe per pack, plus an effect-to-element table |
| No ADR executive-summary rule | The live app generates one (`V0`), and the spec doesn't define it | Define it: counts, the 5 deep decisions, open items, deviations from defaults |
| No `phase`, `weight`, `required` per topic | Can't lay out the topic page or gate sign-off | Set in the key registry |
| Value-field choice lists (regions, SKUs, warehouse sizes) | Stale quickly | Keep them in a separate data file per pack, with `as_of` |

## 4. SPA and deployment readiness

The spec has no server, so it fits a static deployment. It doesn't yet say anything about
hosting. The requirements, checked against the current docs:

- **Cloudflare:** deploy as a Worker with static assets (the migration guide moves Pages
  projects there). The SPA needs `assets.not_found_handling = "single-page-application"`
  in `wrangler.jsonc`, and custom headers such as the CSP go in a `_headers` file. No Worker
  script is needed. Docs:
  <https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/>,
  <https://developers.cloudflare.com/workers/static-assets/headers/>
- **Vercel:** `vercel.json` with a rewrite of `/(.*)` to `/index.html`, and a `headers` block
  for the CSP. Docs: <https://vercel.com/docs/frameworks/frontend/vite>
- **One build, both hosts:** `vite build` to `dist/`, with both config files committed. To
  avoid fallback configuration altogether, hash routing (`/#/topic/…`) also works.
- **Missing from the spec:**
  - a repository licence (none today)
  - a product name and branding
  - a stance on analytics (the spec says opt-in only, but names no tool)
  - an accessibility target (WCAG 2.2 AA is the usual choice)
  - a performance budget for the bundle (the live app ships 600 KB in one chunk)

## 5. Decisions needed from you

Each one has a default the plan will use if you don't choose:

1. **Licence:** MIT for the code. Content under CC BY 4.0, so others can reuse the packs with
   credit.
2. **Host:** Cloudflare Workers static assets, with the Vercel config kept working as well.
3. **v1 scope:** decisions 1 to 29 in both packs, with 30 to 39 behind a "show proposed
   decisions" switch.
4. **Databricks cloud wording:** cloud-neutral, with Azure, AWS and GCP notes only where
   behaviour differs.
5. **Analytics:** none.
