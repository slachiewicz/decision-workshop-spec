// Contract types for platform packs. The JSON Schemas in packs/_schema mirror these;
// scripts/lint-packs.ts checks that pack files conform to both.
//
// A pack is split in two layers so content can be written in parallel:
//   keys.yaml        structure: ids, option values, rules, canvas effects (driver-owned)
//   topics/NN-*.yaml prose: everything a reader sees (content writers)
// mergePack() joins them into Topic objects for the engine and the UI.

export type Cluster =
  | 'architecture'
  | 'platform_setup'
  | 'consumption'
  | 'access_governance'
  | 'operations'
  | 'conventions';

export type Weight = 'fast' | 'standard' | 'deep';
export type Mode = 'decide' | 'surface' | 'naming';
export type Renderer = 'cards' | 'source_mapper' | 'naming_form';
export type DecisionType = 'single' | 'multi' | 'confirm';
export type TopicStatus = 'core' | 'proposed';
export type Maturity = 'ga' | 'preview' | 'beta' | 'gated' | 'deprecated';
export type Severity = 'block' | 'warn';

/** One condition on another decision. Exactly one operator is set. */
export interface Requirement {
  decision_key: string;
  /** Test a value field of the referenced decision instead of its chosen options. */
  field?: string;
  /** single-select: current value is one of these */
  in?: string[];
  /** single-select: current value is none of these */
  not_in?: string[];
  /** multi-select: at least one chosen value is in the list */
  any_of?: string[];
  /** multi-select: no chosen value is in the list */
  none_of?: string[];
  severity: Severity;
  /** Key into the topic file's `rule_reasons` for the user-facing reason. */
  reason_id: string;
}

export type CanvasEffect =
  | { type: 'layer_boxes'; layers: string[] }
  | { type: 'landing_zone'; on: boolean }
  | { type: 'container_grouping'; pattern: 'per_layer' | 'first_pair_shared' | 'single' | 'per_domain' }
  | { type: 'env_multiplier'; envs: string[] }
  | { type: 'layer_engines'; default: string; first?: string; last?: string }
  | { type: 'transform_band'; on: boolean }
  | { type: 'serving_lane'; pattern: string }
  | { type: 'lock'; scope: 'model' | 'storage' | 'all' }
  | { type: 'footer_badge'; label_id: string };

export interface ValueFieldKey {
  id: string;
  type: 'text' | 'select';
  required: boolean;
  /** For select: key into packs/<pack>/choices.yaml */
  choices_ref?: string;
}

export interface OptionKey {
  value: string;
  requires?: Requirement[];
  canvas_effect?: CanvasEffect;
  value_fields?: ValueFieldKey[];
}

export interface ModifierKey {
  id: string;
  decision_key: string;
  on_value: string;
  off_value: string;
  /** The suggested setting is on. The ADR notes when a recommended modifier is left off. */
  recommended?: boolean;
  canvas_effect?: CanvasEffect;
}

export interface AdaptiveRecommendation {
  follows: string; // decision_key
  map: Record<string, string[]>;
}

export interface TopicKey {
  number: number; // stable catalogue number, used in file names
  id: string;
  decision_key: string;
  cluster: Cluster;
  status: TopicStatus;
  weight: Weight;
  mode: Mode;
  renderer: Renderer;
  decision_type: DecisionType;
  required: boolean;
  recommendation: string[]; // empty = it depends
  adaptive_recommendation?: AdaptiveRecommendation;
  canvas_element?: string;
  options: OptionKey[];
  modifiers?: ModifierKey[];
  value_fields?: ValueFieldKey[];
}

export interface PackKeys {
  pack: string;
  topics: TopicKey[];
}

// ---- prose layer (topics/NN-id.yaml) ----

export interface Source {
  url: string;
  title: string;
}

export interface OptionProse {
  value: string;
  label: string;
  description: string;
  tradeoff: string;
  pros: string[];
  cons: string[];
  /** ADR "Context" text used when this option is chosen against the recommendation. */
  adr_context: string;
  maturity: Maturity;
  /** Which part is not GA, when the option as a whole is a posture rather than one feature. */
  maturity_note?: string;
  as_of: string; // YYYY-MM-DD
  sources: Source[];
  value_field_labels?: Record<string, { label: string; hint?: string }>;
}

export interface ModifierProse {
  id: string;
  title: string;
  label: string;
  hint: string;
  on_adr_context: string;
  off_adr_context: string;
}

export interface NamingField {
  id: string;
  label: string;
  hint: string;
  default: string;
}

export interface NamingSection {
  id: string;
  title: string;
  blurb: string;
  fields: NamingField[];
}

export interface TopicProse {
  id: string;
  title: string;
  situation: string;
  intake: string[];
  recommendation_note: string;
  /** ADR "Context" text used when the recommendation is followed. */
  adr_context: string;
  options: OptionProse[];
  modifiers?: ModifierProse[];
  value_field_labels?: Record<string, { label: string; hint?: string }>;
  rule_reasons?: Record<string, string>;
  naming_sections?: NamingSection[];
}

// ---- pack manifest (pack.yaml) ----

export interface PackGroup {
  part: number;
  title: string;
  blurb: string;
  topics: string[]; // topic ids in flow order
}

export interface PackManifest {
  id: string;
  name: string;
  platform_label: string;
  release: string;
  groups: PackGroup[];
  canvas: {
    container_label: string;
    landing_label: string;
    layer_engine_labels: Record<string, string>;
    serving_label: string;
    badge_labels: Record<string, string>;
  };
}

// ---- merged view used by the engine and UI ----

export type Option = OptionKey & OptionProse;
export type Modifier = ModifierKey & ModifierProse;

export interface Topic extends Omit<TopicKey, 'options' | 'modifiers'>, Omit<TopicProse, 'options' | 'modifiers'> {
  options: Option[];
  modifiers: Modifier[];
}

export interface Pack {
  manifest: PackManifest;
  topics: Topic[];
  choices: Record<string, { value: string; label: string }[]>;
}

// ---- session state (see docs/CONTRACT.md §2) ----

export type DecisionStatus = 'decided' | 'open' | 'parked';

export interface DecisionRecord {
  topic_id: string;
  decision_key: string;
  status: DecisionStatus;
  chosen: string[];
  values: Record<string, string>;
  modifiers: Record<string, boolean>;
  naming: Record<string, string>;
  option_notes: Record<string, string>;
  notes: string;
  decided_at: string;
}

export interface Session {
  kind: 'decision-workshop-session';
  schema_version: 1;
  pack: string;
  pack_release: string;
  session_id: string;
  client_name: string;
  facilitator?: string;
  show_proposed: boolean;
  decisions: DecisionRecord[];
  locked: boolean;
  created_at: string;
  updated_at: string;
}

export type RuleState = 'ok' | 'blocked' | 'warn' | 'pending';
export interface RuleResult {
  state: RuleState;
  reasons: string[];
}
