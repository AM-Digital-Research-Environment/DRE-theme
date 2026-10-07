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
    for (const name of ['navigation', 'script', 'shortlist']) {
        await page.addScriptTag({path: `asset/js/${name}.js`});
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
    // Engines with native grid lanes never start Masonry (covered below).
    test.skip(await page.evaluate(() => CSS.supports('display', 'grid-lanes')), 'native grid-lanes engine');
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
    await page.addScriptTag({url: '/themes/dre/asset/js/browse.js'});
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
    await page.addScriptTag({path: 'asset/js/browse.js'});
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

test('in-page links never refetch connections; a new connection page still does', async ({page}) => {
    await fixture(page);
    let requests = 0;
    await page.route('**/index/linked-resources/**', route => {
        requests++;
        return route.fulfill({contentType: 'text/html', body: '<details class="resources-linked" open><summary><span class="resources-linked__summary">Second page</span></summary><ul data-lr-list></ul></details>'});
    });
    await page.evaluate(() => document.querySelector('main').insertAdjacentHTML('beforeend', `
        <a href="#record-42-description">Jump to the description</a>
        <div data-connection-endpoint="/index/linked-resources/42" data-loading="Loading" data-failed="Failed">
        <p data-connection-status role="status"></p>
        <div data-connection-recovery hidden><button type="button" data-connection-retry>Retry</button><a data-connection-continue href="#">Full page</a></div>
        <details class="resources-linked" id="linked-resources" open><summary><span class="resources-linked__summary">Connections</span></summary>
        <button type="button" data-lr-facet="all" class="is-active" aria-pressed="true">All</button>
        <button type="button" data-lr-facet="p1" aria-pressed="false">Authors</button>
        <ul data-lr-list><li class="connection" data-props="p1">Author record</li><li class="connection" data-props="p2">Editor record</li></ul>
        <a data-connection-page href="?lr_page=2#linked-resources">Next connections</a></details></div>`));
    await page.addScriptTag({path: 'asset/js/linked-resources.js'});
    await page.getByRole('button', {name: 'Authors', exact: true}).click();
    await expect(page.getByText('Editor record', {exact: true})).toBeHidden();

    // Real fragment navigation fires popstate in every engine.
    // The skip link is revealed on focus, as a keyboard user meets it.
    await page.getByRole('link', {name: 'Skip to main content'}).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('link', {name: 'Jump to the description', exact: true}).click();
    await expect(page).toHaveURL(/#record-42-description$/);
    await page.goBack();
    await page.waitForTimeout(150);
    expect(requests).toBe(0);
    await expect(page.getByText('Editor record', {exact: true})).toBeHidden();

    await page.getByRole('link', {name: 'Next connections'}).click();
    await expect(page.locator('.resources-linked__summary')).toHaveText('Second page');
    expect(requests).toBe(1);
    await page.goBack();
    await expect.poll(() => requests).toBe(2);
});
