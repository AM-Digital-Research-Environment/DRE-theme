#!/usr/bin/env node
/**
 * Minify the theme's scripts: asset/js/<name>.js → asset/js/dist/<name>.min.js
 * plus a source map. Ported from IWAC-theme's build-js.
 *
 *   node scripts/build-js.mjs            write what changed
 *   node scripts/build-js.mjs --watch    rebuild on every save (npm run watch
 *                                        runs this and the CSS watcher together)
 *
 * The templates load the minified files, and they are committed for the same
 * reason the compiled CSS is: the release zip carries no toolchain. esbuild
 * only minifies; it does not bundle or change the script format, so each file
 * stays a classic script and its top-level names stay as written. The target
 * is the theme's browser floor (Safari 16.2), so a source using newer syntax
 * fails the build instead of a visitor's browser. Already-minified vendor
 * files (`*.min.js`, e.g. Masonry) are left where they are.
 *
 * Whether the committed dist/ is current is scripts/check-stale-css.mjs's
 * question, asked after a build: it compares with git, so it also sees a
 * source deleted without its output.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, watch, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';

import { REPOSITORY_ROOT } from './lib/files.mjs';

const TARGET = ['es2022', 'safari16.2'];

const paths = (root) => {
    const src = join(root, 'asset', 'js');
    return { src, dist: join(src, 'dist') };
};

const sources = (src) => readdirSync(src, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.js') && !entry.name.endsWith('.min.js'))
    .map((entry) => entry.name.slice(0, -3))
    .sort();

/** The two files one source compiles to, as { relative path: content }. */
async function compile(src, name) {
    // LF regardless of the checkout: the map embeds the source verbatim.
    const source = readFileSync(join(src, `${name}.js`), 'utf8').replace(/\r\n/g, '\n');
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

/** Write what changed and remove outputs whose source is gone. */
export async function buildJs(root = REPOSITORY_ROOT) {
    const { src, dist } = paths(root);
    const expected = {};
    for (const name of sources(src)) Object.assign(expected, await compile(src, name));

    const present = existsSync(dist) ? readdirSync(dist).filter((file) => /\.min\.js(\.map)?$/.test(file)) : [];
    const stale = Object.keys(expected).filter((file) => {
        const path = join(dist, file);
        return !existsSync(path) || readFileSync(path, 'utf8') !== expected[file];
    });
    const orphans = present.filter((file) => !(file in expected));

    mkdirSync(dist, { recursive: true });
    for (const file of stale) writeFileSync(join(dist, file), expected[file]);
    for (const file of orphans) unlinkSync(join(dist, file));
    return { written: stale.length, removed: orphans.length, sources: Object.keys(expected).length / 2 };
}

const summary = ({ written, removed, sources: count }) =>
    `Minified scripts: ${written} written, ${removed} removed, ${count} source(s).`;

/** Build, then rebuild on every source change; returns a function that stops watching. */
export function watchJs(root = REPOSITORY_ROOT, {
    onBuild = (result) => console.log(`${summary(result)} Watching asset/js/ …`),
    onError = (error) => console.error(`Minified scripts: ${error.message}`),
} = {}) {
    const { src } = paths(root);
    let timer = null;
    const run = () => buildJs(root).then(onBuild, onError);
    const watcher = watch(src, (_event, file) => {
        if (!file || !file.endsWith('.js') || file.endsWith('.min.js')) return;
        clearTimeout(timer);
        timer = setTimeout(run, 50);
    });
    watcher.on('error', onError);
    void run();
    return () => {
        clearTimeout(timer);
        watcher.close();
    };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const args = process.argv.slice(2);
    if (args.length > 1 || (args.length && args[0] !== '--watch')) {
        console.error('Usage: node scripts/build-js.mjs [--watch]');
        process.exit(2);
    }
    if (args[0] === '--watch') {
        const close = watchJs();
        process.once('SIGINT', close);
        process.once('SIGTERM', close);
    } else {
        try {
            console.log(summary(await buildJs()));
        } catch (error) {
            console.error(`Minified scripts: ${error.message}`);
            process.exitCode = 1;
        }
    }
}
