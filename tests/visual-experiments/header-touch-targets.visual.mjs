import { test, expect, collectDreAssetVersions } from '../browser/read-only-test.mjs';
import { getSurface } from '../browser/surfaces.mjs';

const enabled = process.env.RUN_VISUAL_EXPERIMENTS === '1';
const expectedThemeVersion = process.env.EXPECTED_THEME_VERSION;
const useDeployedAssets = process.env.USE_DEPLOYED_ASSETS === '1';

async function expectTouchTarget(locator, name) {
    const box = await locator.boundingBox();
    const styles = await locator.evaluate((element) => {
        const computed = getComputedStyle(element);
        return {
            width: computed.width,
            height: computed.height,
            minWidth: computed.minWidth,
            minHeight: computed.minHeight,
            flexShrink: computed.flexShrink,
        };
    });
    expect(box, `${name} must be rendered`).toBeTruthy();
    expect(box.width, `${name} must be at least 44px wide; computed ${JSON.stringify(styles)}`).toBeGreaterThanOrEqual(44);
    expect(box.height, `${name} must be at least 44px high; computed ${JSON.stringify(styles)}`).toBeGreaterThanOrEqual(44);
}

test.describe(`${useDeployedAssets ? 'deployed' : 'local-only'} mobile header audit`, () => {
    test.skip(!enabled, 'Set RUN_VISUAL_EXPERIMENTS=1 to opt into production markup experiments.');

    for (const width of [320, 390]) {
        test(`${width}px keeps four touch controls in one row`, async ({ page }, testInfo) => {
            expect(expectedThemeVersion, 'EXPECTED_THEME_VERSION must name the deployed theme version under review').toBeTruthy();

            await page.setViewportSize({ width, height: 844 });
            await page.goto(getSurface('home').path, { waitUntil: 'domcontentloaded' });
            const assets = await collectDreAssetVersions(page);
            expect(assets['DRE-theme'].versions).toContain(expectedThemeVersion);

            if (!useDeployedAssets) {
                await page.locator('body').evaluate((body) => {
                    body.setAttribute('data-impeccable-experiment', 'header-touch-targets');
                });
                await page.addStyleTag({ path: 'asset/css/style.css' });
                await page.addStyleTag({ path: 'tests/visual-experiments/header-touch-targets.css' });
            }

            // Exercise the densest supported state. Production normally reveals
            // this only when installation is available; removing [hidden] is a
            // local visual-state setup and cannot install or write anything.
            const install = page.locator('[data-pwa-install]');
            await install.evaluate((button) => button.removeAttribute('hidden'));

            await expectTouchTarget(page.locator('.dre-search-bar__toggle'), 'mobile search');
            await expectTouchTarget(install, 'install app');
            await expectTouchTarget(page.locator('[data-theme-toggle]'), 'theme switcher');
            await expectTouchTarget(page.locator('.main-navigation__toggle'), 'menu');
            expect(
                await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
                'the enlarged control row must not create horizontal overflow',
            ).toBe(true);

            const screenshotPath = testInfo.outputPath(`header-touch-targets-${width}.png`);
            await page.locator('.main-header').screenshot({ path: screenshotPath });
            await testInfo.attach(`header-touch-targets-${width}`, {
                path: screenshotPath,
                contentType: 'image/png',
            });
        });
    }
});
