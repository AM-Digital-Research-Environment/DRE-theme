import { test, expect, watchErrors } from './read-only-test.mjs';
import { smokeSurfaces } from './surfaces.mjs';

for (const surface of smokeSurfaces('search')) {
    test(`${surface.label} mounts without document errors`, async ({ page }) => {
        const errors = watchErrors(page);
        await page.goto(surface.path, { waitUntil: 'domcontentloaded' });
        await expect(page.locator('h1')).toHaveCount(1);
        await expect(page.locator('main#content')).toBeVisible();
        expect(errors).toEqual([]);
    });
}
