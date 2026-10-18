# Architecture Decision Record

## Example Co · Databricks · 2026-10-19

_Pack release 2026.10.18 · prepared with Example facilitator_

## Executive summary

37 of 39 topics were decided, 1 left open and 1 parked. The platform uses Bronze, Silver, Gold, isolated by Catalog per domain and environment, with Dev, test and prod. 2 options rely on features in preview or gated access: Audit-ready, Chargeback from system.billing.usage.

## Open items

### Ownership and stewardship

**Status:** Open, no decision recorded.

Waiting for the data office to name domain owners.

## Decisions

### Medallion layers

**Decision:** Bronze, Silver, Gold

- Landing volume: Off

**Context:** Bronze, Silver and Gold were chosen. Bronze keeps each source in its raw state, so later layers can be rebuilt from it. Silver holds validated, cleaned and enriched tables, so data-quality rules live in one place. Gold holds the modelled, aggregated views that dashboards, ML and applications read. Each layer is a schema in Unity Catalog, as in the Databricks medallion guidance.

No landing volume was added. Every source connects directly and loads into Bronze tables. A volume can be added later, without changing Bronze, if file-based sources appear.

**Alternatives considered:** Raw and Serving; Bronze, Silver, Gold, Mart

### Isolation strategy

**Decision:** Catalog per domain and environment

- Workspace-catalog binding: Off

**Context:** A catalog per domain and environment was chosen, with one schema per layer (for example prod_sales.silver). Databricks treats the catalog as the primary unit of data isolation, so each domain owns its catalogs, grants access to its own groups and can be charged separately. Layers are schemas inside the catalog, which keeps the number of catalogs manageable.

Catalogs are not bound, so any workspace attached to the metastore can reach them and Unity Catalog grants are the only control. Binding can be added later for production catalogs.

**Alternatives considered:** Catalog per environment; Catalog per layer and environment

### Platform centralisation

**Decision:** Central backbone and domain catalogs

**Context:** A central backbone with domain catalogs was chosen. The platform team owns ingestion, conformed layers and shared standards, and each domain owns its catalogs, grants and pipelines within one metastore. Governance stays in one place without making the platform team a bottleneck for domain work.

**Alternatives considered:** Fully centralised; Federated domains with sharing

### Ingestion

**Decision:** Lakeflow Connect managed connectors

**Context:** Lakeflow Connect managed connectors were chosen for the sources they support. They take over authentication, incremental reads and schema changes, and write to streaming tables governed by Unity Catalog. Connectors in preview are listed with their release state.

**Alternatives considered:** Auto Loader; Lakehouse Federation; Inbound shares (OpenSharing); Custom notebooks and jobs; Structured Streaming and message buses; Partner ETL tools

### Storage engine

**Decision:** Managed tables

**Context:** Unity Catalog managed tables were chosen for all layers. Databricks manages their storage, optimisation and file cleanup, and they stay readable from outside through open APIs. External tables are reserved for data that must stay in formats or locations Unity Catalog cannot manage.

**Alternatives considered:** External tables; Mixed (external Bronze, managed Silver and Gold)

### Transformation tool

**Decision:** Lakeflow pipelines

**Context:** Lakeflow pipelines were chosen for declarative batch and streaming transformations. The pipeline owns its tables, manages dependencies and incremental updates, and enforces data quality expectations.

**Alternatives considered:** Spark notebooks and Lakeflow Jobs; SQL materialized views and streaming tables; dbt on a SQL warehouse

### Transformation location

**Decision:** Co-located with the data

**Context:** Transformations run in the same workspaces as the data. Databricks guidance to reserve direct MODIFY access on production tables for service principals is enforced through grants.

**Alternatives considered:** Separate engineering workspace

### Cloud, region and residency

**Decision:** One primary region

- Cloud: Azure Databricks
- Primary region: westeurope

**Context:** A single primary region was chosen. All workspaces attach to the one Unity Catalog metastore for that region, so grants, lineage and sharing stay in one place. Another region can be added later for disaster recovery or residency, with its own metastore.

**Alternatives considered:** More than one region

### Compute strategy

**Decision:** Serverless jobs; Serverless SQL warehouses; Serverless notebooks

- Default SQL warehouse size: 2X-Small

**Context:** Serverless compute was chosen for jobs, SQL warehouses and notebooks. Databricks manages scaling, runtime upgrades and optimisation, and no cluster creation permission is needed. Classic compute is limited to workloads that serverless does not support, and is governed by compute policies.

**Alternatives considered:** Classic jobs compute; Classic all-purpose compute

### User entitlements

