# Architecture Decision Record

## Example Co · Microsoft Fabric · 2026-10-19

_Pack release 2026.10.18 · prepared with Example facilitator_

## Executive summary

37 of 39 topics were decided, 1 left open and 1 parked. The platform uses Bronze, Silver, Gold, isolated by Workspace per layer and environment across Development, test and production. Storage: Lakehouse only; transformation: Spark notebooks; BI query mode: Direct Lake on OneLake. 1 option relies on features in preview or gated access: Alerts and scheduled review (job alerts built on Activator are in preview; failure e-mails are not).

## Open items

### Ownership and stewardship

**Status:** Open, no decision recorded.

Waiting for the data office to name domain owners.

## Decisions

### Medallion layers

**Decision:** Bronze, Silver, Gold

- Central landing zone: Off

**Context:** Bronze, Silver and Gold were chosen. Bronze keeps each source as it arrived, so any later layer can be rebuilt from it. Silver holds cleaned, deduplicated and conformed tables, so data-quality rules live in one place and can be rerun. Gold holds the business-ready facts and dimensions that semantic models read. Each layer maps onto its own lakehouse or warehouse, in line with Microsoft's medallion guidance for OneLake.

No separate landing zone was added. Every source is copied into Bronze, which already plays that role. One can be added later, without changing Bronze, if a mirrored or shortcut source is introduced.

**Alternatives considered:** Raw and Serving; Bronze, Silver, Gold, Mart

### Workspace isolation strategy

**Decision:** Workspace per layer and environment

**Context:** Separate workspaces per layer and environment were chosen, following Microsoft's guidance that each medallion layer sits in its own lakehouse and that a workspace per layer gives the most control. Access, capacity and deployment can then differ for each layer, at the cost of more workspaces to administer.

**Alternatives considered:** Bronze and Silver shared, Gold separate; One workspace per environment

### Platform centralisation

**Decision:** Central backbone with domain Gold workspaces

- Platform owner: Data platform team

**Context:** A central backbone with domain Gold workspaces was chosen. A central team owns ingestion and the shared Bronze and Silver layers, and each business domain builds and owns its own Gold workspace on top. Identity, security and lineage stay central, which follows the domain-oriented data mesh pattern that Microsoft describes for OneLake.

**Alternatives considered:** Fully centralised

### Ingestion mechanisms

**Decision:** Copy job; Mirroring; OneLake shortcuts

**Context:** Copy job was chosen for raw ingestion into Bronze. It handles bulk, incremental and CDC loads for the supported connectors without a hand-built pipeline, and transformation is left to later layers. Mirroring was chosen for supported operational databases. It replicates changes into OneLake without a pipeline, and the mirrored database serves as the Bronze copy for those sources. OneLake shortcuts were chosen for data that already sits in storage the team owns. The data is referenced rather than copied, which avoids a second copy and the load job that would maintain it.

**Alternatives considered:** Data Factory pipelines; Notebooks; Dataflow Gen2; Eventstream; Fabric Link (Dataverse); Azure Synapse Link (Dataverse)

### Storage engine

**Decision:** Lakehouse only

**Context:** Lakehouses were chosen for every layer. The team works mainly in Spark and notebooks, and T-SQL users only need to read, which the SQL analytics endpoint supports.

**Alternatives considered:** Warehouse only; Lakehouse for Bronze and Silver, Warehouse for Gold

### Transformation tools

**Decision:** Spark notebooks

**Context:** Spark notebooks were chosen for the main transformation layers. The engineering team works in PySpark and needs code-level control over large Delta tables.

**Alternatives considered:** Dataflow Gen2; dbt

**Not available (ruled out by earlier decisions):**
- T-SQL in a warehouse — T-SQL transformations run in a Fabric warehouse. Choose Warehouse only, or Lakehouse plus Warehouse, in the storage engine decision.

### Transformation location

**Decision:** Co-located with each layer

**Context:** Transformation items were co-located with the layer they write. This keeps write access scoped to the layer's own workspace and avoids cross-workspace paths, and code is promoted together with the data items it belongs to.

**Alternatives considered:** Separate engineering workspace

### Region and data residency

**Decision:** Single primary region

- Azure region: West Europe

**Context:** A single primary region was chosen. Capacities and their OneLake data sit in one Azure region that satisfies the residency requirements. Further regions are added through Multi-Geo only when a specific legal or latency reason is stated, because each added region brings its own capacities, disaster recovery plan and cost.

