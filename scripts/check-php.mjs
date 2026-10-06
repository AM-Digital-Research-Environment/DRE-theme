#!/usr/bin/env node
/**
 * PHP verification — real `php -l` on every template and helper, then the
 * theme's PHP tests.
 *
 *   node scripts/check-php.mjs             (also: npm run lint:php)
 *   node scripts/check-php.mjs --require   fail if no PHP can be found (CI)
 *
 * WHY THIS EXISTS. A contributor's machine may have no PHP binary — or a
 * different one from production (PHP 8.5). Without one, `check-templates.mjs`
 * can only approximate a parser by counting `<?php`/`?>` pairs and brackets.
 * That catches a truncated file; it cannot catch a stray `$`, a mistyped `::`,
 * a `match` used as an identifier, or anything else a real grammar would
 * reject — and a template only fails at request time, on the production site,
 * on the one page that renders it.
 *
 * HOW IT FINDS A PHP. In order:
 *   1. `php` on PATH             — fastest, and the version the developer has
 *   2. `docker run php:<v>-cli`  — no local install; the image must already be
 *                                  pulled. One container per phase (syntax,
 *                                  then tests) loops over every file.
 *
 *   DRE_PHP_RUNNER=docker|local  forces one of the two (e.g. to check the
 *                                production PHP 8.5 while a different PHP is on
 *                                PATH: DRE_PHP_RUNNER=docker
 *                                DRE_PHP_IMAGE=php:8.5-cli npm run lint:php)
 *   DRE_PHP_IMAGE                the image for 2. (default php:8.3-cli)
 *   DRE_SKIP_PHP_LINT=1          skip entirely, unless --require is passed.
 *                                Set only by CI's CSS job, whose PHP coverage
 *                                comes from the dedicated PHP matrix jobs.
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
import { join, relative, sep } from 'node:path';
import { spawnSync } from 'node:child_process';

import { walkFiles } from './files.mjs';

const ROOT = join(import.meta.dirname, '..');
const REQUIRE_PHP = process.argv.includes('--require');
const DOCKER_IMAGE = process.env.DRE_PHP_IMAGE ?? 'php:8.3-cli';
const RUNNER = process.env.DRE_PHP_RUNNER ?? 'auto';

if (process.env.DRE_SKIP_PHP_LINT && !REQUIRE_PHP) {
  console.log('PHP verification: SKIPPED (DRE_SKIP_PHP_LINT is set; the PHP jobs run it with --require).');
  process.exit(0);
}

const SCAN_DIRS = ['view', 'helper', 'tests'];

const files = SCAN_DIRS.flatMap(d => [...walkFiles(join(ROOT, d), /\.(?:php|phtml)$/)]);

// --- Find a PHP -----------------------------------------------------------
//
// A runner turns a list of files into one result per file, in order:
//   lint(files) → { file, status, output }
//   run(files)  → { file, status, stdout, stderr }
// The local runner yields lazily, so test output streams as each suite ends.
function localPhp() {
  // No `shell: true`. PHP ships as a real binary on every platform (php.exe on
  // Windows), which spawnSync resolves from PATH directly — and running through
  // a shell would concatenate rather than escape these paths.
  const probe = spawnSync('php', ['-v'], { encoding: 'utf8' });
  if (probe.status !== 0) return null;
  const version = (probe.stdout ?? '').split('\n')[0].trim();
  return {
    label: `local php (${version})`,
    *lint(list) {
      for (const file of list) {
        const result = spawnSync('php', ['-l', file], { encoding: 'utf8' });
        yield { file, status: result.status, output: (result.stderr || '') + (result.stdout || '') };
      }
    },
    *run(list) {
      for (const file of list) {
        const result = spawnSync('php', [file], { encoding: 'utf8' });
        yield { file, status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
      }
    },
  };
}

// Printed after each file inside the container, so one container's combined
// output can be split back into per-file results with their exit codes.
const MARKER = '@@dre-check-php-status';

function dockerPhp() {
  const probe = spawnSync('docker', ['image', 'inspect', DOCKER_IMAGE], { encoding: 'utf8' });
  if (probe.status !== 0) return null; // not pulled; we do not pull implicitly
  const mount = `${ROOT}:/app`;
  const inContainer = (file) => '/app/' + relative(ROOT, file).split(sep).join('/');

  // Starting a container costs about a second, so one per file made this path
  // minutes long. One container loops over the whole list instead.
  const batch = (phpArgs, list) => {
    if (!list.length) return [];
    const script = `for f in "$@"; do php ${phpArgs} "$f" 2>&1; s=$?; printf '\\n${MARKER} %s\\n' "$s"; done`;
    const result = spawnSync(
      'docker',
      ['run', '--rm', '-v', mount, '-w', '/app', DOCKER_IMAGE, 'sh', '-c', script, 'sh', ...list.map(inContainer)],
      { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
    );
    const chunks = (result.stdout ?? '').split(new RegExp(`\\n${MARKER} (\\d+)\\n`));
    // split() with one capture group alternates output, status, output, status…
    const parsed = [];
    for (let i = 0; i + 1 < chunks.length; i += 2) {
      parsed.push({ output: chunks[i], status: Number(chunks[i + 1]) });
    }
    if (result.error || parsed.length !== list.length) {
      console.error(`PHP verification: docker ${DOCKER_IMAGE} did not report every file.`);
      console.error(result.error?.message ?? result.stderr ?? '');
      process.exit(1);
    }
    return parsed.map((entry, i) => ({ file: list[i], ...entry }));
  };

  return {
    label: `docker ${DOCKER_IMAGE}`,
    lint: (list) => batch('-l', list),
    // stdout and stderr share the container's stream; report it as stdout.
    run: (list) => batch('', list).map(({ file, status, output }) => ({ file, status, stdout: output, stderr: '' })),
  };
}

const php =
  RUNNER === 'local' ? localPhp()
  : RUNNER === 'docker' ? dockerPhp()
  : localPhp() ?? dockerPhp();

if (!php) {
  const message = [
    `PHP verification: no PHP binary available${RUNNER === 'auto' ? '' : ` (DRE_PHP_RUNNER=${RUNNER})`} — SKIPPED.`,
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
for (const { file, status, output } of php.lint(files)) {
  if (status !== 0) {
    const detail = output
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
for (const { status, stdout, stderr } of php.run(tests)) {
  process.stdout.write(stdout);
  if (status !== 0) {
    process.stderr.write(stderr);
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
