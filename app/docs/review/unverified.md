# Facts awaiting phase 2 review

The phase 1 writers (A to D) couldn't confirm these from the docs they read. Each line gives
the topic number and option, then what to check. The phase 2 reviewers work from this list,
then spot-check everything else.

## Fabric

- **4 mirroring:** the option is `ga`, but some source types (Cosmos DB, Snowflake) are
  preview. Should the option name them?
- **6 dbt:** set to `preview` because the dbt job item is preview.
- **10 front_end_sku (rule reason):** the reason says the front-end capacity must be F64 or
  larger for free viewers. Confirm.
- **14 builtin_only:** Power BI BCDR isn't on by default in Sweden Central. Confirm the
  current region list.
- **15 tiered_split, reports_in_gold:** these definitions are the writer's reading of the
  Power BI planning pages.
- **19 graphql_api, external_sharing:** set to `ga` without a status label on the page.
- **23 onelake_security:** `ga`. Only third-party engine enforcement is preview.
- **25 windows_archive, regulatory_schedule:** OneLake storage tiers and lifecycle
  management show no status label.
- **27 capacity_level:** the Metrics app's redesigned report is preview, but the default
  report isn't.
- **28 alerts_review, full_observability:** set to `preview` (Activator job alerts, Monitor
  hub, workspace monitoring).
- **29 naming defaults:** these are proposals, not taken from Microsoft docs.
- **30 workspace_private_links:** `ga`. Outbound access protection shows no status label.
- **31 user_identity:** the con that "work breaks when the person leaves" is an inference.
- **33 external_scheduler:** no page read shows an external scheduler triggering Fabric runs
  through the REST API.
- **33 airflow_job:** set to `preview` from the Git integration and workspace identity
  pages.
- **34 notebook_checks:** whether materialized lake view constraints are GA.
- **36 delta_iceberg_interop:** `ga`. The docs conflict on where Iceberg shortcuts can sit.
- **39 platform_defaults:** the workspace recycle bin is preview, and the docs give two
  different retention minimums.
- **39 restore_points_and_git:** `preview`, because the warehouse data-retention page is
  titled preview. Restore points themselves may be GA.

## Databricks

- **4 lakeflow_connect:** connector release states vary. The per-connector pages weren't
  read.
- **4 partner_etl:** only the Fivetran page was read.
- **9 serverless_notebooks:** the serverless limitations page wasn't opened.
- **12 gitlab:** the CI/CD guides list GitHub Actions, Azure DevOps and Jenkins, but not
  GitLab CI.
- **14 managed_dr:** the region list and incompatible pairs were checked on Azure only.
- **17 lakebase_apps:** "Postgres roles are separate from Unity Catalog grants" is an
  inference.
- **19 delta_sharing:** the egress cost for cross-region or cross-cloud sharing is an
  inference.
- **19 marketplace:** the provider approval flow was read at overview level only.
- **19 sql_endpoint:** both cons are inferences.
- **21 external_platform:** no page covers training and serving outside Databricks.
- **23 abac:** confirm that classification tags drive ABAC without extra setup.
- **25 windows_archive:** archival is preview, and S3 Glacier is named. Check Azure and GCP.
- **26 regulated:** customer-managed keys need the Enterprise tier on AWS. That isn't stated
  in the file yet.
- **28 full_observability:** the external monitoring claim rests on a search excerpt.
- **30 private_link_vnet_ncc:** `ga` on Azure. Serverless private connectivity is private
  preview on AWS.
- **30 public_ip_lists:** the Enterprise-tier requirement was checked on AWS only.
- **31 user_tokens:** marked legacy, not deprecated.

## Renames confirmed on 2026-10-18 (already applied)

- Delta Sharing → OpenSharing: <https://docs.databricks.com/aws/en/opensharing>
- Databricks Asset Bundles → Declarative Automation Bundles:
  <https://docs.databricks.com/aws/en/dev-tools/bundles/>
- DLT → Lakeflow pipelines: <https://docs.databricks.com/aws/en/ldp/where-is-dlt>
- Genie spaces → Genie Agents: <https://docs.databricks.com/aws/en/genie/>
- Lakehouse Monitoring → data profiling, part of data quality monitoring
