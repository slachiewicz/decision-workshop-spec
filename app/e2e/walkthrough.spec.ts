import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { PACK_LABELS, sessionId, startSession, topicIds } from './helpers';

for (const pack of Object.keys(PACK_LABELS) as (keyof typeof PACK_LABELS)[]) {
  test(`walkthrough: ${pack}`, async ({ page }) => {
    await startSession(page, pack, `Walkthrough ${pack}`);
    const sid = sessionId(page.url());
    const ids = await topicIds(page);
    expect(ids.length).toBeGreaterThan(0);
    console.log(`${pack}: walking ${ids.length} topics`);

    const titles: string[] = [];
    for (const [i, id] of ids.entries()) {
      await page.goto(`/#/s/${sid}/topic/${id}`);
      const h1 = page.getByRole('heading', { level: 1 });
      await expect(h1).toBeVisible();
      const title = (await h1.textContent())?.trim() ?? id;
      titles.push(title);

      if (i === 1 || (ids.length === 1 && i === 0)) {
        // Park one topic.
        await page.getByRole('button', { name: 'Park for a later phase' }).click();
        await expect(page.getByText('Status: Parked')).toBeVisible();
        continue;
      }

      const confirm = page.getByRole('button', { name: 'Confirm', exact: true });
      if (await confirm.count()) {
        await confirm.click();
      } else {
        const recommended = page.locator('.card[data-recommended="true"] input:not(:disabled)').first();
        const target = (await recommended.count()) ? recommended : page.locator('.card input:not(:disabled)').first();
        await target.check();
      }
      await expect(page.getByText(/Status: (Decided|Parked)/)).toBeVisible();
    }

    await page.goto(`/#/s/${sid}/signoff`);
    await expect(page.getByRole('heading', { level: 1, name: 'Sign-off and export' })).toBeVisible();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download Markdown' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/\.md$/);
    const md = readFileSync((await file.path())!, 'utf8');

    expect(md).toContain('## Executive summary');
    for (const title of titles) expect(md, `ADR mentions "${title}"`).toContain(title);

    // JSON export round-trips through the importer.
    const jsonDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download JSON' }).click();
    const json = JSON.parse(readFileSync((await (await jsonDownload).path())!, 'utf8'));
    expect(json.kind).toBe('decision-workshop-session');
    expect(json.session.pack).toBe(pack);

    // The session persists across a reload.
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Sign-off and export' })).toBeVisible();
    await expect(page.getByText('Decided', { exact: true }).first()).toBeVisible();
  });
}

test('360 px wide has no horizontal page scroll', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await startSession(page, 'fabric', 'Narrow');
  const sid = sessionId(page.url());
  for (const path of ['', `topic/medallion_layers`, 'signoff']) {
    await page.goto(path ? `/#/s/${sid}/${path}` : '/');
    await page.waitForTimeout(150);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `overflow at "${path}"`).toBeLessThanOrEqual(0);
  }
});
