import {
    test,
    expect,
    collectDreAssetVersions,
    versionAtLeast,
    watchErrors,
} from './read-only-test.mjs';
import { getSurface, smokeSurfaces } from './surfaces.mjs';

test('home visualizations lazy-load after scrolling', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(getSurface('home').path, { waitUntil: 'domcontentloaded' });
    await page.locator('footer').scrollIntoViewIfNeeded();
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30_000 });
    const versions = await collectDreAssetVersions(page);
    if (versions['DRE-Visualizations'].versions.some((version) => versionAtLeast(version, '2.28.1'))) {
        const dashboard = page.locator('.dashboard-async-container').first();
        await expect(dashboard).toHaveAttribute('aria-busy', 'false');
        await expect(dashboard.locator('.rv-dashboard-status')).toHaveText('Visualisations ready.');
        await expect(dashboard.locator('.rv-dashboard-status')).toHaveAttribute('role', 'status');
        await expect(dashboard.locator('.rv-dashboard-status')).toHaveAttribute('aria-live', 'polite');
        await expect(dashboard.locator('.rv-dashboard-status')).toHaveAttribute('aria-atomic', 'true');
        await expect(dashboard.locator('h3 .rv-toolbar-btn')).toHaveCount(0);
        await expect(dashboard.locator('.rv-chart-toolbar[role="toolbar"]').first())
            .toHaveAttribute('aria-label', /^Chart actions: /);
    }
    expect(errors).toEqual([]);
});

for (const surface of smokeSurfaces('visualizations')) {
    test(`${surface.label} exposes a stable document shell`, async ({ page }) => {
        const errors = watchErrors(page);
        await page.goto(surface.path, { waitUntil: 'domcontentloaded' });
        await expect(page.locator('h1')).toHaveCount(1);
        await expect(page.locator('main#content')).toBeVisible();
        expect(errors).toEqual([]);
    });
}
