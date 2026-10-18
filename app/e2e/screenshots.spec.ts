import { test } from '@playwright/test';
import { sessionId, startSession } from './helpers';

// Regenerates the committed screenshots in e2e/screenshots/.
test('screenshots: topic page and sign-off page', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await startSession(page, 'fabric', 'Contoso');
  const sid = sessionId(page.url());

  await page.goto(`/#/s/${sid}/topic/medallion_layers`);
  await page.locator('.card[data-recommended="true"] input').first().check();
  await page.getByLabel('Notes for this topic').fill('Three layers agreed with the data team.');
  await page.goto(`/#/s/${sid}/topic/query_mode`);
  await page.locator('.card input:not(:disabled)').first().check();
  await page.goto(`/#/s/${sid}/topic/medallion_layers`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'e2e/screenshots/topic.png' });

  await page.goto(`/#/s/${sid}/signoff`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'e2e/screenshots/signoff.png', fullPage: true });
});
