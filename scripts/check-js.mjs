#!/usr/bin/env node
import { walkFiles } from './files.mjs';
/** Parse every maintained JavaScript file with the current Node grammar. */
import { existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = join(import.meta.dirname, '..');
const SCAN = ['asset/js', 'scripts', 'tests'];
const ROOT_FILES = ['gulpfile.js', 'playwright.config.mjs', 'playwright.visual.config.mjs', 'playwright.local.config.mjs'];

const files = [
    ...SCAN.flatMap((dir) => [...walkFiles(join(ROOT, dir), /\.(?:js|mjs)$/)]),
    ...ROOT_FILES.map((file) => join(ROOT, file)).filter(existsSync),
];
const failures = [];

for (const file of files) {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (result.status !== 0) {
        failures.push(`${relative(ROOT, file).split(sep).join('/')}\n${result.stderr || result.stdout}`);
    }
}

if (failures.length) {
    console.error(`JavaScript syntax: ${failures.length} file(s) failed\n\n${failures.join('\n')}`);
    process.exit(1);
}

console.log(`JavaScript syntax: clean (${files.length} files parsed).`);
