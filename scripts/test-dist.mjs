#!/usr/bin/env node
/**
 * The second pass of `npm run test:unit`: the suites that load theme scripts,
 * run again against the minified files the templates serve.
 *
 *   node scripts/test-dist.mjs
 *
 * A suite takes part when it imports tests/support/theme-script.mjs, whose
 * themeScript() answers asset/js/dist/<name>.min.js under DRE_SCRIPTS=dist
 * (tests/dist.env). Every other suite (the lints, the build, the manifests)
 * reads nothing that minification changes, so running it twice only doubled
 * the time. The list is discovered, not written down, so a new script suite
 * is covered by importing the helper it needs anyway.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { REPOSITORY_ROOT as ROOT } from './lib/files.mjs';

const TESTS = join(ROOT, 'tests', 'js');
const IMPORTS_HELPER = /from\s+['"][^'"]*\/support\/theme-script\.mjs['"]/;

/** Test files under `dir` that import the theme-script helper, sorted. */
function scriptSuites(dir = TESTS) {
    return readdirSync(dir)
        .filter((name) => name.endsWith('.test.mjs'))
        .sort()
        .map((name) => join(dir, name))
        .filter((file) => IMPORTS_HELPER.test(readFileSync(file, 'utf8')));
}

const suites = scriptSuites();
if (!suites.length) {
    // The helper is how a suite reaches the minified build at all; no importer
    // means this pass would silently test nothing.
    console.error('test-dist: no suite in tests/js imports tests/support/theme-script.mjs; nothing tests the minified scripts.');
    process.exit(1);
}
console.log(`Minified scripts: ${suites.length} suite(s): ${suites.map((file) => relative(TESTS, file)).join(', ')}`);
const run = spawnSync(process.execPath, ['--env-file=tests/dist.env', '--test', ...suites], { cwd: ROOT, stdio: 'inherit' });
process.exit(run.status ?? 1);
