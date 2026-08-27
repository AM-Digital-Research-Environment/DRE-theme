import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests/visual-experiments',
    testMatch: '**/*.visual.mjs',
    outputDir: './artifacts/visual-experiments/results',
    timeout: 60_000,
    expect: { timeout: 10_000 },
    retries: 0,
    workers: 1,
    reporter: 'list',
    use: {
        baseURL: process.env.LIVE_BASE_URL || 'https://data.africamultiple.uni-bayreuth.de',
        bypassCSP: true,
        trace: 'retain-on-failure',
        ...devices['Desktop Chrome'],
    },
});
