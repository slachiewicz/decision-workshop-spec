// Pack registry. Each pack's YAML sits in its own dynamic chunk (see packdata/*).
import { loadPack, type RawPack } from '../engine/load';
import type { Pack } from '../packs/types';

export interface PackInfo {
  id: string;
  label: string;
  blurb: string;
}

export const PACKS: PackInfo[] = [
  { id: 'fabric', label: 'Microsoft Fabric', blurb: 'OneLake, lakehouses, warehouses and Power BI.' },
  { id: 'databricks', label: 'Databricks', blurb: 'Unity Catalog, Delta Lake and Lakeflow.' },
];

type Loader = () => Promise<{ raw: RawPack }>;
const loaders: Record<string, Loader> = {
  fabric: () => import('./packdata/fabric'),
  databricks: () => import('./packdata/databricks'),
};

const cache = new Map<string, Promise<Pack>>();

/** Topic files may be missing while a pack is being written, so only topics with prose load. */
export function loadPackById(id: string): Promise<Pack> {
  const hit = cache.get(id);
  if (hit) return hit;
  const loader = loaders[id];
  if (!loader) return Promise.reject(new Error(`Unknown pack "${id}"`));
  const p = loader().then(({ raw }) => {
    const only = new Set<string>();
    for (const t of raw.topics) {
      const m = /^id:\s*['"]?([A-Za-z0-9_]+)/m.exec(t);
      if (m?.[1]) only.add(m[1]);
    }
    return loadPack(raw, only);
  });
  p.catch(() => cache.delete(id));
  cache.set(id, p);
  return p;
}

export function rawFromFiles(files: Record<string, string>, id: string): RawPack {
  const at = (name: string) => files[`/packs/${id}/${name}`] ?? '';
  const topics = Object.keys(files)
    .filter((k) => k.startsWith(`/packs/${id}/topics/`))
    .sort()
    .map((k) => files[k]!);
  return { manifest: at('pack.yaml'), keys: at('keys.yaml'), choices: at('choices.yaml'), topics };
}
