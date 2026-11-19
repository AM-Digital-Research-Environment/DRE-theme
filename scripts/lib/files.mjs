import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** This repository: the default theme root of every script. */
export const REPOSITORY_ROOT = resolve(import.meta.dirname, '..', '..');

/** Deterministic source discovery; never follows symlinks outside the tree. */
export function* walkFiles(dir, pattern) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, {withFileTypes:true}).sort((a,b) => a.name.localeCompare(b.name))) {
        const file = join(dir, entry.name);
        if (entry.isDirectory()) yield* walkFiles(file, pattern);
        else if (entry.isFile() && pattern.test(entry.name)) yield file;
    }
}

/**
 * The theme root a lint script checks: the repository by default, or the
 * directory named by `--root=<dir>` / `--root <dir>`, or by `env` (a variable
 * name) when neither flag is given. The override exists so the lints can be
 * pointed at a seeded fixture (tests/js/lint-negative.test.mjs) and shown to
 * FAIL, not only to pass on a clean tree.
 */
export function themeRoot(argv = process.argv, {env} = {}) {
    const at = argv.findIndex((arg) => arg === '--root' || arg.startsWith('--root='));
    if (at !== -1) {
        const value = argv[at] === '--root' ? argv[at + 1] : argv[at].slice('--root='.length);
        if (!value) throw new Error('--root needs a directory');
        return resolve(value);
    }
    if (env && process.env[env]) return resolve(process.env[env]);
    return REPOSITORY_ROOT;
}

/**
 * The Sass entry points (not partials) under asset/sass, sorted: each compiles
 * to asset/css/<name>.css. The build, the version sync and the stale-output
 * gate all ask this one question, so they cannot disagree on the answer.
 */
export function sassEntryPoints(root = REPOSITORY_ROOT) {
    return readdirSync(join(root, 'asset', 'sass'), { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.scss') && !entry.name.startsWith('_'))
        .map((entry) => entry.name)
        .sort();
}

/** `style.scss` → `asset/css/style.css`, relative to the theme root. */
export const compiledCssPath = (entry) => `asset/css/${entry.replace(/\.scss$/, '.css')}`;
