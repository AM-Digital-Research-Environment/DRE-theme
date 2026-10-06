import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

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
 * directory named by `--root=<dir>`. The override exists so the lints can be
 * pointed at a seeded fixture (tests/js/lint-negative.test.mjs) and shown to
 * FAIL, not only to pass on a clean tree.
 */
export function themeRoot(argv = process.argv) {
    const flag = argv.find((arg) => arg.startsWith('--root='));
    return flag ? resolve(flag.slice('--root='.length)) : resolve(import.meta.dirname, '..');
}
