# Decision catalogue: Fabric and Databricks packs

This catalogue lists the same 29 decisions, in the same five parts, for each platform. The
Fabric column follows the scope of the live workshop (release 2026.10.9). Option names are
shortened and the wording is mine. The Databricks column is a new pack written to match.
Decisions 30 to 36 are proposed additions that the live app does not cover.

**Bold** marks the suggested default. Where no option is bold, there is no default because
the answer depends on the situation. *(preview)* and *(gated)* mark options that weren't
generally available when this was checked. Product names were checked against vendor docs
on 2026-10-18; the content writers found two more renames that day (OpenSharing, Declarative
Automation Bundles). Before you ship a pack, check each fact again and put the URL in that option's
`sources[]`, because both vendors rename features often.

## Part 1. Architecture

| # | Decision | Fabric options | Databricks options |
|---|---|---|---|
| 1 | Medallion layers | Raw·Serving / **Bronze·Silver·Gold** / B·S·G + Mart; modifier: central Landing zone for mirrored or linked sources | Raw·Serving / **Bronze·Silver·Gold** / B·S·G + Mart; modifier: landing volume (UC Volume) for files and Auto Loader |
| 2 | Isolation strategy | Workspace per layer × env / Bronze+Silver shared, Gold separate / one workspace per env | **Catalog per domain × env, schema per layer** (`prod_sales.silver`) / catalog per env, schema per layer (`prod.silver`) / catalog per layer × env; modifier: workspace-catalog binding |
| 3 | Centralisation | **Central backbone + domain marts** / fully centralised | **Central backbone + domain catalogs** / fully centralised (one catalog per env) / federated domains with OpenSharing (formerly Delta Sharing) between them |
| 4 | Ingestion (source mapper, multi) | Copy job (bulk, incremental, CDC), Data Factory pipelines, Mirroring, Shortcuts, Notebooks, Dataflow Gen2, Eventstream; for Dataverse and Dynamics only: Fabric Link, Synapse Link | Lakeflow Connect (managed SaaS and DB connectors), Auto Loader (files), Lakehouse Federation (query in place), OpenSharing (inbound), notebooks or jobs (custom API), Structured Streaming / Kafka, partner ETL (Fivetran and similar) |
| 5 | Storage engine | Lakehouse only / Warehouse only / Lakehouse (B/S) + Warehouse (Gold) | **Managed UC tables** / external tables on own storage / mixed (external Bronze, managed S/G) |
| 6 | Transformation tool (multi) | Spark notebooks / T-SQL (needs Warehouse) / Dataflow Gen2 / dbt | Lakeflow pipelines (formerly DLT) / Spark notebooks + Lakeflow Jobs / SQL (materialized views, streaming tables) / dbt on SQL warehouse |
| 7 | Transformation location | Co-located per layer / separate engineering workspace | Jobs in the same workspace as the data / separate engineering workspace, with the prod catalog writable only by service principals |

## Part 2. Platform setup

| # | Decision | Fabric options | Databricks options |
|---|---|---|---|
| 8 | Cloud, region, residency | **Primary region** (field: Azure region) / multi-region | Cloud (Azure / AWS / GCP; field) + **primary region** / multi-region. One metastore per region |
| 9 | Compute strategy | **Single capacity + surge protection** (fields: SKU, surge protection level) / dev-prod split (needs ≥2 envs) / per BU / back-end vs front-end | **Serverless first** (jobs, SQL, notebooks) / classic clusters with policies / mixed: serverless SQL + classic jobs; field: SQL warehouse size |
| 10 | User licensing / entitlements (multi) | Free viewers on F64+ / Power BI Pro / PPU | Workspace entitlements: Workspace access (builders) / Databricks SQL access (analysts) / Consumer access (dashboard and Genie users); plus dashboard sharing to account users without workspace access. Con of sharing: dashboards run on the publisher's embedded credentials |
| 11 | Environments | Prod only / Dev+Prod / Dev+Test+Prod | Prod only / Dev+Prod / **Dev+Test+Prod** (as catalogs, and optionally separate workspaces) |
| 12 | Source control | Azure DevOps / GitHub / none | GitHub / Azure DevOps / GitLab / none (Git folders) |
| 13 | CI/CD (multi) | **Git + fabric-cicd** (needs Git) / deployment pipelines (needs ≥2 envs) / manual | **Declarative Automation Bundles (formerly Asset Bundles) for workloads + Terraform for account, workspace and UC infrastructure** / bundles only / manual |
| 14 | Disaster recovery | Built-in only (zone-redundant OneLake where the region has zones, plus Power BI BCDR) / cross-region OneLake replication + Git backup (opt-in per capacity; 30-day lock on changes; billed as BCDR storage and operations; KQL data, Activator, GraphQL, apps and other non-OneLake items need Git or rebuild) / active-active | Zone redundancy only / managed DR, active-passive *(gated; Enterprise plan, Mission Critical add-on, serverless, a workspace and metastore in each region)* / DIY active-passive (IaC redeploy + Deep Clone) / active-active |

