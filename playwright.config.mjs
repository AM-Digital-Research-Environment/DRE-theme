import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests/browser',
    timeout: 45_000,
    expect: { timeout: 10_000 },
    retries: 1,
    workers: 1,
    reporter: process.env.CI ? 'github' : 'list',
    use: {
        baseURL: process.env.LIVE_BASE_URL || 'https://data.africamultiple.uni-bayreuth.de',
        trace: 'retain-on-failure',
        ...devices['Desktop Chrome'],
    },
});
