#!/usr/bin/env node
// Read-only route/state inventory and cold-cache timing sample, not a CWV score.
import { chromium, expect } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { productionRequestDecision } from '../tests/browser/production-request-policy.mjs';
const base = process.env.LIVE_BASE_URL || 'https://data.africamultiple.uni-bayreuth.de';
const browser = await chromium.launch();
const report = [];
const local = process.argv.includes('--local-assets');
const axe = await readFile(new URL('../../DRE-Search/node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
await mkdir('artifacts/roadmap-acceptance', { recursive: true });
try {
    for (const path of ['page/research', 'dre-search', 'page/home', 'page/project-explorer', 'page/compare', 'page/spatial-exploration', 'page/networks', 'page/publications-visualisations', 'page/podcasts-visualisations', 'page/youtube-visualisations']) {
        if (process.env.AUDIT_ROUTES && !process.env.AUDIT_ROUTES.split(',').includes(path)) continue;
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', async route => {
            if (!productionRequestDecision(route.request().method(), route.request().url(), route.request().headers(), base).allowed) return route.abort();
            const path = new URL(route.request().url()).pathname;
            if (local && /^\/modules\/DreVisualizations\/asset\/(js|css)\//.test(path)) {
                const file = resolve('../DREVisualizations', path.split('/DreVisualizations/')[1]);
                return route.fulfill({ body: await readFile(file), contentType: extname(file) === '.css' ? 'text/css' : 'application/javascript' });
            }
            return route.continue();
        });
        const session = await context.newCDPSession(page);
        await session.send('Performance.enable');
        const response = await page.goto(`${base}/s/amira/${path}`, { waitUntil: 'networkidle' });
        const dashboard = page.locator('.dashboard-async-container').first();
        if (await dashboard.count()) {
            await dashboard.scrollIntoViewIfNeeded();
            await expect(dashboard).toHaveAttribute('aria-busy', 'false', { timeout: 30_000 });
        }
        const metrics = Object.fromEntries((await session.send('Performance.getMetrics')).metrics.filter(m => ['ScriptDuration', 'LayoutDuration', 'TaskDuration'].includes(m.name)).map(m => [m.name, m.value]));
        await page.addScriptTag({ content: axe });
        const accessibility = await page.evaluate(async () => {
            const results = await window.axe.run(document.querySelector('main#content'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } });
            return results.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) }));
        });
        const mapControls = await page.locator('.maplibregl-ctrl-group button').evaluateAll(nodes => nodes.filter(n => n.getClientRects().length).map(n => {
            const r = n.getBoundingClientRect();
            return { name: n.getAttribute('aria-label') || n.title, width: r.width, height: r.height };
        }));
        const assets = await page.evaluate(() => performance.getEntriesByType('resource').filter(e => e.name.includes('/DRESearch/asset/dist/')).map(e => ({ url: e.name, transferred: e.transferSize, decoded: e.decodedBodySize })));
        if (local && path === 'page/spatial-exploration') {
            const button = page.locator('.rv-spatial-list button').first();
            await button.focus();
            await page.keyboard.press('Space');
            await expect(page.locator('.rv-spatial-list button[aria-pressed="true"]')).toBeFocused();
            await page.keyboard.press('Space');
            await expect(page.locator('.rv-spatial-list button[aria-pressed="true"]')).toHaveCount(0);
        }
        expect(accessibility).toEqual([]);
        expect(errors).toEqual([]);
        report.push({ localAssets: local, path, status: response.status(), errors, accessibility, mapControls, metrics, assets, overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth) });
        console.log(`${path}: HTTP ${response.status()}, ${accessibility.length} accessibility findings, ${mapControls.length} map controls`);
        await context.close();
    }
} finally {
    await writeFile('artifacts/roadmap-acceptance/surfaces' + (local ? '-local' : '') + '.json', JSON.stringify(report, null, 2));
    await browser.close();
}
