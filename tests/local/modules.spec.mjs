/**
 * The theme and its modules rendered together.
 *
 * Each module tests its own built bundle in a browser, but against a stand-in
 * page: generated token CSS and no theme stylesheet, header or scripts. The
 * product a visitor sees is neither (DESIGN.md, One-product Rule), and the
 * failures that matter live in the seam: the theme's global field and button
 * skin bleeding into module controls, the theme toggle not reaching a module,
 * a heading level that only makes sense inside the module's own shell.
 *
 * So this mounts the sibling repositories' BUILT front-ends inside the
 * PHP-rendered theme chrome, with the theme's real stylesheet and scripts, and
 * stubs each module's network. It needs the siblings checked out next to this
 * repository and built (`npm run build` in each); without them every test here
 * is skipped with the command that would enable it.
 */
import {test, expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {existsSync, readFileSync} from 'node:fs';
import {extname, resolve, sep} from 'node:path';
import {renderFixture, routeFixture, types} from './fixtures.mjs';

const SEARCH = resolve('..', 'DRE-Search');
const SEARCH_BUNDLE = resolve(SEARCH, 'asset', 'dist', 'dre-search.js');
const VIZ = resolve('..', 'DREVisualizations');
const VIZ_BUNDLE = resolve(VIZ, 'asset', 'js', 'dashboard-charts.bundle.js');

const chrome = renderFixture('header');

/**
 * What Mirador puts in the head: an import map, then a module that imports
 * through it. Firefox discards an import map that follows ANY module load or
 * modulepreload, so a module whose head hints start one leaves every viewer on
 * the page blank there (DRE Search 1.24-1.26.0). Every themed page carries
 * this probe AFTER the module's own head, and each module is held to it.
 */
const IMPORT_MAP_PROBE = '<script type="importmap">{"imports":{"dre-probe":"/probe/viewer.js"}}</script>'
    + '<script type="module">import viewer from "dre-probe"; window.importMapProbe = viewer;</script>';

/** Answer the probe's module. */
function probe(url, route) {
    if (url.pathname !== '/probe/viewer.js') return false;
    return route.fulfill({contentType: 'text/javascript', body: 'export default "resolved";'}).then(() => true);
}

/** The header fixture's page with `main` replaced and extra theme scripts loaded. */
function themedPage(main, title, head, bodyEnd = '') {
    const start = chrome.indexOf('<main');
    const end = chrome.indexOf('</main>') + '</main>'.length;
    return chrome.slice(0, start)
        .replace('<title>Header fixture</title>', `<title>${title}</title>`)
        // As layout.phtml: the bridge and the toggle are on every page; the
        // resolved mode is on <html> and <body> before anything paints.
        .replace('<html lang="en">', '<html lang="en" class="js" data-theme="light">')
        .replace('<body>', '<body data-theme="light">')
        .replace('</head>', '<script src="/themes/dre/asset/js/dre-token-bridge.js"></script>'
            + '<script src="/themes/dre/asset/js/theme-toggle.js" defer></script>'
            + head + IMPORT_MAP_PROBE + '</head>')
        + `<main id="content" class="container">${main}</main>${bodyEnd}`
        + chrome.slice(end);
}

/** Serve a file from a sibling repository's asset directory. */
function sibling(root, url, route, prefix) {
    const assetRoot = resolve(root, 'asset');
    const file = resolve(assetRoot, decodeURIComponent(url.pathname.slice(prefix.length)));
    if (!file.startsWith(assetRoot + sep)) return route.abort().then(() => true);
    try {
        return route.fulfill({contentType: types[extname(file)] || 'application/octet-stream', body: readFileSync(file)})
            .then(() => true);
    } catch {
        return route.fulfill({status: 404, body: ''}).then(() => true);
    }
}

// --- DRE Search -----------------------------------------------------------

const HITS = [
    {id: '101', title: 'Photograph of the Bayreuth market', type_s: 'Photograph', year: 1932,
        abstract: 'A street scene recorded for the research collection.', project_s: 'Lived Religion'},
    {id: '102', title: 'Interview recording, Lagos', type_s: 'Audio', year: 2014,
        abstract: 'An interview about Swahili poetry and its audiences.', project_s: 'Lived Religion'},
];
const FACETS = [{field: 'type_s', label: 'Type', counts: [{value: 'Photograph', count: 1}, {value: 'Audio', count: 1}]}];
const response = hits => ({available: true, found: hits.length, page: 1, hits, facets: FACETS});
const ENDPOINTS = Object.fromEntries(['facet', 'search', 'export', 'search_all', 'union', 'map', 'suggest', 'suggest_all']
    .map(name => [name, `/dre-search/api/${name.replace('_', '-')}`]));

/** dre-search-block.phtml as Omeka renders it inside a page with a block title. */
function searchBlock() {
    const bootstrap = {
        block_id: 5, profile: 'research_items', card_kind: 'item', date_mode: 'single', show_year: false,
        year_bounds: null, facets: ['type_s'], facet_labels: {type_s: 'Type'}, default_sort: 'relevance',
        sort_options: [{value: 'relevance', label: 'Relevance'}], per_page: 20, item_url_base: '/s/a/item',
        endpoints: ENDPOINTS, initial_response: response(HITS), initial_query: '',
    };
    return `<h1>Research archive</h1>
<section class="dre-search-block" aria-labelledby="dre-search-title-5">
  <h2 class="dre-search-block__title" id="dre-search-title-5">Find research items</h2>
  <div data-dre-search-root data-dre-block-id="5" data-dre-heading-level="3" class="dre-search-block__root" id="dre-search-root-5">
    <div class="dre-search-block__skeleton" aria-hidden="true"></div>
  </div>
  <script type="application/json" id="dre-search-state-5">${JSON.stringify(bootstrap)}</script>
</section>`;
}

async function serveSearch(page, width, {failSearches = 0} = {}) {
    const stub = {failSearches};
    await page.setViewportSize({width, height: 900});
    await page.emulateMedia({reducedMotion: 'reduce'});
    await routeFixture(page, searchPage(), async (url, route) => {
        if (await probe(url, route)) return true;
        if (url.pathname.startsWith('/modules/DreSearch/asset/')) {
            return sibling(SEARCH, url, route, '/modules/DreSearch/asset/');
        }
        const json = (body, status = 200) => route.fulfill({status, contentType: 'application/json', body: JSON.stringify(body)})
            .then(() => true);
        const body = route.request().postDataJSON?.() ?? {};
        switch (url.pathname) {
        case ENDPOINTS.search: {
            if (stub.failSearches > 0) {
                stub.failSearches--;
                return json({error: {code: 'upstream', message: 'Typesense timed out', request_id: 'req-42'}}, 500);
            }
            const filters = body.filters ?? {};
            let hits = body.q === 'nothing' ? [] : HITS;
            if (filters.type_s?.length) hits = hits.filter(h => filters.type_s.includes(h.type_s));
            return json(response(hits));
        }
        case ENDPOINTS.suggest: {
            const q = (url.searchParams.get('q') ?? '').toLowerCase();
            return json({available: true, suggestions: HITS.filter(h => h.title.toLowerCase().includes(q))
                .map(h => ({id: h.id, title: h.title, subtitle: String(h.year)}))});
        }
        case ENDPOINTS.facet:
            return json({available: true, counts: []});
        default:
            return false;
        }
    });
    await page.goto('https://theme.test/');
    await expect(page.getByRole('article').first()).toBeVisible();
    return stub;
}
const searchPage = () => themedPage(searchBlock(), 'Research archive',
    '<link rel="stylesheet" href="/modules/DreSearch/asset/css/dre-search.css">'
    + '<link rel="stylesheet" href="/modules/DreSearch/asset/dist/dre-search.css">'
    // As BundleAssets renders it since 1.26.1: a plain preload in the head,
    // the module script at the end of <body> (inlineScript()).
    + '<link rel="preload" as="script" crossorigin="anonymous" href="/modules/DreSearch/asset/dist/dre-search.js">',
    '<script type="module" src="/modules/DreSearch/asset/dist/dre-search.js"></script>');

async function seriousViolations(page) {
    const results = await new AxeBuilder({page}).include('main').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    return results.violations.filter(v => ['serious', 'critical'].includes(v.impact))
        .map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`);
}

test.describe('DRE Search inside the theme', () => {
    test.skip(!existsSync(SEARCH_BUNDLE), `needs ../DRE-Search built: cd ../DRE-Search && npm ci && npm run build`);

    for (const width of [320, 390, 1280]) {
        test(`a titled block sits in the theme's outline and never scrolls sideways at ${width}`, async ({page}) => {
            await serveSearch(page, width);
            await expect(page.getByRole('heading', {level: 1})).toHaveCount(1);
            await expect(page.getByRole('heading', {level: 2, name: 'Find research items'})).toBeVisible();
            // Nested under the block title, not beside it.
            await expect(page.getByRole('heading', {level: 2, name: 'Filters'})).toHaveCount(0);
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
        });
    }

    test('the theme toggle reaches Search, and both modes pass axe', async ({page}) => {
        // Two full-page axe scans around a repaint: WebKit needs more than the default 30s.
        test.slow();
        await serveSearch(page, 1280);
        const card = page.getByRole('article').first();
        const light = await card.evaluate(n => getComputedStyle(n).backgroundColor);
        expect(await seriousViolations(page)).toEqual([]);

        await page.locator('[data-theme-toggle]').click();
        await expect(page.locator('body')).toHaveAttribute('data-theme', 'dark');
        await expect.poll(() => card.evaluate(n => getComputedStyle(n).backgroundColor)).not.toBe(light);
        expect(await seriousViolations(page)).toEqual([]);
    });

    test('Search fields take the theme field outline and a focus ring that survives forced colours', async ({page}) => {
        await serveSearch(page, 1280);
        const box = page.getByRole('combobox', {name: 'Search research items…'});
        const fieldBorder = await page.evaluate(() => window.DRETokens.cssColor('--field-border'));
        const border = await box.evaluate(n => getComputedStyle(n).borderTopColor);
        expect(await page.evaluate(([a, b]) => window.DRETokens.toRGB(a) === window.DRETokens.toRGB(b), [border, fieldBorder]))
            .toBeTruthy();

        await box.focus();
        const focus = await box.evaluate(n => {
            const s = getComputedStyle(n);
            return {style: s.outlineStyle, width: parseFloat(s.outlineWidth), shadow: s.boxShadow};
        });
        expect(focus.style).not.toBe('none');
        expect(focus.width).toBeGreaterThanOrEqual(2);
        expect(focus.shadow).not.toBe('none');
    });

    test('an import map after the Search head still resolves (Mirador)', async ({page}) => {
        await serveSearch(page, 1280);
        await expect.poll(() => page.evaluate(() => window.importMapProbe ?? null)).toBe('resolved');
    });

    test('autocomplete, a facet, the empty state and Try again work in the themed page', async ({page}) => {
        const stub = await serveSearch(page, 1280);
        const box = page.getByRole('combobox', {name: 'Search research items…'});
        await box.fill('Bayreuth');
        await expect(page.getByRole('option', {name: /Photograph of the Bayreuth market/})).toBeVisible();
        await box.press('Escape');
        await expect(page.getByRole('listbox')).toBeHidden();

        await page.getByRole('checkbox', {name: /Audio/}).check();
        await expect(page.getByRole('article')).toHaveCount(1);
        await page.getByRole('button', {name: 'Clear all filters'}).click();
        await expect(page.getByRole('article')).toHaveCount(2);

        await box.fill('nothing');
        await box.press('Enter');
        await expect(page.getByText('No records match that search.', {exact: true}).first()).toBeVisible();

        stub.failSearches = 1;
        await box.fill('market');
        await box.press('Enter');
        const retry = page.getByRole('button', {name: 'Try again'});
        await expect(retry).toBeVisible();
        await expect(page.locator('main')).not.toContainText('req-42');
        await retry.click();
        await expect(page.getByRole('article').first()).toBeVisible();
    });

    test('in print the results and their chips survive the theme sheet, the controls do not', async ({page}) => {
        await serveSearch(page, 1280);
        await page.emulateMedia({media: 'print'});
        await expect(page.getByRole('article').first()).toBeVisible();
        await expect(page.getByRole('heading', {name: 'Find research items'})).toBeVisible();
        await expect(page.getByRole('checkbox', {name: /Audio/})).toBeHidden();
        // The project chip is a <button>: the theme hides every other one.
        await expect(page.getByRole('article').first().locator('[data-print]', {hasText: 'Lived Religion'})).toBeVisible();
    });
});

