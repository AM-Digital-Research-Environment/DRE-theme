#!/usr/bin/env node
/**
 * Stale compiled-CSS gate — run AFTER `npm run build:css` (npm run verify does).
 *
 *   node scripts/check-stale-css.mjs
 *
 * asset/css/style.css is committed, because it is what Omeka serves and the
 * release zip carries no toolchain. So a Sass change that was never rebuilt
 * ships the old styles. In CI the checkout is clean, so if the fresh build
 * changed the compiled CSS, the committed copy was stale: that fails.
 *
 * Locally the same comparison would fail on every uncommitted Sass edit, even
 * though the rebuilt CSS is exactly what should be committed with it. So a
 * difference is only an error when none of the build's inputs (asset/sass,
 * config/theme.ini, package.json) differ from HEAD either; otherwise it is a
 * reminder to commit the two together.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const INPUTS = ['asset/sass', 'config/theme.ini', 'package.json'];

// Every Sass entry point (not a partial) compiles to asset/css/<name>.css.
const outputs = readdirSync(join(ROOT, 'asset', 'sass'), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.scss') && !entry.name.startsWith('_'))
    .map((entry) => `asset/css/${entry.name.replace(/\.scss$/, '.css')}`)
    .sort();

/** Paths among `paths` that differ from HEAD (staged, unstaged or untracked). */
function changed(paths) {
    const result = spawnSync('git', ['status', '--porcelain', '--untracked-files=all', '--', ...paths], {
        cwd: ROOT,
        encoding: 'utf8',
    });
    if (result.status !== 0) {
        console.error(`Compiled CSS freshness: git status failed — ${result.error?.message ?? result.stderr}`);
        process.exit(2);
    }
    return result.stdout.split('\n').filter(Boolean).map((line) => line.slice(3));
}

const staleOutputs = changed(outputs);
if (!staleOutputs.length) {
    console.log(`Compiled CSS freshness: ${outputs.join(', ')} match${outputs.length === 1 ? 'es' : ''} the committed build.`);
    process.exit(0);
}

const changedInputs = changed(INPUTS);
if (changedInputs.length) {
    console.log(
        `Compiled CSS freshness: ${staleOutputs.join(', ')} changed together with ${changedInputs.length} ` +
            `build input(s) (${changedInputs.slice(0, 3).join(', ')}${changedInputs.length > 3 ? ', …' : ''}) — ` +
            'commit the rebuilt CSS with them.',
    );
    process.exit(0);
}

const message = `${staleOutputs.join(', ')} is out of date — run 'npm run build' and commit the result.`;
console.error(process.env.GITHUB_ACTIONS ? `::error::${message}` : `Compiled CSS freshness: ${message}`);
spawnSync('git', ['diff', '--stat', '--', ...staleOutputs], { cwd: ROOT, stdio: 'inherit' });
process.exit(1);
