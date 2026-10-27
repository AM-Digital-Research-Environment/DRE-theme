#!/usr/bin/env node
// Lighthouse over the nightly smoke surfaces of tests/browser/surfaces.mjs, read-only.
//   npm run audit:lighthouse [-- --form-factor=mobile|desktop]
//   LIGHTHOUSE_RUNS=3 (median kept), LIGHTHOUSE_SURFACES=a,b narrows, LIVE_BASE_URL overrides.
// Median HTML reports and summary.json go to test-results/lighthouse/<form factor>/ (Git-ignored).
// Exits 1 on an `error` assertion; `warn` ones only annotate. Thresholds: scripts/lib/lighthouse-report.mjs.
import { chromium } from '@playwright/test';
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';
import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { surfaces } from '../tests/browser/surfaces.mjs';
import { evaluate, medianRun, summaryMarkdown, weightByOwner } from './lib/lighthouse-report.mjs';

const base = process.env.LIVE_BASE_URL || 'https://data.africamultiple.uni-bayreuth.de';
const runs = Number(process.env.LIGHTHOUSE_RUNS || 3);
const only = process.env.LIGHTHOUSE_SURFACES?.split(',');
const formFactorArg = process.argv.find(arg => arg.startsWith('--form-factor='))?.split('=')[1];
const formFactors = formFactorArg ? [formFactorArg] : ['mobile', 'desktop'];
const onlyCategories = ['performance', 'accessibility', 'best-practices', 'seo'];

async function resolvePath(surface) {
    if (surface.mode !== 'api-resolved') return surface.path;
    const [resource] = await (await fetch(base + surface.resolve.endpoint)).json();
    return surface.path.replace('{id}', resource[surface.resolve.idProperty]);
}

const selected = surfaces.filter(surface => surface.smoke && (!only || only.includes(surface.id)));
const chrome = await chromeLauncher.launch({ chromePath: chromium.executablePath(), chromeFlags: ['--headless=new', '--no-sandbox'] });
let failed = false;
try {
    for (const formFactor of formFactors) {
        const config = formFactor === 'desktop' ? { ...desktopConfig, settings: { ...desktopConfig.settings, onlyCategories } } : { extends: 'lighthouse:default', settings: { onlyCategories } };
        const outDir = `test-results/lighthouse/${formFactor}`;
        await mkdir(outDir, { recursive: true });
        const results = [];
        for (const surface of selected) {
            const url = base + await resolvePath(surface);
            const attempts = [];
            for (let run = 0; run < runs; run++) {
                const result = await lighthouse(url, { port: chrome.port, output: 'html', logLevel: 'error' }, config);
                attempts.push(result);
            }
            const median = attempts.find(({ lhr }) => lhr === medianRun(attempts.map(({ lhr }) => lhr)));
            const findings = evaluate(median.lhr, formFactor, surface);
            results.push({ surface, url, lhr: median.lhr, findings, weights: weightByOwner(median.lhr, base) });
            await writeFile(`${outDir}/${surface.id}.html`, median.report);
            const scores = onlyCategories.map(id => `${id} ${Math.round((median.lhr.categories[id]?.score ?? 0) * 100)}`).join(', ');
            console.log(`${formFactor} ${surface.id}: ${scores}${findings.length ? ` — ${findings.map(f => `${f.level}: ${f.message}`).join('; ')}` : ''}`);
            for (const finding of findings) {
                if (finding.level === 'error') failed = true;
                if (process.env.GITHUB_ACTIONS) console.log(`::${finding.level === 'error' ? 'error' : 'warning'} title=Lighthouse ${formFactor} · ${surface.label}::${finding.message} (owners: ${surface.owners.join(', ')}; ${url})`);
            }
        }
        await writeFile(`${outDir}/summary.json`, JSON.stringify(results.map(({ surface, url, lhr, findings, weights }) => ({
            id: surface.id, url, owners: surface.owners, findings, weights,
            scores: Object.fromEntries(onlyCategories.map(id => [id, lhr.categories[id]?.score ?? null])),
        })), null, 2));
        if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summaryMarkdown(results, formFactor));
    }
} finally {
    chrome.kill();
}
process.exitCode = failed ? 1 : 0;