## Part 3. Consumption

| # | Decision | Fabric options | Databricks options |
|---|---|---|---|
| 15 | BI workspace / serving pattern | Model and report split / single model+report / tiered / reports in Gold | Databricks-native (AI/BI dashboards) / **external BI (Power BI, Tableau) over SQL warehouse** / both |
| 16 | Semantic layer / query mode (multi) | Direct Lake on OneLake (no DirectQuery fallback, composite models, honours OneLake security) / Direct Lake on SQL endpoint (falls back to DirectQuery on SQL RLS and views) / Import / DirectQuery / per model | UC metric views (usable from native and external BI) / Power BI Import from SQL warehouse / Power BI DirectQuery / per model. Adaptive default follows #15: native → metric views, external → Import, plus metric views where metrics are shared |
| 17 | Distribution surfaces (multi) | **Org app** / workspace access / subscriptions / Excel live / mobile / embedded | AI/BI dashboards (published, scheduled) / Genie Agents / Databricks Apps / Lakebase (Postgres) behind apps / Excel and BI via ODBC/JDBC / embedded dashboards |
| 18 | Self-service posture | Consumers only / governed self-service / creator programme | Consumers only / **SQL self-service on Gold** (SQL editor, Genie Agents) / sandbox catalogs per team |
| 19 | Data sharing (surface) | OneLake shortcuts / SQL endpoint / OneLake direct / GraphQL API / external sharing | OpenSharing, formerly Delta Sharing (Databricks-to-Databricks and open) / Clean Rooms / Marketplace / SQL warehouse endpoint |
| 20 | AI readiness | Not now / **AI-ready foundations** / data-agent pilot (paid F2+ capacity; optional dedicated Copilot capacity) | Not now / **AI-ready foundations** (UC comments, tags, metric views) / Genie Agents or agent pilot (Agent Bricks, Model Serving) |
| 21 | DS / ML workloads (multi) | None / in Fabric / external (Databricks, Azure ML) | None / **in-platform** (MLflow, Feature Store in Unity Catalog, Model Serving) / external |

## Part 4. Access and governance

| # | Decision | Fabric options | Databricks options |
|---|---|---|---|
| 22 | Access management | **Entra security groups** / per-user grants | **Account-level groups synced through SCIM from the IdP** / per-user grants; modifier: service principals for all jobs |
| 23 | Row/column security (multi) | None / OneLake security roles (RLS and CLS across engines) / Entra-group RLS in the model / dynamic RLS (mapping table) | None / UC row filters + column masks / ABAC policies on governed tags / dynamic views |
| 24 | Personal data | **Isolated, with retention** / same path / out of scope | **Isolated schema + masks, with retention** / same path / out of scope |
| 25 | Retention and archival | Keep everything / **windows + archive** (field: online window) / formal schedule | Keep everything / **windows + archive** (Delta retention, VACUUM, cold storage) / formal schedule |
| 26 | Compliance and audit | Minimal / **audit-ready** / regulated | Minimal / **audit-ready** (system tables for audit and lineage, retained and queried) / regulated (compliance security profile, customer-managed keys) |

## Part 5. Operations and wrap-up

| # | Decision | Fabric options | Databricks options |
|---|---|---|---|
| 27 | Cost attribution | **Capacity-level** / chargeback by workspace or domain | Workspace-level / **chargeback from `system.billing.usage`: cluster tags on classic compute, serverless usage policies *(preview)* on serverless, budgets for alerting** |
| 28 | Monitoring and alerting | Reactive / **alerts + scheduled review** (field: cadence) / full observability | Reactive / **job alerts + SQL alerts on system tables + scheduled review** / full observability (data quality monitoring, external APM) |
| 29 | Naming conventions (form) | Workspaces, lakehouse/warehouse prefixes, pipelines/notebooks, schemas, dims/facts, columns, keys | Catalogs (`<env>_<domain>`), schemas (`bronze_<source>`, `silver`, `gold`), tables (`dim_`, `fct_`), jobs and pipelines, bundles, service principals, columns, keys |

## Proposed additions (30 to 36)

These decisions are missing from the live app, and an enterprise architecture review will
ask about them. They sit in a separate table so the 29 above stay in step with the live app.
In a build, they fit into Part 2 (30 to 33, 36) and Part 4 (34, 35). They are ordinary
topics with `status: proposed`, so the lint and the engine treat them like the others, and a
pack can drop any of them through `topics_exclude`.

