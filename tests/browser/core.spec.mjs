import { test, expect, watchErrors } from './read-only-test.mjs';
import { getSurface, smokeSurfaces } from './surfaces.mjs';

for (const surface of smokeSurfaces('core')) {
    test(`${surface.label} has one document heading and no runtime errors`, async ({ page }) => {
        const errors = watchErrors(page);
        await page.goto(surface.path, { waitUntil: 'domcontentloaded' });
        await expect(page.locator('h1')).toHaveCount(1);
        expect(errors).toEqual([]);
    });
}

test('an API-resolved media page has one document heading and no runtime errors', async ({ page, request }) => {
    const surface = getSurface('media-record');
    const response = await request.get(surface.resolve.endpoint);
    expect(response.ok(), 'the public media API is unavailable').toBeTruthy();
    const [media] = await response.json();
    expect(media, 'the public API returned no media to smoke-test').toBeTruthy();

    const errors = watchErrors(page);
    const path = surface.path.replace('{id}', media[surface.resolve.idProperty]);
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toHaveCount(1);
    expect(errors).toEqual([]);
});

test('legacy advanced search redirects to DRE Search', async ({ page }) => {
    await page.goto('/s/amira/item/search', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/s\/amira\/dre-search\/?$/);
});

test('mobile navigation remains accessible and within the viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(getSurface('home').path, { waitUntil: 'domcontentloaded' });
    const toggle = page.locator('.main-navigation__toggle');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#menu-drawer')).not.toHaveAttribute('aria-hidden', 'true');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
});
