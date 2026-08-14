/**
 * A small CSS colour engine: OKLCH / hex / color-mix(in oklab, …) → sRGB.
 *
 * WHY THIS EXISTS. Every module declaration in DRE-Visualizations and DRESearch
 * is written `var(--token, literal)`, and the contract (DESIGN.md §9) asks that
 * the literal be the brand value so an isolated render never shows a shadow
 * brand. Those literals were written by hand, at 31 token names, across three
 * repos — and drifted, because no lint has ever looked at a fallback (all three
 * strip `var(--x, …)` before applying any rule).
 *
 * The fix is to stop writing them: this module resolves the theme's own
 * _colors.scss to concrete sRGB so `scripts/gen-token-fallbacks.mjs` can emit
 * one generated table, and so the lint can compare every hand-written literal
 * against it.
 *
 * The theme authors colour three ways, and all three have to be evaluated:
 *   • `oklch(L% C H)` literals            — the hand-authored inks and surfaces
 *   • `#rrggbb`                            — the brand-book pigments and the seed
 *   • `color-mix(in oklab, A p%, B q%)`    — every derived tone
 *
 * Conversion follows Björn Ottosson's Oklab matrices (the ones CSS Color 4
 * references), and color-mix follows the CSS Color 5 rules: percentages
 * normalise, mixing happens in premultiplied alpha, and an omitted percentage
 * is the complement of the one that is given.
 *
 * Out-of-gamut results are clipped per channel, which is what a display does.
 */

// ==========================================================================
// sRGB transfer function
// ==========================================================================

/** Gamma-encoded sRGB channel (0–1) → linear-light. */
export function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Linear-light channel (0–1) → gamma-encoded sRGB. */
export function linearToSrgb(c) {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));

// ==========================================================================
// Oklab ⇄ linear sRGB
// ==========================================================================

/** Oklab {L,a,b} → linear-light sRGB triple, clipped to [0,1]. */
export function oklabToLinearSrgb({ L, a, b }) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

  const l3 = l_ ** 3;
  const m3 = m_ ** 3;
  const s3 = s_ ** 3;

  return [
    clamp01(+4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3),
    clamp01(-1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3),
    clamp01(-0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3),
  ];
}

/** Linear-light sRGB triple → Oklab {L,a,b}. */
export function linearSrgbToOklab([r, g, b]) {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  return {
    L: 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
  };
}

/** `{l,c,h}` (l as 0–1, h in degrees) → Oklab {L,a,b}. */
export function oklchToOklab({ l, c, h }) {
  const hr = (h * Math.PI) / 180;
  return { L: l, a: c * Math.cos(hr), b: c * Math.sin(hr) };
}

// ==========================================================================
// Parsing
// ==========================================================================

/** `oklch(60% 0.010 58)` → { l: 0.60, c: 0.010, h: 58 }. Null if unparseable. */
export function parseOklch(str) {
  const m = /oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*\)/i.exec(str);
  if (!m) return null;
  return { l: parseFloat(m[1]) / 100, c: parseFloat(m[2]), h: parseFloat(m[3]) };
}

/** `#abc` / `#aabbcc` / `#aabbccdd` → gamma-encoded sRGB {r,g,b,alpha} in 0–1. */
export function parseHex(str) {
  const m = /^#([0-9a-f]{3,8})$/i.exec(str.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3 || h.length === 4) h = [...h].map((ch) => ch + ch).join('');
  if (h.length !== 6 && h.length !== 8) return null;
  const int = parseInt(h.slice(0, 6), 16);
  return {
    r: ((int >> 16) & 255) / 255,
    g: ((int >> 8) & 255) / 255,
    b: (int & 255) / 255,
    alpha: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
  };
}

/** Named keywords the theme actually uses in color-mix arguments. */
const KEYWORDS = {
  white: { L: 1, a: 0, b: 0, alpha: 1 },
  black: { L: 0, a: 0, b: 0, alpha: 1 },
  // Per CSS Color 4, `transparent` is rgba(0,0,0,0) — it contributes nothing
  // but its alpha, which is what makes the wash tokens come out translucent.
  transparent: { L: 0, a: 0, b: 0, alpha: 0 },
};

/** Split on top-level commas, ignoring commas nested inside parentheses. */
function splitTopLevel(str) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of str) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/** Pull the balanced body out of `fn(<body>)` starting at the function name. */
function functionBody(str, name) {
  const at = str.toLowerCase().indexOf(name + '(');
  if (at === -1) return null;
  let depth = 0;
  const from = at + name.length + 1;
  for (let i = from - 1; i < str.length; i++) {
    if (str[i] === '(') depth++;
    else if (str[i] === ')' && --depth === 0) return str.slice(from, i);
  }
  return null;
}

/** `var(--primary) 28%` → { color: 'var(--primary)', pct: 28 }. */
function splitPercentage(arg) {
  const m = /^(.*?)\s+([\d.]+)%$/s.exec(arg.trim());
  if (m) return { color: m[1].trim(), pct: parseFloat(m[2]) };
  return { color: arg.trim(), pct: null };
}

// ==========================================================================
// Resolution
// ==========================================================================