// --- DRE Visualizations ---------------------------------------------------

const VIZ_ASSET = '/modules/DreVisualizations/asset/';
const LIBS = `window.RV_DATA_BASE='/s/test/dre-data/';window.RV_LIBS={`
    + `echarts:'${VIZ_ASSET}vendor/echarts.min.js',maplibre:'${VIZ_ASSET}vendor/maplibre-gl.js',`
    + `maplibreWorker:'${VIZ_ASSET}vendor/maplibre-gl-worker.js',maplibreCss:'${VIZ_ASSET}vendor/maplibre-gl.css',`
    + `d3:['dispatch','quadtree','timer','force'].map(function(n){return '${VIZ_ASSET}vendor/d3-'+n+'.min.js';})};`;

const DASHBOARD = {
    totalItems: 3,
    types: [{name: 'Book', value: 2}, {name: 'Article', value: 1}],
    languages: [{name: 'English', value: 2}, {name: 'French', value: 1}],
    locations: [{name: 'Bayreuth', lat: 49.94, lon: 11.58, value: 2, itemId: 7}],
};

/** A record's visualisation block as the module renders it (async-surface.phtml). */
function dashboardBlock() {
    return `<h1>A research item</h1>
<div class="resource-vis-block dashboard-block">
  <div class="dashboard-async-container" data-base-path="" data-site-base="/s/test" data-item-id="test"
       data-ready-status="Visualisations ready." data-empty-status="No visualisations are available."
       data-error-status="The visualisation could not be loaded.">
    <p class="rv-dashboard-status rv-async-status" role="status" aria-live="polite" aria-atomic="true">Loading…</p>
    <div class="rv-dashboard-content"><div class="rv-loading rv-async-loading" aria-hidden="true"><div class="rv-spinner"></div><span>Loading…</span></div></div>
  </div>
</div>`;
}

