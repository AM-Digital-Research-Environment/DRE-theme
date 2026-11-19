#!/usr/bin/env node
/**
 * Copy package.json's version everywhere else the release version is written.
 *
 *   npm version <major|minor|patch|x.y.z>   runs this as the `version` hook
 *   node scripts/sync-version.mjs           same edits, nothing staged
 *   node scripts/sync-version.mjs --root=<dir>   ... in another theme tree
 *
 * npm bumps package.json and package-lock.json, then runs the `version`
 * script before it commits and tags. This writes the same number into
 *
 *   config/theme.ini   [info] version — what Omeka shows an admin, and what
 *                      the release tag must match
 *   CITATION.cff       version, and date-released → today
 *   README.md          a hard-coded version badge, if one is ever added
 *   CHANGELOG.md       promotes the [Unreleased] notes to `## [x.y.z] - today`
 *   asset/css/*.css    rebuilt, because the stylesheet header restates the
 *                      version (CI fails a stale compiled CSS)
 *
 * and, under `npm version`, stages them so they land in the version commit.
 * `npm run lint:ini` (scripts/check-theme-ini.mjs) asserts the result.
 *
 * Under `npm version` an empty [Unreleased] is a failure, not a no-op: the
 * release workflow takes its notes from the version's CHANGELOG section and
 * would otherwise publish generated notes in their place. (The `preversion`
 * hook refuses the same thing before package.json is bumped; this is the
 * backstop.) Run by hand, the script only syncs what it can.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildCss } from './build-css.mjs';
import { changelogSection, promoteUnreleased } from './changelog-section.mjs';
import { compiledCssPath, sassEntryPoints, themeRoot } from './lib/files.mjs';
import { parseInfo } from './lib/theme-ini.mjs';

const ROOT = themeRoot();
const version = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) {
    console.error(`sync-version: package.json version "${version}" is not x.y.z`);
    process.exit(1);
}
const today = new Date().toISOString().slice(0, 10);
const touched = [];
const releasing = process.env.npm_lifecycle_event === 'version';

// Before any file is written, so a refused release leaves only npm's own bump
// of package.json and package-lock.json to undo.
if (releasing) {
    const changelog = join(ROOT, 'CHANGELOG.md');
    const text = existsSync(changelog) ? readFileSync(changelog, 'utf8') : '';
    if (!changelogSection(promoteUnreleased(text, version, today), version)) {
        console.error(
            `sync-version: CHANGELOG.md has no notes for ${version}: ## [Unreleased] is empty (or missing). ` +
                'Write the release notes there, then undo the bump (git checkout -- package.json package-lock.json) ' +
                'and run npm version again.',
        );
        process.exit(1);
    }
}

function edit(file, transform, { required = true } = {}) {
    const path = join(ROOT, file);
    if (!existsSync(path)) {
        if (required) throw new Error(`sync-version: ${file} is missing`);
        return;
    }
    const before = readFileSync(path, 'utf8');
    const after = transform(before);
    if (after !== before) {
        writeFileSync(path, after);
        touched.push(file);
    }
}

try {
    // Only the [info] block: other sections may legitimately carry a `version` key.
    edit('config/theme.ini', (text) => {
        const replaced = text.replace(
            /(^\[info\][^\n]*\n(?:(?!\[)[^\n]*\n)*?)version\s*=\s*"[^"]*"/m,
            `$1version = "${version}"`,
        );
        if (parseInfo(replaced).values.version !== version) {
            throw new Error('sync-version: no [info] version line in config/theme.ini');
        }
        return replaced;
    });
    // The release date moves only with the version, so a re-run is a no-op.
    edit('CITATION.cff', (text) => {
        const bumped = text.replace(/^version:\s*.*$/m, `version: ${version}`);
        return bumped === text ? text : bumped.replace(/^date-released:\s*.*$/m, `date-released: ${today}`);
    });
    edit('README.md', (text) => text.replace(
        /(img\.shields\.io\/badge\/version-v?)\d+\.\d+\.\d+/g,
        `$1${version}`,
    ), { required: false });
    edit('CHANGELOG.md', (text) => promoteUnreleased(text, version, today), { required: false });

    // Stage only the compiled outputs of Sass entry points, never other files
    // that happen to be modified under asset/css.
    await buildCss(ROOT);
    const outputs = sassEntryPoints(ROOT).map(compiledCssPath);
    const css = spawnSync('git', ['status', '--porcelain', '--', ...outputs], { cwd: ROOT, encoding: 'utf8' });
    for (const line of (css.stdout ?? '').split('\n').filter(Boolean)) touched.push(line.slice(3));
} catch (error) {
    console.error(error.message);
    process.exit(1);
}

if (releasing && touched.length) {
    const add = spawnSync('git', ['add', '--', ...touched], { cwd: ROOT, stdio: 'inherit' });
    if (add.status !== 0) process.exit(add.status ?? 1);
}
console.log(`sync-version: ${version}${touched.length ? ` → ${touched.join(', ')}` : ' (already in sync)'}`);
