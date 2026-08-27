import { test, expect, collectDreAssetVersions } from '../browser/read-only-test.mjs';
import { getSurface } from '../browser/surfaces.mjs';

const enabled = process.env.RUN_VISUAL_EXPERIMENTS === '1';
const expectedThemeVersion = process.env.EXPECTED_THEME_VERSION;

test.describe('local-only production markup experiments', () => {
    test.skip(!enabled, 'Set RUN_VISUAL_EXPERIMENTS=1 to opt into production markup experiments.');

    test('record reading-rhythm probe', async ({ page }, testInfo) => {
        expect(expectedThemeVersion, 'EXPECTED_THEME_VERSION must name the deployed theme version under review').toBeTruthy();

        await page.goto(getSurface('item-record').path, { waitUntil: 'domcontentloaded' });
        const assets = await collectDreAssetVersions(page);
        expect(
            assets['DRE-theme'].versions,
            `production does not expose the expected DRE-theme ${expectedThemeVersion}`,
        ).toContain(expectedThemeVersion);

        await page.locator('body').evaluate((body) => {
            body.setAttribute('data-impeccable-experiment', 'record-reading-rhythm');
        });
        await page.addStyleTag({ path: 'tests/visual-experiments/record-reading-rhythm.css' });

        const target = page.locator('.item-record').first();
        await expect(target).toBeVisible();
        await target.scrollIntoViewIfNeeded();

        const screenshotPath = testInfo.outputPath('record-reading-rhythm.png');
        await page.screenshot({ path: screenshotPath, fullPage: true });
        await testInfo.attach('record-reading-rhythm', {
            path: screenshotPath,
            contentType: 'image/png',
        });
    });
});
