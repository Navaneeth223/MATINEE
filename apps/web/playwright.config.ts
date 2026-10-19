import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './test',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:5199',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: [
    {
      command: 'pnpm exec wrangler dev --config wrangler.test.toml --persist-to .wrangler/state-test',
      cwd: '../edge',
      port: 8789,
      timeout: 120000,
      reuseExistingServer: false,
    },
    {
      command: 'pnpm exec vite --port 5199 --strictPort',
      port: 5199,
      timeout: 120000,
      reuseExistingServer: false,
      env: {
        VITE_API_PORT: '8789',
      },
    },
  ],
});
