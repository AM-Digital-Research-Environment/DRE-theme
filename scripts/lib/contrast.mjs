/**
 * WCAG contrast over the theme's OKLCH palette.
 *
 * Used by scripts/check-design-tokens.mjs to ASSERT the accessibility claim in
 * DESIGN.md instead of restating it. The theme authors every ink and surface in
 * OKLCH, so the check has to do the colour-space work itself: parse the
 * `oklch(L% C H)` literals out of _colors.scss, convert, and compute the ratio.
 *
 * The colour-space work itself now lives in ./color.mjs, which grew a full
 * color-mix(in oklab, …) resolver so the fallback table can be generated rather
 * than hand-written. This module keeps the contrast-specific API on top of it;
 * the Oklab matrices are declared once, over there.
 */
import {
  parseOklch,
  oklchToOklab,
  oklabToLinearSrgb,
  relativeLuminance,
  resolveColor,
} from './color.mjs';

export { parseOklch, relativeLuminance };

/** OKLCH → linear-light sRGB, clipped to [0, 1]. */
export function oklchToLinearSrgb(oklch) {
  return oklabToLinearSrgb(oklchToOklab(oklch));
}

/** WCAG contrast ratio between two OKLCH colours (order-independent). */
export function contrastRatio(oklchA, oklchB) {
  const la = relativeLuminance(oklchToLinearSrgb(oklchA));
  const lb = relativeLuminance(oklchToLinearSrgb(oklchB));
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * WCAG contrast between two arbitrary colour EXPRESSIONS — hex, oklch(),
 * var() chains or color-mix(in oklab, …) — resolved through `lookup`.
 *
 * Composited over `ground` when either colour is translucent, so a wash is
 * measured as it actually paints rather than as if it were opaque.
 */
export function contrastRatioResolved(exprA, exprB, lookup) {
  const a = resolveColor(exprA, lookup);
  const b = resolveColor(exprB, lookup);
  const over = (c, ground) => {
    const alpha = c.alpha ?? 1;
    if (alpha >= 0.999) return oklabToLinearSrgb(c);
    const top = oklabToLinearSrgb(c);
    const bottom = oklabToLinearSrgb(ground);
    return top.map((ch, i) => ch * alpha + bottom[i] * (1 - alpha));
  };
  const la = relativeLuminance(over(a, b));
  const lb = relativeLuminance(over(b, a));
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
