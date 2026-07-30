/**
 * OKLCH → sRGB → WCAG relative luminance, with no dependencies.
 *
 * Used by scripts/check-design-tokens.mjs to ASSERT the accessibility claim in
 * DESIGN.md instead of restating it. The theme authors every ink and surface in
 * OKLCH, so the check has to do the colour-space work itself: parse the
 * `oklch(L% C H)` literals out of _colors.scss, convert, and compute the ratio.
 *
 * Conversion follows Björn Ottosson's Oklab matrices (the same ones the CSS
 * Color 4 spec references). Out-of-gamut results are clipped per channel, which
 * is what a display does anyway — and the pairs we check are all in gamut.
 */

/** `oklch(60% 0.010 58)` → { l: 0.60, c: 0.010, h: 58 }. Returns null if unparseable. */
export function parseOklch(str) {
  const m = /oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*\)/i.exec(str);
  if (!m) return null;
  return { l: parseFloat(m[1]) / 100, c: parseFloat(m[2]), h: parseFloat(m[3]) };
}

/** OKLCH → linear-light sRGB, clipped to [0, 1]. */
export function oklchToLinearSrgb({ l: L, c: C, h: H }) {
  const hr = (H * Math.PI) / 180;
  const a = C * Math.cos(hr);
  const b = C * Math.sin(hr);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

  const l3 = l_ ** 3;
  const m3 = m_ ** 3;
  const s3 = s_ ** 3;

  const clip = (v) => Math.min(1, Math.max(0, v));
  return [
    clip(+4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3),
    clip(-1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3),
    clip(-0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3),
  ];
}

/** WCAG 2.x relative luminance. Input is LINEAR sRGB, so no de-gamma step. */
export function relativeLuminance([r, g, b]) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two OKLCH colours (order-independent). */
export function contrastRatio(oklchA, oklchB) {
  const la = relativeLuminance(oklchToLinearSrgb(oklchA));
  const lb = relativeLuminance(oklchToLinearSrgb(oklchB));
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
