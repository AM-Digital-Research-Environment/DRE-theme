#!/usr/bin/env node
/**
 * PHP verification — real `php -l` on every template and helper, then the
 * theme's PHP tests.
 *
 *   node scripts/check-php.mjs             (also: npm run lint:php)
 *   node scripts/check-php.mjs --require   fail if no PHP can be found (CI)
 *
 * WHY THIS EXISTS. The theme is developed on a machine with no PHP binary, so
 * `check-templates.mjs` approximates a parser by counting `<?php`/`?>` pairs and
 * brackets. That catches a truncated file; it cannot catch a stray `$`, a
 * mistyped `::`, a `match` used as an identifier, or anything else a real
 * grammar would reject — and a template only fails at request time, on the
 * production site, on the one page that renders it.
 *
 * HOW IT FINDS A PHP. In order:
 *   1. `php` on PATH             — fastest, and the version the developer has
 *   2. `docker run php:<v>-cli`  — no local install; needs a working registry
 *
 * WHEN IT FINDS NEITHER it prints how to get one and exits 0, so a contributor
 * without PHP is not blocked — but CI passes `--require`, so the check is a hard
 * gate exactly where it can always run. That asymmetry is deliberate and stated;
 * it is NOT the accidental version this repo already had, where `lint:ini`
 * shelled out to `grep`, silently got nothing on Windows, and reported every
 * admin field as dead.
 *
 * WHAT IT DOES NOT CATCH. Syntax is not correctness. A file can parse perfectly
 * and still put the Author under "Further details" — see
 * scripts/check-resource-groups.mjs and tests/ResourceGroupsTest.php for the
 * behavioural half.
 */
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = join(import.meta.dirname, '..');
const REQUIRE_PHP = process.argv.includes('--require');
const DOCKER_IMAGE = process.env.DRE_PHP_IMAGE ?? 'php:8.3-cli';

const SCAN_DIRS = ['view', 'helper', 'tests'];

function* phpFiles(dir) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* phpFiles(p);
    else if (name.endsWith('.php') || name.endsWith('.phtml')) yield p;
  }
}

const files = SCAN_DIRS.flatMap((d) => [...phpFiles(join(ROOT, d))]);

// --- Find a PHP -----------------------------------------------------------
function localPhp() {
  // No `shell: true`. PHP ships as a real binary on every platform (php.exe on
  // Windows), which spawnSync resolves from PATH directly — and running through
  // a shell would concatenate rather than escape these paths.
  const probe = spawnSync('php', ['-v'], { encoding: 'utf8' });
  if (probe.status !== 0) return null;
  const version = (probe.stdout ?? '').split('\n')[0].trim();
  return {
    label: `local php (${version})`,
    lint: (file) => spawnSync('php', ['-l', file], { encoding: 'utf8' }),
    run: (file) => spawnSync('php', [file], { encoding: 'utf8' }),
  };
}

function dockerPhp() {
  const probe = spawnSync('docker', ['image', 'inspect', DOCKER_IMAGE], { encoding: 'utf8' });
  if (probe.status !== 0) return null; // not pulled; we do not pull implicitly
  const mount = `${ROOT}:/app`;
  const inContainer = (file) => '/app/' + relative(ROOT, file).split(sep).join('/');
  return {
    label: `docker ${DOCKER_IMAGE}`,
    lint: (file) =>
      spawnSync('docker', ['run', '--rm', '-v', mount, '-w', '/app', DOCKER_IMAGE, 'php', '-l', inContainer(file)], { encoding: 'utf8' }),
    run: (file) =>
      spawnSync('docker', ['run', '--rm', '-v', mount, '-w', '/app', DOCKER_IMAGE, 'php', inContainer(file)], { encoding: 'utf8' }),
  };
}

const php = localPhp() ?? dockerPhp();

if (!php) {
  const message = [
    'PHP verification: no PHP binary available — SKIPPED.',
    '',
    '  Get one, cheapest first:',
    '    winget install PHP.PHP.8.3            # Windows, ~30s, then reopen the shell',
    '    brew install php                      # macOS',
    '    sudo apt install php-cli              # Debian/Ubuntu',
    `    docker pull ${DOCKER_IMAGE}                # no local install`,
    '',
    '  CI runs this with --require, so a syntax error still cannot reach a release.',
  ].join('\n');

  if (REQUIRE_PHP) {
    console.error(message.replace('SKIPPED.', 'REQUIRED but not found.'));
    process.exit(1);
  }
  console.log(message);
  process.exit(0);
}

console.log(`PHP verification: using ${php.label} on ${files.length} file(s).`);

// --- 1. Syntax ------------------------------------------------------------
const syntaxErrors = [];
for (const file of files) {
  const result = php.lint(file);
  if (result.status !== 0) {
    const detail = ((result.stderr || '') + (result.stdout || ''))
      .split('\n')
      .filter((l) => l.trim() && !/^No syntax errors/.test(l))
      .join('\n      ');
    syntaxErrors.push(`${relative(ROOT, file).split(sep).join('/')}\n      ${detail}`);
  }
}

if (syntaxErrors.length) {
  console.error(`\nPHP syntax: ${syntaxErrors.length} file(s) failed to parse\n`);
  for (const e of syntaxErrors) console.error('  ' + e);
  process.exit(1);
}
console.log(`PHP syntax: clean (${files.length} files parsed).`);

// --- 2. Behaviour ---------------------------------------------------------
// OmekaCompatibilityTest needs an unpacked official Omeka release and is run
// by its dedicated CI job. The dependency-free suites run everywhere else.
const tests = files.filter((f) => /Test\.php$/.test(f) && !f.endsWith('OmekaCompatibilityTest.php'));
let failed = 0;
for (const test of tests) {
  const result = php.run(test);
  process.stdout.write(result.stdout ?? '');
  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? '');
    failed++;
  }
}

if (failed) {
  console.error(`\nPHP tests: ${failed} of ${tests.length} failed.`);
  process.exit(1);
}
if (tests.length) {
  console.log(`PHP tests: ${tests.length} suite(s) passed.`);
}
