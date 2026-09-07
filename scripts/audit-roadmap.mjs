#!/usr/bin/env node
// Bounded read-only acceptance pass. --local-assets previews sibling Search
// and theme builds in this browser only; the production HTML/data stay intact.
import { chromium, expect } from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { productionRequestDecision } from '../tests/browser/production-request-policy.mjs';

const base = process.env.LIVE_BASE_URL || 'https://data.africamultiple.uni-bayreuth.de';
const local = process.argv.includes('--local-assets');
const output = resolve('artifacts/roadmap-acceptance');
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const report = { capturedAt: new Date().toISOString(), localAssets: local, cases: [] };
try {
    for (const mode of ['light', 'dark']) {
        for (const width of [320, 390, 1280]) {
            const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: mode, reducedMotion: 'reduce', hasTouch: width < 500 });
            const page = await context.newPage();
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.route('**/*', async route => {
                const request = route.request();
                if (!productionRequestDecision(request.method(), request.url(), request.headers(), base).allowed) {
                    errors.push(`Blocked mutation: ${request.url()}`);
                    return route.abort();
                }
                const pathname = new URL(request.url()).pathname;
                let file;
                if (local && pathname.startsWith('/modules/DRESearch/asset/dist/')) file = resolve('../DRE-Search/asset/dist', pathname.split('/asset/dist/')[1]);
                if (local && pathname === '/themes/DRE-theme/asset/css/style.css') file = resolve('asset/css/style.css');
                if (file) return route.fulfill({ body: await readFile(file), contentType: extname(file) === '.css' ? 'text/css' : 'application/javascript' });
                return route.continue();
            });
            const session = await context.newCDPSession(page);
            await session.send('Performance.enable');
            await page.goto(`${base}/s/amira/dre-search`, { waitUntil: 'domcontentloaded' });
            await expect(page.locator('.dre-search__results')).toHaveAttribute('aria-busy', 'false');
            const versions = await page.locator('script[src], link[href]').evaluateAll(nodes => nodes.map(node => node.src || node.href).filter(url => /DRESearch|DRE-theme|DreVisualizations/.test(url)));
            const chooser = page.locator('.dre-fed__chooser select');
            if (width < 500) {
                await expect(chooser).toBeVisible();
                await chooser.focus();
                await expect(chooser).toBeFocused();
            } else {
                const tab = page.getByRole('tab', { selected: true });
                await tab.focus();
                await page.keyboard.press('ArrowRight');
                await expect(page.getByRole('tab', { selected: true })).toBeFocused();
            }
            await expect(page.locator('.dre-search__results')).toHaveAttribute('aria-busy', 'false');
            const toggleSizes = await page.locator('.dre-view button').evaluateAll(nodes => nodes.map(node => {
                const box = node.getBoundingClientRect();
                return { width: box.width, height: box.height };
            }));
            if (local) for (const box of toggleSizes) {
                expect(box.width).toBeGreaterThanOrEqual(44);
                expect(box.height).toBeGreaterThanOrEqual(44);
            }
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
            await page.screenshot({ path: `${output}/search-${mode}-${width}.png` });
            const metrics = Object.fromEntries((await session.send('Performance.getMetrics')).metrics
                .filter(metric => ['ScriptDuration', 'TaskDuration', 'LayoutDuration'].includes(metric.name))
                .map(metric => [metric.name, metric.value]));
            const assets = await page.evaluate(() => performance.getEntriesByType('resource')
                .filter(entry => entry.name.includes('/DRESearch/asset/dist/'))
                .map(entry => ({ url: entry.name, transferSize: entry.transferSize, decodedBodySize: entry.decodedBodySize })));
            if (mode === 'light' && width === 390) {
                const summary = page.locator('.dre-actions summary');
                await summary.focus();
                await page.keyboard.press('Enter');
                await expect(page.locator('.dre-actions')).toHaveAttribute('open', '');
                await page.getByRole('button', { name: 'Filters', exact: true }).click();
                const facet = page.locator('.dre-search input[type="checkbox"]').first();
                await expect(facet).toBeVisible();
                await facet.check();
                await expect(page.locator('.dre-search__results')).toHaveAttribute('aria-busy', 'false');
                const query = page.locator('.dre-fed__search input');
                await query.fill('zzzxqnonexistentroadmap20260907');
                await query.press('Enter');
                await expect(page.locator('.dre-search__empty')).toBeVisible();
                await query.fill('');
                await query.press('Enter');
                await expect(page.locator('.dre-search__empty')).toHaveCount(0);
                const drawer = page.locator('.main-navigation__toggle');
                await drawer.click();
                expect(await page.locator('#menu-drawer').evaluate(node => getComputedStyle(node).transitionDuration)).toBe('0s');
                await page.keyboard.press('Escape');
                await expect(drawer).toHaveAttribute('aria-expanded', 'false');
            }
            // Text zoom and deliberately long translated UI strings, browser-local.
            await page.addStyleTag({ content: 'html { font-size: 200%; }' });
            await chooser.locator('option').evaluateAll(options => options.forEach(option => {
                option.textContent = `Résultats de recherche et ressources documentaires : ${option.textContent}`;
            }));
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
            expect(errors).toEqual([]);
            report.cases.push({ mode, width, versions, toggleSizes, metrics, assets, textZoomReflow: true });
            await context.close();
        }
    }
} finally {
    await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
    await browser.close();
}
console.log(`Roadmap acceptance: ${report.cases.length} viewport/mode cases passed; ${output}`);
