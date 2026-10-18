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
const limited: string[] = []; // still 429 after retries: unchecked, not broken
const urls = [...uses.keys()];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Microsoft Learn rate-limits bursts with 429. Retry with backoff, honouring Retry-After.
async function get(url: string): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20_000) });
    if (r.status !== 429 || attempt >= 4) return r;
    const after = Number(r.headers.get('retry-after'));
    await sleep((Number.isFinite(after) && after > 0 ? after : 2 ** attempt * 2) * 1000);
  }
}

const CONCURRENCY = 4;
for (let i = 0; i < urls.length; i += CONCURRENCY) {
  await Promise.all(
    urls.slice(i, i + CONCURRENCY).map(async (url) => {
      try {
        const r = await get(url);
        if (r.status === 429) limited.push(url);
        else if (r.status !== 200) bad.push(`${r.status} ${url}  (${uses.get(url)!.join(', ')})`);
        else if (r.redirected && stripLocale(new URL(r.url).pathname) !== stripLocale(new URL(url).pathname)) {
          bad.push(`moved ${url} -> ${r.url}  (${uses.get(url)!.join(', ')})`);
        }
      } catch (e) {
        bad.push(`ERR ${url}: ${(e as Error).message}`);
      }
    }),
  );
}
if (limited.length) {
  console.warn(`check:links: ${limited.length} URL(s) unchecked, host rate-limited (429):\n  ${limited.join('\n  ')}`);
}
if (bad.length) {
  console.error(bad.join('\n'));
  console.error(`\ncheck:links FAILED: ${bad.length} of ${urls.length} URL(s)`);
  process.exit(1);
}
console.log(`check:links passed: ${urls.length - limited.length} of ${urls.length} URL(s) checked, none broken`);
