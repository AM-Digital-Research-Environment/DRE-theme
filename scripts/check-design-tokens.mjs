#!/usr/bin/env node
/**
 * Design-token contract lint — encodes the anti-patterns from DESIGN.md §8/§9
 * and DESIGN-ROADMAP.md §3 so they cannot quietly regress.
 *
 *   node scripts/check-design-tokens.mjs        (also: npm run lint:tokens)
 *
 * Syntax checks, over every SCSS source under asset/sass (compiled CSS exempt):
 *   1. Raw hex colours outside the token files and outside var(--x, #hex)
 *      fallback position.
 *   2. Coloured border-left/right wider than 1px (the "accent side-stripe"
 *      AI tell). CSS-triangle/chevron borders pair left+bottom etc. and are
 *      allowlisted by file.
 *   3. Gradient text (background-clip: text).
 *   4. px-valued font-size (the type scale is rem-only).
 *   5. Any surviving $font__h1-sm-size … $font__h6-base-size reference — the
 *      parallel Sass heading scale is deleted; --text-* is the only scale.
 *   6. Off-grid px page geometry in the layout partials — that layer reads the
 *      --container-* / --header-height / --space-* tokens now.
 *
 * PROPERTY check — the one the design system actually promises:
 *   7. Computed WCAG contrast for every ink/surface pair, per mode, parsed
 *      straight out of the OKLCH literals in _colors.scss. DESIGN.md used to
 *      *assert* AA by hand and was wrong about --muted; this measures it.
 *      Limitation, stated rather than hidden: only hand-authored oklch()
 *      literals can be evaluated. Tones derived with color-mix() from the admin
 *      --primary-base seed (links, --primary-*) are not statically knowable and
 *      are out of scope.
 *
 * Exit code 1 on any finding; prints file:line for each.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { parseOklch, contrastRatio } from './lib/contrast.mjs';

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

// Partials that own page geometry and must express it in tokens.
const LAYOUT_PARTIALS = [
  'base/layout/_layout.scss',
  'base/layout/_regions.scss',
  'abstracts/variables/_layout.scss',
];
// Hairlines, rules and outlines are legitimately sub-grid.
const PX_GEOMETRY_OK = new Set(['0px', '1px', '2px', '3px']);

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

    // 5. The deleted parallel heading scale.
    const legacyHeading = line.match(/\$font__h[1-6]-(sm|base)-size/);
    if (legacyHeading) {
      findings.push(`${loc}  ${legacyHeading[0]} — the Sass heading scale is deleted; author from --text-*`);
    }

    // 6. Off-grid px geometry in the layout layer (@media breakpoints exempt:
    //    those are viewport queries, not page geometry).
    if (LAYOUT_PARTIALS.includes(relSass) && !/@media|@include|@use/.test(line)) {
      for (const px of line.match(/-?\d+(\.\d+)?px/g) ?? []) {
        if (!PX_GEOMETRY_OK.has(px)) {
          findings.push(`${loc}  px page geometry in a layout partial (use --container-*/--space-*): ${px}`);
        }
      }
    }
  });
}

// ==========================================================================
// 7. Contrast assertion.
// ==========================================================================

const colorsSrc = readFileSync(join(SASS, 'abstracts', 'variables', '_colors.scss'), 'utf8');

/** Extract the body of `@mixin <name> { … }` / `<selector> { … }` by brace matching. */
function blockBody(src, opener) {
  const start = src.indexOf(opener);
  if (start === -1) return null;
  let i = src.indexOf('{', start);
  if (i === -1) return null;
  let depth = 0;
  const from = i + 1;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(from, i);
  }
  return null;
}

/** name → `oklch(…)` literal, for the hand-authored declarations in a block. */
function oklchTokens(body) {
  const out = new Map();
  if (!body) return out;
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*(oklch\([^)]*\))\s*;/g)) {
    out.set(m[1], m[2]);
  }
  return out;
}

const AA = 4.5;

const light = oklchTokens(blockBody(colorsSrc, '@mixin am-light-theme'));
const dark = oklchTokens(blockBody(colorsSrc, '@mixin am-dark-theme'));
const boldLight = oklchTokens(blockBody(colorsSrc, 'body[data-brand="bold"]'));
const boldDark = oklchTokens(blockBody(colorsSrc, '@mixin am-masthead-bold-dark'));

// Every ink is checked against every surface it can legitimately land on. The
// quiet tiers are held to the same 4.5:1 — the point of the audit fix.
const INKS = ['--ink-strong', '--ink', '--ink-light', '--ink-subtle', '--muted'];
const SURFACES = ['--surface', '--surface-raised', '--surface-sunken', '--background'];

function checkPairs(modeName, tokens, inks, surfaces) {
  for (const inkName of inks) {
    const ink = tokens.get(inkName);
    if (!ink) {
      findings.push(`_colors.scss  ${modeName}: ${inkName} is not a hand-authored oklch() literal — contrast cannot be asserted`);
      continue;
    }
    for (const surfName of surfaces) {
      const surf = tokens.get(surfName);
      if (!surf) continue;
      const ratio = contrastRatio(parseOklch(ink), parseOklch(surf));
      if (ratio < AA) {
        findings.push(
          `_colors.scss  ${modeName}: ${inkName} on ${surfName} is ${ratio.toFixed(2)}:1 — below AA (${AA}:1)`
        );
      }
    }
  }
}

checkPairs('light', light, INKS, SURFACES);
checkPairs('dark', dark, INKS, SURFACES);

// The footer band is its own ground in both modes.
checkPairs('light footer', light, ['--footer-text', '--footer-text-muted'], ['--footer-surface', '--footer-surface-alt']);
checkPairs('dark footer', dark, ['--footer-text', '--footer-text-muted'], ['--footer-surface', '--footer-surface-alt']);

// Brand presence C paints a masthead ground of its own; its type must clear AA
// on it, or "bold" would be the one treatment that fails the contract.
checkPairs('brand=bold light', boldLight, ['--masthead-ink', '--masthead-ink-soft'], ['--masthead-bg']);
checkPairs('brand=bold dark', boldDark, ['--masthead-ink', '--masthead-ink-soft'], ['--masthead-bg']);

if (findings.length) {
  console.error(`Design-token contract: ${findings.length} finding(s)\n`);
  for (const f of findings) console.error('  ' + f);
  process.exit(1);
} else {
  console.log('Design-token contract: clean (incl. computed WCAG contrast, both modes).');
}