const vizPage = () => themedPage(dashboardBlock(), 'A research item',
    `<link rel="stylesheet" href="${VIZ_ASSET}css/dre-visualizations.css">`
    + `<script>${LIBS}window.RV_I18N={};</script>`
    + ['js/dashboard-core.js', 'js/dashboard-charts.bundle.js', 'js/dashboard.js']
        .map(path => `<script defer src="${VIZ_ASSET}${path}"></script>`).join(''));

async function serveViz(page, width) {
    await page.setViewportSize({width, height: 900});
    await page.emulateMedia({reducedMotion: 'reduce'});
    await routeFixture(page, vizPage(), async (url, route) => {
        if (await probe(url, route)) return true;
        if (url.pathname.startsWith(VIZ_ASSET)) return sibling(VIZ, url, route, VIZ_ASSET);
        if (url.pathname.startsWith('/s/test/dre-data/')) {
            const body = url.pathname.endsWith('current.json') ? {generationId: '20261005T000000Z-aaaaaaaaaaaa'}
                : url.pathname.endsWith('/test.json') ? DASHBOARD : null;
            await route.fulfill({status: body ? 200 : 404, contentType: 'application/json', body: JSON.stringify(body ?? {})});
            return true;
        }
        return false;
    });
    await page.goto('https://theme.test/');
    const container = page.locator('[data-state]').first();
    await expect(container).toHaveAttribute('data-state', 'ready', {timeout: 15000});
    await expect(container).toHaveAttribute('aria-busy', 'false');
}

