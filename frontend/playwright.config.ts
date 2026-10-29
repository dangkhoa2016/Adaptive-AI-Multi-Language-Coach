import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  fullyParallel: false,
  reporter: [
    ['list'],
    [
      'json',
      { outputFile: process.env.PLAYWRIGHT_JSON_OUTPUT_NAME ?? 'test-results/results.json' },
    ],
  ],
  webServer: [
    {
      command: 'pnpm --filter @vocab/backend test:e2e:server',
      url: 'http://127.0.0.1:8788',
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'pnpm dev --host localhost',
      url: 'http://localhost:5173',
      reuseExistingServer: false,
    },
  ],
  use: { baseURL: 'http://localhost:5173' },
})
