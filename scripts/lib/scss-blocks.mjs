/**
 * The little Sass parsing the token scripts need: comment stripping and brace
 * matching over the token partials (asset/sass/abstracts/variables/).
 *
 * gen-token-fallbacks.mjs and check-design-tokens.mjs both read
 * `_colors.scss` by block. They each had their own copy, and only one of them
 * removed comments first, so the contrast lint could match a selector named in
 * prose rather than the real block. One parser, used by both.
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
