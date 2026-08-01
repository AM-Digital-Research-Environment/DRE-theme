import { test, expect } from '@playwright/test';

const site = '/s/amira';

function watchErrors(page) {
    const errors = [];
    page.on('console', (message) => {
        if (message.type() === 'error') errors.push(`console: ${message.text()}`);
    });
    page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
    return errors;
}

for (const path of [
    `${site}/page/home`,
    `${site}/item`,
    `${site}/item/9754`,
    `${site}/item-set`,
    `${site}/media`,
    `${site}/dre-search`,
]) {
    test(`${path} has one document heading and no runtime errors`, async ({ page }) => {
        const errors = watchErrors(page);
        await page.goto(path, { waitUntil: 'domcontentloaded' });
        await expect(page.locator('h1')).toHaveCount(1);
        expect(errors).toEqual([]);
    });
}

test('legacy advanced search redirects to DRE Search', async ({ page }) => {
    await page.goto(`${site}/item/search`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(new RegExp(`${site}/dre-search/?$`));
});

test('mobile navigation remains accessible and within the viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${site}/page/home`, { waitUntil: 'domcontentloaded' });
    const toggle = page.locator('.main-navigation__toggle');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#menu-drawer')).not.toHaveAttribute('aria-hidden', 'true');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
});

test('home visualizations lazy-load after scrolling', async ({ page }) => {
    await page.goto(`${site}/page/home`, { waitUntil: 'domcontentloaded' });
    await page.locator('footer').scrollIntoViewIfNeeded();
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30_000 });
});