**Decision:** Workspace access (builders)

**Context:** Workspace access was assigned to data engineers and scientists. It is granted through an account-level group, and viewers do not receive it.

**Alternatives considered:** Databricks SQL access (analysts); Consumer access (dashboard and Genie users); Dashboard sharing to account users

### Environments

**Decision:** Dev, test and prod

**Context:** Development, test and production environments were chosen. Each environment has its own catalogs, and code is promoted between them through bundle targets. Production changes are deployed by automation only, so every release has passed through test.

**Alternatives considered:** Production only; Dev and prod

### Source control

**Decision:** GitHub

**Context:** GitHub was chosen. Developers link accounts to Git folders, and CI/CD authenticates to Databricks as a service principal using workload identity federation instead of stored secrets.

**Alternatives considered:** Azure DevOps; GitLab; No Git provider

### CI/CD

**Decision:** Bundles deployed by CI; Terraform for platform infrastructure

**Context:** Declarative Automation Bundles were chosen for workloads and the Databricks Terraform provider for account, workspace and Unity Catalog infrastructure. Both are deployed from Git by CI under service principals, and production is changed only through that path.

**Alternatives considered:** Bundles deployed by hand; Manual deployment

### Disaster recovery

**Decision:** Zone redundancy only

**Context:** Zone redundancy only was chosen. The platform stays inside one region and relies on multi-zone resilience, with zone-redundant storage for workspace data. A regional outage is accepted as a risk, with recovery when the region returns.

**Alternatives considered:** DIY active-passive

**Not available (ruled out by earlier decisions):** Managed disaster recovery — Cross-region recovery needs a second region, so choose more than one region in the region decision.; Active-active — Cross-region recovery needs a second region, so choose more than one region in the region decision.

### Network and private connectivity

**Decision:** Public endpoints with access controls

**Context:** Public endpoints with access controls were chosen. Access to the workspace and account console is limited by context-based ingress rules, with IP access lists where they are still in use. Private connectivity is not required by current policy.

**Alternatives considered:** Front-end and back-end Private Link; Private Link, VNet injection and serverless NCC

### Identity for automation

**Decision:** Service principals with OAuth

**Context:** Service principals with OAuth machine-to-machine authentication were chosen for automation that cannot use federation. Client secrets are kept in a secret store and rotated on a schedule.

**Alternatives considered:** Workload identity federation; User personal access tokens

### Account and workspace topology

**Decision:** Workspace per environment

**Context:** One workspace per environment was chosen. Production catalogs are bound to the production workspace, and domains are separated by catalog and group inside each workspace.

**Alternatives considered:** Workspace per domain and environment; Single workspace

### Orchestration

**Decision:** Lakeflow Jobs

**Context:** Lakeflow Jobs were chosen for orchestration. Pipelines, notebooks and SQL tasks run as jobs with triggers and alerts, and run history is queried through system tables.

**Alternatives considered:** Apache Airflow; Another external scheduler

### Table format

**Decision:** Delta Lake

**Context:** Delta Lake was chosen as the table format. It is the default for Unity Catalog managed tables and has the broadest feature support on the platform. External engines that need Iceberg are handled case by case.

**Alternatives considered:** Delta with Iceberg reads (UniForm); Managed Iceberg

### BI and serving pattern

**Decision:** External BI over a SQL warehouse

**Context:** External BI tools were chosen as the main reporting layer, connected to Databricks SQL warehouses. Report authors keep their existing tools and skills. Shared metrics are defined once as Unity Catalog metric views, and access is governed by Unity Catalog, so the platform team does not rebuild reports in a second tool.

**Alternatives considered:** Databricks-native (AI/BI dashboards and Genie); Both native and external BI

### Semantic layer and query mode

**Decision:** Unity Catalog metric views; Power BI Import from a SQL warehouse

**Context:** Shared business metrics are defined as Unity Catalog metric views, so every tool that reads them gets the same numbers. Power BI models import from a SQL warehouse for speed, and switch to DirectQuery only where data must be current within minutes.

**Alternatives considered:** Power BI DirectQuery; Decide per model

### Distribution surfaces

**Decision:** AI/BI dashboards

**Context:** Published AI/BI dashboards were chosen as a distribution surface, with scheduled refresh and subscriptions. Dashboards that use shared data permissions are reviewed, because viewers see data under the publisher's credentials.

**Alternatives considered:** Genie Agents; Databricks Apps; Lakebase Postgres behind apps; ODBC and JDBC drivers; Embedded dashboards

### Self-service posture

**Decision:** SQL self-service on Gold

