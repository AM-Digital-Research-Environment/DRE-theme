import {defineConfig} from '@playwright/test';

export default defineConfig({
    testDir: './tests/local',
    fullyParallel: true,
    workers: process.env.CI ? 2 : 3,
    timeout: 30000,
    outputDir: 'test-results/local',
    use: {headless: true, trace: 'retain-on-failure'},
    projects: ['chromium', 'firefox', 'webkit'].map(browserName => ({name: browserName, use: {browserName, ...(browserName === 'chromium' && process.env.DRE_BROWSER_CHANNEL ? {channel: process.env.DRE_BROWSER_CHANNEL} : {})}})),
});