**Alternatives considered:** Multiple regions

### Capacity strategy

**Decision:** Single capacity with surge protection

- Starting SKU: F64
- Surge protection level: Capacity level

**Context:** A single shared capacity with surge protection was chosen. All workloads draw on one pool, which uses capacity efficiently, and surge protection rejects background work before the capacity reaches deep throttling. The capacity is monitored with the Fabric Capacity Metrics app, and it is split only if measured contention or chargeback needs justify a second one.

**Alternatives considered:** Separate capacities for development and production; Capacity per business unit; Back-end and front-end capacities

### Who gets access to what, and what it costs

**Decision:** Free viewers on F64 or larger

**Context:** Free viewers on an F64 or larger capacity were chosen. Most users only read reports, so per-user licensing is avoided for them, and the cost of the larger capacity is accepted. Authors keep Pro or PPU licenses.

**Alternatives considered:** Power BI Pro per user; Power BI Premium Per User

### Environments

**Decision:** Development, test and production

**Context:** Development, test and production environments were chosen. Changes are built in development and validated in a test stage with production-like data before they are promoted, which follows Microsoft's deployment patterns. The cost is a third set of workspaces to run.

**Alternatives considered:** Production only; Development and production

### Source control

**Decision:** Azure DevOps

**Context:** Azure DevOps was chosen as the Git provider. The organisation already uses Azure Repos and Azure Pipelines, and Fabric connects with Microsoft Entra identities, including a service principal for automation.

**Alternatives considered:** GitHub; No source control

### CI/CD and deployment

**Decision:** Git with fabric-cicd

**Context:** Git with fabric-cicd was chosen as the deployment approach. Item definitions live in the repository, and a pipeline in the Git platform publishes them to each environment's workspace with environment-specific parameters and manual approvals. This is the code-first option that Microsoft's Fabric CI/CD guidance recommends.

**Alternatives considered:** Deployment pipelines; Manual promotion

### Disaster recovery

**Decision:** Built-in resilience only

**Context:** Built-in resilience only was chosen. Zone-redundant OneLake storage and Power BI business continuity meet the stated recovery needs, and the business accepts waiting for the region to be restored after a regional disaster.

**Alternatives considered:** Cross-region replication and Git backup

**Not available (ruled out by earlier decisions):**
- Active-active across regions — Active-active needs capacities in at least two regions. Choose Multiple regions in the region decision.

### Network and private connectivity

**Decision:** Public endpoints

**Context:** Public endpoints were chosen. Access is protected by Microsoft Entra sign-in and Conditional Access, no policy requires private connectivity, and the team keeps the full feature set. Firewalled storage is reached through trusted workspace access.

**Alternatives considered:** Tenant-level private link; Workspace-level private links with outbound protection

### Identity for automation

**Decision:** Workspace identity; Service principals

**Context:** Workspace identities were chosen for Fabric items that connect to Azure storage and other supported sources. Fabric manages the credentials, and access is granted to the identity on the target resource. Service principals were chosen for deployment pipelines and API automation. The tenant setting is limited to a dedicated security group, each principal holds the lowest workspace role that works, and secrets are stored in a managed vault and rotated.

**Alternatives considered:** User identity

### Tenant and domain topology

**Decision:** Workspaces mapped to Fabric domains

**Context:** Workspaces were mapped to Fabric domains, with a separate central domain for shared infrastructure. Each domain has a named admin, and governance settings that suit it are delegated, which keeps ownership clear as the workspace count grows.

**Alternatives considered:** Flat set of workspaces

### Orchestration

**Decision:** Fabric pipelines

**Context:** Fabric pipelines were chosen as the orchestrator. They are built into Fabric, the team prefers a visual designer, and they run the notebooks, copy jobs and dataflows that make up the workflows, with schedules and failure alerts.

**Alternatives considered:** Apache Airflow job; External scheduler

### Table format

**Decision:** Delta only

**Context:** Delta was chosen as the table format. Every Fabric engine writes Delta to OneLake by default, and it gives ACID transactions, time travel and the optimisations that Fabric's engines expect. Iceberg interoperability can be added later for a specific consumer without changing the stored tables.

**Alternatives considered:** Delta with Iceberg interoperability

### BI workspace and serving pattern

**Decision:** Model and report split

