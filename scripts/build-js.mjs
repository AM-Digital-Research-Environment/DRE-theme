#!/usr/bin/env node
/**
 * Minify the theme's scripts: asset/js/<name>.js → asset/js/dist/<name>.min.js
 * plus a source map. Ported from IWAC-theme's build-js.
 *
 *   node scripts/build-js.mjs            write what changed
 *   node scripts/build-js.mjs --check    fail if dist/ is stale or has orphans
 *   node scripts/build-js.mjs --watch    rebuild on every save
 *
 * The templates load the minified files, and they are committed for the same
 * reason the compiled CSS is: the release zip carries no toolchain. esbuild
 * only minifies; it does not bundle or change the script format, so each file
 * stays a classic script and its top-level names stay as written. The target
 * is the theme's browser floor (Safari 16.2), so a source using newer syntax
 * fails the build instead of a visitor's browser. Already-minified vendor
 * files (`*.min.js`, e.g. Masonry) are left where they are.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, watch, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { transform } from 'esbuild';

const ROOT = join(import.meta.dirname, '..');
const SRC = join(ROOT, 'asset', 'js');
const DIST = join(SRC, 'dist');
const TARGET = ['es2022', 'safari16.2'];

const sources = () => readdirSync(SRC, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.js') && !entry.name.endsWith('.min.js'))
    .map((entry) => entry.name.slice(0, -3))
    .sort();

/** The two files one source compiles to, as { relative path: content }. */
async function compile(name) {
    // LF regardless of the checkout: the map embeds the source verbatim.
    const source = readFileSync(join(SRC, `${name}.js`), 'utf8').replace(/\r\n/g, '\n');
    const result = await transform(source, {
        loader: 'js',
        minify: true,
        target: TARGET,
        sourcemap: 'external',
        sourcefile: `../${name}.js`,
        charset: 'utf8',
    });
    return {
        [`${name}.min.js`]: `${result.code.trimEnd()}\n//# sourceMappingURL=${name}.min.js.map\n`,
        [`${name}.min.js.map`]: `${result.map.trimEnd()}\n`,
    };
}

async function build({ check = false } = {}) {
    const expected = {};
    for (const name of sources()) Object.assign(expected, await compile(name));

    const present = existsSync(DIST) ? readdirSync(DIST).filter((file) => /\.min\.js(\.map)?$/.test(file)) : [];
    const stale = Object.keys(expected).filter((file) => {
        const path = join(DIST, file);
        return !existsSync(path) || readFileSync(path, 'utf8') !== expected[file];
    });
    const orphans = present.filter((file) => !(file in expected));

    if (check) {
        if (!stale.length && !orphans.length) {
            console.log(`Minified scripts: asset/js/dist/ matches ${Object.keys(expected).length / 2} source(s).`);
            return true;
        }
        const message = [
            stale.length ? `stale: ${stale.join(', ')}` : '',
            orphans.length ? `no source: ${orphans.join(', ')}` : '',
        ].filter(Boolean).join('; ');
        const text = `asset/js/dist/ is out of date (${message}) — run 'npm run build:js' and commit the result.`;
        console.error(process.env.GITHUB_ACTIONS ? `::error::${text}` : `Minified scripts: ${text}`);
        return false;
    }

    mkdirSync(DIST, { recursive: true });
    for (const file of stale) writeFileSync(join(DIST, file), expected[file]);
    for (const file of orphans) unlinkSync(join(DIST, file));
    console.log(`Minified scripts: ${stale.length} written, ${orphans.length} removed, ${Object.keys(expected).length / 2} source(s).`);
    return true;
}

const args = new Set(process.argv.slice(2));
if (args.has('--watch')) {
    let timer = null;
    const run = () => build().catch((error) => console.error(`Minified scripts: ${error.message}`));
    await run();
    watch(SRC, (_event, file) => {
        if (!file || !file.endsWith('.js') || file.endsWith('.min.js')) return;
        clearTimeout(timer);
        timer = setTimeout(run, 50);
    });
    console.log('Minified scripts: watching asset/js/ …');
} else {
    try {
        process.exitCode = (await build({ check: args.has('--check') })) ? 0 : 1;
    } catch (error) {
        console.error(`Minified scripts: ${error.message}`);
        process.exitCode = 1;
    }
}
