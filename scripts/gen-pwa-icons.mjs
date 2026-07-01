#!/usr/bin/env node
/**
 * Generate the installable-PWA icon set from the theme's brand mark.
 *
 *   npm run build:icons          (or: node scripts/gen-pwa-icons.mjs)
 *
 * There is no square glyph shipped with the theme — the header carries the
 * horizontal Africa Multiple wordmark (asset/img/africamultiple.webp), whose
 * compass/globe mark is only ~130px tall and bleeds into the lettering, so it
 * cannot be cropped and upscaled cleanly. Instead we RE-DRAW that compass rose
 * here as crisp vector art, in the theme's OWN brand pigments (the --brand-*
 * tokens from asset/sass/abstracts/variables/_colors.scss), and rasterise it
 * with sharp. One source of truth, sharp at any size, and a clean single-colour
 * silhouette for the monochrome purpose.
 *
 * Outputs (asset/img/pwa/):
 *   icon-192.png / icon-512.png        purpose "any"  — rounded tile, ~10% margin
 *   maskable-192.png / maskable-512.png purpose "maskable" — full bleed, glyph in the 80% safe zone
 *   monochrome-512.png                 purpose "monochrome" — single-colour glyph on transparent
 *   apple-touch-icon.png (180)         opaque, square, no rounding (iOS masks it itself)
 *   favicon-16/32/48.png               browser tab — resized from favicon-source.png
 *                                      (the real colour-compass artwork, NOT redrawn)
 *
 * Re-run after changing the palette or geometry below, then commit the PNGs.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const OUT_DIR = join(import.meta.dirname, '..', 'asset', 'img', 'pwa');

// --- Brand pigments — the Cluster's canonical brand-book values, mirrored from
//     the --brand-* tokens in _colors.scss. Uni-Grün is the tile ground. -------
const C = {
  green:      '#009260', // Uni-Grün — the brand seed / tile ground
  braun:      '#d57912',
  gelb:       '#f59c08',
  dunkelblau: '#00268a', // navy — the dominant compass needle
  hellblau:   '#44b8f2',
  gold:       '#cca352',
  cream:      '#fdfcf9', // light --surface — rings/highlights on the green tile
};

// ---------------------------------------------------------------------------
// Compass geometry, authored in a 100×100 space centred on (50,50). Every
// needle is a slender rhombus ("spindle") along a bearing; 0° = north (up),
// clockwise. Lengths in the same 100-unit space; a few needles reach past the
// ring (max extent ~52) — icons scale the whole group to fit their safe area.
// ---------------------------------------------------------------------------
const CX = 50, CY = 50;
const MAX_EXTENT = 52; // longest needle tip from centre, for fit-scaling

const rad = (deg) => ((deg - 90) * Math.PI) / 180; // 0°=up
const ptOut = (deg, len) => [CX + len * Math.cos(rad(deg)), CY + len * Math.sin(rad(deg))];
const ptIn = (deg, len) => [CX - len * Math.cos(rad(deg)), CY - len * Math.sin(rad(deg))];
const perp = (deg, w) => {
  const a = rad(deg) + Math.PI / 2;
  return [w * Math.cos(a), w * Math.sin(a)];
};
const n = (v) => Number(v.toFixed(2));

/** A double-ended compass needle (rhombus) along `deg`. */
function spindle(deg, outer, inner, halfWidth, fill) {
  const [ox, oy] = ptOut(deg, outer);
  const [ix, iy] = ptIn(deg, inner);
  const [dx, dy] = perp(deg, halfWidth);
  const d = `M${n(ox)},${n(oy)} L${n(CX + dx)},${n(CY + dy)} `
          + `L${n(ix)},${n(iy)} L${n(CX - dx)},${n(CY - dy)} Z`;
  return `<path d="${d}" fill="${fill}"/>`;
}

// The seven needles, echoing the arrangement of the real mark: a dominant navy
// N–S needle, warm golds/tan on the NE/NW, a long light-blue reaching west, a
// cream needle NE and a braun one SE breaking past the ring.
function needles({ green, navy }) {
  return [
    spindle(147, 49, 8, 3.0, C.braun),      // SE, long
    spindle(275, 52, 24, 2.3, C.hellblau),  // W, long
    spindle(52, 50, 7, 2.6, green),         // NE, long (cream on the tile)
    spindle(212, 45, 7, 2.4, C.gelb),       // SW
    spindle(325, 34, 7, 2.8, C.gold),       // NW (tan)
    spindle(33, 31, 7, 2.6, C.gelb),        // NE short (bright gold)
    spindle(4, 47, 44, 3.1, navy),          // N–S dominant navy needle
  ].join('');
}

/**
 * Full compass rose as an SVG group, scaled so its longest needle tip lands at
 * `fitRadius` from centre. `ring`/`green`/`navy`/`hub` let each purpose recolour
 * (e.g. monochrome paints everything one colour).
 */