**Context:** Governed self-service was chosen. Trained users receive read access to Gold tables and metric views and can query them with the SQL editor and Genie Agents. Writing is limited to approved areas, so official figures come from one governed source.

**Alternatives considered:** Consumers only; Sandbox catalogs per team

### Data sharing

**Decision:** OpenSharing (formerly Delta Sharing)

**Context:** OpenSharing, formerly Delta Sharing, was chosen for sharing governed data outside the owning team. Shares are created by data owners and recipients are registered by the platform team. Sharing activity is reviewed through audit logs.

**Alternatives considered:** Clean Rooms; Databricks Marketplace; SQL warehouse endpoint

### AI readiness

**Decision:** AI-ready foundations

**Context:** AI-ready foundations were chosen. Gold tables carry descriptions and tags, shared measures are defined as metric views, and trusted assets are certified. No agent is built yet, but a later pilot can start from governed, documented data.

**Alternatives considered:** Not now; Genie Agent or agent pilot

### Data science and ML workloads

**Decision:** In-platform (MLflow, Feature Store, Model Serving)

**Context:** Machine learning workloads were placed in the platform. Experiments are tracked in MLflow, models and features are governed in Unity Catalog, and real-time inference uses Model Serving. Models therefore share the access control, lineage and audit of the data they learn from.

**Alternatives considered:** None yet; External ML platform

### Access management

**Decision:** Account-level groups synced from the identity provider

- Service principals for jobs: Off

**Context:** Access is granted to account-level groups that are synced from the identity provider. Membership changes in the identity provider flow to Databricks, so joiners, movers and leavers are handled once. Direct grants to individual users are avoided.

Jobs run under the identity of their owner. Access for a job is therefore tied to a person, and a job must be reassigned when its owner leaves.

**Alternatives considered:** Grants to individual users

### Row and column security

**Decision:** None

**Context:** No row or column security was applied. Access is granted per table, and tables that mix sensitivity levels are split so each table has a single audience.

**Alternatives considered:** Row filters and column masks; ABAC policies on governed tags; Dynamic views

### Personal data handling

**Decision:** Isolated schema, masks and retention

**Context:** Personal data is isolated in dedicated schemas with column masks, and only the minimum fields flow into shared Silver and Gold layers. Deletion requests are applied to the source and propagated downstream, and VACUUM runs after deletes so removed records leave storage. Retention rules are set per dataset.

**Alternatives considered:** Same path as other data; Out of scope

### Retention and archival

**Decision:** Retention windows and archive

- Standard online window: 1 year

**Context:** Each dataset keeps data online for a defined window. Older data is archived to cheaper storage or deleted according to the dataset's rule. VACUUM and predictive optimization remove unreferenced files so deleted records leave storage, and table history is not used as a long-term backup.

**Alternatives considered:** Keep everything; Formal regulatory schedule

### Compliance and audit

**Decision:** Audit-ready

**Context:** An audit-ready posture was chosen. Audit and lineage system tables are enabled, copied to a retained table that meets the evidence period, and reviewed on a schedule. The compliance security profile and customer-managed keys are not enabled, because no regulated data is in scope.

**Alternatives considered:** Minimal; Regulated

**Maturity:** Audit-ready: preview

### Data quality

**Decision:** Pipeline expectations

**Context:** Pipeline expectations were chosen for record-level rules. Critical rules fail the update, less critical rules drop or flag records, and rule metrics are reviewed by the table owner.

**Alternatives considered:** Data quality monitoring; Third-party testing

### Secrets management

**Decision:** Azure Key Vault-backed secret scopes

**Context:** Secret scopes backed by Azure Key Vault were chosen. Secrets are created and rotated in the vault by the security team, and Databricks reads them through read-only scopes aligned to roles or applications.

**Alternatives considered:** Databricks-backed secret scopes; Unity Catalog service credentials and secrets

### Discovery and lineage

**Decision:** Unity Catalog lineage and Catalog Explorer

**Context:** Unity Catalog lineage and Catalog Explorer were chosen as the discovery and lineage tools. Owners keep descriptions and tags current, impact analysis uses lineage before schema changes, and external sources are registered as external assets.

**Alternatives considered:** External enterprise catalog

### Cost attribution

**Decision:** Chargeback from system.billing.usage

**Context:** Cost is attributed from the billable usage system table. Classic compute carries cluster tags, serverless compute carries tags from serverless usage policies, and budgets alert owners when spend passes their threshold. A dashboard on system.billing.usage supports monthly chargeback.

**Alternatives considered:** Workspace-level

**Maturity:** Chargeback from system.billing.usage: preview