**Context:** Semantic models and reports were placed in separate workspaces. Model owners hold edit rights in the model workspace, and report authors publish to their own workspaces with Read and Build permission on the shared model. Row-level security therefore stays in force for authors, and ownership of each item is clear.

**Alternatives considered:** Single workspace; Tiered split; Reports in the Gold workspace

### Semantic model storage mode

**Decision:** Direct Lake on OneLake

**Context:** Direct Lake on OneLake was chosen as the default for semantic models over Gold. Models read Delta tables in OneLake without a scheduled import, they don't fall back to DirectQuery, and they honour OneLake security roles, so row and column rules defined on the lakehouse apply in reports too. Import stays available for models that combine Fabric data with other sources.

**Alternatives considered:** Direct Lake on SQL endpoint; Import; DirectQuery; Decide per model

### Report distribution surfaces

**Decision:** Org app

**Context:** Org apps were chosen as the main way to distribute reports. An org app packages selected reports with audiences, so consumers see a curated view without access to the whole workspace. Other surfaces are added only for audiences that need them.

**Alternatives considered:** Workspace Viewer access; Email subscriptions; Excel live connection; Power BI mobile apps; Embedded in your application

### Self-service posture

**Decision:** Governed self-service

**Context:** Governed self-service was chosen. A central team maintains and certifies shared semantic models, and business users build reports on them with Read and Build permission in their own workspaces. Row-level security stays in force for those creators.

**Alternatives considered:** Consumers only; Creator programme

### Data sharing surfaces

**Decision:** OneLake shortcuts; SQL analytics endpoint

**Context:** OneLake shortcuts were chosen for sharing inside the tenant. Consumers read Gold tables in place, with no second copy, and access is the intersection of rights on the shortcut path and the target. Data residency is therefore unchanged by sharing. The SQL analytics endpoint was opened for consumers who work in T-SQL. It gives read-only access to Delta tables, and security is set with SQL permissions on views and tables. Teams that need writes use Spark or a warehouse instead.

**Alternatives considered:** OneLake storage APIs; API for GraphQL; External data sharing

### AI readiness

**Decision:** AI-ready foundations

**Context:** AI-ready foundations were chosen. Tables and models are described and endorsed, tenant settings are scoped to named groups, and no agent is published yet. This prepares the platform for a pilot without moving data outside its geography before a use case exists.

**Alternatives considered:** Not now; Data agent pilot

### Data science and ML workloads

**Decision:** None yet

**Context:** No machine learning workloads were planned at this stage. The question is revisited when a team brings a concrete use case, and no ML tooling is provisioned in the meantime.

**Alternatives considered:** In Fabric; External platform

### Access management

**Decision:** Entra groups

**Context:** Roles are assigned to Microsoft Entra groups, not to individuals. Group membership is the one place where access changes, workspace roles map to groups per workspace, and individual grants are limited to documented, short-lived exceptions.

**Alternatives considered:** Individual grants

### Row and column security

**Decision:** OneLake security roles

**Context:** OneLake security roles were chosen to enforce table, row and column rules in one place for all Fabric engines. Consumers hold the Viewer role, and row and column rules are combined in one role per user. Editing roles in the workspace are limited to the platform team.

**Alternatives considered:** No row or column rules; Model RLS by group; Dynamic RLS with a mapping table

### Personal data handling

**Decision:** Isolated and minimised

**Context:** Personal data is isolated and minimised. Direct identifiers sit in separate, tightly controlled tables, and later layers carry only what reports need. A request to find or delete a person's data therefore touches a small, known set of tables.

**Alternatives considered:** Same path as other data; Out of scope

### Retention and archival

**Decision:** Windows and archive

- Online window: 3 years

**Context:** Data stays online for the chosen window and then moves to cooler storage tiers by lifecycle rule. Delta tables are vacuumed on the default seven-day threshold or longer, and the online window is recorded with the decision so audits can check it.

**Alternatives considered:** Keep everything; Regulatory schedule

### Compliance and audit

**Decision:** Audit-ready

**Context:** An audit-ready posture was chosen. Fabric activity is retained beyond the default window, audit events are reviewed on a schedule, and OneLake data access is logged. Key and region controls stay at platform defaults until a regulation requires more.

**Alternatives considered:** Minimal; Regulated

### Data quality

**Decision:** Checks in notebooks and views

**Context:** Quality checks run inside processing. Constraints on materialized lake views and checks in notebooks stop or filter bad rows between layers, and failures raise a job alert. The team maintains the rules as code in Git.