| # | Decision | Fabric options | Databricks options |
|---|---|---|---|
| 30 | Network and private connectivity | Public endpoints / tenant-level private link / workspace-level private links + managed VNets + outbound access protection; trusted workspace access for firewalled storage | Public endpoints + IP access lists / front-end and back-end Private Link / VNet injection (classic) + network connectivity configs for serverless egress |
| 31 | Identity and automation principals | Workspace identity / service principals / user identity | Account-level service principals with OAuth / workload identity federation from CI / user tokens (discouraged) |
| 32 | Account and workspace topology | One tenant, workspaces per #2 | One account, one metastore per region, workspaces per env or per domain, workspace-catalog binding |
| 33 | Orchestration | Fabric pipelines / Apache Airflow job / external scheduler | Lakeflow Jobs / external Airflow / external scheduler |
| 34 | Data quality | Checks in notebooks / Purview data quality / third-party (Great Expectations and similar) | Pipeline expectations (Lakeflow pipelines) / data quality monitoring (anomaly detection, data profiling) / third-party |
| 35 | Secrets | Connections with stored credentials / Azure Key Vault references | Secret scopes (Databricks-backed or Key Vault-backed) / UC service credentials |
| 36 | Table format | Delta (default) / Iceberg interoperability through shortcuts | **Delta** / Delta + Iceberg reads (UniForm) / managed Iceberg |

## Cross-decision constraints (`requires`)

Fabric (from the live pack):

- `transform_tool = tsql_warehouse` requires `storage.engine in {warehouse_only, lakehouse_warehouse}` (block).
- `cap.strategy = split_dev_prod` requires `ops.environments in {dev_prod, dev_test_prod}` (block).
- `ops.deployment = git_fabric_cicd` requires `ops.git_platform in {ado, github}` (block).
- `ops.deployment = deployment_pipelines` requires `ops.environments in {dev_prod, dev_test_prod}` (block).

Fabric (proposed):

- `security = onelake_security` with `bi.query_mode any_of {direct_lake_sql}` (warn): Direct Lake on SQL endpoint doesn't honour OneLake security roles and falls back to DirectQuery.

Databricks (proposed):

- `ops.deployment = bundles_ci` requires `ops.git_platform not_in {none}` (block). Bundles alone can deploy from any checkout. CI needs a repository.
- `storage.engine = external_only` (warn): predictive optimisation runs only on managed tables.
- `isolation = catalog_per_env` with `environments = single_env` (warn): the catalog split adds nothing.
- `security any_of {abac}` with `access_management` other than account groups (warn). Unity Catalog grants and policies accept account-level groups only; workspace-local groups can't be used. Policies themselves can target users, groups or service principals.
- `dr in {managed_dr, active_active}` requires `region = multi_region` (block).
- `dr = managed_dr` requires a serverless compute option in #9 (block), and warns when #23 uses row filters, masks or ABAC, when #6 uses Lakeflow pipelines or materialized views and streaming tables, or when #25 uses archival. Managed DR doesn't replicate any of those.
- `dr = diy_active_passive` and `backup = deep_clone_backups` warn when #23 uses row filters, masks or ABAC, because deep clone isn't supported on those tables.

## Canvas presets

The Fabric preset draws sources, the optional Landing zone, layer boxes grouped into
workspaces, the model and report workspaces, and footer bands.

The Databricks preset draws:

- sources and ingestion lanes (Lakeflow Connect, Auto Loader, Federation, OpenSharing)
- a landing volume
- catalogs per domain and environment, with one schema per layer inside each
- serving: a SQL warehouse, then Dashboards, Genie Agents and Apps, then external BI
- a Unity Catalog governance band across the bottom (grants, row filters and masks, lineage)
- a footer badge for the bundles and Git platform

Effect types are generic. Each pack's `pack.yaml` supplies the labels.

| Effect | Fabric meaning | Databricks meaning |
|---|---|---|
| `layer_boxes` | Lakehouse/warehouse per layer | Schema per layer |
| `container_grouping` | Workspace bands | Catalog bands |
| `env_multiplier` | Env badge | Env badge, and repeats the catalog per environment |
| `layer_engines` | LH/WH per layer | Managed/external icon per layer |
| `bi_workspaces` | Model/report workspaces | Serving lane (native / external / both) |
| `lock` | RLS on model or OneLake roles | Filter/mask icon on Gold and Silver schemas |
| `footer_badge` | Git · ADO/GitHub | Bundles · GitHub/ADO/GitLab |
