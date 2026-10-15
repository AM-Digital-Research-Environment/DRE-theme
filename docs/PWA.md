# Installable PWA

The DRE theme makes the Omeka S site **installable as an app** — desktop *Install*,
mobile *Add to Home Screen* — with the Africa Multiple compass mark as the app
icon. It is deliberately minimal: a manifest, a small install button, icons, and
theme-color metadata. **No service worker.** No offline cache. No auto-popup.

Toggle it under theme settings → **Progressive Web App** (default on). Since 2.38
the favicons, the Apple touch icon and the `theme-color` metas are emitted on
every page whatever the setting: they are browser chrome, not app install. The
toggle governs only the manifest, the install button and the mobile web-app
metas.

## What ships

| Piece | Where |
| --- | --- |
| Per-site manifest (JSON island → runtime `blob:`) | `view/layout/layout.phtml` + `asset/js/pwa-install.js` |
| Install button (hidden until installable) | `view/common/header.phtml` |
| Button + iOS-hint styles | `asset/sass/components/pwa/_pwa-install.scss` |
| Icon set (official compass on white) | `asset/img/pwa/*.png` (generator: `scripts/gen-pwa-icons.mjs`) |
| `theme-color` (light/dark), Apple touch icon, favicons (always) | `view/layout/layout.phtml` `<head>` |
| Apple/mobile web-app metas (PWA only) | `view/layout/layout.phtml` `<head>` |
| Enable + short-name settings | `config/theme.ini` (`pwa_enable`, `pwa_short_name`) |

## Why a runtime `blob:` manifest, not a static file

The manifest has to carry **per-site** values — `name` (site title), `short_name`,
and `start_url`/`scope`/`id` (the site base, e.g. `https://…/s/amira/`). A theme
can serve static assets but **cannot register an Omeka route**, so it can’t expose
a real `…/manifest.webmanifest` endpoint that varies by site, and a single static
file couldn’t hold the right values anyway.

So `layout.phtml` builds the manifest in PHP and emits it as a JSON island:

```html
<script type="application/json" id="dre-pwa-manifest">{…}</script>
```

`pwa-install.js` reads that island, rewrites every URL-bearing field to an
**absolute** URL, and attaches the result as a same-origin **`blob:` URL**:

```js
const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });
link.href = URL.createObjectURL(blob);
```

Two things matter here, and both are easy to get wrong:

1. **`blob:`, not `data:`.** A `data:` URL manifest has an **opaque origin**, so
   Chrome rejects its `start_url`/`scope` (they’d be cross-origin to the page) and
   the site won’t install. A `blob:` URL created on the page is **same-origin**, so
   the manifest is accepted.
2. **Absolutise first.** A `blob:` URL resolves relative references against its own
   opaque path — *not* against the site — so `start_url`, `scope`, `id`, and every
   `icons[].src` / `shortcuts[].url` must already be absolute **before** the JSON is
   turned into a blob. The script does this with `new URL(value, document.baseURI)`.

The JSON is encoded with `JSON_HEX_TAG | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE`
so a stray `</script>` can’t break out of the island while slashes/unicode stay
readable.

## Why no service worker

A theme **cannot usefully register a service worker** on an Omeka S site:

- Omeka serves theme files from `/themes/<theme>/asset/…`.
- The site lives at `/s/<slug>/…`.
- A service worker’s default scope is its own directory, and a worker can only
  control pages **at or below** its own path. `/themes/<theme>/asset/` is **not** a
  parent of `/s/<slug>/`, so a theme-shipped worker could only claim
  `/themes/<theme>/asset/…` — which contains no navigable pages. Useless.
- Widening the scope to `/` requires the server to send a
  **`Service-Worker-Allowed`** response header for the worker file — that’s web-server
  configuration (nginx/Apache), which the theme does not control.

And crucially, **it isn’t needed**: Chrome and Edge **removed the service-worker
requirement** for installability. A site is installable with a valid manifest,
a suitable icon, and HTTPS. So the manifest alone does the job, and we avoid the
real hazards of a badly-scoped worker (stale caches, update headaches) on a
research archive whose content should always be fresh.

If offline support is ever wanted, it belongs in an **Omeka module** (or server
config) that can register a worker at the site root with the right scope header —
not in the theme.

## The install button behaviour

- **Chrome / Edge / Android.** The browser fires `beforeinstallprompt`; the script
  calls `preventDefault()` (killing the browser’s own mini-infobar) and reveals the
  header button. Click → `prompt()`. If the user dismisses, the button stays,
  re-armed for the next `beforeinstallprompt`. On `appinstalled`, it hides.
- **iOS Safari.** There is no `beforeinstallprompt`, so the button is shown up
  front and a click opens a small dismissible hint: *tap Share, then “Add to Home
  Screen.”* (Esc, an outside click, a re-click, or the × closes it.) In-app iOS
  browsers (Chrome/Firefox/etc.) can’t install, so the hint isn’t offered there.
- **Already installed.** If the page is already running in standalone
  display-mode, the button stays hidden.

The button ships with the `[hidden]` attribute. Its stylesheet scopes `display`
to `:not([hidden])`, so the attribute wins and the button is invisible until the
script removes it — no flash on browsers that can’t install.

## The icon set

`scripts/gen-pwa-icons.mjs` (run with `npm run build:icons`) resizes every icon
with **sharp** from one master, `compass-source.png`. That file is the Africa
Multiple compass rose cut out of the Cluster's official print logo
(`logo_africamultiple_image.tif`), with the lettering and grey rule removed. It is
1024px with a transparent ground, framed like the official favicon. Nothing is
redrawn. It writes to `asset/img/pwa/`:

| File | Size | Purpose |
| --- | --- | --- |
| `compass-source.png` | 1024 | master artwork (build input only; not in the release zip) |
| `icon-192.png`, `icon-512.png` | 192, 512 | `any` — compass on a rounded white tile |
| `maskable-192.png`, `maskable-512.png` | 192, 512 | `maskable` — full-bleed white; the ring sits inside the 80% safe zone |
| `monochrome-512.png` | 512 | `monochrome` — the mark's own silhouette, white on transparent |
| `apple-touch-icon.png` | 180 | opaque white, square, no rounding (iOS masks it) |
| `favicon-192.png`, `favicon-96.png` | 192, 96 | search engines: Google shows the largest declared icon, in multiples of 48px |
| `favicon-48.png`, `favicon-32.png`, `favicon-16.png` | 48, 32, 16 | browser tab |

Until v2.35 the app and touch icons were a vector *re-draw* of the compass on a
green tile. Because the touch icon was the largest icon on the page, Google showed
it beside search results. To change the mark, replace `compass-source.png` and
re-run the script. Commit the regenerated PNGs.

## Testing installability

1. Serve the site over **HTTPS** (or `http://localhost`).
2. Open Chrome DevTools → **Application → Manifest**. Confirm the manifest loads
   (as a `blob:` URL), the icons resolve, and there are no “`start_url` is not
   valid” / cross-origin errors.
3. **Application → Manifest → “Installability”** should report the site as
   installable; the address-bar install control and the header button appear.
4. On iOS, load in Safari and confirm the header button shows the Share hint.
