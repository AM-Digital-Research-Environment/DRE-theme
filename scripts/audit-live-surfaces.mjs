#!/usr/bin/env node
// Read-only route/state inventory and cold-cache timing sample, not a CWV score.
//   npm run audit:surfaces [-- --local-assets]   (AUDIT_ROUTES=<surface id>,… narrows routes)
// The routes are tests/browser/surfaces.mjs entries: the home and research
// gateway pages, the federated search and every visualization page.
// Reports go to artifacts/roadmap-acceptance/ (Git-ignored).
import { chromium, expect } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { surfaces } from '../tests/browser/surfaces.mjs';
import { LIVE_BASE_URL as base, routeAuditPage } from './lib/audit-browser.mjs';

const AUDITED = surfaces.filter(({ id, group, mode }) =>
    mode !== 'api-resolved' && (['home', 'research-gateway', 'federated-search'].includes(id) || group === 'visualizations'));
const only = process.env.AUDIT_ROUTES?.split(',').map(id => id.trim()).filter(Boolean);
const unknown = only?.filter(id => !AUDITED.some(surface => surface.id === id)) ?? [];
if (unknown.length) {
    console.error(`AUDIT_ROUTES: unknown surface id(s) ${unknown.join(', ')}; choose from ${AUDITED.map(({ id }) => id).join(', ')}`);
    process.exit(2);
}
const browser = await chromium.launch();
const report = [];
const local = process.argv.includes('--local-assets');
const axe = await readFile(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
await mkdir('artifacts/roadmap-acceptance', { recursive: true });
try {
    for (const { id, path } of AUDITED) {
        if (only && !only.includes(id)) continue;
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await routeAuditPage(page, { base, local });
        const session = await context.newCDPSession(page);
        await session.send('Performance.enable');
        const response = await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
        const dashboard = page.locator('.dashboard-async-container').first();
        if (await dashboard.count()) {
            await dashboard.scrollIntoViewIfNeeded();
            await expect(dashboard).toHaveAttribute('aria-busy', 'false', { timeout: 30_000 });
        }
        const metrics = Object.fromEntries((await session.send('Performance.getMetrics')).metrics.filter(m => ['ScriptDuration', 'LayoutDuration', 'TaskDuration'].includes(m.name)).map(m => [m.name, m.value]));
        await page.addScriptTag({ content: axe });
        const accessibility = await page.evaluate(async () => {
            const results = await window.axe.run(document.querySelector('main'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } });
            return results.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) }));
        });
        const mapControls = await page.locator('.maplibregl-ctrl-group button').evaluateAll(nodes => nodes.filter(n => n.getClientRects().length).map(n => {
            const r = n.getBoundingClientRect();
            return { name: n.getAttribute('aria-label') || n.title, width: r.width, height: r.height };
        }));
        const assets = await page.evaluate(() => performance.getEntriesByType('resource').filter(e => e.name.includes('/DRESearch/asset/dist/')).map(e => ({ url: e.name, transferred: e.transferSize, decoded: e.decodedBodySize })));
        if (local && id === 'spatial-exploration') {
            const button = page.locator('.rv-spatial-list button').first();
            await button.focus();
            await page.keyboard.press('Space');
            await expect(page.locator('.rv-spatial-list button[aria-pressed="true"]')).toBeFocused();
            await page.keyboard.press('Space');
            await expect(page.locator('.rv-spatial-list button[aria-pressed="true"]')).toHaveCount(0);
        }
        expect(accessibility).toEqual([]);
        expect(errors).toEqual([]);
        report.push({ localAssets: local, id, path, status: response.status(), errors, accessibility, mapControls, metrics, assets, overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth) });
        console.log(`${id} (${path}): HTTP ${response.status()}, ${accessibility.length} accessibility findings, ${mapControls.length} map controls`);
        await context.close();
    }
} finally {
    await writeFile('artifacts/roadmap-acceptance/surfaces' + (local ? '-local' : '') + '.json', JSON.stringify(report, null, 2));
    await browser.close();
}
