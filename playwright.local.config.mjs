import {defineConfig} from '@playwright/test';

// The browser suite runs the minified scripts the templates load
// (tests/support/theme-script.mjs); the unit suites cover both builds.
process.env.DRE_SCRIPTS ??= 'dist';

export default defineConfig({
    testDir: './tests/local',
    fullyParallel: true,
    workers: process.env.CI ? 2 : 3,
    timeout: 30000,
    outputDir: 'test-results/local',
    use: {headless: true, trace: 'retain-on-failure'},
    projects: ['chromium', 'firefox', 'webkit'].map(browserName => ({name: browserName, use: {browserName, ...(browserName === 'chromium' && process.env.DRE_BROWSER_CHANNEL ? {channel: process.env.DRE_BROWSER_CHANNEL} : {})}})),
});
