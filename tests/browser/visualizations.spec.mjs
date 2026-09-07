import {
    test,
    expect,
    collectDreAssetVersions,
    versionAtLeast,
    watchErrors,
} from './read-only-test.mjs';
import { getSurface, smokeSurfaces } from './surfaces.mjs';

test('the published visualization snapshot contains its required datasets', async ({ request }) => {
    const root = '/modules/DreVisualizations/asset/data/';
    const response = await request.get(`${root}current.json`);
    expect(response.status(), 'Restore or regenerate the published visualization snapshot: current.json is unavailable')
        .toBe(200);
    const manifest = await response.json();
    expect(manifest.generationId).toMatch(/^[0-9]{8}T[0-9]{6}Z-[a-f0-9]{12}$/);
    for (const path of ['item-dashboards/collection-overview.json', 'item-dashboards/projects-index.json', 'network-explorer.json']) {
        const url = `${root}generations/${manifest.generationId}/${path}`;
        const artifact = await request.get(url);
        expect(artifact.status(), `Required published dataset is unavailable: ${url}`).toBe(200);
        const data = await artifact.json();
        expect(data, `Expected a JSON dataset at ${url}`).toBeTruthy();
        if (path.endsWith('collection-overview.json')) expect(data.totalItems).toBeGreaterThan(0);
    }
});

test('home visualizations lazy-load after scrolling', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(getSurface('home').path, { waitUntil: 'domcontentloaded' });
    const dashboard = page.locator('.dashboard-async-container').first();
    await dashboard.scrollIntoViewIfNeeded();
    await expect(dashboard.locator('.rv-dashboard-status'),
        'The overview must finish loading successfully; inspect failed-requests.json for missing snapshot data')
        .toHaveText('Visualisations ready.', { timeout: 30_000 });
    await expect(dashboard.locator('canvas').first()).toBeVisible();
    const versions = await collectDreAssetVersions(page);
    if (versions['DRE-Visualizations'].versions.some((version) => versionAtLeast(version, '2.28.1'))) {
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
    test(`${surface.label} finishes loading its interactive controls`, async ({ page }) => {
        const errors = watchErrors(page);
        await page.goto(surface.path, { waitUntil: 'domcontentloaded' });
        await expect(page.locator('h1')).toHaveCount(1);
        await expect(page.locator('main#content')).toBeVisible();
        const readySelectors = {
            'project-explorer': '.explorer-select',
            'spatial-exploration': '.dre-spatial-exploration .maplibregl-canvas',
            networks: '.network-type-switcher',
        };
        await expect(page.locator(readySelectors[surface.id]).first()).toBeVisible({ timeout: 30_000 });
        await expect(page.locator('main .rv-error')).toHaveCount(0);
        expect(errors).toEqual([]);
    });
}
