#!/usr/bin/env node
/**
 * Generate the token fallback table — the one number per token.
 *
 *   node scripts/gen-token-fallbacks.mjs           (also: npm run build:tokens)
 *   node scripts/gen-token-fallbacks.mjs --check   (CI: assert the artefacts are current)
 *
 * WHY. DESIGN.md §9 makes the custom properties a public API between the theme
 * and its two modules, and asks that every `var(--token, literal)` fallback be
 * the brand value — so an isolated render, or a maintainer reading the code,
 * never sees a shadow brand. Those literals were written BY HAND, at 31 token
 * names, across three repositories, and drifted: --muted alone appears as four
 * different greys in DRESearch, none of them the theme's #716a66, and the
 * search client's type fallbacks encode an entire scale the theme doesn't have.
 *
 * The reason it drifted is structural. All three token lints strip
 * `var(--x, …)` before applying any rule — deliberately, "so the rules only
 * ever see the active value" — so the fallback is the one part of the design
 * system no check has ever looked at. And nothing ever paints it on the live
 * site, because the token always wins when the theme is loaded.
 *
 * So: stop writing the literals, generate them. The theme already owns the
 * OKLCH → sRGB matrices (scripts/lib/color.mjs, grown from the contrast lint's
 * own conversion code), which makes it the only repository that CAN resolve
 * `color-mix(in oklab, var(--primary-base), black 12%)` to a number.
 *
 * EMITS two artefacts, both committed, both deterministic (no timestamps, so a
 * CI freshness check is a plain diff):
 *   • asset/css/dre-tokens-fallback.css  — one :root block per mode. A module
 *     may ship this layer and then write bare var(--token).
 *   • asset/css/dre-tokens-fallback.json — the same table for the JS bridges,
 *     the Mirador config, and the lint rule that compares hand-written literals
 *     against it.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { resolveColor, formatColor, UnresolvableColor } from './lib/color.mjs';
import { blockBody, collectMixins, declarations, stripComments, substituteParams } from './lib/scss-blocks.mjs';

const ROOT = join(import.meta.dirname, '..');
const VARS = join(ROOT, 'asset', 'sass', 'abstracts', 'variables');
const OUT_CSS = join(ROOT, 'asset', 'css', 'dre-tokens-fallback.css');
const OUT_JSON = join(ROOT, 'asset', 'css', 'dre-tokens-fallback.json');

const check = process.argv.includes('--check');

// ==========================================================================
// Parse the Sass sources
// ==========================================================================

// Comments go before any structural parsing: see scripts/lib/scss-blocks.mjs.
const read = (name) => stripComments(readFileSync(join(VARS, name), 'utf8'));
const colorsSrc = read('_colors.scss');
const tokensSrc = read('_tokens.scss');
const typographySrc = read('_typography.scss');
const breakpointsSrc = read('_breakpoints.scss');

/**
 * The breakpoint ladder, published as data.
 *
 * Breakpoints are the one scale a custom property cannot express — `var()` is
 * illegal in a media query — so they live in Sass, where only the theme can read
 * them, and both modules invented their own ladder. Emitting them into the
 * generated artefact is how a module (and the shared lint) can finally see the
 * five numbers it is supposed to author against.
 */
const breakpoints = Object.fromEntries(
  [...breakpointsSrc.matchAll(/^\s*\$([\w-]+)\s*:\s*(\d+)px\s*;/gm)].map((m) => [m[1], Number(m[2])])
);

/**
 * Every TOP-LEVEL `<selector> { … }` body, merged in source order.
 *
 * Top-level matters twice over. `:root` is written more than once in both
 * files — the seed and the brand family are separate blocks — and one of them
 * sits inside `@media (min-width: $md)`, where --container-gutter widens. A
 * fallback table should carry the base value of a responsive token, not
 * whichever step happens to be declared last, so nested blocks are skipped.
 *
 * The selector must be followed by `{`, which is what keeps `:root` from
 * matching `:root:not([data-theme="light"])`.
 */
