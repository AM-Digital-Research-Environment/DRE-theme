/**
 * The little Sass parsing the token scripts need: comment stripping and brace
 * matching over the token partials (asset/sass/abstracts/variables/).
 *
 * gen-token-fallbacks.mjs and check-design-tokens.mjs both read
 * `_colors.scss` by block. They each had their own copy, and only one of them
 * removed comments first, so the contrast lint could match a selector named in
 * prose rather than the real block. One parser, used by both: the same goes for
 * reading a block's declarations, `@include`d mixins expanded in place.
 */

/**
 * Sass `//` comments, removed before any structural parsing.
 *
 * These files document themselves heavily and mention their own selectors in
 * prose — `_colors.scss` says ":root" in a comment 200 lines above the real
 * `:root` block — so a matcher that scans raw source finds the wrong brace.
 * `://` is spared so a URL in a comment cannot truncate the line early.
 */
export const stripComments = (src) => src.replace(/(^|[^:])\/\/.*$/gm, '$1');

/**
 * Body of `<opener> { … }` by brace matching, from the first match at or after
 * `fromIndex`; null when the opener or its block is missing. Pass source that
 * has been through stripComments().
 */
export function blockBody(src, opener, fromIndex = 0) {
  const start = src.indexOf(opener, fromIndex);
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

/**
 * `--name: value;` pairs declared directly in a block, in source order.
 *
 * Nested at-rules and selectors are skipped: only the block's own declarations
 * are the mode's, and a @media inside it belongs to a different cascade.
 */
export function declarations(body, mixins = new Map(), seen = new Set()) {
  const out = new Map();
  if (!body) return out;
  let depth = 0;
  for (const line of body.split(/\r?\n/)) {
    const bare = line.replace(/\/\/.*$/, '');
    if (depth === 0) {
      const decl = /^\s*(--[\w-]+)\s*:\s*(.+?);\s*$/.exec(bare);
      if (decl) out.set(decl[1], decl[2].trim());

      // `@include am-masthead-balanced;` / `@include am-panel-tokens(var(--surface));`
      // Expanded IN PLACE, so a declaration written after the include still
      // wins — which is exactly how dark overrides --masthead-field-bg. Matched
      // globally because a one-line block can carry several
      // (`:root { @include a; @include b; }`).
      for (const include of bare.matchAll(/@include\s+([\w-]+)\s*(?:\(([^)]*)\))?\s*;/g)) {
        const mixin = mixins.get(include[1]);
        if (!mixin || seen.has(include[1])) continue;
        const args = include[2] ? splitTopLevelArgs(include[2]) : [];
        const expanded = declarations(
          substituteParams(mixin.body, mixin.params, args),
          mixins,
          new Set([...seen, include[1]])
        );
        for (const [k, v] of expanded) out.set(k, v);
      }
    }
    depth += (bare.match(/\{/g) ?? []).length - (bare.match(/\}/g) ?? []).length;
  }
  return out;
}

/** Split a mixin argument list on top-level commas. */
function splitTopLevelArgs(str) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of str) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/** Replace `$param` / `#{$param}` in a mixin body with the passed argument. */
export function substituteParams(body, params, args) {
  let out = body;
  params.forEach((param, i) => {
    const value = args[i];
    if (value == null) return;
    const name = param.replace(/^\$/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out
      .replace(new RegExp(`#\\{\\$${name}\\}`, 'g'), value)
      .replace(new RegExp(`\\$${name}\\b`, 'g'), value);
  });
  return out;
}

/** Every `@mixin name($params) { … }` in a source, by name. */
export function collectMixins(src) {
  const out = new Map();
  for (const m of src.matchAll(/@mixin\s+([\w-]+)\s*(?:\(([^)]*)\))?\s*\{/g)) {
    const body = blockBody(src, m[0].slice(0, -1).trimEnd(), m.index);
    if (body != null) {
      out.set(m[1], { body, params: m[2] ? splitTopLevelArgs(m[2]) : [] });
    }
  }
  return out;
}