/** What each ECharts instance resolved its text colours to, to see a repaint. */
const chartColours = page => page.evaluate(() => [...document.querySelectorAll('[_echarts_instance_]')]
    .map(el => JSON.stringify(window.echarts.getInstanceByDom(el).getOption().textStyle ?? null)).join('|'));

test.describe('DRE Visualizations inside the theme', () => {
    test.skip(!existsSync(VIZ_BUNDLE), 'needs ../DREVisualizations checked out next to this repository (its bundles are committed)');

    for (const width of [320, 1280]) {
        test(`a dashboard keeps the page outline and never scrolls sideways at ${width}`, async ({page}) => {
            await serveViz(page, width);
            await expect(page.getByRole('heading', {level: 1})).toHaveCount(1);
            await expect(page.getByRole('heading', {level: 2, name: 'Visualisations'})).toBeVisible();
            await expect(page.locator('.resource-vis-block h3').first()).toBeVisible();
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
        });
    }

    test('the theme toggle repaints the charts, and both modes pass axe', async ({page}) => {
        // Two full-page axe scans around a repaint: WebKit needs more than the default 30s.
        test.slow();
        await serveViz(page, 1280);
        await expect.poll(() => page.locator('[_echarts_instance_]').count()).toBeGreaterThan(0);
        const light = await chartColours(page);
        expect(await seriousViolations(page)).toEqual([]);

        await page.locator('[data-theme-toggle]').click();
        await expect(page.locator('body')).toHaveAttribute('data-theme', 'dark');
        await expect.poll(() => chartColours(page)).not.toBe(light);
        expect(await seriousViolations(page)).toEqual([]);
    });

    test('under the theme stylesheet, module controls keep a visible outline in forced colours', async ({page}) => {
        await page.emulateMedia({forcedColors: 'active'});
        await serveViz(page, 1280);
        await page.locator('.resource-vis-block').evaluate(n => n.querySelector('button, summary, a[href]')?.focus());
        const unringed = new Set();
        let seen = 0;
        for (let i = 0; i < 25; i++) {
            const focus = await page.evaluate(() => {
                const el = document.activeElement;
                if (!el?.closest('.resource-vis-block')) return null;
                const s = getComputedStyle(el);
                return {key: el.outerHTML.slice(0, 80), visible: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0};
            });
            if (focus) {
                seen++;
                if (!focus.visible) unringed.add(focus.key);
            }
            await page.keyboard.press('Tab');
        }
        expect(seen).toBeGreaterThan(3);
        expect([...unringed]).toEqual([]);
    });

    test('an import map after the Visualizations head still resolves (Mirador)', async ({page}) => {
        await serveViz(page, 1280);
        await expect.poll(() => page.evaluate(() => window.importMapProbe ?? null)).toBe('resolved');
    });

    test('each chart offers its data as a table', async ({page}) => {
        await serveViz(page, 1280);
        const toggle = page.locator('summary', {hasText: 'Data table'}).first();
        const disclosure = toggle.locator('xpath=..');
        await toggle.click();
        await expect(disclosure.getByRole('table')).toBeVisible();
    });
});
