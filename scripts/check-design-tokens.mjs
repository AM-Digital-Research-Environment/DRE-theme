#!/usr/bin/env node
/**
 * Design-token contract lint — encodes the anti-patterns from DESIGN.md §8/§9
 * so they cannot quietly regress.
 *
 *   node scripts/check-design-tokens.mjs        (also: npm run lint:tokens)
 *   node scripts/check-design-tokens.mjs --root <dir>
 *       Lint another tree laid out like this repository (asset/sass,
 *       asset/css/dre-tokens-fallback.json, scripts/design-token-allowlist.txt).
 *       Used by tests/js/tokens-negative.test.mjs to prove a seeded violation
 *       fails; DRE_TOKENS_ROOT=<dir> does the same.
 *
 * The RULES live in scripts/lib/token-rules.mjs and are shared verbatim with
 * DRE-Visualizations and DRESearch (`npm run vendor:lint` copies them out).
 * Before that, all three repos had their own script, each claiming to mirror
 * this one and none of them doing so — the dashboards enforced off-scale spacing
 * and radius that the theme did not, this file measured contrast that no module
 * did, and the search client had no rem check at all. This file is now just the
 * theme's CONFIG plus the one check only the theme can perform.
 *
 * The contrast assertion stays here because it needs the OKLCH source: it parses
 * the literals out of _colors.scss and computes the ratios, so DESIGN.md's
 * accessibility claim is measured on every build rather than restated by hand.
 * (The previous 60% L --muted was 3.9:1 in light — i.e. the claim was untrue.)
 *
 * Exit code 1 on any finding; prints file:line for each.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseOklch, contrastRatio, contrastRatioResolved } from './lib/contrast.mjs';
import { runRules, report, parseAllowlist, formatAllowlist } from './lib/token-rules.mjs';

/** `--root <dir>` / `--root=<dir>` / DRE_TOKENS_ROOT, else this repository. */
function rootArg(argv) {
  const at = argv.findIndex((a) => a === '--root' || a.startsWith('--root='));
  if (at !== -1) {
    const value = argv[at].includes('=') ? argv[at].slice('--root='.length) : argv[at + 1];
    if (!value) {
      console.error('check-design-tokens: --root needs a directory');
      process.exit(2);
    }
    return resolve(value);
  }
  return process.env.DRE_TOKENS_ROOT ? resolve(process.env.DRE_TOKENS_ROOT) : null;
}

const ROOT = rootArg(process.argv.slice(2)) ?? join(import.meta.dirname, '..');
const SASS = join(ROOT, 'asset', 'sass');
const ALLOWLIST = join(ROOT, 'scripts', 'design-token-allowlist.txt');
const table = JSON.parse(readFileSync(join(ROOT, 'asset', 'css', 'dre-tokens-fallback.json'), 'utf8'));
const updateAllowlist = process.argv.includes('--update-allowlist');

// Rules the theme is exempt from BY DESIGN — as opposed to the ratchet below,
// which is work not yet done.
const BASE_RULES = {
    // The theme AUTHORS the tokens, so its own token partials are the one place
    // raw colour and raw scale values belong.
    hex: {
      allow: [
        'asset/sass/abstracts/variables/_colors.scss', // the palette itself
        'asset/sass/abstracts/variables/_tokens.scss', // shadow inks
        'asset/sass/abstracts/mixins/_mixins.scss', // URL-encoded SVG data URIs (%23000 masks)
        'asset/sass/components/blocks/timeline/_timeline.scss', // TimelineJS's permanently-light widget
        'asset/sass/base/elements/_body.scss',
        'asset/sass/base/_theme.scss',
        'asset/sass/utilities/_print.scss', // paper is true white; ink is ink
        'asset/sass/generic/_normalize.scss', // vendored
      ],
    },
    stripe: {
      allow: [
        'asset/sass/components/linked-resources/_linked-resources.scss', // CSS chevron caret
        'asset/sass/components/navigation/_navigation.scss', // CSS chevron caret
      ],
    },
    // The scale definitions themselves, plus the vendored reset.
    fontSize: { allow: ['asset/sass/abstracts/variables/', 'asset/sass/generic/_normalize.scss'] },
    spacing: { allow: ['asset/sass/abstracts/variables/', 'asset/sass/generic/_normalize.scss'] },
    radius: { allow: ['asset/sass/abstracts/variables/'] },
    leading: { allow: ['asset/sass/abstracts/variables/', 'asset/sass/generic/_normalize.scss'] },
    zindex: { allow: ['asset/sass/abstracts/variables/_tokens.scss'] },
    media: { allow: ['asset/sass/abstracts/variables/_breakpoints.scss'] },
  // The theme's own fallbacks are the generated table's source, so checking
  // them against it would be circular.
  fallback: false,
};

const SCAN = { root: ROOT, dirs: ['asset/sass'], extensions: ['.scss'], table };

