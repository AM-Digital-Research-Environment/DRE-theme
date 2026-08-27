import { test, expect, collectDreAssetVersions } from './read-only-test.mjs';
import { getSurface } from './surfaces.mjs';

test('production identifies the loaded DRE assets', async ({ page }) => {
    await page.goto(getSurface('home').path, { waitUntil: 'domcontentloaded' });
    const assets = await collectDreAssetVersions(page);

    expect(assets['DRE-theme'].urls, 'no DRE-theme asset was detected').not.toEqual([]);
    expect(assets.DRESearch.urls, 'no DRESearch asset was detected').not.toEqual([]);
    expect(assets['DRE-Visualizations'].urls, 'no DRE-Visualizations asset was detected').not.toEqual([]);
});

test('theme control synchronizes the document theme signal', async ({ page }) => {
    await page.goto(getSurface('home').path, { waitUntil: 'domcontentloaded' });
    const toggle = page.locator('[data-theme-toggle]');
    const initialTheme = await page.locator('body').getAttribute('data-theme');
    await toggle.click();
    await expect(page.locator('body')).not.toHaveAttribute('data-theme', initialTheme);
    await expect(page.locator('html')).toHaveAttribute('data-theme', await page.locator('body').getAttribute('data-theme'));
});
