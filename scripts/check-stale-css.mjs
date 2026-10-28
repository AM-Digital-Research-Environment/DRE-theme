#!/usr/bin/env node
/**
 * Stale build-output gate — run AFTER `npm run build` (npm run verify does).
 *
 *   node scripts/check-stale-css.mjs
 *
 * asset/css/style.css and asset/js/dist/ are committed, because they are what
 * Omeka serves and the release zip carries no toolchain. So a Sass or script
 * change that was never rebuilt ships the old output. In CI the checkout is
 * clean, so if the fresh build changed a committed output, the committed copy
 * was stale: that fails.
 *
 * Locally the same comparison would fail on every uncommitted source edit,
 * even though the rebuilt output is exactly what should be committed with it.
 * So a difference is only an error when none of that output's build inputs
 * differ from HEAD either; otherwise it is a reminder to commit the two
 * together.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');

const GROUPS = [
    {
        label: 'Compiled CSS freshness',
        noun: 'the rebuilt CSS',
        // Every Sass entry point (not a partial) compiles to asset/css/<name>.css.
        outputs: readdirSync(join(ROOT, 'asset', 'sass'), { withFileTypes: true })
            .filter((entry) => entry.isFile() && entry.name.endsWith('.scss') && !entry.name.startsWith('_'))
            .map((entry) => `asset/css/${entry.name.replace(/\.scss$/, '.css')}`)
            .sort(),
        inputs: ['asset/sass', 'config/theme.ini', 'package.json'],
    },
    {
        label: 'Minified scripts freshness',
        noun: 'the rebuilt asset/js/dist/',
        outputs: ['asset/js/dist'],
        // `:(glob)` so `*` stops at the slash: dist/ is an output, not an input.
        inputs: [':(glob)asset/js/*.js', 'scripts/build-js.mjs', 'package-lock.json'],
    },
];

/** Paths among `paths` that differ from HEAD (staged, unstaged or untracked). */
function changed(label, paths) {
    const result = spawnSync('git', ['status', '--porcelain', '--untracked-files=all', '--', ...paths], {
        cwd: ROOT,
        encoding: 'utf8',
    });
    if (result.status !== 0) {
        console.error(`${label}: git status failed — ${result.error?.message ?? result.stderr}`);
        process.exit(2);
    }
    return result.stdout.split('\n').filter(Boolean).map((line) => line.slice(3));
}

let failed = false;
for (const { label, noun, outputs, inputs } of GROUPS) {
    const staleOutputs = changed(label, outputs);
    if (!staleOutputs.length) {
        console.log(`${label}: ${outputs.join(', ')} match${outputs.length === 1 ? 'es' : ''} the committed build.`);
        continue;
    }

    const changedInputs = changed(label, inputs);
    if (changedInputs.length) {
        console.log(
            `${label}: ${staleOutputs.slice(0, 3).join(', ')}${staleOutputs.length > 3 ? ', …' : ''} changed together with ` +
                `${changedInputs.length} build input(s) (${changedInputs.slice(0, 3).join(', ')}${changedInputs.length > 3 ? ', …' : ''}) — ` +
                `commit ${noun} with them.`,
        );
        continue;
    }

    const message = `${staleOutputs.join(', ')} is out of date — run 'npm run build' and commit the result.`;
    console.error(process.env.GITHUB_ACTIONS ? `::error::${message}` : `${label}: ${message}`);
    spawnSync('git', ['diff', '--stat', '--', ...staleOutputs], { cwd: ROOT, stdio: 'inherit' });
    failed = true;
}
process.exit(failed ? 1 : 0);