// ==========================================================================
// The ratchet — scripts/design-token-allowlist.txt
//
// The px-geometry rule used to name three files, one of which —
// abstracts/variables/_layout.scss — had been DELETED when its contents became
// tokens. So it guarded two files, while the component layer held 95 px
// geometry declarations on an inherited 5px sub-grid living alongside the 4pt
// scale, concentrated in exactly the components a researcher touches.
//
// Every rule now runs over the WHOLE tree, and what has not been converted yet
// is written down, per rule per file, in the allowlist. The list is the backlog:
// shrinking it is the unit of work, and nothing new can be added to the tree
// without either being on-scale or being recorded.
//
//   node scripts/check-design-tokens.mjs --update-allowlist
//
// regenerates it from the current state — use after a conversion pass, and read
// the diff: lines should only ever disappear.
// ==========================================================================
if (updateAllowlist) {
  const all = runRules({ ...SCAN, rules: BASE_RULES });
  writeFileSync(
    ALLOWLIST,
    formatAllowlist(
      all,
      `# GENERATED baseline for scripts/check-design-tokens.mjs — the RATCHET.\n` +
        `#\n` +
        `# Each line exempts one rule in one file. This is a backlog, not a set of\n` +
        `# exemptions: every line is a conversion someone still owes. Lines should\n` +
        `# only ever be REMOVED. Regenerate with --update-allowlist after a pass,\n` +
        `# and check the diff — a new line means new drift got in.\n` +
        `#\n` +
        `# Rules exempt by design (the theme authors the scales) live in the script.`
    )
  );
  console.log(`Wrote ${all.length} allowlist entr(ies) to scripts/design-token-allowlist.txt`);
  process.exit(0);
}

const findings = runRules({
  ...SCAN,
  rules: parseAllowlist(readFileSync(ALLOWLIST, 'utf8'), BASE_RULES),
});

// ==========================================================================
// Contrast assertion — the one check only the theme can make.
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
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*(oklch\([^)]*\))\s*;/g)) out.set(m[1], m[2]);
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
      findings.push(
        `_colors.scss  ${modeName}: ${inkName} is not a hand-authored oklch() literal — contrast cannot be asserted`
      );
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

// Brand presence C paints TWO masthead grounds of its own — the band and the
// sunken catalogue column — and since 2.24 it is the default, so this is the
// masthead nearly every visitor sees. Its type must clear AA on both, or the
// default treatment would be the one that fails the contract. --numeral is in
// the ink list because the catalogue's figures are its content, not decoration;
// --masthead-rule is deliberately absent (a 3px rule is non-text, WCAG 1.4.11).
const BOLD_INKS = ['--masthead-ink', '--masthead-ink-soft', '--numeral'];
const BOLD_GROUNDS = ['--masthead-bg', '--masthead-sunken'];
checkPairs('brand=bold light', boldLight, BOLD_INKS, BOLD_GROUNDS);
checkPairs('brand=bold dark', boldDark, BOLD_INKS, BOLD_GROUNDS);

// ==========================================================================
// Non-text contrast (WCAG 1.4.11) — 3:1 for what identifies a control or its
// state. The text pairs above never covered it, which is how the field border
// shipped at --border-strong: 1.9:1 light, 2.3:1 dark.
//
//   --field-border   the outline of every text field, select and textarea,
//                    on every surface a form can sit on.
//   --focus-color    the keyboard focus outline (and the focused field's
//                    border), against the page and card grounds. --focus-ring
//                    is the translucent halo AROUND that indicator, not the
//                    indicator itself, so it is not held to 3:1.
//
// --focus-color is derived (var(--primary) → color-mix from --primary-base),
// so it is resolved through the colour engine rather than read as a literal.
// The seed is the default; an admin override is a deployment's own claim.
// ==========================================================================
const NON_TEXT = 3;

/** Every `--name: value;` declared at the top level of a block. */
function allTokens(body) {
  const out = new Map();
  if (!body) return out;
  let depth = 0;
  for (const line of body.split(/\r?\n/)) {
    const bare = line.replace(/(^|[^:])\/\/.*$/, '$1');
    if (depth === 0) {
      const m = /^\s*(--[\w-]+)\s*:\s*(.+?);\s*$/.exec(bare);
      if (m) out.set(m[1], m[2].trim());
    }
    depth += (bare.match(/\{/g) ?? []).length - (bare.match(/\}/g) ?? []).length;
  }
  return out;
}

const seed = /--primary-base\s*:\s*([^;]+);/.exec(colorsSrc)?.[1].trim();
const modeTokens = {
  light: allTokens(blockBody(colorsSrc, '@mixin am-light-theme')),
  dark: allTokens(blockBody(colorsSrc, '@mixin am-dark-theme')),
};

function checkNonText(modeName, tokens, name, grounds) {
  if (!tokens.get(name)) {
    findings.push(`_colors.scss  ${modeName}: ${name} is not declared — non-text contrast cannot be asserted`);
    return;
  }
  const lookup = (n) => (n === '--primary-base' ? seed : tokens.get(n)) ?? null;
  for (const ground of grounds) {
    if (!tokens.get(ground)) continue;
    let ratio;
    try {
      ratio = contrastRatioResolved(`var(${name})`, `var(${ground})`, lookup);
    } catch (err) {
      findings.push(`_colors.scss  ${modeName}: ${name} on ${ground} cannot be resolved (${err.message})`);
      continue;
    }
    if (ratio < NON_TEXT) {
      findings.push(
        `_colors.scss  ${modeName}: ${name} on ${ground} is ${ratio.toFixed(2)}:1 — ` +
          `below WCAG 1.4.11 non-text contrast (${NON_TEXT}:1)`
      );
    }
  }
}

for (const [modeName, tokens] of Object.entries(modeTokens)) {
  checkNonText(modeName, tokens, '--field-border', SURFACES);
  checkNonText(modeName, tokens, '--focus-color', ['--background', '--surface', '--surface-raised']);
}

report('Design-token contract (incl. computed WCAG text and non-text contrast, both modes)', findings);
