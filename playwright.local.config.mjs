import { defineConfig } from '@playwright/test';
export default defineConfig({
    testDir: './tests/local', fullyParallel: true, workers: 2,
    outputDir: 'test-results/local', reporter: 'list',
    use: { headless: true },
    projects: [
        {name: 'chromium', use: {browserName: 'chromium', ...(process.env.DRE_BROWSER_CHANNEL ? {channel: process.env.DRE_BROWSER_CHANNEL} : {})}},
        {name: 'firefox', use: {browserName: 'firefox'}},
        {name: 'webkit', use: {browserName: 'webkit'}},
    ],
});
