import { expect, type Page } from '@playwright/test';

export const PACK_LABELS = { fabric: 'Microsoft Fabric', databricks: 'Databricks' } as const;

export async function startSession(page: Page, pack: keyof typeof PACK_LABELS, client = 'Acme Test') {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Decision workshop' })).toBeVisible();
  await page.getByRole('radio', { name: new RegExp(PACK_LABELS[pack]) }).check();
  await page.getByLabel('Client name').fill(client);
  await page.getByRole('button', { name: 'Start session' }).click();
  await page.waitForURL(/#\/s\/[^/]+\/part\/\d+/);
}

export function sessionId(url: string): string {
  const m = /#\/s\/([^/]+)/.exec(url);
  if (!m) throw new Error(`No session id in ${url}`);
  return m[1]!;
}

/** Topic ids with prose, in flow order, read from the progress rail. */
export async function topicIds(page: Page): Promise<string[]> {
  const hrefs = await page.locator('nav[aria-label="Progress"] a[href*="/topic/"]').evaluateAll((els) =>
    els.map((e) => e.getAttribute('href') ?? ''),
  );
  return hrefs.map((h) => decodeURIComponent(h.split('/topic/')[1] ?? '')).filter(Boolean);
}