### Monitoring and alerting

**Decision:** Job alerts, SQL alerts and scheduled review

- Review cadence: Weekly

**Context:** Job failure notifications and SQL alerts on system tables were chosen, with a scheduled review of runtime, cost and incidents. Notifications go to a team channel through a system destination, and a named owner runs the review.

**Alternatives considered:** Reactive; Full observability

### Naming conventions

**Decision:** Confirmed

| Section | Field | Agreed pattern |
| --- | --- | --- |
| Catalogs | Catalog pattern | <env>_<domain> (default) |
| Catalogs | Example | prod_sales (default) |
| Schemas | Bronze schema | bronze_<source> (default) |
| Schemas | Silver schema | silver (default) |
| Schemas | Gold schema | gold (default) |
| Tables and views | Dimension prefix | dim_ (default) |
| Tables and views | Fact prefix | fct_ (default) |
| Tables and views | Metric view prefix | mv_ (default) |
| Jobs, pipelines and bundles | Job and pipeline pattern | <domain>_<layer>_<purpose>_<env> (default) |
| Jobs, pipelines and bundles | Bundle name | <domain>-<purpose> (default) |
| Groups and service principals | Group pattern | <domain>-<role> (default) |
| Groups and service principals | Service principal pattern | sp-<domain>-<purpose>-<env> (default) |
| Columns and keys | Column style | snake_case (default) |
| Columns and keys | Surrogate key | <entity>_key (default) |
| Columns and keys | Business key | <entity>_id (default) |

**Context:** The naming conventions in this record were confirmed. They apply to every new object. Existing objects are renamed only when they are rebuilt. Names use lowercase letters, digits and underscores, so no object needs quoting in SQL.

## Parked for a later phase

### Backup and restore

**Status:** Parked for a later phase.

**Reason:** Revisit after the first production release.

## Appendix: sources

