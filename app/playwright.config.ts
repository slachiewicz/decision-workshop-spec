import { defineConfig } from '@playwright/test';

// Uses the installed Google Chrome; no Playwright browser download.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { channel: 'chrome', baseURL: 'http://localhost:4173', viewport: { width: 1280, height: 900 } },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
