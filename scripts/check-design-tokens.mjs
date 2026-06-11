#!/usr/bin/env node
/**
 * Design-token contract lint — encodes the anti-patterns from DESIGN.md §8/§9
 * and DESIGN-ROADMAP.md §3 so they cannot quietly regress.
 *
 *   node scripts/check-design-tokens.mjs        (also: npm run lint:tokens)
 *
 * Checks every SCSS source under asset/sass (compiled CSS is exempt):
 *   1. Raw hex colours outside the token files and outside var(--x, #hex)
 *      fallback position.
 *   2. Coloured border-left/right wider than 1px (the "accent side-stripe"
 *      AI tell). CSS-triangle/chevron borders pair left+bottom etc. and are
 *      allowlisted by file.
 *   3. Gradient text (background-clip: text).
 *   4. px-valued font-size (the type scale is rem-only).
 *
 * Exit code 1 on any finding; prints file:line for each.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const SASS = join(ROOT, 'asset', 'sass');

// Files allowed to hold raw colour values, with the reason on record.
const HEX_ALLOW = [
  'abstracts/variables/_colors.scss',   // the palette itself
  'abstracts/variables/_tokens.scss',   // shadow inks
  'abstracts/mixins/_mixins.scss',      // URL-encoded SVG data URIs (%23000 masks)
  'components/blocks/timeline/_timeline.scss', // TimelineJS's permanently-light widget surface
  'base/elements/_body.scss',
  'base/_theme.scss',
  'utilities/_print.scss',              // paper is true white; ink is ink
  'generic/_normalize.scss',            // vendored
];

// border-left/right >1px that are construction, not decoration.
const STRIPE_ALLOW = [
  'components/linked-resources/_linked-resources.scss', // CSS chevron caret
  'components/navigation/_navigation.scss',             // CSS chevron caret
];

const findings = [];

function* scssFiles(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* scssFiles(p);
    else if (name.endsWith('.scss')) yield p;
  }
}

function stripComments(line) {
  return line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
}

for (const file of scssFiles(SASS)) {
  const rel = relative(ROOT, file).split(sep).join('/');
  const relSass = relative(SASS, file).split(sep).join('/');
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);

  lines.forEach((raw, i) => {
    const line = stripComments(raw);
    const loc = `${rel}:${i + 1}`;

    // 1. Raw hex outside allowlist and outside var() fallback position.
    if (!HEX_ALLOW.includes(relSass)) {
      const noFallbacks = line.replace(/var\(\s*--[\w-]+\s*,[^)]*\)/g, '');
      const noDataUri = noFallbacks.replace(/url\([^)]*\)/g, '').replace(/%23[0-9a-fA-F]{3,6}/g, '');
      const hex = noDataUri.match(/#[0-9a-fA-F]{3,8}\b/);
      if (hex) findings.push(`${loc}  raw hex outside fallback position: ${hex[0]}`);
    }

    // 2. Side-stripe accents.
    if (!STRIPE_ALLOW.includes(relSass)) {
      if (/border-(left|right)\s*:\s*([2-9]|\d{2,})px\s+\w+\s+(var\(|#|oklch|rgb)/.test(line)) {
        findings.push(`${loc}  coloured side-stripe border: ${line.trim()}`);
      }
    }

    // 3. Gradient text.
    if (/background-clip\s*:\s*text/.test(line)) {
      findings.push(`${loc}  gradient text (background-clip: text)`);
    }

    // 4. px type.
    if (/font-size\s*:\s*\d+px/.test(line)) {
      findings.push(`${loc}  px font-size (the type scale is rem-only): ${line.trim()}`);
    }
  });
}

if (findings.length) {
  console.error(`Design-token contract: ${findings.length} finding(s)\n`);
  for (const f of findings) console.error('  ' + f);
  process.exit(1);
} else {
  console.log('Design-token contract: clean.');
}
