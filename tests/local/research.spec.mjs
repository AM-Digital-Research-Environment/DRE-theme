import {test, expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {renderFixture, routeFixture} from './fixtures.mjs';

const html = renderFixture('research');
async function fixture(page, width = 1280, mode = 'light') {
    await page.setViewportSize({width, height: 900});
    await routeFixture(page, html);
    await page.goto('https://theme.test/s/a/item/42');
    await page.evaluate(mode => {
        document.documentElement.dataset.theme = mode;
        document.body.dataset.theme = mode;
    }, mode);
    for (const name of ['navigation', 'script', 'section-links', 'shortlist']) {
        await page.addScriptTag({path: `asset/js/${name}.js`});
    }
    await page.evaluate(() => document.fonts.ready);
}

for (const [width, mode] of [[320, 'light'], [390, 'dark'], [1280, 'light'], [1280, 'dark']]) {
    test(`research tools at ${width} in ${mode} mode`, async ({page}, info) => {
        await fixture(page, width, mode);
        await page.emulateMedia({reducedMotion: 'reduce'});
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
        const contents = page.getByRole('navigation', {name: 'Record contents'});
        await expect(contents.getByRole('link')).toHaveCount(3);
        await contents.getByRole('link', {name: 'Description', exact: true}).click();
        await expect(page).toHaveURL(/#record-42-description$/);
        await expect(page.getByRole('button', {name: 'Copy section link'}).first()).toBeVisible();
        await page.evaluate(() => scrollTo(0, 0));
        if (info.project.name === 'chromium') await page.screenshot({path: info.outputPath('research.png'), fullPage: true});
        await page.locator('main > [data-shortlist-save]').click();
        await page.getByRole('button', {name: 'Research shortlist', exact: true}).click();
        await expect(page.getByRole('dialog')).toBeVisible();
        expect((await new AxeBuilder({page}).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
        if (info.project.name === 'chromium') await page.screenshot({path: info.outputPath('shortlist.png')});
    });
}

test('failed Masonry leaves readable cards and grid/list/history switching works', async ({page}) => {
    await fixture(page);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.evaluate(() => { window.Masonry = function () { throw Error('Unavailable'); }; });
    await page.addScriptTag({path: 'asset/js/browse.js'});
    await expect(page.locator('.resources')).not.toHaveClass(/is-masonry/);
    await expect(page.locator('.resource').first()).toBeVisible();
    await page.getByRole('button', {name: 'List', exact: true}).click();
    await expect(page.locator('.resources')).toHaveClass(/resource-list/);
    await page.getByRole('button', {name: 'Grid', exact: true}).click();
    await expect(page.locator('.resources')).toHaveClass(/resource-grid/);
    await page.goBack();
    await expect(page.locator('.resources')).toHaveClass(/resource-list/);
    expect(errors).toEqual([]);
});

test('working Masonry handles a delayed image without overlapping cards', async ({page}) => {
    await fixture(page);
    await page.emulateMedia({reducedMotion: 'no-preference'});
    await page.addScriptTag({path: 'asset/js/masonry.pkgd.min.js'});
    await page.addScriptTag({path: 'asset/js/browse.js'});
    await expect(page.locator('.resources')).toHaveClass(/is-masonry/);
    await page.evaluate(async () => {
        const image = document.createElement('img');
        image.alt = ''; image.style.width = '100%';
        const loaded = new Promise(resolve => image.onload = resolve);
        document.querySelector('.resource').prepend(image);
        image.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"></svg>');
        await loaded;
    });
    await expect.poll(() => page.locator('.resources > .resource').evaluateAll(cards => {
        const rects = cards.map(card => card.getBoundingClientRect());
        return rects.every((a, i) => rects.slice(i + 1).every(b =>
            a.bottom <= b.top + 1 || b.bottom <= a.top + 1 || a.right <= b.left + 1 || b.right <= a.left + 1));
    })).toBeTruthy();
    await page.getByRole('button', {name: 'List', exact: true}).click();
    await expect(page.locator('.resources')).not.toHaveClass(/is-masonry/);
    await page.getByRole('button', {name: 'Grid', exact: true}).click();
    await expect(page.locator('.resources')).toHaveClass(/is-masonry/);
});
