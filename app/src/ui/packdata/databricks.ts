import type { RawPack } from '../../engine/load';
import { rawFromFiles } from '../packs';

const files = import.meta.glob('/packs/databricks/**/*.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export const raw: RawPack = rawFromFiles(files, 'databricks');
