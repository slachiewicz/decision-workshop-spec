# Decision catalogue: Fabric and Databricks packs

This catalogue lists the same 29 decisions, in the same five parts, for each platform. The
Fabric column follows the scope of the live workshop (release 2026.10.9). Option names are
shortened and the wording is mine. The Databricks column is a new pack written to match.
**Bold** marks the suggested default, and "—" means it depends on the situation, so there is
no default. Before you ship a pack, check each vendor fact against the current docs and put
the URL in that option's `sources[]`. Both vendors rename features often.

## Part 1. Architecture

| # | Decision | Fabric options | Databricks options |
|---|---|---|---|
| 1 | Medallion layers | Raw·Serving / **Bronze·Silver·Gold** / B·S·G + Mart; modifier: central Landing zone for mirrored or linked sources | Raw·Serving / **Bronze·Silver·Gold** / B·S·G + Mart; modifier: landing volume (UC Volume) for files and Auto Loader |
| 2 | Isolation strategy | Workspace per layer × env / Bronze+Silver shared, Gold separate / one workspace per env | Catalog per env, schema per layer (**`dev.silver`**) / catalog per layer × env / catalog per domain × env; modifier: workspace-catalog binding |
| 3 | Centralisation | **Central backbone + domain marts** / fully centralised | **Central backbone + domain catalogs** (data mesh-lite) / fully centralised / federated domains with Delta Sharing between them |
| 4 | Ingestion (source mapper, multi) | Data Factory pipelines, Fabric Link, Synapse Link, Shortcuts, Mirroring, Notebooks, Dataflow Gen2, Eventstream | Lakeflow Connect (managed SaaS/DB connectors), Auto Loader (files), Lakehouse Federation (query in place), Delta Sharing (inbound), notebooks/jobs (custom API), Structured Streaming / Kafka, partner ETL (Fivetran and similar) |
| 5 | Storage engine | Lakehouse only / Warehouse only / Lakehouse (B/S) + Warehouse (Gold) | **Managed UC tables** / external tables on own storage / mixed (external Bronze, managed S/G); modifier: Iceberg reads (UniForm) |
| 6 | Transformation tool (multi) | Spark notebooks / T-SQL (needs Warehouse) / Dataflow Gen2 / dbt | Lakeflow Declarative Pipelines (formerly DLT) / Spark notebooks + Lakeflow Jobs / SQL (materialized views, streaming tables) / dbt on SQL warehouse |
| 7 | Transformation location | Co-located per layer / separate engineering workspace | Jobs in the same workspace as the data / separate engineering workspace with prod catalog bound read-write only for service principals |

## Part 2. Platform setup

| # | Decision | Fabric options | Databricks options |
|---|---|---|---|
| 8 | Cloud, region, residency | **Primary region** (field: Azure region) / multi-region | Cloud choice (Azure / AWS / GCP; field) + **primary region** / multi-region; metastore is one per region |
| 9 | Compute strategy | **Single capacity + surge protection** (field: SKU) / dev-prod split (needs ≥2 envs) / per BU / back-end vs front-end | **Serverless first** (jobs, SQL, notebooks) / classic clusters with policies / mixed: serverless SQL + classic jobs; field: SQL warehouse size |
| 10 | User licensing / entitlements (multi) | Free viewers on F64+ / Power BI Pro / PPU | Workspace users vs SQL-only consumers / account-level SCIM groups / AI/BI dashboard viewers shared without workspace access |
| 11 | Environments | Prod only / Dev+Prod / Dev+Test+Prod | Prod only / Dev+Prod / **Dev+Test+Prod** (as catalogs, and optionally separate workspaces) |
| 12 | Source control | Azure DevOps / GitHub / none | GitHub / Azure DevOps / GitLab / none (Git folders) |
| 13 | CI/CD (multi) | **Git + fabric-cicd** (needs Git) / deployment pipelines (needs ≥2 envs) / manual | **Asset Bundles + CI** (needs Git) / Terraform for workspace & UC infrastructure / manual |
| 14 | Disaster recovery | Availability zones only / cross-region DR + Git backup / active-active | Cloud-native zone redundancy only / **cross-region: IaC redeploy + Deep Clone or replicated storage** / active-active (secondary workspace + metastore) |

## Part 3. Consumption

| # | Decision | Fabric options | Databricks options |
|---|---|---|---|
| 15 | BI workspace / serving pattern | Model and report split / single model+report / tiered / reports in Gold | Databricks-native (AI/BI dashboards) / **external BI (Power BI/Tableau) over SQL warehouse** / both, with metric views as the shared semantic layer |
| 16 | Semantic layer / query mode (multi) | Direct Lake / Import / DirectQuery / per model / composite | UC metric views / Power BI Import from SQL warehouse / Power BI DirectQuery / per model; adaptive default follows #15 |
| 17 | Distribution surfaces (multi) | **Org app** / workspace access / subscriptions / Excel live / mobile / embedded | AI/BI dashboards (published, scheduled) / Genie spaces / Databricks Apps / Excel and BI via ODBC/JDBC / embedded dashboards |
| 18 | Self-service posture | Consumers only / governed self-service / creator programme | Consumers only / **SQL self-service on Gold** (SQL editor, Genie) / sandbox catalogs per team |
| 19 | Data sharing (surface) | OneLake shortcuts / SQL endpoint / OneLake direct / GraphQL API / external sharing | Delta Sharing (D2D and open) / Clean Rooms / Marketplace / SQL warehouse endpoint / Lakebase (Postgres) for apps |
| 20 | AI readiness | Not now / **AI-ready foundations** / data-agent pilot (Copilot) | Not now / **AI-ready foundations** (UC comments, tags, metric views) / Genie or agent pilot (Agent Bricks, Model Serving) |
| 21 | DS / ML workloads (multi) | None / in Fabric / external (Databricks, Azure ML) | None / **in-platform** (MLflow, Feature Store, Model Serving) / external |