**Alternatives considered:** Purview data quality; Third-party tool

### Secrets and credentials

**Decision:** Key Vault references

**Context:** Azure Key Vault references were chosen for connections to supported connectors. Secrets stay in the vault and rotate there, and Fabric reads the latest version at connection time. Sources that cannot use references fall back to stored connections.

**Alternatives considered:** Stored connections

### Discovery and lineage

**Decision:** OneLake catalog

**Context:** The OneLake catalog was chosen for discovery and lineage. Teams curate descriptions and endorsement on their items, domains filter the view, and lineage supports impact analysis. Sources outside Fabric are not catalogued here.

**Alternatives considered:** Purview Unified Catalog

### Cost attribution

**Decision:** Capacity-level

**Context:** Cost is attributed at capacity level. The platform team carries the capacity bill and reports consumption by workspace and item from the Capacity Metrics app. Chargeback to teams can be added later if workspaces map cleanly to owners.

**Alternatives considered:** Chargeback by workspace or domain

### Monitoring and alerting

**Decision:** Alerts and scheduled review

- Review cadence: Monthly

**Context:** Alerts plus a scheduled review were chosen. Job failures and capacity thresholds raise alerts to named recipients, and the owner reviews capacity and job health on a fixed cadence. Full log collection is left for later.

**Alternatives considered:** Reactive; Full observability

**Maturity:** Alerts and scheduled review: preview (job alerts built on Activator are in preview; failure e-mails are not)

### Naming conventions

**Decision:** Confirmed

| Section | Field | Agreed pattern |
| --- | --- | --- |
| Workspaces | Data workspace pattern | `{domain}-{layer}-{env}` (default) |
| Workspaces | Reporting workspace pattern | `{domain}-reports-{env}` (default) |
| Workspaces | Environment tokens | `dev, test, prod` (default) |
| Items | Lakehouse prefix | `lh_` (default) |
| Items | Warehouse prefix | `wh_` (default) |
| Items | Pipeline prefix | `pl_` (default) |
| Items | Notebook prefix | `nb_` (default) |
| Items | Semantic model prefix | `sm_` (default) |
| Schemas and tables | Bronze schema | `{source_system}` (default) |
| Schemas and tables | Silver schema | `{domain}` (default) |
| Schemas and tables | Gold schema | `{domain}` (default) |
| Schemas and tables | Dimension table prefix | `dim_` (default) |
| Schemas and tables | Fact table prefix | `fact_` (default) |
| Columns and keys | Column name style | `snake_case` (default) |
| Columns and keys | Surrogate key suffix | `_key` (default) |
| Columns and keys | Business key suffix | `_id` (default) |
| Columns and keys | Audit columns | `_ingested_at, _source_system` (default) |

**Context:** Naming conventions were confirmed for workspaces, items, schemas, tables, columns and keys. The patterns apply to all new objects, and existing objects are renamed only when they are next changed. The chosen patterns are listed with the decision.

## Parked for a later phase

### Backup and point-in-time restore

**Status:** Parked for a later phase.

**Reason:** Revisit after the first production release.

## Appendix: sources

