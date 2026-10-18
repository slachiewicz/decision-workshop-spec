import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { sessionId, startSession } from './helpers';

async function audit(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(
    bad.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`),
    `axe on ${label}`,
  ).toEqual([]);
}

for (const scheme of ['light', 'dark'] as const) {
  test(`axe: landing, topic and sign-off (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Decision workshop' })).toBeVisible();
    await audit(page, 'landing page');

    await startSession(page, 'fabric', 'A11y Client');
    const sid = sessionId(page.url());

    await page.goto(`/#/s/${sid}/topic/medallion_layers`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // Select an option so value fields, notes and the canvas are all on the page.
    await page.locator('.card input:not(:disabled)').first().check();
    await audit(page, 'topic page');

    await page.goto(`/#/s/${sid}/signoff`);
    await expect(page.getByRole('heading', { level: 1, name: 'Sign-off and export' })).toBeVisible();
    await audit(page, 'sign-off page');
  });
}