- [What is the medallion lakehouse architecture?](https://docs.databricks.com/aws/en/lakehouse/medallion)
- [Unity Catalog best practices](https://docs.databricks.com/aws/en/data-governance/unity-catalog/best-practices)
- [Lakeflow Connect connector concepts](https://docs.databricks.com/aws/en/ingestion/lakeflow-connect/)
- [Ingest with SQL and Spark APIs](https://docs.databricks.com/aws/en/ingestion/)
- [Unity Catalog managed tables for Delta Lake and Apache Iceberg](https://docs.databricks.com/aws/en/tables/managed)
- [Spark Declarative Pipelines on Lakeflow](https://docs.databricks.com/aws/en/ldp/)
- [Materialized views](https://docs.databricks.com/aws/en/ldp/concepts/materialized-views)
- [Azure Databricks regions](https://learn.microsoft.com/azure/databricks/resources/supported-regions)
- [Run your Lakeflow Jobs with serverless compute for workflows](https://docs.databricks.com/aws/en/jobs/run-serverless-jobs)
- [Connect to serverless compute](https://docs.databricks.com/aws/en/compute/serverless/)
- [Set up serverless SQL warehouses](https://docs.databricks.com/aws/en/admin/sql/serverless)
- [SQL warehouse types](https://docs.databricks.com/aws/en/compute/sql-warehouse/warehouse-types)
- [Serverless compute limitations](https://docs.databricks.com/aws/en/compute/serverless/limitations)
- [Manage entitlements](https://docs.databricks.com/aws/en/security/auth/entitlements)
- [Declarative Automation Bundles deployment modes](https://docs.databricks.com/aws/en/dev-tools/bundles/deployment-modes)
- [Workspace-catalog binding](https://docs.databricks.com/aws/en/data-governance/unity-catalog/access-control/workspace-catalog-binding)
- [Configure Git integration for Git folders](https://docs.databricks.com/aws/en/repos/repos-setup)
- [GitHub Actions](https://docs.databricks.com/aws/en/dev-tools/ci-cd/github)
- [Enable workload identity federation for GitHub Actions](https://docs.databricks.com/aws/en/dev-tools/auth/provider-github)
- [What are Declarative Automation Bundles?](https://docs.databricks.com/aws/en/dev-tools/bundles/)
- [CI/CD on Databricks](https://docs.databricks.com/aws/en/dev-tools/ci-cd/)
- [Databricks Terraform provider](https://docs.databricks.com/aws/en/dev-tools/terraform)
- [Reliability in Azure Databricks](https://learn.microsoft.com/azure/reliability/reliability-databricks)
- [Disaster recovery](https://docs.databricks.com/aws/en/admin/disaster-recovery)
- [Manage IP access lists](https://docs.databricks.com/aws/en/security/network/front-end/ip-access-list)
- [Networking](https://docs.databricks.com/aws/en/security/network/)
- [Authorize access to Databricks resources](https://docs.databricks.com/aws/en/dev-tools/auth/)
- [Service principals](https://docs.databricks.com/aws/en/admin/users-groups/service-principals)
- [Service principals on Azure Databricks](https://learn.microsoft.com/azure/databricks/admin/users-groups/service-principals)
- [Lakeflow Jobs](https://docs.databricks.com/aws/en/jobs/)
- [What is Delta Lake in Databricks?](https://docs.databricks.com/aws/en/delta/)
- [Unity Catalog metric views](https://docs.databricks.com/aws/en/uc-semantics/metric-views)
- [Connect Power BI Desktop to Azure Databricks](https://learn.microsoft.com/azure/databricks/partners/bi/power-bi/desktop)
- [Connect Tableau to Databricks](https://docs.databricks.com/aws/en/partners/bi/tableau)
- [Semantic model modes in the Power BI service](https://learn.microsoft.com/power-bi/connect-data/service-dataset-modes-understand)
- [Share a dashboard](https://docs.databricks.com/aws/en/dashboards/share/share)
- [Manage scheduled dashboard updates and subscriptions](https://docs.databricks.com/aws/en/dashboards/share/schedule-subscribe)
- [Create and manage a Genie Agent](https://docs.databricks.com/aws/en/genie-agents/set-up)
- [What is OpenSharing?](https://docs.databricks.com/aws/en/opensharing)
- [Databricks-to-Databricks sharing protocol](https://docs.databricks.com/aws/en/opensharing/share-data-databricks)
- [Databricks-to-Open sharing protocol](https://docs.databricks.com/aws/en/opensharing/share-data-open)
- [Add AI-generated comments to Unity Catalog objects](https://docs.databricks.com/aws/en/comments/ai-comments)
- [Flag data as certified or deprecated](https://docs.databricks.com/aws/en/data-governance/unity-catalog/certify-deprecate-data)
- [MLflow on Databricks](https://docs.databricks.com/aws/en/mlflow/)
- [Feature tables in Unity Catalog](https://docs.databricks.com/aws/en/machine-learning/feature-store/uc/feature-tables-uc)
- [Deploy models using Model Serving](https://docs.databricks.com/aws/en/machine-learning/model-serving/)
- [Sync users and groups from your identity provider using SCIM](https://docs.databricks.com/aws/en/admin/users-groups/scim/)
- [Groups](https://docs.databricks.com/aws/en/admin/users-groups/groups)
- [Prepare your data for GDPR compliance](https://docs.databricks.com/aws/en/ldp/gdpr)
- [Row filters and column masks](https://docs.databricks.com/aws/en/data-governance/unity-catalog/filters-and-masks/)
- [Data Classification](https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-classification)
- [Work with table history](https://docs.databricks.com/aws/en/tables/history)
- [Remove unused data files with vacuum](https://docs.databricks.com/aws/en/tables/operations/vacuum)
- [Archival support in Databricks](https://docs.databricks.com/aws/en/optimizations/archive-delta)
- [Audit log system table reference](https://docs.databricks.com/aws/en/admin/system-tables/audit-logs)
- [Lineage system tables reference](https://docs.databricks.com/aws/en/admin/system-tables/lineage)
- [Manage data quality with pipeline expectations](https://docs.databricks.com/aws/en/ldp/expectations)
- [Secret management on Azure Databricks](https://learn.microsoft.com/azure/databricks/security/secrets/)
- [Secret management](https://docs.databricks.com/aws/en/security/secrets/)
- [Lineage in Unity Catalog](https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-lineage)
- [What is Catalog Explorer?](https://docs.databricks.com/aws/en/catalog-explorer/)
- [Discover data](https://docs.databricks.com/aws/en/discover/)
- [Monitor costs using system tables](https://docs.databricks.com/aws/en/admin/usage/system-tables)
- [Use tags to attribute and track usage](https://docs.databricks.com/aws/en/admin/account-settings/usage-detail-tags)
- [Attribute usage with serverless usage policies](https://docs.databricks.com/aws/en/admin/usage/budget-policies)
- [Create and monitor budgets](https://docs.databricks.com/aws/en/admin/account-settings/budgets)
- [Add notifications on a job](https://docs.databricks.com/aws/en/jobs/notifications)
- [Databricks SQL alerts](https://docs.databricks.com/aws/en/sql/user/alerts/)
- [System tables reference](https://docs.databricks.com/aws/en/admin/system-tables/)
