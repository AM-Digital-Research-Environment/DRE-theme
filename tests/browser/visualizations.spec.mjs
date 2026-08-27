import { test, expect, watchErrors } from './read-only-test.mjs';
import { getSurface, smokeSurfaces } from './surfaces.mjs';

test('home visualizations lazy-load after scrolling', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(getSurface('home').path, { waitUntil: 'domcontentloaded' });
    await page.locator('footer').scrollIntoViewIfNeeded();
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30_000 });
    expect(errors).toEqual([]);
});

for (const surface of smokeSurfaces('visualizations')) {
    test(`${surface.label} exposes a stable document shell`, async ({ page }) => {
        const errors = watchErrors(page);
        await page.goto(surface.path, { waitUntil: 'domcontentloaded' });
        await expect(page.locator('h1')).toHaveCount(1);
        await expect(page.locator('main')).toBeVisible();
        expect(errors).toEqual([]);
    });
}
