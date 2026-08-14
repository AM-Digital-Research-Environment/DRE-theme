#!/usr/bin/env node
/**
 * Copy the shared design-token rules and the generated token table out to the
 * sibling module repositories.
 *
 *   node scripts/vendor-lint.mjs [path-to-module …]     (npm run vendor:lint)
 *
 * Defaults to ../DREVisualizations and ../DRE-Search, which is how the three
 * repos are checked out side by side.
 *
 * WHY VENDOR RATHER THAN DEPEND. The modules are separate repositories on their
 * own release cadence, installed into an Omeka site independently of the theme;
 * a build-time dependency on the theme would be a lie about how they ship. So
 * the rules are COPIED, with a header saying where they came from, and each
 * module's lint fails loudly if its copy has been edited in place.
 *
 * What this replaces: three hand-written lint scripts, two of which opened by
 * claiming they mirrored the theme's and neither of which did.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const DEFAULT_TARGETS = ['../DREVisualizations', '../DRE-Search'];

const targets = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const check = process.argv.includes('--check');
const list = (targets.length ? targets : DEFAULT_TARGETS).map((t) => resolve(ROOT, t));

const BANNER = `/**
 * VENDORED from DRE-theme — do not edit here.
 *
 * Source of truth: DRE-theme/scripts/lib/token-rules.mjs
 * Refresh with:    (in DRE-theme) npm run vendor:lint
 *
 * The design-token rules are shared across DRE-theme, DRE-Visualizations and
 * DRESearch so the three cannot drift apart again. Repo-specific paths and
 * allowlists belong in this repo's scripts/check-design-tokens.mjs, not here.
 */
`;

const artefacts = [
  {
    from: join(ROOT, 'scripts', 'lib', 'token-rules.mjs'),
    to: ['scripts', 'lib', 'token-rules.mjs'],
    banner: BANNER,
  },
  {
    from: join(ROOT, 'asset', 'css', 'dre-tokens-fallback.json'),
    to: ['scripts', 'lib', 'dre-tokens-fallback.json'],
    banner: '',
  },
];

let stale = 0;
for (const target of list) {
  if (!existsSync(target)) {
    console.warn(`  skipped (not found): ${target}`);
    continue;
  }
  for (const { from, to, banner } of artefacts) {
    const dest = join(target, ...to);
    const content = banner + readFileSync(from, 'utf8');
    const current = existsSync(dest) ? readFileSync(dest, 'utf8') : null;
    if (current === content) continue;
    if (check) {
      console.error(`  STALE: ${join(target, ...to)}`);
      stale++;
      continue;
    }
    mkdirSync(join(target, ...to.slice(0, -1)), { recursive: true });
    writeFileSync(dest, content);
    console.log(`  wrote ${join(target, ...to)}`);
  }
}

if (check && stale) {
  console.error(`\n${stale} vendored artefact(s) out of date. Run \`npm run vendor:lint\`.`);
  process.exit(1);
}
if (!check) console.log('Vendored lint rules + token table.');
