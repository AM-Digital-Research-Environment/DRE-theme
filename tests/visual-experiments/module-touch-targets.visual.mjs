import { resolve } from 'node:path';
import { test, expect, collectDreAssetVersions } from '../browser/read-only-test.mjs';
import { getSurface } from '../browser/surfaces.mjs';

const enabled = process.env.RUN_VISUAL_EXPERIMENTS === '1';
const expectedSearchVersion = process.env.EXPECTED_DRESEARCH_VERSION;
const expectedVisualizationsVersion = process.env.EXPECTED_VISUALIZATIONS_VERSION;
const useDeployedAssets = process.env.USE_DEPLOYED_ASSETS === '1';
const visualizationsCss =
    process.env.DRE_VISUALIZATIONS_CSS ||
    resolve(import.meta.dirname, '..', '..', '..', 'DREVisualizations', 'asset', 'css', 'dre-visualizations.css');

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

async function expectTouchTarget(locator, name) {
    const box = await locator.boundingBox();
    expect(box, `${name} must be rendered`).toBeTruthy();
    expect(box.width, `${name} must be at least 44px wide`).toBeGreaterThanOrEqual(44);
    expect(box.height, `${name} must be at least 44px high`).toBeGreaterThanOrEqual(44);
}

test.describe(`${useDeployedAssets ? 'deployed' : 'local-only'} module touch-target audit`, () => {
    test.skip(!enabled, 'Set RUN_VISUAL_EXPERIMENTS=1 to opt into production markup experiments.');

    test('DRESearch high-frequency controls use the shared 44px box', async ({ page }, testInfo) => {
        expect(expectedSearchVersion, 'EXPECTED_DRESEARCH_VERSION must name the deployed version').toBeTruthy();

        await page.goto(getSurface('federated-search').path, { waitUntil: 'domcontentloaded' });
        const assets = await collectDreAssetVersions(page);
        expect(assets.DRESearch.versions).toContain(expectedSearchVersion);
        await page.locator('.dre-search').first().waitFor();
        if (!useDeployedAssets) {
            await page.locator('body').evaluate((body) => {
                body.setAttribute('data-impeccable-experiment', 'module-touch-targets');
            });
            await page.addStyleTag({ path: 'tests/visual-experiments/module-touch-targets.css' });
        }

        await expectTouchTarget(page.locator('.dre-fed__search input').first(), 'federated search field');
        await expectTouchTarget(page.locator('.dre-sort__select').first(), 'sort selector');
        for (const [index, label] of ['list view', 'gallery view'].entries()) {
            await expectTouchTarget(page.locator('.dre-view button').nth(index), label);
        }
        await expectTouchTarget(page.locator('.dre-export__trigger').first(), 'export menu');
        await expectTouchTarget(page.getByRole('button', { name: 'Copy link' }).first(), 'copy link');

        const input = page.locator('.dre-fed__search input').first();
        await input.fill('Africa');
        await expect(page.locator('.dre-fed__search > button').first()).toBeVisible();
        await expectTouchTarget(page.locator('.dre-fed__search > button').first(), 'clear search');

        const pager = page.locator('.dre-pager__btn').first();
        if (await pager.count()) await expectTouchTarget(pager, 'pagination');
        expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
            'the adapted search controls must not create horizontal overflow',
        ).toBe(true);

        const screenshotPath = testInfo.outputPath('dre-search-touch-targets-390.png');
        await page.locator('.dre-summary').first().screenshot({ path: screenshotPath });
        await testInfo.attach('dre-search-touch-targets-390', {
            path: screenshotPath,
            contentType: 'image/png',
        });
    });

    test('MapLibre navigation and close controls use the shared 44px box', async ({ page }, testInfo) => {
        expect(
            expectedVisualizationsVersion,
            'EXPECTED_VISUALIZATIONS_VERSION must name the deployed version',
        ).toBeTruthy();

        await page.goto(getSurface('spatial-exploration').path, { waitUntil: 'domcontentloaded' });
        const assets = await collectDreAssetVersions(page);
        expect(assets['DRE-Visualizations'].versions).toContain(expectedVisualizationsVersion);
        const navigation = page.locator('.resource-vis-block .maplibregl-ctrl button').first();
        await navigation.waitFor({ timeout: 30_000 });
        if (!useDeployedAssets) await page.addStyleTag({ path: visualizationsCss });
        await expectTouchTarget(navigation, 'MapLibre navigation');

        const fixture = page.locator('.resource-vis-block').first();
        await fixture.evaluate((container) => {
            const popup = document.createElement('div');
            popup.className = 'maplibregl-popup-content';
            popup.dataset.impeccableFixture = 'map-close';
            popup.innerHTML = '<button class="maplibregl-popup-close-button" type="button" aria-label="Close">×</button><span>Popup text</span>';
            container.append(popup);
        });
        const close = page.locator('[data-impeccable-fixture="map-close"] .maplibregl-popup-close-button');
        await expectTouchTarget(close, 'MapLibre popup close');
        const paddingEnd = await page
            .locator('[data-impeccable-fixture="map-close"]')
            .evaluate((element) => Number.parseFloat(getComputedStyle(element).paddingInlineEnd));
        expect(paddingEnd, 'popup content must clear the enlarged close control').toBeGreaterThan(44);

        const screenshotPath = testInfo.outputPath('maplibre-touch-targets-390.png');
        await page.locator('.maplibregl-map').first().screenshot({ path: screenshotPath });
        await testInfo.attach('maplibre-touch-targets-390', {
            path: screenshotPath,
            contentType: 'image/png',
        });
    });
});
