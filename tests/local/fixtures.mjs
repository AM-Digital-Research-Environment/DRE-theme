import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {extname, resolve, sep} from 'node:path';

export function renderFixture(name) {
    return execFileSync('php', [`tests/support/${name}-fixture.php`], {encoding: 'utf8'});
}

export async function routeFixture(page, html) {
    const assetRoot = resolve('asset');
    const types = {'.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml',
        '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2'};
    await page.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin !== 'https://theme.test') return route.abort();
        if (url.pathname.startsWith('/themes/dre/asset/')) {
            const file = resolve(assetRoot, decodeURIComponent(url.pathname.slice('/themes/dre/asset/'.length)));
            if (!file.startsWith(assetRoot + sep)) return route.abort();
            try { return route.fulfill({contentType: types[extname(file)] || 'application/octet-stream', body: readFileSync(file)}); }
            catch { return route.fulfill({status: 404, body: ''}); }
        }
        return route.fulfill({contentType: 'text/html', body: html.replace('</head>',
            '<link rel="stylesheet" href="/themes/dre/asset/css/style.css"></head>')});
    });
}
