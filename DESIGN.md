# Africa Multiple — DRE Theme · Design System

**“Scholarly Modernism.”** A refined, warm, academic visual language for the
Digital Research Environment of the [Africa Multiple Cluster of Excellence](https://www.africamultiple.uni-bayreuth.de/)
(University of Bayreuth). The theme is a fork of Omeka S’s **Lively**, re-skinned
onto a modern OKLCH design-token foundation with first-class light/dark modes.

The brand identity is shared with the **AMIRA** research dashboard. This document
is the single reference for how the system is put together and how to maintain it.

---

## 1. Design context

| | |
|---|---|
| **Audience** | Researchers, students and the interested public engaging with the Cluster’s digital collections and research data. |
| **Use** | Browsing, searching and reading an Omeka S archive (items, item sets, media, exhibits) — often long reading sessions, sometimes at night. |
| **Tone** | Scholarly, warm, authoritative, unfussy. Earthy not corporate; precise not flashy. |
| **Theme** | Light by default, dark on request — the visitor’s OS preference is respected, with a manual toggle that persists. |

---

## 2. Brand palette

Anchored on the Cluster’s signature green and earth-tone accent family.

| Token | Hex | Role |
|---|---|---|
| **Uni-Grün** | `#009260` | Primary — the brand seed (`--primary-base`) |
| **Braun** | `#d57912` | Accent — warmth, secondary emphasis |
| **Gelb** | `#f0980b` | Brand yellow (decorative / data) |
| **Dunkelblau** | `#1f4bc4` | Brand deep blue (data) |
| **Hellblau** | `#0e8acd` | Brand light blue (data) |
| **Gold** | `#c79938` | Complementary — decorative rules & dividers |

Neutrals are **warm stone** in light mode (a faint earth cast, never cold grey)
and a Uni-Grün-tinted **forest dark** in dark mode (deep neutral, anchored to the
brand rather than a generic charcoal).

The six brand colours are exposed as `--brand-green … --brand-gold` for tags,
categories and decorative use.

---

## 3. The single-seed colour engine

The most important maintainability decision: **one brand seed drives everything.**

```
--primary-base: #009260;   /* injected by layout.phtml from the "Brand colour" setting */
```

Every primary variant is **derived** from that seed with `color-mix(in oklab, …)`
rather than hand-picked:

```scss
--primary:        color-mix(in oklab, var(--primary-base), black 12%);
--primary-hover:  color-mix(in oklab, var(--primary-base), black 22%);
--primary-text:   color-mix(in oklab, var(--primary-base), black 24%);   /* links */
/* …and in dark mode the same seed is mixed toward white instead */
```

Glows, focus rings, selection, blockquote tints and primary-muted surfaces are
**all** mixed from `--primary`, so **changing the brand colour in theme settings
re-tints the entire interface** — and stays AA-legible in both modes — with no
other edits.

**Why OKLCH / oklab?** Perceptually uniform: equal lightness steps *look* equal,
so tints don’t go garish at the extremes and dark-mode lifts are predictable
without magic numbers.

### Semantic tokens (the vocabulary components use)

| Group | Tokens |
|---|---|
| Ink (text) | `--ink-strong` `--ink` `--ink-light` `--ink-subtle` `--muted` |
| Surfaces | `--surface` `--surface-raised` `--surface-sunken` `--background` |
| Lines | `--border-light` `--border` `--border-strong` |
| Brand | `--primary` `--primary-hover` `--primary-active` `--primary-muted` `--primary-text` `--primary-contrast` · `--accent*` `--complementary` |
| State | `--success` `--warning` `--error` `--info` (+ `*-bg`) |
| Links | `--link` `--link-hover` |
| Footer | `--footer-surface` `--footer-surface-alt` `--footer-divider` `--footer-text` `--footer-text-muted` |
| Focus / select | `--focus-color` `--focus-ring` `--selection-bg` |

All are defined in `asset/sass/abstracts/variables/_colors.scss`, once for light
(`@mixin am-light-theme`) and once for dark (`@mixin am-dark-theme`).

---

## 4. Light / dark mode

A `data-theme` attribute on `<body>` drives the modes:

- **Default** = follow the OS (`@media (prefers-color-scheme: dark)` applies dark
  to `:root:not([data-theme="light"])`), falling back to light.
- **Manual** = the sun/moon toggle writes `light` / `dark` to
  `localStorage['dre-theme-preference']` and sets `body[data-theme]`.
- **No flash (FOUC)** = a tiny synchronous script at the top of `<body>` in
  `layout.phtml` applies the stored/preferred theme **before first paint**. The
  toggle icon is chosen by CSS from `[data-theme]`, so there’s no flash of the
  wrong icon either.

Files: `asset/js/theme-toggle.js` (toggle + persistence), `asset/js/utils.js`
(`DREUtils.onReady`), the head-script in `view/layout/layout.phtml`.

---

## 5. Typography

| Role | Family | Notes |
|---|---|---|
| **Display** (h1–h4, banner, titles) | **Spectral** | Warm scholarly serif with real optical weight; carries the academic voice. |
| **Body / UI** (everything else, h5–h6) | **Hanken Grotesk** | Humanist grotesque, highly legible, full Latin-Extended for FR + transliteration. |
| **Mono** | system mono stack | Code, technical values. |

Deliberately **not** the Inter / DM Sans / Fraunces monoculture. Served via
**Bunny Fonts** — a GDPR-compliant, no-IP-logging mirror of Google Fonts —
appropriate for an EU (Bayreuth) deployment.

**Scale** (`_typography.scss`): fixed `rem` steps for product UI so a 13px label
never drifts between breakpoints; fluid `clamp()` reserved for the display tier
(`--text-3xl`, `--text-4xl`, h1/h2). Body is 17px (`--text-base`) for long-form
reading; line length is capped (`--measure-*`).

---

## 6. Other token scales

Defined in `asset/sass/abstracts/variables/_tokens.scss`:

- **Spacing** — 4 pt grid, numeric (`--space-1…40`) + semantic (`--space-xs…3xl`).
- **Radius** — `--radius-sm…2xl` (component default 8 px — institutional, not consumer-round).
- **Shadow** — warm-tinted, layered `--shadow-xs…xl`; deeper + cooler in dark mode.
- **Motion** — `--transition-fast/base/slow` on `--ease-out-quart`; emphasis on `--ease-expo-out`. All suppressed under `prefers-reduced-motion`.
- **Z-index** — named scale (`--z-header`, `--z-modal`, …).
- **Panel helpers** — `--panel-bg/-border/-radius/-shadow` (note: `--panel-border` is re-declared per theme because custom properties freeze their inner `var()` at the declaring block).

---

## 7. Logos & icons

**Logos** (in `asset/img/`):

- `africamultiple.webp` (light) / `africamultiple-dark.webp` (dark) — the header
  lockup. The dark variant was generated by lightening only the **neutral**
  pixels of the mark (the grey “multiple” wordmark) while preserving the
  saturated brand colours, so it stays legible on the forest-dark surface.
- `bayreuth.webp`, `uni-bayreuth-africa-multiple-logo.webp` — the University of
  Bayreuth and Africa Multiple Cluster marks, shown on light plaques in the
  footer (`common/footer/footer-institutions`).
- `ubt.webp` — a compact University of Bayreuth mark, available for settings use.

The header logo is overridable via the **Logo** theme setting.

**Icons** are [Lucide](https://lucide.dev/) SVGs (`sun`, `moon`, `search`,
`chevron-*`, …) — the same family the AMIRA dashboard uses, for cross-product
consistency. They use `stroke="currentColor"`, so they inherit theme colour.
Rendered inline via the `GetSVG` view helper (`$this->GetSVG('sun')`).

---

## 8. Components

Most component partials consume the legacy `$color__*` Sass aliases, which are
**repointed at the semantic tokens** in `_colors.scss` — so the whole theme became
theme-aware in one move. Notable bespoke work:

- **Header** — sticky surface with a 3 px Uni-Grün top “flag” rule, quiet utility
  bar, the lockup with light/dark swap, and the sun/moon toggle.
- **Footer** — one deep-forest band (`--footer-*`): an asymmetric masthead
  pairing a brand-identity block (title in Spectral + description, with inline
  `currentColor` social icons that recolour on the dark band) against the
  institutional marks (Bayreuth + Cluster, on light plaques), over a single
  hairline-separated legal row (copyright + a discreet designer credit). The
  Cluster's Facebook / Instagram / YouTube are wired as overridable defaults.
  Replaced the old stack of three bands (empty top, bordered marks strip, darker
  bottom bar).
- **Back to top** — a fixed brand-green control that fades in past a scroll
  threshold and smooth-scrolls to the top (honours `prefers-reduced-motion`).
- **Cards** (resource grid/list) — clean surface cards: hairline border, soft
  shadow, hover lift. (Replaced the dashed / asymmetric-radius base style.)
- **Linked resources** — a consolidated, faceted view of every record that
  references the current one. Records are merged (a record linked as both
  *author* and *editor* appears once, carrying both relationships) and laid out
  as an editorial “relationship → title” list. Relationship **facet pills**
  filter the list and a control sorts it (relationship / title), all client-side
  over the server-rendered DOM (`asset/js/linked-resources.js`). Replaced the
  old per-property **accordion** stack (dashed boxes, centred titles).
- **Titles** — a short Uni-Grün underline accent (replaced the left-edge colour
  bar — see anti-patterns below).
- **Blockquote** — full-bordered, primary-tinted panel with a serif quotation
  glyph (no icon-font dependency, no side-stripe).
- **Buttons, links, fields** — token-driven, with proper `:focus-visible` rings.

### Anti-patterns deliberately removed

- **Left/right accent stripes** on titles, callouts and collapsible blocks
  (the classic “AI admin UI” tell) → replaced with underline accents, full
  borders, or background tints.
- **Accordion stacks** (dashed boxes, asymmetric `20px/0` radius, centred
  triggers) for linked resources → replaced with a single consolidated,
  faceted list (see Components above).
- **Gradient text**, glassmorphism, neon-on-dark → not used.
- **Cold grey** neutrals → warm stone (light) / forest (dark).

---

## 9. Build

```bash
npm install
npm run build      # gulp css  → asset/css/style.css (compressed, autoprefixed)
npm run watch      # rebuild on change
```

Toolchain (latest as of build): **gulp 5**, **dart-sass 1.100**, **gulp-sass 6**,
**gulp-postcss 10**, **autoprefixer 10.5**. Browser targets in
`package.json › browserslist` (modern evergreen + Safari/iOS ≥ 14, which gives us
`oklch()`, `color-mix()` and WebP).

### SCSS architecture

```
abstracts/variables/_tokens.scss      ← spacing, radii, shadows, motion, z-index
abstracts/variables/_colors.scss      ← OKLCH brand palette, light/dark, $color__* aliases
abstracts/variables/_typography.scss  ← Spectral + Hanken, scale, $font__* aliases
abstracts/mixins/_mixins.scss         ← buttons, container, clearfix
base/ … components/ … utilities/      ← consume the tokens above
```

> **Note on `@import`:** the partials still use Sass `@import` (fully supported by
> Dart Sass 1.x; the deprecation is non-breaking and there is no Dart Sass 3 yet).
> The *real* modernization here is the CSS-custom-property token system, which is
> what makes the theme maintainable. Migrating the partials to the `@use`/`@forward`
> module system is a clean, mechanical future step:
> add `loadPaths: ['asset/sass']` to the gulp task and a single
> `@use "abstracts/abstracts" as *;` to each leaf partial.

---

## 10. Maintenance recipes

**Re-brand to a different colour.** Change **Brand colour** in the theme settings
(or `--primary-base` default in `_colors.scss`). Everything else re-derives.

**Add a token.** Put primitives/derived values in `_tokens.scss` or `_colors.scss`
inside *both* the light and dark blocks if it must differ per mode.

**Style a new component theme-aware.** Use the semantic tokens
(`var(--surface)`, `var(--ink)`, `var(--border)`, `var(--primary)`) — never a raw
hex or a cold grey. Avoid `border-left/right` accent stripes.

**Swap the header logo.** Upload via the **Logo** setting, or replace
`asset/img/africamultiple{,-dark}.webp`.

**Accessibility.** Body/surface pairings target WCAG AA (≥ 4.5:1) in both modes;
focus is always visible (`:focus-visible` ring); motion respects
`prefers-reduced-motion`; the theme toggle is a labelled `aria-pressed` button.
