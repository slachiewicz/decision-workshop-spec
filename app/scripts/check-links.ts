// Fetch every sources[].url in the topic files and report anything that isn't a 200.
//   npm run check:links                 all packs
//   npm run check:links -- fabric       one pack
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import type { TopicProse } from '../src/packs/types';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'packs');
const packs = process.argv[2] ? [process.argv[2]] : ['fabric', 'databricks'];

const uses = new Map<string, string[]>();
for (const pack of packs) {
  const dir = join(root, pack, 'topics');
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.yaml'))) {
    const t = parse(readFileSync(join(dir, f), 'utf8')) as TopicProse;
    for (const o of t.options ?? []) {
      for (const s of o.sources) uses.set(s.url, [...(uses.get(s.url) ?? []), `${pack}/${f}#${o.value}`]);
    }
  }
}

// Microsoft Learn redirects locale-free URLs to /en-us/...; that's not a move.
// Store URLs without the locale so readers land in their own language.
const stripLocale = (path: string) => path.replace(/^\/[a-z]{2}-[a-z]{2}\//, '/').replace(/\/$/, '');

const bad: string[] = [];
const urls = [...uses.keys()];
for (let i = 0; i < urls.length; i += 8) {
  await Promise.all(
    urls.slice(i, i + 8).map(async (url) => {
      try {
        const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20_000) });
        if (r.status !== 200) bad.push(`${r.status} ${url}  (${uses.get(url)!.join(', ')})`);
        else if (r.redirected && stripLocale(new URL(r.url).pathname) !== stripLocale(new URL(url).pathname)) {
          bad.push(`moved ${url} -> ${r.url}  (${uses.get(url)!.join(', ')})`);
        }
      } catch (e) {
        bad.push(`ERR ${url}: ${(e as Error).message}`);
      }
    }),
  );
}
if (bad.length) {
  console.error(bad.join('\n'));
  console.error(`\ncheck:links FAILED: ${bad.length} of ${urls.length} URL(s)`);
  process.exit(1);
}
console.log(`check:links passed: ${urls.length} URL(s)`);
