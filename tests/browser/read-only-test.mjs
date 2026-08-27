import { test as base, expect } from '@playwright/test';

import { productionRequestDecision } from './production-request-policy.mjs';

export function watchErrors(page) {
    const errors = [];
    page.on('console', (message) => {
        if (message.type() === 'error') errors.push(`console: ${message.text()}`);
    });
    page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
    return errors;
}

export async function collectDreAssetVersions(page) {
    const assetUrls = await page.locator('link[href], script[src]').evaluateAll((elements) => elements
        .map((element) => element.href || element.src)
        .filter(Boolean));

    const owners = {
        'DRE-theme': /\/themes\/DRE-theme\//i,
        DRESearch: /\/modules\/DRESearch\//i,
        'DRE-Visualizations': /\/modules\/(?:DRE-?Visualizations|ResourceVisualizations)\//i,
    };

    return Object.fromEntries(Object.entries(owners).map(([owner, pattern]) => {
        const urls = [...new Set(assetUrls.filter((url) => pattern.test(url)))];
        const versions = [...new Set(urls.map((url) => {
            const parsed = new URL(url);
            return parsed.searchParams.get('v') || parsed.searchParams.get('version');
        }).filter(Boolean))];
        return [owner, { versions, urls }];
    }));
}

export const test = base.extend({
    productionRequestSafety: [async ({ page, baseURL }, use, testInfo) => {
        const blocked = [];
        const allowedReadOnlyPosts = [];
        await page.route('**/*', async (route) => {
            const request = route.request();
            const decision = productionRequestDecision(
                request.method(),
                request.url(),
                request.headers(),
                baseURL,
            );
            if (!decision.allowed) {
                blocked.push(`${request.method()} ${request.url()}`);
                await route.abort('blockedbyclient');
                return;
            }
            if (decision.reason === 'read-only-search-post') {
                allowedReadOnlyPosts.push(`${request.method()} ${request.url()}`);
            }
            await route.continue();
        });

        await use({ blocked, allowedReadOnlyPosts });
        await testInfo.attach('production-request-safety.json', {
            body: JSON.stringify({ blocked, allowedReadOnlyPosts }, null, 2),
            contentType: 'application/json',
        });
        expect(blocked, 'production tests must never attempt a mutating request').toEqual([]);
    }, { auto: true }],
});

test.afterEach(async ({ page }, testInfo) => {
    if (!page.url().startsWith('http')) return;
    const versions = await collectDreAssetVersions(page);
    await testInfo.attach('dre-asset-versions.json', {
        body: JSON.stringify({ page: page.url(), capturedAt: new Date().toISOString(), ...versions }, null, 2),
        contentType: 'application/json',
    });
});

export { expect };