function topLevelBlocks(src, selector) {
  const bodies = [];
  let from = 0;
  for (;;) {
    const at = src.indexOf(selector, from);
    if (at === -1) break;
    from = at + selector.length;
    if (!/^\s*\{/.test(src.slice(from))) continue;
    const before = src.slice(0, at);
    const depth = (before.match(/\{/g) ?? []).length - (before.match(/\}/g) ?? []).length;
    if (depth !== 0) continue;
    const body = blockBody(src, selector, at);
    if (body) bodies.push(body);
  }
  return bodies;
}

/** Merge maps left-to-right; later declarations win, as the cascade would. */
const merge = (...maps) => new Map(maps.flatMap((m) => [...m]));

// One registry across all three partials — _tokens.scss's mixins can be
// included from _colors.scss and vice versa.
const MIXINS = merge(collectMixins(colorsSrc), collectMixins(tokensSrc), collectMixins(typographySrc));

const mixinDecls = (name, args = []) => {
  const mixin = MIXINS.get(name);
  if (!mixin) throw new Error(`_colors.scss/_tokens.scss: @mixin ${name} not found`);
  return declarations(substituteParams(mixin.body, mixin.params, args), MIXINS, new Set([name]));
};

// The theme mixins, with their own @includes expanded in source order.
const lightColors = mixinDecls('am-light-theme');
const darkColors = mixinDecls('am-dark-theme');
const lightTokens = mixinDecls('am-light-tokens');
const darkTokens = mixinDecls('am-dark-tokens');

// Bare selector blocks: the --primary-base seed, the fixed brand-book family,
// the entity-type family, the type scale and the token layer. `@include`s inside
// them (am-entity-colors-light, am-light-tokens, …) expand too, so a family
// added as a mixin is picked up without touching this script.
const blocks = (src, selector) =>
  merge(...topLevelBlocks(src, selector).map((b) => declarations(b, MIXINS)));

const rootColors = blocks(colorsSrc, ':root');
const rootTokens = blocks(tokensSrc, ':root');
const rootType = blocks(typographySrc, ':root');

// The dark-mode selector blocks, which is where a family declares its dark
// half — `body[data-theme="dark"] { @include am-entity-colors-dark; }`.
const darkSelectors = blocks(colorsSrc, 'body[data-theme="dark"]');

const MODE_MAPS = {
  light: merge(rootColors, rootTokens, rootType, lightColors, lightTokens),
  dark: merge(rootColors, rootTokens, rootType, darkSelectors, darkColors, darkTokens),
};

// ==========================================================================
// Resolve
// ==========================================================================

/**
 * Resolve a token to its concrete value.
 *
 * Colour expressions become sRGB. Everything else — the type scale, spacing,
 * shadows, motion — has its var() chain expanded in place, so `--shadow-sm`
 * comes out as a real box-shadow with real colours in it and `--space-xs`
 * resolves through its numeric-step alias.
 */
function resolveToken(name, map, seen = new Set()) {
  const raw = map.get(name);
  if (raw == null) return null;
  if (seen.has(name)) return null;
  const next = new Set([...seen, name]);

  try {
    return formatColor(resolveColor(raw, (n) => map.get(n) ?? null));
  } catch (err) {
    if (!(err instanceof UnresolvableColor)) throw err;
  }

  // Not a single colour — a shadow list, a transition, a measure. Expand the
  // var() references it contains, then resolve any color-mix() left embedded in
  // it, so `--shadow-lg` comes out as a real box-shadow with real colours.
  return resolveEmbeddedMixes(expandVars(raw, map, next), map);
}

/** Replace every balanced `color-mix(…)` inside a composite value. */
function resolveEmbeddedMixes(value, map) {
  let out = '';
  let i = 0;
  for (;;) {
    const at = value.toLowerCase().indexOf('color-mix(', i);
    if (at === -1) return out + value.slice(i);
    out += value.slice(i, at);
    let depth = 0;
    let j = at + 'color-mix'.length;
    for (; j < value.length; j++) {
      if (value[j] === '(') depth++;
      else if (value[j] === ')' && --depth === 0) break;
    }
    const expr = value.slice(at, j + 1);
    try {
      out += formatColor(resolveColor(expr, (n) => map.get(n) ?? null));
    } catch (err) {
      if (!(err instanceof UnresolvableColor)) throw err;
      out += expr;
    }
    i = j + 1;
  }
}

function expandVars(value, map, seen) {
  return value.replace(/var\(\s*(--[\w-]+)\s*(?:,([^()]*(?:\([^()]*\)[^()]*)*))?\)/g,
    (whole, name, fallback) => {
      const resolved = resolveToken(name, map, seen);
      if (resolved != null) return resolved;
      return fallback != null ? fallback.trim() : whole;
    });
}

/** Tokens worth publishing, in a stable, readable order. */
function tableFor(mode) {
  const map = MODE_MAPS[mode];
  const table = {};
  for (const name of map.keys()) {
    const value = resolveToken(name, map);
    if (value != null) table[name] = value;
  }
  return table;
}

const light = tableFor('light');
const dark = tableFor('dark');

// Tokens whose value is identical in both modes are mode-independent: the type
// scale, spacing, radii, z-index, the fixed brand pigments. Publishing them
// once, outside the mode blocks, is both smaller and truer — it says which
// decisions the theme toggle does not touch.
const shared = {};
for (const [name, value] of Object.entries(light)) {
  if (dark[name] === value) shared[name] = value;
}
const lightOnly = Object.fromEntries(Object.entries(light).filter(([k]) => !(k in shared)));
const darkOnly = Object.fromEntries(Object.entries(dark).filter(([k]) => !(k in shared)));

// ==========================================================================
// Emit
// ==========================================================================

const HEADER = `/* GENERATED by scripts/gen-token-fallbacks.mjs — do not edit.
 *
 * The theme's tokens resolved to concrete sRGB and rem, one value per token.
 * Regenerate with \`npm run build:tokens\`; CI asserts this file matches its
 * source (\`npm run lint:tokens\`).
 *
 * WHAT THIS IS FOR. DESIGN.md §9 makes these custom properties a public API
 * between DRE-theme and its modules, and asks that any \`var(--token, literal)\`
 * fallback carry the brand value rather than a hand-picked approximation. This
 * file is that list, generated from asset/sass/abstracts/variables/*.scss so
 * there is one number per token instead of one per call site.
 *
 * A module has two ways to use it, and both are correct:
 *   1. Ship this stylesheet ahead of the module's own and write bare
 *      \`var(--token)\` — no literals to keep in sync at all.
 *   2. Keep the inline \`var(--token, literal)\` form and let the shared lint
 *      compare each literal against dre-tokens-fallback.json.
 *
 * Colours are resolved through color-mix(in oklab, …) from the --primary-base
 * seed as authored. An admin who overrides the brand colour in theme settings
 * re-tints the live site but NOT this file — which is the point: these are
 * fallbacks for when the theme is absent, not a second source of truth.
 */`;

function cssBlock(selector, table, indent = '  ') {
  const width = Math.max(...Object.keys(table).map((k) => k.length));
  const body = Object.entries(table)
    .map(([k, v]) => `${indent}${(k + ':').padEnd(width + 1)} ${v};`)
    .join('\n');
  return `${selector} {\n${body}\n}`;
}

const css = [
  HEADER,
  '',
  '/* Mode-independent: the decisions the theme toggle does not touch. */',
  cssBlock(':root', shared),
  '',
  '/* Light — the default. */',
  cssBlock(':root', lightOnly),
  '',
  '/* Dark, by system preference unless the visitor explicitly chose light. */',
  '@media (prefers-color-scheme: dark) {',
  cssBlock('  :root:not([data-theme="light"])', darkOnly, '    '),
  '}',
  '',
  '/* Dark, by the theme toggle. Mirrors _colors.scss: the manual choice is',
  '   written to [data-theme] on both <html> and <body>, and must beat a system',
  '   preference already applied to :root. */',
  cssBlock('[data-theme="dark"]', darkOnly),
  '',
  cssBlock('[data-theme="light"]', lightOnly),
  '',
].join('\n');

const json = JSON.stringify(
  {
    $comment:
      'GENERATED by scripts/gen-token-fallbacks.mjs — do not edit. The DRE theme tokens ' +
      'resolved to concrete values, for JS colour bridges, the Mirador config, and the ' +
      'shared design-token lint. See asset/css/dre-tokens-fallback.css for the CSS form.',
    source: 'asset/sass/abstracts/variables/*.scss',
    breakpoints,
    shared,
    light: lightOnly,
    dark: darkOnly,
  },
  null,
  2
) + '\n';

const artefacts = [
  [OUT_CSS, css],
  [OUT_JSON, json],
];

if (check) {
  const stale = [];
  for (const [path, expected] of artefacts) {
    let actual = null;
    try {
      actual = readFileSync(path, 'utf8');
    } catch {
      /* missing counts as stale */
    }
    if (actual !== expected) stale.push(relative(ROOT, path).split(sep).join('/'));
  }
  if (stale.length) {
    console.error(
      `Token fallback table is stale:\n${stale.map((f) => '  ' + f).join('\n')}\n\n` +
        'Run `npm run build:tokens` and commit the result.'
    );
    process.exit(1);
  }
  console.log('Token fallback table: current.');
} else {
  for (const [path, content] of artefacts) writeFileSync(path, content);
  const count = Object.keys(shared).length + Object.keys(lightOnly).length;
  console.log(
    `Token fallback table: ${count} tokens ` +
      `(${Object.keys(shared).length} mode-independent, ${Object.keys(lightOnly).length} per mode) ` +
      '→ asset/css/dre-tokens-fallback.{css,json}'
  );
}
