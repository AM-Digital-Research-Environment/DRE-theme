import assert from 'node:assert/strict';
import test from 'node:test';

import { assetOwner, evaluate, medianRun, summaryMarkdown, weightByOwner } from '../../scripts/lib/lighthouse-report.mjs';
import { surfaces } from '../browser/surfaces.mjs';

const base = 'https://data.africamultiple.uni-bayreuth.de';
const lhr = (scores, audits = {}) => ({
    categories: Object.fromEntries(Object.entries(scores).map(([id, score]) => [id, { score }])),
    audits,
});
const passing = { performance: 0.9, accessibility: 1, 'best-practices': 1, seo: 1 };

test('requests are attributed to the theme, the module that served them, or their host', () => {
    assert.equal(assetOwner(`${base}/themes/DRE-theme/asset/css/style.css?v=2.45.0`, base), 'DRE-theme');
    assert.equal(assetOwner(`${base}/modules/DreVisualizations/asset/js/item.js`, base), 'DRE-Visualizations');
    assert.equal(assetOwner(`${base}/modules/DRESearch/asset/dist/app.js`, base), 'DRESearch');
    assert.equal(assetOwner(`${base}/application/asset/js/global.js`, base), 'Omeka S');
    assert.equal(assetOwner(`${base}/s/amira/page/home`, base), 'page');
    assert.equal(assetOwner('https://code.jquery.com/jquery-3.7.1.min.js', base), 'code.jquery.com');
});

test('every module owner named in the surface manifest can be matched by assetOwner', () => {
    const named = new Set(surfaces.flatMap(({ owners }) => owners));
    for (const [dir, owner] of [['DRESearch', 'DRESearch'], ['DreVisualizations', 'DRE-Visualizations'], ['Mirador', 'Mirador']]) {
        assert.ok(named.has(owner), `${owner} is no longer a surface owner`);
        assert.equal(assetOwner(`${base}/modules/${dir}/asset/x.js`, base), owner);
    }
});

test('warn-first: a slow or shifting page warns, an inaccessible or unfindable page errors', () => {
    assert.deepEqual(evaluate(lhr(passing, { 'cumulative-layout-shift': { numericValue: 0.02 } }), 'mobile'), []);

    const slow = evaluate(lhr({ ...passing, performance: 0.4 }, { 'total-blocking-time': { numericValue: 900 }, 'cumulative-layout-shift': { numericValue: 0.25 } }), 'mobile');
    assert.deepEqual(slow.map(({ level, id }) => [level, id]), [['warn', 'performance'], ['warn', 'cumulative-layout-shift'], ['warn', 'total-blocking-time']]);

    const broken = evaluate(lhr({ ...passing, accessibility: 0.9, seo: 0.69 }), 'desktop');
    assert.deepEqual(broken.map(({ level, id }) => [level, id]), [['error', 'accessibility'], ['error', 'seo']]);
});

test('a surface that is noindex by design is not held to the SEO score', () => {
    const noindex = lhr({ ...passing, seo: 0.61 });
    assert.deepEqual(evaluate(noindex, 'mobile', { indexable: false }), []);
    assert.equal(evaluate(noindex, 'mobile', {})[0].id, 'seo');
    const declared = surfaces.filter(({ indexable }) => indexable === false).map(({ id }) => id).sort();
    assert.deepEqual(declared, ['federated-search', 'media-record']);
});

test('thresholds follow the form factor and a failed run is an error', () => {
    const lcp = { 'largest-contentful-paint': { numericValue: 3000 } };
    assert.deepEqual(evaluate(lhr(passing, lcp), 'mobile'), []);
    assert.equal(evaluate(lhr(passing, lcp), 'desktop')[0].id, 'largest-contentful-paint');
    assert.equal(evaluate({ runtimeError: { code: 'NO_FCP', message: 'no paint' } }, 'mobile')[0].level, 'error');
});

test('the median run is chosen by performance score, ignoring failed runs', () => {
    const runs = [0.5, 0.9, 0.7].map(performance => lhr({ ...passing, performance }));
    assert.equal(medianRun(runs).categories.performance.score, 0.7);
    assert.equal(medianRun([{ runtimeError: { code: 'X' } }, runs[1]]), runs[1]);
});

test('the summary groups findings and asset weight under each surface owner', () => {
    const item = surfaces.find(({ id }) => id === 'item-record');
    const run = lhr({ ...passing, performance: 0.4 }, {
        'network-requests': { details: { items: [
            { url: `${base}/modules/DreVisualizations/asset/js/item.js`, transferSize: 20480, resourceType: 'Script' },
            { url: `${base}/themes/DRE-theme/asset/css/style.css`, transferSize: 10240, resourceType: 'Stylesheet' },
            { url: 'data:image/png;base64,AA', transferSize: 0, resourceType: 'Image' },
        ] } },
    });
    const weights = weightByOwner(run, base);
    assert.deepEqual(Object.keys(weights).sort(), ['DRE-Visualizations', 'DRE-theme']);
    const markdown = summaryMarkdown([{ surface: item, lhr: run, findings: evaluate(run, 'mobile'), weights }], 'mobile');
    for (const owner of item.owners) assert.match(markdown, new RegExp(`### ${owner}`));
    assert.match(markdown, /\| Canonical Mirador item record \| 20\.0 \| 0\.0 \| 20\.0 \| 1 \|/);
    assert.match(markdown, /⚠️ Canonical Mirador item record: performance 40 < 80/);
});
