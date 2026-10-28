#!/usr/bin/env node
/**
 * `npm audit --audit-level=high`, with its exceptions written down.
 *
 *   node scripts/check-audit.mjs        (npm run audit:deps; part of npm run verify)
 *
 * A bare `npm audit` gate has no answer to an advisory nothing can fix: it
 * holds every push red until someone weakens the gate, and a weakened gate
 * hides the next real advisory. So this fails on any high or critical advisory
 * not listed in scripts/lib/audit-exceptions.mjs, and on any listed one that
 * has stopped needing its exception: npm can now fix it in range, or it no
 * longer appears. Ported from IWAC-theme's scripts/check-audit.js.
 */
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import exceptions from './lib/audit-exceptions.mjs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const BLOCKING = new Set(['high', 'critical']);

/**
 * Run `npm audit --json` with this process's own npm when there is one (an
 * `npm run` parent sets npm_execpath) and return the parsed report. npm exits
 * non-zero whenever it finds anything, so the exit status says nothing here; a
 * report that does not parse, or carries an error, does.
 */
function audit() {
    const execpath = process.env.npm_execpath;
    const options = { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 };
    // Outside `npm run`, a whole command line through the shell finds npm on
    // every platform (npm.cmd on Windows).
    const result = execpath && execpath.endsWith('.js')
        ? spawnSync(process.execPath, [execpath, 'audit', '--json'], options)
        : spawnSync('npm audit --json', { ...options, shell: true });
    let report;
    try {
        report = JSON.parse(result.stdout);
    } catch {
        console.error(`✗ npm audit produced no report:\n${result.stderr || result.stdout}`);
        process.exit(1);
    }
    if (report.error) {
        console.error(`✗ npm audit failed: ${report.error.summary || JSON.stringify(report.error)}`);
        process.exit(1);
    }
    return report;
}

const vulnerabilities = audit().vulnerabilities || {};

// A vulnerability's `via` lists advisories (objects) and the vulnerable
// dependencies it inherits them through (strings). Only the objects are
// advisories; the strings are the same advisory seen from a dependent.
const advisories = new Map();
for (const vulnerability of Object.values(vulnerabilities)) {
    for (const via of vulnerability.via) {
        if (typeof via !== 'object') continue;
        const id = String(via.url || via.source).split('/').pop();
        advisories.set(id, { id, package: via.name, severity: via.severity, title: via.title, range: via.range });
    }
}

const problems = [];
const excepted = [];

for (const advisory of advisories.values()) {
    if (!BLOCKING.has(advisory.severity)) continue;
    if (!exceptions[advisory.id]) {
        problems.push(`${advisory.severity}: ${advisory.package} ${advisory.range} — ${advisory.title} (${advisory.id})`);
        continue;
    }
    // `true` means a fix inside the declared ranges; an object names a
    // semver-major move, which is no fix at all and keeps the exception.
    if (vulnerabilities[advisory.package]?.fixAvailable === true) {
        problems.push(`${advisory.id} (${advisory.package}) is excepted but npm can now fix it in range — run \`npm audit fix\` and delete the exception`);
        continue;
    }
    excepted.push(advisory);
}

for (const [id, exception] of Object.entries(exceptions)) {
    if (!advisories.has(id)) {
        problems.push(`${id} (${exception.package}) is excepted but no longer reported — delete the exception`);
    }
}

if (problems.length) {
    console.error('✗ npm audit:\n');
    for (const problem of problems) console.error(`  - ${problem}`);
    console.error('\n  Exceptions live in scripts/lib/audit-exceptions.mjs, each with the reason it cannot be fixed.');
    process.exit(1);
}

const listed = excepted.map((advisory) => `${advisory.package} ${advisory.id}`).join(', ');
console.log(`✓ npm audit: no high or critical advisory outside the documented exceptions${listed ? ` (${listed})` : ''}`);