export class UnresolvableColor extends Error {}

/**
 * Resolve any colour expression the theme uses to Oklab + alpha.
 *
 * `lookup` maps a custom-property name (`--primary`) to its raw declared value,
 * so `var()` chains resolve recursively. `seen` breaks reference cycles.
 */
export function resolveColor(expr, lookup, seen = new Set()) {
  const src = String(expr).trim().replace(/\s*!(important|default)\s*$/i, '');

  const keyword = KEYWORDS[src.toLowerCase()];
  if (keyword) return { ...keyword };

  const hex = parseHex(src);
  if (hex) {
    const lin = [srgbToLinear(hex.r), srgbToLinear(hex.g), srgbToLinear(hex.b)];
    return { ...linearSrgbToOklab(lin), alpha: hex.alpha };
  }

  if (/^oklch\(/i.test(src)) {
    const parsed = parseOklch(src);
    if (!parsed) throw new UnresolvableColor(`unparseable oklch(): ${src}`);
    return { ...oklchToOklab(parsed), alpha: 1 };
  }

  if (/^color-mix\(/i.test(src)) {
    const body = functionBody(src, 'color-mix');
    if (!body) throw new UnresolvableColor(`unbalanced color-mix(): ${src}`);
    const args = splitTopLevel(body);
    if (args.length !== 3 || !/^in\s+oklab$/i.test(args[0])) {
      throw new UnresolvableColor(`only color-mix(in oklab, A, B) is supported: ${src}`);
    }
    const a = splitPercentage(args[1]);
    const b = splitPercentage(args[2]);
    return mixOklab(
      resolveColor(a.color, lookup, seen),
      a.pct,
      resolveColor(b.color, lookup, seen),
      b.pct
    );
  }

  if (/^var\(/i.test(src)) {
    const body = functionBody(src, 'var');
    if (!body) throw new UnresolvableColor(`unbalanced var(): ${src}`);
    const [name, ...rest] = splitTopLevel(body);
    const fallback = rest.join(', ');
    if (seen.has(name)) throw new UnresolvableColor(`circular var() reference: ${name}`);
    const declared = lookup(name);
    if (declared == null) {
      if (fallback) return resolveColor(fallback, lookup, seen);
      throw new UnresolvableColor(`undefined custom property: ${name}`);
    }
    return resolveColor(declared, lookup, new Set([...seen, name]));
  }

  throw new UnresolvableColor(`unrecognised colour expression: ${src}`);
}

/**
 * CSS Color 5 `color-mix()` in the Oklab space.
 *
 * Percentages normalise to 100. Mixing is done in PREMULTIPLIED alpha, which is
 * what makes `color-mix(in oklab, var(--accent) 28%, transparent)` come out as
 * the accent hue at 0.28 alpha rather than the accent darkened toward black.
 */
export function mixOklab(colorA, pctA, colorB, pctB) {
  let p1 = pctA;
  let p2 = pctB;
  if (p1 == null && p2 == null) { p1 = 50; p2 = 50; }
  else if (p1 == null) p1 = 100 - p2;
  else if (p2 == null) p2 = 100 - p1;

  const sum = p1 + p2;
  if (sum === 0) throw new UnresolvableColor('color-mix() percentages sum to zero');
  // When the two percentages sum to less than 100 the result carries an alpha
  // multiplier; at or above 100 they simply normalise.
  const alphaMultiplier = sum < 100 ? sum / 100 : 1;
  const w1 = p1 / sum;
  const w2 = p2 / sum;

  const alpha = colorA.alpha * w1 + colorB.alpha * w2;

  // Premultiply, mix, un-premultiply.
  const pm = (c, w) => ({ L: c.L * c.alpha * w, a: c.a * c.alpha * w, b: c.b * c.alpha * w });
  const A = pm(colorA, w1);
  const B = pm(colorB, w2);
  const out = alpha === 0
    ? { L: 0, a: 0, b: 0 }
    : { L: (A.L + B.L) / alpha, a: (A.a + B.a) / alpha, b: (A.b + B.b) / alpha };

  return { ...out, alpha: alpha * alphaMultiplier };
}

// ==========================================================================
// Formatting
// ==========================================================================

/** Oklab {L,a,b,alpha} → gamma-encoded 0–255 sRGB channels. */
export function toRgb255(color) {
  return oklabToLinearSrgb(color).map((c) => Math.round(clamp01(linearToSrgb(c)) * 255));
}

/**
 * Oklab {L,a,b,alpha} → the shortest exact CSS literal: `#rrggbb` when opaque,
 * `rgba(r, g, b, a)` otherwise. Translucent tokens (the highlight wash, the
 * focus ring, the overlay) genuinely need the alpha, so they keep it.
 */
export function formatColor(color) {
  const [r, g, b] = toRgb255(color);
  const alpha = color.alpha ?? 1;
  if (alpha >= 0.999) {
    return '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('');
  }
  return `rgba(${r}, ${g}, ${b}, ${Number(alpha.toFixed(4))})`;
}

/** WCAG 2.x relative luminance from LINEAR sRGB (no de-gamma step). */
export function relativeLuminance([r, g, b]) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
