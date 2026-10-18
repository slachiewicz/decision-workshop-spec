// Build a Pack from raw YAML strings, so Node tests and Vite share one path.
// The caller supplies the text (fs in Node, import.meta.glob ?raw in the browser).
import { parse } from 'yaml';
import { mergePack } from '../packs/merge';
import type { Pack, PackKeys, PackManifest, TopicProse } from '../packs/types';

export interface RawPack {
  manifest: string;
  keys: string;
  choices: string;
  topics: string[];
}

/** `only` limits the merge to some topic ids while a pack is partly written. */
export function loadPack(raw: RawPack, only?: Set<string>): Pack {
  const manifest = parse(raw.manifest) as PackManifest;
  const keys = parse(raw.keys) as PackKeys;
  const choices = (parse(raw.choices) ?? {}) as Pack['choices'];
  const proses = raw.topics.map((t) => parse(t) as TopicProse);
  return mergePack(manifest, keys, proses, choices, only);
}
