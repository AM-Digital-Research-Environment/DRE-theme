#!/usr/bin/env node
/**
 * Compiled-CSS integrity lint — the artifact checks, not the source checks.
 *
 *   node scripts/check-compiled-css.mjs      (also: npm run lint:css)
 *
 * check-design-tokens.mjs reads asset/sass and exempts the compiled CSS by
 * design. That left a blind spot the size of the whole site: a defect can be
 * absent from every SCSS source and still ship, because it is introduced by the
 * BUILD. This lint reads the built asset/css/*.css and nothing else.
 *
 * It exists because of a real regression (v2.22.0, caught pre-release):
 *
 *   Dart Sass announces a non-ASCII stylesheet with `@charset "UTF-8";` in
 *   expanded output, but with a bare U+FEFF BOM in COMPRESSED output. gulpfile's
 *   prependHeader() only recognised the @charset form, so once v2.21.0 made
 *   `compressed` actually take effect and the v2.22.0 redesign put one curly
 *   quote into `blockquote::before`, the BOM stopped being at byte 0 (where the
 *   CSS parser strips it) and landed mid-file, welded to the first selector:
 *
 *       /* …theme header… *_/
 *       ﻿:root{--space-1: .25rem; … 63 declarations … }
 *
 *   `﻿:root` matches no element. The entire spacing scale and both
 *   --container-* tokens silently evaluated to empty, so `max-width:
 *   var(--container-max)` computed to `none` and every page went full-bleed with
 *   zero gutters. One invisible character, whole layout flattened, and not one
 *   SCSS file was wrong.
 *
 * Checks:
 *   1. No U+FEFF anywhere in the compiled CSS. (At byte 0 it is merely useless —
 *      we emit an explicit @charset — and anywhere else it is catastrophic.)
 *   2. No selector containing a BOM or a C0/C1 control character.
 *   3. Every var(--token) reference without a fallback is defined somewhere in
 *      the file, or is a known runtime-injected token. Catches typo'd and
 *      orphaned tokens, whose failure mode is the same silent empty value.
 *
 * Exit code 1 on any finding.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const CSS_DIR = join(ROOT, 'asset', 'css');

// Tokens the THEME references but the RUNTIME defines, so they are legitimately
// absent from the compiled file. Keep this list short and justified.
const RUNTIME_TOKENS = new Set([
  // view/layout/layout.phtml writes both into an inline :root block, from the
  // admin "Brand colour" setting.
  '--primary-base',
  '--primary-contrast',
]);

const findings = [];

function checkFile(name, css) {
  // --- 1. BOM anywhere ------------------------------------------------------
  for (let i = 0; i < css.length; i++) {
    if (css.charCodeAt(i) === 0xfeff) {
      const line = css.slice(0, i).split('\n').length;
      const ctx = JSON.stringify(css.slice(i, i + 40));
      findings.push(
        `${name}:${line}  U+FEFF BOM at offset ${i} — Dart Sass emits one instead of ` +
        `@charset in compressed output; gulpfile prependHeader() must strip it ` +
        `before prepending the header. Context: ${ctx}`
      );
      break; // one report is enough; they all have the same cause
    }
  }

  // --- 2. Selectors with BOM / control characters ---------------------------
  // Strip comments, then look at everything preceding each `{`.
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of noComments.matchAll(/(^|[};])\s*([^{};]+)\{/g)) {
    const sel = m[2];
    if (/^\s*@/.test(sel)) continue; // at-rule preludes
    const bad = [...sel].find((ch) => {
      const c = ch.charCodeAt(0);
      return c === 0xfeff || (c < 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d) || (c >= 0x7f && c <= 0x9f);
    });
    if (bad) {
      findings.push(
        `${name}  selector contains U+${bad.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')} ` +
        `and can never match: ${JSON.stringify(sel.slice(0, 60))}`
      );
    }
  }

  // --- 3. Unresolvable var() references -------------------------------------
  const defined = new Set();
  // A definition is `--name:` at the start of a declaration (after { or ;),
  // which excludes the `--name` inside a var() reference.
  for (const m of noComments.matchAll(/[{;]\s*(--[\w-]+)\s*:/g)) defined.add(m[1]);

  const used = new Map(); // token -> true if ever referenced WITHOUT a fallback
  for (const m of noComments.matchAll(/var\(\s*(--[\w-]+)\s*([,)])/g)) {
    const [, token, next] = m;
    const hasFallback = next === ',';
    if (!used.has(token) || !hasFallback) used.set(token, hasFallback);
  }

  for (const [token, hasFallback] of used) {
    if (hasFallback) continue; // a fallback makes an undefined token survivable
    if (defined.has(token) || RUNTIME_TOKENS.has(token)) continue;
    findings.push(
      `${name}  var(${token}) has no definition and no fallback — it computes to ` +
      `an empty value and silently drops its declaration`
    );
  }
}

const files = readdirSync(CSS_DIR).filter((f) => f.endsWith('.css'));
if (!files.length) {
  console.error(`Compiled CSS: no .css files in asset/css — run \`gulp css\` first.`);
  process.exit(1);
}
for (const f of files) checkFile(f, readFileSync(join(CSS_DIR, f), 'utf8'));

if (findings.length) {
  console.error(`Compiled CSS integrity: ${findings.length} finding(s)\n`);
  for (const f of findings) console.error('  ' + f);
  process.exit(1);
} else {
  console.log(`Compiled CSS integrity: clean (${files.join(', ')}) — no BOM, no dead selectors, no unresolvable var().`);
}
