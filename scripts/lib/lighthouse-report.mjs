/**
 * Lighthouse assertions and owner attribution for the nightly live audit.
 *
 * A Lighthouse score belongs to a page, and every AMIRA page mixes the theme
 * with module blocks, so a red score alone says nothing about which repository
 * should act. Two things narrow it: each surface in tests/browser/surfaces.mjs
 * names its owners, and every request Lighthouse records can be traced to the
 * theme or module directory that served it.
 *
 * Warn first: a threshold starts as `warn` and becomes `error` only once the
 * production baseline has passed it for a while. The performance score on a
 * shared runner swings by several points between runs, so it stays a warning.
 * Layout shift is a warning until the DRESearch fix for the search page's
 * footer jump (CLS 0.22, DRE Search 1.32.1) is deployed; every other
 * smoke surface stays under 0.03.
 *
 * A surface marked `indexable: false` is noindex by design, so its SEO score is
 * not asserted. On every other surface an accidental noindex costs `is-crawlable`
 * about a third of the SEO score, which the SEO threshold already catches.
 */

export const categoryAssertions = [
    { id: 'performance', level: 'warn', min: 0.8 },
    { id: 'accessibility', level: 'error', min: 0.95 },
    { id: 'best-practices', level: 'warn', min: 0.9 },
    { id: 'seo', level: 'error', min: 0.9 },
];

export const auditAssertions = [
    { id: 'cumulative-layout-shift', level: 'warn', max: { mobile: 0.1, desktop: 0.1 } },
    { id: 'largest-contentful-paint', level: 'warn', max: { mobile: 4000, desktop: 2500 }, unit: 'ms' },
    { id: 'total-blocking-time', level: 'warn', max: { mobile: 600, desktop: 300 }, unit: 'ms' },
];

// Module directory → the owner name surfaces.mjs uses.
const moduleOwners = { DreVisualizations: 'DRE-Visualizations' };

export function assetOwner(url, baseURL) {
    const { origin, pathname } = new URL(url);
    if (origin !== new URL(baseURL).origin) return new URL(url).hostname;
    const module = pathname.match(/^\/modules\/([^/]+)\//)?.[1];
    if (module) return moduleOwners[module] || module;
    if (pathname.startsWith('/themes/')) return 'DRE-theme';
    if (pathname.startsWith('/application/')) return 'Omeka S';
    if (pathname.startsWith('/files/')) return 'media files';
    return 'page';
}

/** The run with the median performance score; Lighthouse's own median needs TTI, which v10 dropped. */
export function medianRun(lhrs) {
    const usable = lhrs.filter(lhr => !lhr.runtimeError && lhr.categories.performance?.score != null);
    if (!usable.length) return lhrs[0];
    const sorted = [...usable].sort((a, b) => a.categories.performance.score - b.categories.performance.score);
    return sorted[Math.floor((sorted.length - 1) / 2)];
}

const formatValue = (value, unit) => unit === 'ms' ? `${Math.round(value)} ms` : String(Math.round(value * 1000) / 1000);

export function evaluate(lhr, formFactor, surface = {}) {
    if (lhr.runtimeError) return [{ level: 'error', id: 'runtime', message: `Lighthouse could not audit the page: ${lhr.runtimeError.code} ${lhr.runtimeError.message}` }];
    const findings = [];
    for (const { id, level, min } of categoryAssertions) {
        if (id === 'seo' && surface.indexable === false) continue;
        const score = lhr.categories[id]?.score;
        if (score == null) findings.push({ level, id, message: `${id} has no score` });
        else if (score < min) findings.push({ level, id, message: `${id} ${Math.round(score * 100)} < ${Math.round(min * 100)}` });
    }
    for (const { id, level, max, unit } of auditAssertions) {
        const value = lhr.audits[id]?.numericValue;
        if (value != null && value > max[formFactor]) findings.push({ level, id, message: `${id} ${formatValue(value, unit)} > ${formatValue(max[formFactor], unit)}` });
    }
    return findings;
}

/** Transferred bytes per owner, split by resource type, from the network-requests audit. */
export function weightByOwner(lhr, baseURL) {
    const owners = {};
    for (const { url, transferSize = 0, resourceType } of lhr.audits['network-requests']?.details?.items || []) {
        if (!/^https?:/.test(url)) continue;
        const owner = owners[assetOwner(url, baseURL)] ??= { script: 0, stylesheet: 0, total: 0, requests: 0 };
        if (resourceType === 'Script') owner.script += transferSize;
        if (resourceType === 'Stylesheet') owner.stylesheet += transferSize;
        owner.total += transferSize;
        owner.requests += 1;
    }
    return owners;
}

const kib = bytes => (bytes / 1024).toFixed(1);
const score = (lhr, id, surface) => {
    if (lhr.categories?.[id]?.score == null) return '–';
    return Math.round(lhr.categories[id].score * 100) + (id === 'seo' && surface.indexable === false ? ' (noindex)' : '');
};

/** Markdown for $GITHUB_STEP_SUMMARY: scores, then findings and asset weight grouped by owner. */
export function summaryMarkdown(results, formFactor) {
    const lines = [`## Lighthouse (${formFactor})`, '', '| Surface | Perf | A11y | Best practices | SEO | Findings |', '| --- | ---: | ---: | ---: | ---: | --- |'];
    for (const { surface, lhr, findings } of results) {
        lines.push(`| ${surface.label} | ${['performance', 'accessibility', 'best-practices', 'seo'].map(id => score(lhr, id, surface)).join(' | ')} | ${findings.map(f => `${f.level === 'error' ? '❌' : '⚠️'} ${f.message}`).join('<br>') || '✅'} |`);
    }
    const owners = [...new Set(results.flatMap(({ surface }) => surface.owners))];
    for (const owner of owners) {
        const owned = results.filter(({ surface }) => surface.owners.includes(owner));
        lines.push('', `### ${owner}`, '');
        const findings = owned.flatMap(({ surface, findings }) => findings.map(f => `- ${f.level === 'error' ? '❌' : '⚠️'} ${surface.label}: ${f.message}`));
        lines.push(...(findings.length ? findings : ['No findings on the surfaces it owns.']));
        const weights = owned.map(({ surface, weights }) => [surface, weights[owner]]).filter(([, weight]) => weight);
        if (weights.length) {
            lines.push('', '| Surface | JS KiB | CSS KiB | All KiB | Requests |', '| --- | ---: | ---: | ---: | ---: |');
            for (const [surface, w] of weights) lines.push(`| ${surface.label} | ${kib(w.script)} | ${kib(w.stylesheet)} | ${kib(w.total)} | ${w.requests} |`);
        }
    }
    return lines.join('\n') + '\n';
}
