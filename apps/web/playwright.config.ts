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
      command: 'cd ../edge && pnpm exec wrangler dev --config wrangler.test.toml',
      url: 'http://127.0.0.1:8789',
      timeout: 30000,
      reuseExistingServer: false,
    },
    {
      command: 'pnpm exec vite --port 5199 --strictPort',
      url: 'http://localhost:5199',
      timeout: 30000,
      reuseExistingServer: false,
      env: {
        VITE_API_PORT: '8789',
      },
    },
  ],
});