## Part 4. Access and governance

| # | Decision | Fabric options | Databricks options |
|---|---|---|---|
| 22 | Access management | **Entra security groups** / per-user grants | **Account groups synced through SCIM from the IdP** / per-user grants; modifier: service principals for all jobs |
| 23 | Row/column security (multi) | None / Entra-group RLS / dynamic RLS (mapping table) | None / UC row filters + column masks / ABAC policies on governed tags / dynamic views; covers every engine, not only BI |
| 24 | Personal data | **Isolated, with retention** / same path / out of scope | **Isolated schema + masks, with retention** / same path / out of scope |
| 25 | Retention and archival | Keep everything / **windows + archive** (field: online window) / formal schedule | Keep everything / **windows + archive** (Delta retention, VACUUM, cold storage) / formal schedule |
| 26 | Compliance and audit | Minimal / **audit-ready** / regulated | Minimal / **audit-ready** (system tables: audit, lineage, retained and queried) / regulated (compliance security profile, customer-managed keys) |

## Part 5. Operations and wrap-up

| # | Decision | Fabric options | Databricks options |
|---|---|---|---|
| 27 | Cost attribution | **Capacity-level** / chargeback by workspace or domain | Workspace-level / **tags + serverless budget policies → `system.billing`** chargeback |
| 28 | Monitoring and alerting | Reactive / **alerts + scheduled review** (field: cadence) / full observability | Reactive / **job alerts + SQL alerts on system tables + scheduled review** / full observability (Lakehouse Monitoring, external APM) |
| 29 | Naming conventions (form) | Workspaces, lakehouse/warehouse prefixes, pipelines/notebooks, schemas, dims/facts, columns, keys | Catalogs (`<env>_<domain>`), schemas (`bronze_<source>`, `silver`, `gold`), tables (`dim_`, `fct_`), jobs/pipelines, bundles, service principals, columns, keys |

## Cross-decision constraints (`requires`)

Fabric (from the live pack):

- `transform_tool = tsql_warehouse` requires `storage.engine ∈ {warehouse_only, lakehouse_warehouse}`.
- `cap.strategy = split_dev_prod` requires `ops.environments ∈ {dev_prod, dev_test_prod}`.
- `ops.deployment = git_fabric_cicd` requires `ops.git_platform ∈ {ado, github}`.
- `ops.deployment = deployment_pipelines` requires `ops.environments ∈ {dev_prod, dev_test_prod}`.

Databricks (proposed):

- `ops.deployment = asset_bundles` requires `ops.git_platform ≠ none`.
- `storage.engine = external_only` rules out "managed-table only" features in #16 and #20 (predictive optimisation, some metric-view paths). Show these as a soft warning.
- `isolation = catalog_per_env` with `environments = single_env` is redundant. Use a soft warning.
- `security ∋ abac` requires `access.groups = scim_groups`, because the policies key on account groups.
- `dr = active_active` requires `region = multi_region`.
- `bi.query_mode ∋ metric_views` requires `bi.pattern ∈ {native, both}`. Adaptive default: if #15 is external BI, recommend Import.

## Canvas presets

The Fabric preset draws sources, the optional Landing zone, layer boxes grouped into
workspaces, the model and report workspaces, and footer bands.

The Databricks preset draws:

- sources and ingestion lanes (Lakeflow Connect, Auto Loader, Federation, Sharing)
- a landing volume
- catalogs per environment, with one schema per layer inside each
- serving: a SQL warehouse, then Dashboards, Genie and Apps, then external BI
- a Unity Catalog governance band across the bottom (grants, row filters and masks, lineage)
- a footer badge for the bundles and Git platform

| Effect | Fabric meaning | Databricks meaning |
|---|---|---|
| `layer_boxes` | Lakehouse/warehouse per layer | Schema per layer |
| `workspace_grouping` | Workspace bands | Catalog bands (`catalog_grouping`) |
| `env_multiplier` | Env badge | Env badge, and repeats the catalog per environment |
| `layer_engines` | LH/WH per layer | Managed/external icon per layer |
| `bi_workspaces` | Model/report workspaces | Serving lane (native / external / both) |
| `lock` | RLS on model | Filter/mask icon on Gold and Silver schemas |
| `footer_badge` | Git · ADO/GitHub | Bundles · GitHub/ADO/GitLab |
