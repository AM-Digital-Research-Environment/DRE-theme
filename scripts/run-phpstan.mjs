#!/usr/bin/env node
/**
 * PHPStan on helper/ against the real Omeka S classes — the CI gate, run with
 * one command.
 *
 *   OMEKA_PATH=/abs/path/omeka-s npm run lint:phpstan
 *
 * Opt-in, and not part of `verify`: it needs an unpacked official Omeka S
 * release (OMEKA_PATH) and a PHPStan, neither of which the theme ships. CI's
 * "Omeka S release + PHP 8.5" job runs the same analysis and blocks a release
 * on it, so a helper change that skipped this locally is caught there — later.
 *
 * Which PHPStan, in order: PHPSTAN (a phpstan.phar or binary), then `phpstan`
 * on PATH. Pin the version CI uses (.github/workflows/ci.yml, `tools:`):
 *
 *   curl -fsSL https://github.com/phpstan/phpstan/releases/download/2.3.3/phpstan.phar -o phpstan.phar
 *   PHPSTAN=/abs/path/phpstan.phar OMEKA_PATH=… npm run lint:phpstan
 *
 * Download both outside the repository. Extra arguments are passed on
 * (`npm run lint:phpstan -- --error-format=github`).
 */
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = join(import.meta.dirname, '..');
const fail = (message) => {
  console.error(`lint:phpstan: ${message}`);
  process.exit(2);
};

const omeka = process.env.OMEKA_PATH ? resolve(process.env.OMEKA_PATH) : '';
if (!omeka) {
  fail('set OMEKA_PATH to an unpacked Omeka S 4.2.1 release, e.g.\n'
    + '  curl -fsSL https://github.com/omeka/omeka-s/releases/download/v4.2.1/omeka-s-4.2.1.zip -o omeka.zip && unzip -q omeka.zip\n'
    + '  OMEKA_PATH=$PWD/omeka-s npm run lint:phpstan   (outside this repository)');
}
if (!existsSync(join(omeka, 'vendor', 'autoload.php'))) {
  fail(`OMEKA_PATH=${omeka} has no vendor/autoload.php; it must be the official release zip, unpacked.`);
}

// A .phar runs through php; a binary or a Composer shim runs itself.
const phpstan = process.env.PHPSTAN ? resolve(process.env.PHPSTAN) : 'phpstan';
const [command, ...prefix] = phpstan.endsWith('.phar') ? ['php', phpstan] : [phpstan];
const args = [...prefix, 'analyse', '--no-progress', '--memory-limit=1G', ...process.argv.slice(2)];

const run = spawnSync(command, args, {
  cwd: ROOT,
  stdio: 'inherit',
  env: { ...process.env, OMEKA_PATH: omeka },
  // A Windows Composer shim is a .bat, which needs a shell; a path from PHPSTAN
  // or a .phar does not.
  shell: process.platform === 'win32' && !process.env.PHPSTAN,
});
if (run.error) {
  fail(`could not run ${phpstan} (${run.error.code ?? run.error.message}). Set PHPSTAN to a phpstan.phar, or put phpstan on PATH.`);
}
process.exit(run.status ?? 1);
