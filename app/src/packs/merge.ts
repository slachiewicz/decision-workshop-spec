import type { Pack, PackKeys, PackManifest, Topic, TopicProse } from './types';

export class PackMergeError extends Error {
  constructor(readonly problems: string[]) {
    super(problems.join('\n'));
    this.name = 'PackMergeError';
  }
}

/**
 * Join the structure layer (keys.yaml) with the prose layer (topics/*.yaml).
 * Throws PackMergeError listing every mismatch, so a writer sees all of them at once.
 * `only` limits the merge to a subset of topic ids (used while a pack is partly written).
 */
export function mergePack(
  manifest: PackManifest,
  keys: PackKeys,
  proses: TopicProse[],
  choices: Pack['choices'],
  only?: Set<string>,
): Pack {
  const problems: string[] = [];
  const byId = new Map(proses.map((p) => [p.id, p]));
  const topics: Topic[] = [];

  for (const key of keys.topics) {
    if (only && !only.has(key.id)) continue;
    const prose = byId.get(key.id);
    if (!prose) {
      problems.push(`${key.id}: no topic file`);
      continue;
    }
    const proseOpts = new Map(prose.options.map((o) => [o.value, o]));
    for (const o of prose.options) {
      if (!key.options.some((k) => k.value === o.value)) {
        problems.push(`${key.id}: option "${o.value}" is not in keys.yaml`);
      }
    }
    const options = key.options.flatMap((k) => {
      const p = proseOpts.get(k.value);
      if (!p) {
        problems.push(`${key.id}: option "${k.value}" has no prose`);
        return [];
      }
      return [{ ...k, ...p }];
    });
    const proseMods = new Map((prose.modifiers ?? []).map((m) => [m.id, m]));
    const modifiers = (key.modifiers ?? []).flatMap((k) => {
      const p = proseMods.get(k.id);
      if (!p) {
        problems.push(`${key.id}: modifier "${k.id}" has no prose`);
        return [];
      }
      return [{ ...k, ...p }];
    });
    const { options: _o, modifiers: _m, ...restKey } = key;
    const { options: _po, modifiers: _pm, ...restProse } = prose;
    topics.push({ ...restKey, ...restProse, options, modifiers });
  }

  for (const p of proses) {
    if (!keys.topics.some((k) => k.id === p.id)) problems.push(`${p.id}: topic file has no entry in keys.yaml`);
  }
  if (problems.length) throw new PackMergeError(problems);
  return { manifest, topics, choices };
}
