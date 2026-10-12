#!/usr/bin/env node
/**
 * Generate the favicon + installable-PWA icon set from the official brand mark.
 *
 *   npm run build:icons          (or: node scripts/gen-pwa-icons.mjs)
 *
 * Every icon is resized from ONE master, `asset/img/pwa/compass-source.png`:
 * the Africa Multiple compass rose cut out of the Cluster's official print
 * logo (logo_africamultiple_image.tif, 2421×595 CMYK with an embedded ICC
 * profile → sRGB), with the "africamultiple" lettering and the grey rule
 * removed and the square framed as the official 48px favicon frames it —
 * ring at ~70% of the width, needle tips running off the edges. 1024px,
 * transparent ground.
 *
 * Nothing here is redrawn. A vector re-draw of the compass shipped as the
 * app/touch icon until v2.35 and is what Google showed beside search results
 * (it picks the largest icon a page declares) — the real artwork must win at
 * every size. To change the mark, replace compass-source.png and re-run.
 *
 * Outputs (asset/img/pwa/):
 *   icon-192.png / icon-512.png         purpose "any" — compass on a rounded white tile
 *   maskable-192.png / maskable-512.png purpose "maskable" — full-bleed white; the
 *                                       ring sits well inside the 80% safe zone
 *   monochrome-512.png                  purpose "monochrome" — the mark's own alpha, white
 *   apple-touch-icon.png (180)          opaque, square, no rounding (iOS masks it itself)
 *   favicon-16/32/48/96/192.png         browser tab + search engines (Google wants a
 *                                       multiple of 48px, and prefers the larger)
 *
 * Commit the regenerated PNGs.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const OUT_DIR = join(import.meta.dirname, '..', 'asset', 'img', 'pwa');
const SRC = join(OUT_DIR, 'compass-source.png');
const WHITE = '#ffffff';

// Corner radius of the "any" tile, as a fraction of its size (~22% reads as a
// modern rounded app tile; corners outside it stay transparent).
const R_ANY = 0.22;

/** The mark at `size`px, flattened onto opaque white. */
const onWhite = (size) =>
  sharp(SRC)
    .resize(size, size, { kernel: 'lanczos3' })
    .flatten({ background: WHITE });

/** The mark on a white tile with rounded, transparent corners. */
async function roundedTile(size) {
  const r = Math.round(size * R_ANY);
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">`
    + `<rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="#fff"/></svg>`,
  );
  const flat = await onWhite(size).png().toBuffer();
  return sharp(flat).ensureAlpha().composite([{ input: mask, blend: 'dest-in' }]);
}

/** The mark's own silhouette in white on transparent (the OS tints it). */
async function monochrome(size) {
  const alpha = await sharp(SRC).resize(size, size, { kernel: 'lanczos3' })
    .ensureAlpha().extractChannel('alpha').toBuffer();
  return sharp({ create: { width: size, height: size, channels: 3, background: WHITE } })
    .joinChannel(alpha);
}

const TARGETS = [
  ['icon-192.png', 192, () => roundedTile(192)],
  ['icon-512.png', 512, () => roundedTile(512)],
  ['maskable-192.png', 192, () => onWhite(192)],
  ['maskable-512.png', 512, () => onWhite(512)],
  ['monochrome-512.png', 512, () => monochrome(512)],
  ['apple-touch-icon.png', 180, () => onWhite(180)],
  ...[16, 32, 48, 96, 192].map((s) => [`favicon-${s}.png`, s, () => onWhite(s)]),
];

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  for (const [file, size, make] of TARGETS) {
    const buf = await (await make()).png({ compressionLevel: 9 }).toBuffer();
    await writeFile(join(OUT_DIR, file), buf);
    console.log(`  ${file.padEnd(22)} ${size}px  ${(buf.length / 1024).toFixed(1)} KiB`);
  }
  console.log('Icons written to asset/img/pwa/ (from compass-source.png).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
