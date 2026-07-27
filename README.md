# Africa Multiple — DRE · Omeka S theme

[![latest release](https://img.shields.io/github/v/release/AM-Digital-Research-Environment/DRE-theme?label=release&color=009260&logo=git&logoColor=white)](https://github.com/AM-Digital-Research-Environment/DRE-theme/releases/latest)
[![Omeka S v4.2.0+](https://img.shields.io/badge/Omeka%20S-v4.2.0+-8a1f1f)](https://omeka.org/s/)
[![PHP v8.1+](https://img.shields.io/badge/PHP-v8.1+-605F8E?logo=php&logoColor=white)](https://www.php.net/)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-009260.svg)](LICENSE)

The **Digital Research Environment** theme for the [Africa Multiple Cluster of Excellence](https://www.africamultiple.uni-bayreuth.de/) (University of Bayreuth) — a *“Scholarly Modernism”* design system for the Cluster’s Omeka S archive. Warm and scholarly, built on a modern **OKLCH design-token** foundation with first-class **light and dark modes** and the Cluster’s Uni-Grün brand identity.

> 📐 Full design-system reference: **[`DESIGN.md`](DESIGN.md)** · design context: [`.impeccable.md`](.impeccable.md)

## Features

- **Single-seed brand engine** — one Uni-Grün seed (`#009260`) drives every accent, hover, focus ring and tint via `color-mix(in oklab, …)`. Change the **Brand colour** setting and the whole theme re-tints, AA-legible in both modes.
- **Light & dark modes** — respects the visitor’s system preference, with a manual sun/moon toggle that persists; a synchronous head-script prevents any flash of the wrong theme.
- **Distinctive typography** — Spectral (display serif) + Hanken Grotesk (body/UI) served via **Bunny Fonts**, a privacy-first, GDPR-compliant mirror of Google Fonts (no IP logging) — relevant for an EU deployment.
- **Earth-tone banner** — a photography-free masthead: a soft diagonal colour wash through the brand earth tones (green → gold → braun), pure CSS and theme-aware (pale under dark type in light mode, deep under light type in dark mode). A tall hero on the home page carrying the site title, a slim title strip elsewhere. No image required.
- **Brand assets** — the Africa Multiple lockup (with an auto-generated dark-mode variant), institutional footer marks (University of Bayreuth + the Cluster), and [Lucide](https://lucide.dev/) icons.
- **OKLCH design tokens** — colour, spacing, radius, shadow, motion and z-index, all as CSS custom properties for easy maintenance.
- **Accessible** — WCAG AA text/surface pairings in both modes, always-visible focus, and `prefers-reduced-motion` support.
- **Installable (PWA)** — visitors can install the site as an app (desktop *Install* / mobile *Add to Home Screen*) with a brand-mark compass icon. A quiet header button appears **only when the browser can actually install** — no auto-popup, and no service worker (the per-site manifest alone is enough in current Chrome/Edge). Ships light/dark `theme-color`, an Apple touch icon and favicons; toggle it under *Progressive Web App* settings. See **[Installable PWA](#installable-pwa)** below and [`docs/PWA.md`](docs/PWA.md).

## Installation

For out-of-the-box use, follow the [Omeka S manual on installing themes](https://omeka.org/s/docs/user-manual/sites/site_theme/#installing-themes): place this folder in your Omeka S `themes/` directory and select it for your site.

For Sass development you’ll need [Node.js](https://nodejs.org/) (≥ 20). From the theme directory:

```bash
npm install
npm run build     # lint, then compile asset/sass → asset/css/style.css (compressed, autoprefixed)
npm run watch     # recompile on change
```

Build toolchain: gulp 5, Dart Sass 1.x, gulp-postcss, autoprefixer.

### Checks

`npm run build` runs `npm run lint` first, so a contract violation fails the build rather than shipping. Each check encodes a bug that actually reached a release:

| Script | Checks |
| --- | --- |
| `npm run lint:tokens` | Raw hex outside the palette, accent side-stripes, gradient text, px font sizes |
| `npm run lint:ini` | `theme.ini` structure, `.info` vs `.options.info`, dead `Zend\…` types, settings declared but never read, helper registration |
| `npm run lint:templates` | `<?php`/`?>` and bracket balance, unresolved `partial()` paths, helper call sites whose casing doesn't match `theme.ini` |
| `npm run i18n:check` | `language/template.pot` is up to date (regenerate with `npm run i18n:extract`) |

The template and INI checks exist because this theme is developed without a local PHP binary, so `php -l` isn't available — they are a structural net, not a PHP parser.

### Translations

Theme strings are extracted to [`language/template.pot`](language/template.pot):

```bash
npm run i18n:extract
```

To add a locale, copy it to `<locale>.po`, translate the `msgstr` values, compile to `<locale>.mo`, and drop both in `language/`.

## Theme settings

- **General** — *Brand colour* (single seed; default Uni-Grün `#009260`).
- **Contact info** — location, phone, email; show in top header and/or footer.
- **Header** — top-navigation depth; optional custom *Logo* (overrides the bundled Africa Multiple lockup).
- **Banner** — copy for the abstract earth-tone wash masthead: eyebrow, title (defaults to the site title), tagline, optional call-to-action button, and a toggle to show the slim banner on interior pages.
- **Footer** — a single forest band: a brand-identity masthead (title + description, overridable via *Footer site description*) with social links on the left and the fixed institutional marks (University of Bayreuth + Africa Multiple Cluster) on the right, over a quiet legal row (copyright + a discreet designer credit). The footer logo / menu / content fields inherited from the Lively fork were removed in v2.21.0 — no template read them.
- **Social media** — Facebook, X/Twitter, LinkedIn, Instagram, YouTube, Mastodon. The Cluster's Facebook, Instagram and YouTube show by default; any setting entered here overrides its default.
- **Footer bottom** — copyright, terms and privacy links.
- **Media** — decorative borders. (*Media caption in viewer* was removed in v2.21.0: nothing read it, and Mirador supplies its own caption chrome.)
- **Resource tags** — show tags by resource type and/or class.
- **Browse** — layout (grid / list / toggle) and body-property truncation.
- **Progressive Web App** — enable/disable the installable app (default on) and an optional short *installed app name* (the label under the home-screen icon).

## Installable PWA

With the **Progressive Web App** setting enabled (the default), the site becomes installable — desktop browsers offer *Install*, mobile browsers *Add to Home Screen* — using the Africa Multiple compass mark on a Uni-Grün tile.

- **Quiet, browser-gated button.** A small install button sits in the header, hidden by default. `asset/js/pwa-install.js` reveals it **only** when the browser fires `beforeinstallprompt` (Chrome/Edge/Android), or on iOS Safari (where the button opens a *Share → Add to Home Screen* hint). There is **no auto-popup** — the browser’s own mini-infobar is suppressed.
- **Per-site manifest, minted at runtime.** The manifest (name, start URL/scope/id from the site base, `theme_color`/`background_color` from the surface tokens, icons, Browse/Search shortcuts, locale) is built in PHP as a JSON island in `<head>`, then attached by the script as a **same-origin `blob:` URL** with all URLs absolutised first. A theme can’t register an Omeka route to serve a real `.webmanifest`, a static file can’t carry per-site values, and a `data:` manifest has an opaque origin Chrome would reject — so a runtime blob is the correct approach.
- **No service worker — on purpose.** Omeka serves theme assets from `/themes/<theme>/asset/`, which is **not** a parent of the site path `/s/<slug>/`, so a service worker shipped by the theme could only claim a useless narrow scope (broadening it needs a `Service-Worker-Allowed` response header, i.e. server config the theme doesn’t control). Chrome/Edge dropped the service-worker requirement for installability, so **the manifest alone makes the site installable.** Full rationale in [`docs/PWA.md`](docs/PWA.md).
- **Regenerate the icons** after changing the brand mark or palette:

  ```bash
  npm run build:icons   # scripts/gen-pwa-icons.mjs → asset/img/pwa/*.png
  ```

## Design system

The visual language — palette, the single-seed colour engine, typography, tokens, dark mode, components and maintenance recipes — is documented in **[`DESIGN.md`](DESIGN.md)**. The theme’s design tokens are also the shared contract for its sibling modules, **DRE-Search** and **ResourceVisualizations**, which consume them so they follow the brand and the light/dark toggle automatically — see [§9 “The module ecosystem”](DESIGN.md#9-the-module-ecosystem--search--visualizations).

## Credits

Theme by Frédérick Madore for the Africa Multiple Cluster of Excellence. Originally forked from the **Lively** theme by the Omeka Team ([omeka-s-themes/lively](https://github.com/omeka-s-themes/lively)), it has since been rebuilt into a standalone theme and design system.

## License

Distributed under the **GNU General Public License v3** (GPLv3) — see [`LICENSE`](LICENSE). The Omeka name is a registered trademark of the Corporation for Digital Scholarship.
