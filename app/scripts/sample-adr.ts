// Render an example ADR per pack from one coherent scenario: the suggested default where a
// topic has one, an explicit scenario choice where it doesn't (never "the first option"),
// recommended modifiers on, proposed topics shown, one topic parked and one left open.
// Fails if a choice is ruled out by the rules, so the examples can't contradict themselves.
//   npm run sample:adr      writes docs/examples/<pack>-adr.md
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPack } from '../src/engine/load';
import { newSession, setDecision } from '../src/engine/session';
import { orderedTopics, effectiveRecommendation, evaluateParts } from '../src/engine/rules';
import { renderAdr } from '../src/engine/adr';

const app = join(dirname(fileURLToPath(import.meta.url)), '..');
const NOW = '2026-10-19T09:00:00.000Z';
const TODAY = '2026-10-19';
const PARKED = 'backup_restore';
const OPEN = 'ownership';

interface Scenario {
  chosen: Record<string, string[]>; // topics without a suggested default
  values: Record<string, string>; // value fields by id
  modifiers: Record<string, boolean>; // overrides; otherwise `recommended`
}

const SCENARIOS: Record<string, Scenario> = {
  fabric: {
    chosen: {
      ingestion: ['copy_job', 'mirroring', 'shortcuts'],
      storage_engine: ['lakehouse_only'],
      transform_tool: ['spark_notebooks'],
      transform_location: ['colocated'],
      access_licensing: ['free_viewers_f64'],
      source_control: ['ado'],
      disaster_recovery: ['builtin_only'],
      bi_serving_pattern: ['model_report_split'],
      self_service: ['governed_self_service'],
      data_sharing: ['shortcuts_internal', 'sql_endpoint'],
      ml_workloads: ['none_yet'],
      row_column_security: ['onelake_security'],
      network_connectivity: ['public_endpoints'],
      automation_identity: ['workspace_identity', 'service_principals'],
      platform_topology: ['domains_mapped'],
      orchestration: ['fabric_pipelines'],
      data_quality: ['notebook_checks'],
      secrets: ['key_vault_references'],
      discovery_lineage: ['onelake_catalog'],
    },
    values: { azure_region: 'westeurope', starting_sku: 'F64', surge_level: 'capacity', online_window: '3y', review_cadence: 'monthly', platform_owner: 'Data platform team' },
    modifiers: {},
  },
  databricks: {
    chosen: {
      ingestion: ['lakeflow_connect', 'auto_loader'],
      transform_tool: ['lakeflow_pipelines'],
      transform_location: ['colocated'],
      access_licensing: ['workspace_access', 'sql_access', 'consumer_access'],
      source_control: ['github'],
      disaster_recovery: ['zone_redundancy'],
      distribution: ['odbc_jdbc'],
      data_sharing: ['delta_sharing'],
      row_column_security: ['row_filters_masks'],
      network_connectivity: ['private_link'],
      automation_identity: ['sp_oauth', 'workload_identity_federation'],
      platform_topology: ['workspace_per_env'],
      orchestration: ['lakeflow_jobs'],
      data_quality: ['pipeline_expectations', 'quality_monitoring'],
      secrets: ['secret_scopes_key_vault'],
      discovery_lineage: ['uc_lineage_explorer'],
    },
    values: { cloud: 'azure', cloud_region: 'westeurope', sql_warehouse_size: 'm', online_window: '3y', review_cadence: 'monthly', platform_owner: 'Data platform team' },
    modifiers: { landing_volume: true },
  },
};

for (const id of ['fabric', 'databricks']) {
  const sc = SCENARIOS[id]!;
  const dir = join(app, 'packs', id);
  const read = (f: string) => readFileSync(join(dir, f), 'utf8');
  const topics = readdirSync(join(dir, 'topics')).sort().map((f) => read(join('topics', f)));
  const pack = loadPack({ manifest: read('pack.yaml'), keys: read('keys.yaml'), choices: read('choices.yaml'), topics });

  let s = newSession(pack, { session_id: `example-${id}`, client_name: 'Example Co', now: NOW, facilitator: 'Example facilitator', show_proposed: true });
  // Two passes: rules depend on later topics (DR on retention, cost on compute), so the
  // second pass re-derives recommendations with every decision in place.
  for (let pass = 0; pass < 2; pass++) {
    for (const t of orderedTopics(pack)) {
      if (t.id === PARKED) {
        s = setDecision(s, t, { status: 'parked', notes: 'Revisit after the first production release.' }, NOW);
        continue;
      }
      if (t.id === OPEN) {
        s = setDecision(s, t, { status: 'open', notes: 'Waiting for the data office to name domain owners.' }, NOW);
        continue;
      }
      const modifiers = Object.fromEntries(t.modifiers.map((m) => [m.id, sc.modifiers[m.id] ?? !!m.recommended]));
      if (t.decision_type === 'confirm') {
        const naming = Object.fromEntries((t.naming_sections ?? []).flatMap((sec) => sec.fields.map((f) => [f.id, f.default])));
        s = setDecision(s, t, { status: 'decided', chosen: [], naming, modifiers }, NOW);
        continue;
      }
      const chosen = sc.chosen[t.id] ?? effectiveRecommendation(pack, t, s).values;
      if (!chosen.length) throw new Error(`${id}/${t.id}: no suggested default and no scenario choice`);
      const fields = [...(t.value_fields ?? []), ...t.options.filter((o) => chosen.includes(o.value)).flatMap((o) => o.value_fields ?? [])];
      const values = Object.fromEntries(fields.filter((f) => sc.values[f.id]).map((f) => [f.id, sc.values[f.id]!]));
      s = setDecision(s, t, { status: 'decided', chosen, values, modifiers }, NOW);
    }
  }

  const problems: string[] = [];
  for (const t of orderedTopics(pack)) {
    const rec = s.decisions.find((d) => d.topic_id === t.id);
    for (const o of t.options.filter((x) => rec?.chosen.includes(x.value))) {
      const r = evaluateParts(pack, t, o, s);
      for (const b of r.blocks) problems.push(`${t.id}.${o.value} blocked: ${b}`);
      for (const w of r.warns) problems.push(`${t.id}.${o.value} warns: ${w}`);
    }
  }
  if (problems.length) {
    console.error(`${id}: the example scenario contradicts the pack rules:\n  ${problems.join('\n  ')}`);
    process.exitCode = 1;
  }
  const out = join(app, 'docs', 'examples', `${id}-adr.md`);
  writeFileSync(out, renderAdr(pack, s, TODAY));
  console.log(`wrote ${out}`);
}
