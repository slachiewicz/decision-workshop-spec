import { expect, test } from '@playwright/test';
import { sessionId, startSession } from './helpers';

test('no CSP violations or console errors on landing, topic and sign-off', async ({ page }) => {
  const problems: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      const w = window as unknown as { __csp?: string[] };
      (w.__csp ??= []).push(`${e.violatedDirective} ${e.blockedURI}`);
    });
  });
  const violations = () => page.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? []);

  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Decision workshop' })).toBeVisible();
  expect(await violations(), 'landing').toEqual([]);

  await startSession(page, 'fabric', 'CSP Client');
  const sid = sessionId(page.url());

  await page.goto(`/#/s/${sid}/topic/medallion_layers`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.locator('.card input:not(:disabled)').first().check();
  expect(await violations(), 'topic').toEqual([]);

  await page.goto(`/#/s/${sid}/signoff`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(await violations(), 'sign-off').toEqual([]);

  expect(problems).toEqual([]);
});
