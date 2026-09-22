import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const html = execFileSync('php', ['tests/support/browser-fixture.php'], {encoding:'utf8'});
const css = readFileSync('asset/css/style.css', 'utf8');
async function fixture(page, width, mode) {
    await page.setViewportSize({width, height:900});
    await page.route('https://theme.test/**', route => route.fulfill({contentType:'text/html',body:html}));
    await page.goto('https://theme.test/');
    // Match the real layout: resolve both theme attributes before CSS can paint.
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.evaluate(theme => {
        document.documentElement.dataset.theme = theme;
        document.body.dataset.theme = theme;
    }, mode);
    await page.addStyleTag({content: css});
}
for (const width of [375, 1280]) for (const mode of ['light', 'dark']) {
    test(`fallback grid and keyboard annotations ${width} ${mode}`, async ({page}) => {
        await fixture(page, width, mode);
        const cards = page.locator('.resource');
        for (const card of await cards.all()) await expect(card).toBeVisible();
        const boxes = await cards.evaluateAll(nodes => nodes.map(n => {const r=n.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right};}));
        for (let i=0;i<boxes.length;i++) for (let j=i+1;j<boxes.length;j++) {
            const a=boxes[i], b=boxes[j];
            expect(a.bottom <= b.top || b.bottom <= a.top || a.right <= b.left || b.right <= a.left).toBeTruthy();
        }
        const summary = page.locator('summary.has-annotation');
        await summary.focus(); await page.keyboard.press('Enter');
        await expect(page.locator('details')).toHaveAttribute('open','');
        await expect(page.getByText('Editorial note')).toBeVisible();
        await page.addScriptTag({path:'asset/js/annotations.js'});
        await page.keyboard.press('Escape');
        await expect(page.locator('details')).not.toHaveAttribute('open','');
        await expect(summary).toBeFocused();
        const results = await new AxeBuilder({page}).include('main').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
        expect(results.violations).toEqual([]);
        await page.screenshot({path:`test-results/local/${width}-${mode}.png`,fullPage:true});
    });
}
test('failed Masonry leaves readable cards and view switching works', async ({page}) => {
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await fixture(page, 1280, 'light');
    await page.evaluate(() => { window.Masonry = class { constructor() { throw new Error('blocked asset'); } }; });
    await page.addScriptTag({path:'asset/js/browse.js'});
    await expect(page.locator('.resources')).not.toHaveClass(/is-masonry/);
    await page.getByRole('button',{name:'List',exact:true}).click();
    await expect(page.locator('.resources')).toHaveClass(/resource-list/);
    await page.getByRole('button',{name:'Grid',exact:true}).click();
    await expect(page.locator('.resource').first()).toBeVisible();
    expect(errors).toEqual([]);
});
