import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {extname, resolve, sep} from 'node:path';

export function renderFixture(name) {
    return execFileSync('php', [`tests/support/${name}-fixture.php`], {encoding: 'utf8'});
}

export const types = {'.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
    '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp',
    '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.pbf': 'application/x-protobuf'};

/**
 * Serve `html` as every page of https://theme.test with the theme's assets.
 * `handle(url, route)` sees each same-origin request first and returns true
 * once it has answered it — the module specs serve sibling bundles and stub
 * module APIs through it.
 */
export async function routeFixture(page, html, handle = () => false) {
    const assetRoot = resolve('asset');
    await page.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin !== 'https://theme.test') return route.abort();
        if (await handle(url, route)) return;
        if (url.pathname.startsWith('/themes/dre/asset/')) {
            const file = resolve(assetRoot, decodeURIComponent(url.pathname.slice('/themes/dre/asset/'.length)));
            if (!file.startsWith(assetRoot + sep)) return route.abort();
            try { return route.fulfill({contentType: types[extname(file)] || 'application/octet-stream', body: readFileSync(file)}); }
            catch { return route.fulfill({status: 404, body: ''}); }
        }
        // utils.js is on every real page before any theme script (layout.phtml);
        // the specs then add the scripts under test.
        return route.fulfill({contentType: 'text/html', body: html.replace('</head>',
            '<link rel="stylesheet" href="/themes/dre/asset/css/style.css">'
            + '<script src="/themes/dre/asset/js/utils.js"></script></head>')});
    });
}
