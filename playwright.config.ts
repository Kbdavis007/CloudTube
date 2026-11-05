import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

/**
 * Browser resolution order:
 *   1. PLAYWRIGHT_EXECUTABLE_PATH  (explicit override)
 *   2. the distro chromium, when present (this sandbox ships one)
 *   3. Playwright's own managed browser (CI: `npx playwright install chromium`)
 */
const systemChromium = '/usr/bin/chromium';
const executablePath =
  process.env.PLAYWRIGHT_EXECUTABLE_PATH ||
  (existsSync(systemChromium) ? systemChromium : undefined);

const PORT = Number(process.env.PORT) || 3000;
const baseURL = process.env.E2E_BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  outputDir: 'test-results',
  use: {
    baseURL,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: executablePath ? { executablePath } : {},
      },
    },
  ],
  // Boot the full-stack dev server (Vite middleware + /api) for the app smoke test.
  webServer: {
    command: 'npm run dev',
    url: `${baseURL}/api/health`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