function compass({ fitRadius, ring, green, navy, hub }) {
  const s = fitRadius / MAX_EXTENT;
  const rings = ring
    ? `<circle cx="50" cy="50" r="34" fill="none" stroke="${ring}" stroke-width="1.7"/>`
      + `<circle cx="50.7" cy="49.3" r="37" fill="none" stroke="${ring}" stroke-width="1.4"/>`
    : '';
  return `<g transform="translate(${CX},${CY}) scale(${n(s)}) translate(${-CX},${-CY})">`
    + rings
    + needles({ green, navy })
    + `<circle cx="50" cy="50" r="3.2" fill="${hub}"/>`
    + `</g>`;
}

/** Compose one icon's SVG. */
function iconSvg({ size, glyph, tile = C.green, radius = 0, opaque = false }) {
  const bg = tile
    ? `<rect x="0" y="0" width="100" height="100" rx="${radius}" ry="${radius}" fill="${tile}"/>`
    : '';
  // `opaque` is a hint for callers; transparency comes purely from omitting the tile.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}"${opaque ? '' : ''}>`
    + bg + glyph + `</svg>`;
}

// The full-colour compass as it sits on the green tile: rings + the NE needle
// become cream so they read against Uni-Grün; the navy needle stays navy.
const tileCompass = (fitRadius) =>
  compass({ fitRadius, ring: C.cream, green: C.cream, navy: C.dunkelblau, hub: C.dunkelblau });

// Monochrome silhouette: one colour everywhere (the OS tints it). White renders
// legibly whether the platform uses the alpha as a mask or paints the pixels.
const monoCompass = (fitRadius) =>
  compass({ fitRadius, ring: '#ffffff', green: '#ffffff', navy: '#ffffff', hub: '#ffffff' });

// size 100-space corner radius that reads as ~22% of the icon (modern rounded tile).
const R_ANY = 22;

/** Build the list of outputs. */
function targets() {
  return [
    // purpose "any" — rounded tile with a comfortable margin.
    { file: 'icon-192.png', size: 192, svg: iconSvg({ size: 192, radius: R_ANY, glyph: tileCompass(40) }) },
    { file: 'icon-512.png', size: 512, svg: iconSvg({ size: 512, radius: R_ANY, glyph: tileCompass(40) }) },
    // purpose "maskable" — full bleed, glyph strictly inside the 80% safe zone
    // (safe radius = 40 in the 100-space; keep tips a touch inside).
    { file: 'maskable-192.png', size: 192, svg: iconSvg({ size: 192, radius: 0, glyph: tileCompass(36) }) },
    { file: 'maskable-512.png', size: 512, svg: iconSvg({ size: 512, radius: 0, glyph: tileCompass(36) }) },
    // purpose "monochrome" — glyph only, transparent ground.
    { file: 'monochrome-512.png', size: 512, svg: iconSvg({ size: 512, tile: null, glyph: monoCompass(42) }) },
    // Apple touch icon — opaque, square, NO rounding (iOS applies its own mask).
    // `opaque` flattens away the alpha channel so older iOS never composites it
    // onto black.
    { file: 'apple-touch-icon.png', size: 180, opaque: true, svg: iconSvg({ size: 180, radius: 0, glyph: tileCompass(41) }) },
    // NB: the browser-tab favicons are NOT redrawn here. They are resized
    // straight from the brand master `favicon-source.png` (the official colour
    // compass on white) in main(), so the tab uses the real artwork.
  ];
}

// The browser-tab favicon sizes, downscaled from the shipped master artwork.
const FAVICON_SRC = 'favicon-source.png';
const FAVICON_SIZES = [16, 32, 48];

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  for (const t of targets()) {
    // High rasterisation density then resize to exact size = crisp edges at any
    // scale (librsvg renders the 100-unit canvas at ~size*4 then downsamples).
    let pipe = sharp(Buffer.from(t.svg), { density: Math.max(72, t.size * 4) })
      .resize(t.size, t.size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } });
    if (t.opaque) pipe = pipe.flatten({ background: C.green }); // drop alpha → true RGB
    const buf = await pipe.png({ compressionLevel: 9 }).toBuffer();
    const out = join(OUT_DIR, t.file);
    await writeFile(out, buf);
    console.log(`  ${t.file.padEnd(22)} ${t.size}px  ${(buf.length / 1024).toFixed(1)} KiB`);
  }

  // Browser-tab favicons — resized straight from the master artwork, NOT
  // redrawn. `favicon-source.png` is the official Africa Multiple colour
  // compass on white; downscale it to the standard tab sizes.
  const srcPath = join(OUT_DIR, FAVICON_SRC);
  for (const size of FAVICON_SIZES) {
    const buf = await sharp(srcPath)
      .resize(size, size, { fit: 'contain', kernel: 'lanczos3', background: '#ffffff' })
      .png({ compressionLevel: 9 })
      .toBuffer();
    const file = `favicon-${size}.png`;
    await writeFile(join(OUT_DIR, file), buf);
    console.log(`  ${file.padEnd(22)} ${size}px  ${(buf.length / 1024).toFixed(1)} KiB  (from ${FAVICON_SRC})`);
  }

  console.log('PWA icons written to asset/img/pwa/.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
