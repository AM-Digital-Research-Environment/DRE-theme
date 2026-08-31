import {
    test,
    expect,
    collectDreAssetVersions,
    versionAtLeast,
    watchErrors,
} from './read-only-test.mjs';
import { getSurface } from './surfaces.mjs';

async function expectUniqueIds(page) {
    const duplicates = await page.locator('[id]').evaluateAll((elements) => {
        const counts = new Map();
        for (const element of elements) {
            if (!element.id) continue;
            counts.set(element.id, (counts.get(element.id) || 0) + 1);
        }
        return [...counts.entries()].filter(([, count]) => count > 1);
    });
    expect(duplicates, 'the document must not contain duplicate non-empty IDs').toEqual([]);
}

test('the canonical DRESearch route mounts its operational surface', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(getSurface('federated-search').path, { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { level: 1, name: 'Search', exact: true })).toBeVisible();
    await expect(page.locator('.dre-search')).toBeVisible();
    await expect(page.locator('.dre-search__facets[aria-label="Filters"]')).toBeVisible();
    await expect(page.locator('.dre-search__results')).toBeVisible();
    await expectUniqueIds(page);
    expect(errors).toEqual([]);
});

test('the canonical item route mounts Mirador and its digitized canvas', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(getSurface('item-record').path, { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#content > h1')).toHaveText('From the Editor');
    await expect(page.locator('.block-mirador')).toBeVisible();
    await expect(page.locator('.mirador-viewer[aria-label="Workspace"]')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('canvas[aria-label="Digitized view"]')).toBeVisible({ timeout: 30_000 });
    const versions = await collectDreAssetVersions(page);
    expect(versions.Mirador.versions, 'the Mirador asset version must be observable').not.toEqual([]);
    if (versions['DRE-theme'].versions.some((version) => versionAtLeast(version, '2.30.1'))) {
        await expect(
            page.locator('.block-mirador[role="application"]'),
            'DRE-theme 2.30.1+ is loaded, but the server rendered a stale Mirador wrapper; replace view/common/resource-page-block-layout/mirador.phtml and restart the PHP container because OPcache timestamp validation is disabled',
        )
            .toHaveAttribute('aria-label', 'Image viewer');
    }
    await expectUniqueIds(page);
    expect(errors).toEqual([]);
});

test('the research gateway links to the canonical research surfaces', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(getSurface('research-gateway').path, { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { level: 1, name: 'Research', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Research sections', exact: true }))
        .toHaveAttribute('href', /\/s\/amira\/page\/research-sections$/);
    await expect(page.getByRole('link', { name: 'Research projects', exact: true }))
        .toHaveAttribute('href', /\/s\/amira\/page\/research-projects$/);
    await expect(page.getByRole('link', { name: 'Research items', exact: true }))
        .toHaveAttribute('href', /\/s\/amira\/page\/research-items$/);
    await expectUniqueIds(page);
    expect(errors).toEqual([]);
});
