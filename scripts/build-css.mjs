#!/usr/bin/env node
/** Compile theme Sass directly; no task runner or glob-expansion dependency. */
import {watch} from 'node:fs';
import {mkdir, readFile, readdir, rename, rm, writeFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {compile} from 'sass';
import postcss from 'postcss';
import autoprefixer from 'autoprefixer';

const ROOT = resolve(import.meta.dirname, '..');

// The PHP floor is not declared anywhere in the theme: it is inherited from the
// Omeka S release theme.ini's omeka_version_constraint admits (4.2.1's
// composer.json requires php >=8.1). Raise it together with that constraint.
const REQUIRES_PHP = '8.1';

/**
 * The stylesheet header restates config/theme.ini [info], which is what Omeka
 * shows an admin. Every value is read from there on each build, so the two
 * cannot drift (the hand-written description already had).
 */
function cssHeader(ini) {
    const info = ini.split(/^\[info\]\s*$/m)[1]?.split(/^\[/m)[0];
    const value = key => {
        const match = info?.match(new RegExp(`^\\s*${key}\\s*=\\s*"([^"]+)"`, 'm'));
        if (!match) throw new Error(`CSS build: missing [info] ${key} in config/theme.ini`);
        if (match[1].includes('*/')) throw new Error(`CSS build: [info] ${key} must not contain "*/"`);
        return match[1];
    };
    return `/*
Theme Name: ${value('name')}
Theme URI: ${value('theme_link')}
Author: ${value('author')}
Author URI: ${value('author_link')}
Description: ${value('description')}
Version: ${value('version')}
Omeka Version Constraint: ${value('omeka_version_constraint')}
Requires PHP: ${REQUIRES_PHP}
License: GNU General Public License v3 or later
License URI: LICENSE
Text Domain: dre-theme
*/
`;
}

export async function buildCss(root = ROOT) {
    const sourceDir = join(root, 'asset/sass');
    const outputDir = join(root, 'asset/css');
    const header = cssHeader(await readFile(join(root, 'config/theme.ini'), 'utf8'));
    const {browserslist} = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
    const entries = (await readdir(sourceDir, {withFileTypes: true}))
        .filter(entry => entry.isFile() && entry.name.endsWith('.scss') && !entry.name.startsWith('_'))
        .map(entry => entry.name).sort();
    if (!entries.length) throw new Error('CSS build: no Sass entry points in asset/sass');

    // Compile every entry before writing any output, so Sass errors leave the
    // last successful build intact. Reread metadata and browser targets each run.
    const outputs = [];
    for (const name of entries) {
        const from = join(sourceDir, name);
        const to = join(outputDir, name.replace(/\.scss$/, '.css'));
        const compiled = compile(from, {style: 'compressed', charset: false});
        const result = await postcss([autoprefixer({overrideBrowserslist: browserslist})])
            .process(compiled.css, {from, to, map: false});
        for (const warning of result.warnings()) console.warn(warning.toString());
        // Keep @charset first and never move a Sass BOM into the first selector.
        const css = result.css.replace(/^\uFEFF/, '').replace(/^@charset [^;]+;\s*/, '');
        outputs.push({to, css: '@charset "UTF-8";\n' + header + css});
    }
    await mkdir(outputDir, {recursive: true});
    for (const {to, css} of outputs) {
        const temporary = `${to}.${process.pid}.tmp`;
        try {
            await writeFile(temporary, css, 'utf8');
            await rename(temporary, to);
        } finally {
            await rm(temporary, {force: true});
        }
    }
    return outputs.length;
}

export function watchCss(root = ROOT, {onBuild = count => console.log(`CSS: built ${count} stylesheet(s); watching for changes.`), onError = console.error} = {}) {
    let timer, running = false, pending = false, closed = false;
    const watchers = [];
    const close = () => {
        closed = true;
        clearTimeout(timer);
        watchers.forEach(watcher => watcher.close());
    };
    const rebuild = async () => {
        if (closed) return;
        pending = true;
        if (running) return;
        running = true;
        try {
            do {
                pending = false;
                try { const count = await buildCss(root); if (!closed) onBuild(count); }
                catch (error) { if (!closed) onError(error); }
            } while (pending && !closed);
        } finally { running = false; }
    };
    const schedule = () => {
        clearTimeout(timer);
        timer = setTimeout(rebuild, 75);
    };
    try {
        for (const [directory, recursive, accepts] of [
            [join(root, 'asset/sass'), true, name => name.endsWith('.scss')],
            [join(root, 'config'), false, name => name === 'theme.ini'],
            [root, false, name => name === 'package.json'],
        ]) {
            const watcher = watch(directory, {recursive}, (event, name) => {
                if (!name || accepts(String(name)) || (recursive && event === 'rename')) schedule();
            });
            watcher.on('error', error => { close(); onError(error); });
            watchers.push(watcher);
        }
    } catch (error) { close(); throw error; }
    void rebuild();
    return close;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        const args = process.argv.slice(2);
        if (args.length > 1 || (args.length && args[0] !== '--watch')) {
            throw new Error('Usage: node scripts/build-css.mjs [--watch]');
        }
        if (args[0] === '--watch') {
            const close = watchCss();
            process.once('SIGINT', close);
            process.once('SIGTERM', close);
        } else {
            console.log(`CSS: built ${await buildCss()} stylesheet(s).`);
        }
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
