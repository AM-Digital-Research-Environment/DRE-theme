/**
 * The request routing shared by the hand-run production audits
 * (scripts/audit-roadmap.mjs, scripts/audit-live-surfaces.mjs).
 *
 * Every request goes through the production guard the smoke suite uses
 * (tests/browser/production-request-policy.mjs), so an audit can read the
 * live site and never write to it. With --local-assets, the module and theme
 * builds in the sibling checkouts (scripts/lib/siblings.mjs) and this tree are
 * served in place of the deployed ones, inside that browser only.
 */
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

import { productionRequestDecision } from '../../tests/browser/production-request-policy.mjs';
import { REPOSITORY_ROOT } from './files.mjs';
import { sibling } from './siblings.mjs';

export const LIVE_BASE_URL = process.env.LIVE_BASE_URL || 'https://data.africamultiple.uni-bayreuth.de';

/** [deployed path prefix, local directory] for each build --local-assets serves. */
const LOCAL_ASSETS = [
    ['/modules/DRESearch/asset/dist/', () => resolve(sibling('search').path, 'asset', 'dist')],
    ['/modules/DreVisualizations/asset/js/', () => resolve(sibling('visualizations').path, 'asset', 'js')],
    ['/modules/DreVisualizations/asset/css/', () => resolve(sibling('visualizations').path, 'asset', 'css')],
    ['/themes/DRE-theme/asset/css/', () => resolve(REPOSITORY_ROOT, 'asset', 'css')],
];

/** The local file standing in for a deployed asset path, or null. */
export function localAsset(pathname) {
    for (const [prefix, directory] of LOCAL_ASSETS) {
        if (!pathname.startsWith(prefix)) continue;
        const root = directory();
        let rest;
        try { rest = decodeURIComponent(pathname.slice(prefix.length)); } catch { return null; }
        const file = resolve(root, rest);
        // The path comes from a production page: never serve outside the build.
        return file.startsWith(root + sep) ? file : null;
    }
    return null;
}

/**
 * Route every request of `page` through the production guard, and through
 * the local builds when `local` is set. `onBlocked(request)` hears of each
 * request the guard refused.
 */
export async function routeAuditPage(page, { base = LIVE_BASE_URL, local = false, onBlocked } = {}) {
    await page.route('**/*', async (route) => {
        const request = route.request();
        if (!productionRequestDecision(request.method(), request.url(), request.headers(), base).allowed) {
            onBlocked?.(request);
            return route.abort();
        }
        const file = local ? localAsset(new URL(request.url()).pathname) : null;
        if (file) {
            return route.fulfill({
                body: await readFile(file),
                contentType: extname(file) === '.css' ? 'text/css' : 'application/javascript',
            });
        }
        return route.continue();
    });
}
