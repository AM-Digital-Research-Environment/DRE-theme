import {test, expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {renderFixture, routeFixture} from './fixtures.mjs';
import {themeScript} from '../support/theme-script.mjs';

const html = renderFixture('research');
async function fixture(page, width = 1280, mode = 'light') {
    await page.setViewportSize({width, height: 900});
    await routeFixture(page, html);
    await page.goto('https://theme.test/s/a/item/42');
    await page.evaluate(mode => {
        // As the layout's head script: html.js (which reveals the
        // script-driven controls) and both theme attributes.
        document.documentElement.classList.add('js');
        document.documentElement.dataset.theme = mode;
        document.body.dataset.theme = mode;
    }, mode);
    for (const name of ['navigation', 'script', 'shortlist']) {
        await page.addScriptTag({path: themeScript(name)});
    }
    await page.evaluate(() => document.fonts.ready);
}

for (const [width, mode] of [[320, 'light'], [390, 'dark'], [1280, 'light'], [1280, 'dark']]) {
    test(`research tools at ${width} in ${mode} mode`, async ({page}, info) => {
        await fixture(page, width, mode);
        await page.emulateMedia({reducedMotion: 'reduce'});
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
        // The record is just its grouped fields: no contents nav, no copy buttons.
        await expect(page.getByRole('navigation', {name: 'Record contents'})).toHaveCount(0);
        await expect(page.getByRole('button', {name: 'Copy section link'})).toHaveCount(0);
        await expect(page.getByRole('heading', {level: 2, name: 'Description', exact: true})).toBeVisible();
        await page.evaluate(() => scrollTo(0, 0));
        if (info.project.name === 'chromium') await page.screenshot({path: info.outputPath('research.png'), fullPage: true});
        await page.locator('main > [data-shortlist-save]').click();
        await page.getByRole('button', {name: /^Research shortlist/}).click();
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
    await page.addScriptTag({path: themeScript('browse')});
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
    // Engines with native grid lanes never start Masonry (covered below).
    test.skip(await page.evaluate(() => CSS.supports('display', 'grid-lanes')), 'native grid-lanes engine');
    await page.emulateMedia({reducedMotion: 'no-preference'});
    await page.addScriptTag({path: 'asset/js/masonry.pkgd.min.js'});
    await page.addScriptTag({path: themeScript('browse')});
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

const cardsOverlap = cards => {
    const rects = cards.map(card => card.getBoundingClientRect());
    return rects.some((a, i) => rects.slice(i + 1).some(b =>
        !(a.bottom <= b.top + 1 || b.bottom <= a.top + 1 || a.right <= b.left + 1 || b.right <= a.left + 1)));
};

test('Masonry is fetched only where the engine lacks grid-lanes, and cards never overlap', async ({page}) => {
    await fixture(page);
    let masonryRequests = 0;
    page.on('request', request => { if (request.url().includes('masonry.pkgd.min.js')) masonryRequests++; });
    const native = await page.evaluate(() => CSS.supports('display', 'grid-lanes'));
    // Loaded by URL, as on a real page: browse.js derives Masonry's URL from its own.
    await page.addScriptTag({url: '/themes/dre/' + themeScript('browse')});
    if (native) {
        await expect(page.locator('.resources')).not.toHaveClass(/is-masonry/);
        expect(masonryRequests).toBe(0);
    } else {
        await expect(page.locator('.resources')).toHaveClass(/is-masonry/);
        expect(masonryRequests).toBe(1);
    }
    await expect.poll(() => page.locator('.resources > .resource').evaluateAll(cardsOverlap)).toBe(false);
});

test('the view toggle keeps keyboard focus and reports the pressed view', async ({page}) => {
    await fixture(page);
    await page.addScriptTag({path: themeScript('browse')});
    const list = page.getByRole('button', {name: 'List', exact: true});
    await list.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.resources')).toHaveClass(/resource-list/);
    await expect(list).toBeFocused();
    await expect(list).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', {name: 'Grid', exact: true})).toHaveAttribute('aria-pressed', 'false');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', {name: 'List', exact: true})).not.toBeFocused();
});

test('in-page links never refetch connections; a whole-set filter swaps the block in place', async ({page}) => {
    await fixture(page);
    const filtered = renderFixture('research', 'filtered');
    let requests = 0;
    await page.route(url => url.pathname.endsWith('/index/linked-resources'), route => {
        requests++;
        const url = new URL(route.request().url());
        return route.fulfill({contentType: 'text/html', body: url.searchParams.has('lr_property') ? filtered : html});
    });
    await page.evaluate(() => document.querySelector('main').insertAdjacentHTML('afterbegin', '<a href="#record-42-description">Jump to the description</a>'));
    await page.addScriptTag({path: themeScript('linked-resources')});
    const block = page.locator('.resources-linked');
    await expect(block.locator('.resources-linked__summary')).toHaveText(/147\s+linked records/);

    // Real fragment navigation fires popstate in every engine.
    // The skip link is revealed on focus, as a keyboard user meets it.
    await page.getByRole('link', {name: 'Skip to main content'}).focus();
    await page.keyboard.press('Enter');
    // Keyboard-activated like the skip link: a mouse click on this link did not
    // navigate in one of two WebKit CI runs.
    await page.getByRole('link', {name: 'Jump to the description', exact: true}).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#record-42-description$/);
    await page.goBack();
    // Back on the bare URL means the popstate handler has run, instead of a
    // fixed wait. A refetch it started late would replace the block.
    await expect(page).not.toHaveURL(/#record-42-description$/);
    expect(requests).toBe(0);

    // A relationship is a filter over the whole set: the total stays, the
    // status places the page in the 30 matching records, focus stays on the
    // chosen (now current) filter, and the address can be shared.
    const creator = block.getByRole('link', {name: /^Creator/});
    await creator.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-lr-status]')).toContainText('Showing 1–3 of 30 matching records');
    await expect(page.locator('.resources-linked__summary')).toHaveText(/147\s+linked records/);
    await expect(page).toHaveURL(/lr_property=items%3A2-0/);
    await expect(page.locator(':focus')).toHaveAttribute('aria-current', 'true');
    await expect(page.locator('[data-connection-status]')).toContainText('30 matching records');
    expect(requests).toBe(1);
    expect((await new AxeBuilder({page}).include('.resources-linked').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
    await page.goBack();
    await expect.poll(() => requests).toBe(2);
    await expect(page.locator('[data-lr-status]')).toContainText('Showing 1–3 of 147');
});

test('without JavaScript the whole-set filters, search and sort are ordinary links and a GET form', async ({browser}) => {
    const filtered = renderFixture('research', 'filtered');
    const context = await browser.newContext({javaScriptEnabled: false, viewport: {width: 1280, height: 900}});
    const page = await context.newPage();
    const seen = [];
    await routeFixture(page, html, async (url, route) => {
        if (url.pathname !== '/s/a/item/42' || !url.search) return false;
        seen.push(url);
        await route.fulfill({contentType: 'text/html', body: filtered});
        return true;
    });
    await page.goto('https://theme.test/s/a/item/42');
    await page.locator('.resources-linked').getByRole('link', {name: /^Creator/}).click();
    await expect(page.locator('[data-lr-status]')).toContainText('Showing 1–3 of 30 matching records');
    expect(seen.at(-1).searchParams.get('lr_property')).toBe('items:2-0');
    await page.getByLabel('Search linked records by title').fill('Linked');
    await page.getByLabel('Sort by').selectOption('title-desc');
    await page.getByRole('button', {name: 'Apply', exact: true}).click();
    await expect.poll(() => seen.length).toBe(2);
    expect(Object.fromEntries(seen[1].searchParams)).toEqual({lr_property: 'items:2-0', lr_q: 'Linked', lr_sort: 'title-desc'});
    await context.close();
});

// The theme toggle and the grid/list switch only act through their scripts.
// Without JavaScript (no html.js, which the layout's head script sets) they are
// not offered.
test('controls that need JavaScript are hidden without it and shown with it', async ({browser}) => {
    const page_ = html;
    for (const [javaScriptEnabled, markup] of [[false, page_], [true, page_.replace('<html lang="en">', '<html lang="en" class="js">')]]) {
        const context = await browser.newContext({javaScriptEnabled, viewport: {width: 1280, height: 900}});
        const page = await context.newPage();
        await routeFixture(page, markup);
        await page.goto('https://theme.test/s/a/item/42');
        for (const selector of ['[data-theme-toggle]', '.browse-controls .layout-toggle']) {
            if (javaScriptEnabled) await expect(page.locator(selector)).toBeVisible();
            else await expect(page.locator(selector)).toBeHidden();
        }
        await context.close();
    }
});
