# Africa Multiple — DRE · Omeka S theme

[![latest release](https://img.shields.io/github/v/release/AM-Digital-Research-Environment/DRE-theme?label=release&color=009260&logo=git&logoColor=white)](https://github.com/AM-Digital-Research-Environment/DRE-theme/releases/latest)
[![Omeka S v4.2.1+](https://img.shields.io/badge/Omeka%20S-v4.2.1+-8a1f1f)](https://omeka.org/s/)
[![PHP v8.1+](https://img.shields.io/badge/PHP-v8.1+-605F8E?logo=php&logoColor=white)](https://www.php.net/)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-009260.svg)](LICENSE)

The **Digital Research Environment** theme for the [Africa Multiple Cluster of Excellence](https://www.africamultiple.uni-bayreuth.de/) (University of Bayreuth) — a *“Scholarly Modernism”* design system for the Cluster’s Omeka S archive. Warm and scholarly, built on a modern **OKLCH design-token** foundation with first-class **light and dark modes** and the Cluster’s Uni-Grün brand identity.

> 📐 Full design-system reference: **[`DESIGN.md`](DESIGN.md)** · design context: [`.impeccable.md`](.impeccable.md) · current design/token audit and its breaking-change register: [`AUDIT.md`](AUDIT.md)

## Features

- **Single-seed brand engine** — one Uni-Grün seed (`#009260`) drives every accent, hover, focus ring and tint via `color-mix(in oklab, …)`. Change the **Brand colour** setting and the whole theme re-tints, AA-legible in both modes.
- **Light & dark modes** — respects the visitor’s system preference, with a manual sun/moon toggle that persists; a synchronous head-script prevents any flash of the wrong theme.
- **Distinctive typography** — Spectral (display serif) + Hanken Grotesk (body/UI), sourced from Bunny Fonts and **self-hosted by the theme**. No visitor request is made to a font CDN.
- **The deep-plate masthead** — a photography-free masthead carried by *type, rule and ground*: a gold brand flag → eyebrow → display title → lede → two text links, beside a sunken **catalogue column** of corpus counts in gold tabular numerals, each row linking to its authority page. The band is an authored plate in both light and dark rather than following the page surface — before v2.24 it resolved to a 1.8 % step off the page and read as empty space. Three **brand-presence** treatments — *quiet*, *balanced*, *bold* (default) — are a token switch, not a rebuild. The earlier earth-tone wash is still available as an optional treatment. A slim title strip on interior pages. No image required.
- **Records that read like records** — item metadata is rendered in named groups (Abstract · Description · Subjects · Origins & context · Rights & access · Identifiers & sources), never in database order, with subjects as chips and a sticky rail carrying citation, DOI, permalink and licence. Any property the theme hasn't been taught about lands in *Further details*, so nothing is ever hidden.
- **Brand assets** — the Africa Multiple lockup (with an auto-generated dark-mode variant), institutional footer marks (University of Bayreuth + the Cluster), and [Lucide](https://lucide.dev/) icons.
- **OKLCH design tokens, all the way down** — colour, *type, rhythm, spacing, layout*, radius, shadow, motion and z-index, all as CSS custom properties. One scale per decision: page geometry reads `--container-max` / `--header-height` / `--label-col`, headings read `--text-*` and `--leading-*`, and there is no parallel Sass number set.
- **Accessible — and measured** — WCAG AA text/surface pairings in both modes, always-visible focus, and `prefers-reduced-motion` support. The contrast claim is *asserted by the build*: `npm run lint:tokens` computes the ratio for every ink/surface pair in both modes from the OKLCH literals and fails on a regression.
- **Installable (PWA)** — visitors can install the site as an app (desktop *Install* / mobile *Add to Home Screen*) with a brand-mark compass icon. A quiet header button appears **only when the browser can actually install** — no auto-popup, and no service worker (the per-site manifest alone is enough in current Chrome/Edge). Ships light/dark `theme-color`, an Apple touch icon and favicons; toggle it under *Progressive Web App* settings. See **[Installable PWA](#installable-pwa)** below and [`docs/PWA.md`](docs/PWA.md).

## Installation

For out-of-the-box use, follow the [Omeka S manual on installing themes](https://omeka.org/s/docs/user-manual/sites/site_theme/#installing-themes): place this folder in your Omeka S `themes/` directory and select it for your site.

For Sass and test development you’ll need [Node.js](https://nodejs.org/) ≥ 24.15. From the theme directory:

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
| `npm run lint:tokens` | Raw hex outside the palette, accent side-stripes, gradient text, px font sizes, surviving `$font__h*-size` references, off-grid px page geometry — **and computed WCAG contrast** for every ink/surface pair in both modes |
| `npm run lint:ini` | `theme.ini` structure, `.info` vs `.options.info`, dead `Zend\…` types, settings declared but never read, helper registration |
| `npm run lint:templates` | `<?php`/`?>` and bracket balance, unresolved `partial()` paths, helper call sites whose casing doesn't match `theme.ini` |
| `npm run lint:groups` | Every property of the live *Research Items* template lands in a named metadata group, and the ones the record design depends on (Author, Abstract, Subject, DOI…) land in the *right* one |
| `npm run lint:js` | Every maintained `.js`/`.mjs` file parses with the supported Node runtime |
| `npm run lint:php` | **Real `php -l`** over every `.php`/`.phtml`, then the theme's PHP tests |
| `npm run test:unit` | jsdom behavior tests for dark mode, translated labels, storage failures, mobile navigation and the PWA manifest/install prompt |
| `npm run i18n:check` | `language/template.pot` is up to date (regenerate with `npm run i18n:extract`) |

### PHP verification

`lint:php` uses whatever PHP it can find — a `php` on `PATH` first, then a
pulled `php:8.3-cli` Docker image. **With neither it prints how to get one and
exits 0**, so a contributor without PHP is not blocked; CI runs
`npm run lint:php:require`, which makes the same check a hard gate. That
asymmetry is deliberate and documented — unlike the accidental version this repo
used to have, where `lint:ini` shelled out to `grep`, silently got nothing on
Windows, and reported every admin field as dead.

Getting a PHP, cheapest first:

```bash
winget install PHP.PHP.8.3
```

`lint:templates` remains the no-PHP structural net (it catches a truncated file,
heading-contract drift and retired integrations, not a mistyped `::`). It is a
fallback for `lint:php`, not a substitute.

**Syntax is not correctness.** A template can parse perfectly and still render
the Author under “Further details”. That half is covered by `lint:groups` (data,
runs anywhere) and `tests/ResourceGroupsTest.php` (logic, needs PHP) — both
asserted against `tests/fixtures/research-items-template.json`, the real property
list of the live template. The helper and template contract suites also make
every warning and deprecation fatal. CI validates discovery through Omeka S
4.2.1's real theme manager on PHP 8.5. Refresh the fixture with
`npm run fixtures:refresh` when the template changes. See
[`docs/TESTING.md`](docs/TESTING.md) for the complete matrix and nightly smoke
test.

### Search integration

Search and faceting are owned by the **DRE Search** Typesense module. Theme links
go directly to `/s/{slug}/dre-search`; legacy Omeka item, item-set and media
advanced-search routes return an HTTP 302 to that page. The former advanced-search
partials, JavaScript and Sass—and the no-longer-installed Faceted Browse module
override—are intentionally absent.

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
- **Banner** — the masthead: *brand presence* (quiet / balanced / bold), eyebrow, title (defaults to the site title), tagline, two optional text links, the catalogue column (heading + corpus counts), an optional standing note beneath it, the optional earth-tone wash, and a toggle to show the slim strip on interior pages.
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

The visual language — palette, the single-seed colour engine, typography, tokens, dark mode, components and maintenance recipes — is documented in **[`DESIGN.md`](DESIGN.md)**. The theme’s design tokens are also the shared contract for its sibling modules, **DRE Search** and **DRE Visualizations**, which consume them so they follow the brand and the light/dark toggle automatically — see [§9 “The module ecosystem”](DESIGN.md#9-the-module-ecosystem--search--visualizations).

**Upgrading to v2.22** — the token layer grew beyond colour (type, rhythm and layout families) and a handful of tokens were retired or renamed. Only one rename affects the modules: `--dre-hl-bg` → `--highlight-bg`, shipped with a deprecated compatibility alias and already updated in DRE Search. The full register, with impact and mitigation per change, is in [`AUDIT.md` §4](AUDIT.md).

## Credits

Theme by Frédérick Madore for the Africa Multiple Cluster of Excellence.

This theme began in 2026 as a fork of the **Lively** theme by the Omeka Team ([omeka-s-themes/lively](https://github.com/omeka-s-themes/lively)), whose GPLv3 licence it keeps, and to whom it owes its starting point. It has since been rebuilt top to bottom — palette and the single-seed colour engine, typography, spacing and layout tokens, every component, both colour schemes, the build pipeline and the test suite — and the last of the inherited stock-theme furniture was retired in v2.22 (see [`AUDIT.md`](AUDIT.md) §B7). It is now developed, versioned and released independently, and is not affiliated with or supported by the Omeka Team.

## License

Distributed under the **GNU General Public License v3** (GPLv3) — see [`LICENSE`](LICENSE). The Omeka name is a registered trademark of the Corporation for Digital Scholarship.
