# Africa Multiple — DRE · Omeka S theme

[![release v2.19.8](https://img.shields.io/badge/release-v2.19.8-009260?logo=git&logoColor=white)](https://github.com/AM-Digital-Research-Environment/DRE-theme/releases/latest)
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

## Installation

For out-of-the-box use, follow the [Omeka S manual on installing themes](https://omeka.org/s/docs/user-manual/sites/site_theme/#installing-themes): place this folder in your Omeka S `themes/` directory and select it for your site.

For Sass development you’ll need [Node.js](https://nodejs.org/) (≥ 20). From the theme directory:

```bash
npm install
npm run build     # compile asset/sass → asset/css/style.css (compressed, autoprefixed)
npm run watch     # recompile on change
```

Build toolchain: gulp 5, Dart Sass 1.x, gulp-postcss, autoprefixer.

## Theme settings

- **General** — *Brand colour* (single seed; default Uni-Grün `#009260`).
- **Contact info** — location, phone, email; show in top header and/or footer.
- **Header** — top-navigation depth; optional custom *Logo* (overrides the bundled Africa Multiple lockup).
- **Banner** — copy for the abstract earth-tone wash masthead: eyebrow, title (defaults to the site title), tagline, optional call-to-action button, and a toggle to show the slim banner on interior pages.
- **Footer** — a single forest band: a brand-identity masthead (title + description, overridable via *Footer site description*) with social links on the left and the fixed institutional marks (University of Bayreuth + Africa Multiple Cluster) on the right, over a quiet legal row (copyright + a discreet designer credit).
- **Social media** — Facebook, X/Twitter, LinkedIn, Instagram, YouTube, Mastodon. The Cluster's Facebook, Instagram and YouTube show by default; any setting entered here overrides its default.
- **Footer bottom** — copyright, terms and privacy links.
- **Media** — decorative borders; media caption in the viewer.
- **Resource tags** — show tags by resource type and/or class.
- **Browse** — layout (grid / list / toggle) and body-property truncation.

## Design system

The visual language — palette, the single-seed colour engine, typography, tokens, dark mode, components and maintenance recipes — is documented in **[`DESIGN.md`](DESIGN.md)**. The theme’s design tokens are also the shared contract for its sibling modules, **DRE-Search** and **ResourceVisualizations**, which consume them so they follow the brand and the light/dark toggle automatically — see [§9 “The module ecosystem”](DESIGN.md#9-the-module-ecosystem--search--visualizations).

## Credits

Theme by Frédérick Madore for the Africa Multiple Cluster of Excellence. Originally forked from the **Lively** theme by the Omeka Team ([omeka-s-themes/lively](https://github.com/omeka-s-themes/lively)), it has since been rebuilt into a standalone theme and design system.

## License

Distributed under the **GNU General Public License v3** (GPLv3) — see [`LICENSE`](LICENSE). The Omeka name is a registered trademark of the Corporation for Digital Scholarship.