- [Understand medallion architecture for Fabric with OneLake](https://learn.microsoft.com/fabric/onelake/onelake-medallion-lakehouse-architecture)
- [Microsoft OneLake patterns and foundational capabilities](https://learn.microsoft.com/fabric/onelake/architecture-patterns)
- [Fabric governance and security baselines](https://learn.microsoft.com/azure/cloud-adoption-framework/data/governance-security-baselines-fabric-data-lake-unify-data-platform)
- [Fabric domains](https://learn.microsoft.com/fabric/governance/domains)
- [Microsoft Fabric decision guide - Choose a data movement strategy](https://learn.microsoft.com/fabric/data-factory/decision-guide-data-movement)
- [Microsoft Fabric decision guide - Choose a data integration strategy](https://learn.microsoft.com/fabric/data-factory/decision-guide-data-integration)
- [What is Mirroring in Fabric?](https://learn.microsoft.com/fabric/mirroring/overview)
- [Get data into Microsoft Fabric](https://learn.microsoft.com/fabric/fundamentals/get-data)
- [Unify data with OneLake shortcuts and mirroring](https://learn.microsoft.com/fabric/onelake/unify-data)
- [Microsoft Fabric decision guide - Choose a data store](https://learn.microsoft.com/fabric/fundamentals/decision-guide-data-store)
- [Prepare and transform data in Microsoft Fabric](https://learn.microsoft.com/fabric/fundamentals/prepare-transform-data)
- [Choose a Microsoft Fabric deployment pattern](https://learn.microsoft.com/azure/architecture/data-guide/technology-choices/fabric-deployment-patterns)
- [Fabric region availability](https://learn.microsoft.com/fabric/admin/region-availability)
- [Configure Multi-Geo support for Fabric](https://learn.microsoft.com/fabric/admin/service-admin-premium-multi-geo)
- [Manage surge protection for Fabric capacities](https://learn.microsoft.com/fabric/enterprise/surge-protection)
- [Microsoft Fabric capacity planning guide - Scale for decentralized analytics](https://learn.microsoft.com/fabric/enterprise/capacity-planning-scale-self-service-analytics)
- [Understand Microsoft Fabric licenses and capacity](https://learn.microsoft.com/fabric/enterprise/licenses)
- [Power BI implementation planning - Subscriptions, licenses, and trials](https://learn.microsoft.com/power-bi/guidance/powerbi-implementation-planning-subscriptions-licenses-trials)
- [Introduction to deployment pipelines](https://learn.microsoft.com/fabric/cicd/deployment-pipelines/intro-to-deployment-pipelines)
- [What is Microsoft Fabric Git integration?](https://learn.microsoft.com/fabric/cicd/git-integration/intro-to-git-integration)
- [Automate git integration with a service principal in Azure DevOps](https://learn.microsoft.com/fabric/cicd/git-integration/automate-git-integration-with-service-principal)
- [Fabric CI/CD concepts and best practices](https://learn.microsoft.com/fabric/fundamentals/understand-best-practices-fabric-cicd)
- [CI/CD for Microsoft Fabric using Azure DevOps and the fabric-cicd Python package](https://learn.microsoft.com/fabric/cicd/tutorial-fabric-cicd-azure-devops)
- [Choose the best Fabric CI/CD workflow option for you](https://learn.microsoft.com/fabric/cicd/manage-deployment)
- [What is OneLake?](https://learn.microsoft.com/fabric/onelake/onelake-overview)
- [Reliability in Microsoft Fabric](https://learn.microsoft.com/fabric/security/reliability-fabric)
- [Trusted workspace access](https://learn.microsoft.com/fabric/security/security-trusted-workspace-access)
- [Workspace identity](https://learn.microsoft.com/fabric/security/workspace-identity)
- [Authenticate with workspace identity](https://learn.microsoft.com/fabric/security/workspace-identity-authenticate)
- [Developer tenant settings](https://learn.microsoft.com/fabric/admin/service-admin-portal-developer)
- [Service principals in Fabric Data Warehouse](https://learn.microsoft.com/fabric/data-warehouse/service-principals)
- [Tutorial - End-to-end automation in Fabric](https://learn.microsoft.com/fabric/cicd/tutorial-end-to-end-automation)
- [Best practices for planning and creating domains in Microsoft Fabric](https://learn.microsoft.com/fabric/governance/domains-best-practices)
- [What is Data Factory in Microsoft Fabric?](https://learn.microsoft.com/fabric/data-factory/data-factory-overview)
- [CI/CD for pipelines in Data Factory in Microsoft Fabric](https://learn.microsoft.com/fabric/data-factory/cicd-pipelines)
- [Lakehouse and Delta Lake tables](https://learn.microsoft.com/fabric/data-engineering/lakehouse-and-delta-tables)
- [Power BI implementation planning: Workspaces at the workspace level](https://learn.microsoft.com/power-bi/guidance/powerbi-implementation-planning-workspaces-workspace-level-planning)
- [Separate reports from models in Power BI Desktop](https://learn.microsoft.com/power-bi/guidance/report-separate-from-model)
- [Introduction to semantic models across workspaces](https://learn.microsoft.com/power-bi/connect-data/service-datasets-across-workspaces)
- [Direct Lake overview](https://learn.microsoft.com/fabric/fundamentals/direct-lake-overview)
- [Integrate Direct Lake security](https://learn.microsoft.com/fabric/fundamentals/direct-lake-security-integration)
- [Get started with org apps](https://learn.microsoft.com/power-bi/explore-reports/org-app-items)
- [Publish a workspace app in Power BI](https://learn.microsoft.com/power-bi/collaborate-share/service-create-distribute-apps)
- [Power BI usage scenarios: Managed self-service BI](https://learn.microsoft.com/power-bi/guidance/powerbi-implementation-planning-usage-scenario-managed-self-service-bi)
- [Promote and certify Power BI content with endorsement](https://learn.microsoft.com/power-bi/collaborate-share/service-endorsement-overview)
- [Power BI implementation planning: Content distribution and sharing](https://learn.microsoft.com/power-bi/guidance/powerbi-implementation-planning-content-distribution-sharing)
- [Shortcuts in a lakehouse](https://learn.microsoft.com/fabric/data-engineering/lakehouse-shortcuts)
- [OneLake shortcut security](https://learn.microsoft.com/fabric/onelake/onelake-shortcut-security)
- [What is the SQL analytics endpoint for a lakehouse?](https://learn.microsoft.com/fabric/data-engineering/lakehouse-sql-analytics-endpoint)
- [What is a lakehouse in Microsoft Fabric?](https://learn.microsoft.com/fabric/data-engineering/lakehouse-overview)
- [Enable and configure Copilot in Microsoft Fabric](https://learn.microsoft.com/fabric/fundamentals/copilot-enable-fabric)
- [Add a Fabric data agent as a tool in Microsoft Copilot Studio](https://learn.microsoft.com/fabric/data-science/data-agent-microsoft-copilot-studio-tool)
- [Analyze and train data in Microsoft Fabric](https://learn.microsoft.com/fabric/fundamentals/analyze-train-data)
- [Roles in workspaces in Microsoft Fabric](https://learn.microsoft.com/fabric/fundamentals/roles-workspaces)
- [Give users access to workspaces](https://learn.microsoft.com/fabric/fundamentals/give-access-workspaces)
- [Table, column, and row-level security in OneLake](https://learn.microsoft.com/fabric/onelake/security/table-column-row-security)
- [Create and manage OneLake security roles](https://learn.microsoft.com/fabric/onelake/security/create-manage-roles)
- [Data Subject Requests and the GDPR and CCPA](https://learn.microsoft.com/compliance/regulatory/gdpr-data-subject-requests)
- [Dynamic data masking in Fabric Data Warehouse](https://learn.microsoft.com/fabric/data-warehouse/dynamic-data-masking)
- [OneLake storage tiers](https://learn.microsoft.com/fabric/onelake/onelake-storage-tiers)
- [OneLake lifecycle management](https://learn.microsoft.com/fabric/onelake/onelake-lifecycle-management)
- [Learn about auditing solutions in Microsoft Purview](https://learn.microsoft.com/purview/audit-solutions-overview)
- [Track user activities in Microsoft Fabric](https://learn.microsoft.com/fabric/admin/track-user-activities)
- [Track user activities in Power BI](https://learn.microsoft.com/fabric/enterprise/powerbi/service-admin-auditing)
- [Data security in OneLake](https://learn.microsoft.com/fabric/onelake/security/get-started-security)
- [Data quality in materialized lake views](https://learn.microsoft.com/fabric/data-engineering/materialized-lake-views/data-quality)
- [Configure Azure Key Vault references](https://learn.microsoft.com/fabric/data-factory/azure-key-vault-reference-configure)
- [OneLake catalog overview](https://learn.microsoft.com/fabric/governance/onelake-catalog-overview)
- [Get started with Fabric governance](https://learn.microsoft.com/fabric/governance/get-started-with-fabric-governance)
- [Find and explore data in the OneLake catalog](https://learn.microsoft.com/fabric/governance/onelake-catalog-explore)
- [What is the Microsoft Fabric Capacity Metrics app?](https://learn.microsoft.com/fabric/enterprise/metrics-app)
- [Troubleshooting guide: Monitor and identify capacity usage](https://learn.microsoft.com/fabric/enterprise/capacity-planning-troubleshoot-consumption)
- [Set up job alerts in the Monitor hub (preview)](https://learn.microsoft.com/fabric/admin/monitoring-hub-alerts)
- [Monitor Fabric Capacity Health Using Capacity Overview Events](https://learn.microsoft.com/fabric/real-time-hub/tutorial-monitor-capacity-threshold)
- [Create custom alerts on Fabric capacity overview events in Real-Time hub](https://learn.microsoft.com/fabric/real-time-hub/set-custom-alerts-fabric-capacity-overview-events)
