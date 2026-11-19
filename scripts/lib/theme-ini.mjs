#!/usr/bin/env node
/**
 * config/theme.ini's [info] block, read once for every script.
 *
 *   node scripts/lib/theme-ini.mjs <key> [file]   print one [info] value
 *
 * The build (stylesheet header), the version sync, the template and theme.ini
 * lints and the release workflow all read [info]. Each used to carry its own
 * regular expression, and they disagreed: one matched `version = …` anywhere
 * in the file, so a `version` key in [config] could have answered for the
 * release. Only [info] is read here, and only its own lines.
 *
 * Exit code 1 when the key is absent, 2 on a usage error.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { REPOSITORY_ROOT } from './files.mjs';

/** The lines of `[info]`, up to the next section header (or the end). */
export function infoSection(text) {
    const lines = text.replace(/\r\n/g, '\n').split('\n');
    const start = lines.findIndex((line) => /^\s*\[info\]\s*$/.test(line));
    if (start === -1) return null;
    const rest = lines.slice(start + 1);
    const end = rest.findIndex((line) => /^\s*\[[^\]]+\]\s*$/.test(line));
    return (end === -1 ? rest : rest.slice(0, end)).join('\n');
}

/**
 * `{ values: { key: value }, helpers: [names] }` from [info]: quoted scalar
 * keys, and the `helpers[] = "Name"` registrations in order.
 */
export function parseInfo(text) {
    const section = infoSection(text) ?? '';
    const values = {};
    const helpers = [];
    for (const m of section.matchAll(/^\s*([A-Za-z_][\w.]*)\s*=\s*"([^"]*)"\s*$/gm)) {
        if (!(m[1] in values)) values[m[1]] = m[2];
    }
    for (const m of section.matchAll(/^\s*helpers\[\]\s*=\s*"([^"]+)"\s*$/gm)) helpers.push(m[1]);
    return { values, helpers };
}

/** The theme root's [info] block; `{ values: {}, helpers: [] }` without a theme.ini. */
export function readThemeInfo(root = REPOSITORY_ROOT) {
    let text;
    try {
        text = readFileSync(join(root, 'config', 'theme.ini'), 'utf8');
    } catch (error) {
        if (error.code === 'ENOENT') return { values: {}, helpers: [] };
        throw error;
    }
    return parseInfo(text);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const [key, file = join(REPOSITORY_ROOT, 'config', 'theme.ini')] = process.argv.slice(2);
    if (!key) {
        console.error('Usage: node scripts/lib/theme-ini.mjs <key> [theme.ini]');
        process.exit(2);
    }
    const value = parseInfo(readFileSync(file, 'utf8')).values[key];
    if (value === undefined) {
        console.error(`${file} declares no [info] ${key}`);
        process.exit(1);
    }
    process.stdout.write(`${value}\n`);
}
