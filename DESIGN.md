# Africa Multiple — DRE Theme · Design System

**“Scholarly Modernism.”** A refined, warm, academic visual language for the
Digital Research Environment of the [Africa Multiple Cluster of Excellence](https://www.africamultiple.uni-bayreuth.de/)
(University of Bayreuth). A complete, standalone design system on a modern OKLCH
design-token foundation with first-class light/dark modes. It began as a fork of
Omeka S’s **Lively** but has since been rebuilt top to bottom — palette, colour
engine, typography, tokens, components and templates are all its own.

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
| **Gelb** | `#f59c08` | Brand yellow (decorative / data) |
| **Dunkelblau** | `#00268a` | Brand deep blue (data) |
| **Hellblau** | `#44b8f2` | Brand light blue (data) |
| **Gold** | `#cca352` | Complementary — decorative rules & dividers |

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

A `data-theme` attribute drives the modes. It is mirrored on **both `<html>` and
`<body>`**: `<html>` so the root `color-scheme` (scrollbars and the viewport
canvas) tracks the active theme, and `<body>` for the subtree token theming and
for chart modules that observe `body[data-theme]`.

- **Default** = follow the OS (`@media (prefers-color-scheme: dark)` applies dark
  to `:root:not([data-theme="light"])`), falling back to light.
- **Manual** = the sun/moon toggle writes `light` / `dark` to
  `localStorage['dre-theme-preference']` and sets `data-theme` on both elements.
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
consistency — kept in `asset/img/*.svg`. They use `stroke="currentColor"`, so
they inherit theme colour, and are painted two ways, with **no icon webfont**:

- **Static decorations** (select arrows, the drawer chevron, …) — a plain CSS
  `background-image: url("../img/<name>.svg")`.
- **Recolouring `::before` / `::after` glyphs** — the
  `svg-icon($icon, $size, $color)` mixin (`abstracts/mixins/_mixins.scss`): a
  `mask-image` of an inline-SVG data-URI tinted with
  `background-color: currentColor`, so the glyph follows its host's colour token
  and its hover / disabled states exactly as a font glyph did.

**No FontAwesome.** As of **v2.5.5** the theme stopped loading Omeka core's
`iconfonts.css` (and its ~77 KiB `fa-solid` webfont — ~91 KiB/page). The core
`o-icon-*` classes the theme still renders — pagination `prev`/`next`, media
`grid`/`list`, `search`, advanced-search `add`/`delete`, `private`/`annotation`
— are repainted with `svg-icon()` masks in `base/elements/_icons.scss`. To add a
glyph: drop a URL-encoded Lucide data-URI into `_mixins.scss` and apply
`svg-icon()`. With the webfont gone, any unstyled `o-icon-*` renders nothing
(an empty `::before`) rather than a “tofu” box.

> Note: the `GetSVG` view helper declared in `theme.ini` is **vestigial** —
> nothing calls it and it is not actually registered (calling `$this->getSVG()`
> throws). The CSS `background-image` / `svg-icon()` mask paths above are the
> icon system; don't reach for `GetSVG`.

---

## 8. Components

Most component partials consume the legacy `$color__*` Sass aliases, which are
**repointed at the semantic tokens** in `_colors.scss` — so the whole theme became
theme-aware in one move. Notable bespoke work:

- **Header** — sticky surface with a 3 px Uni-Grün top “flag” rule, quiet utility
  bar, the lockup with light/dark swap, and the sun/moon toggle. On the home page
  the lockup steps down from `<h1>` to a plain home link, because the hero banner
  there carries the site title as the page `<h1>` (one `<h1>` per page).
- **Banner — earth-tone wash** — a photography-free masthead: a soft diagonal
  sweep through the brand earth tones (Uni-Grün → Gold → Braun), drawn purely in
  CSS. Each stop is `color-mix`-ed toward `--surface`, so the wash is a pale tint
  under dark type in light mode and a deep tint under light type in dark mode
  (AA+ either way); a surface-based left scrim keeps the type on calm ground
  while the colour blooms to the right. Two variants from one partial
  (`common/banner.phtml`): a **tall hero** on the home page (eyebrow + site title
  `<h1>` + tagline + optional CTA) and a **slim masthead** elsewhere that keeps
  the title present site-wide (toggle: *Show banner on interior pages*). Home
  detection lives in `layout.phtml` (route `site`, or `site/page` matching
  `homepage()`), passed to both the header and the banner. Copy comes from the
  **Banner** theme settings and falls back to the site title, so it is meaningful
  out of the box.
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
  references the current one, inside a native `<details>` disclosure
  (collapsible, no JS, open by default). Records are merged (a record linked as
  both *author* and *editor* appears once, carrying both relationships) and laid
  out as a dense, responsive **card grid** — each card showing the record’s
  **type** (its resource class) and how it relates. Relationship **facet pills**
  filter the grid and a control sorts it (relationship / title), all client-side
  over the server-rendered DOM (`asset/js/linked-resources.js`). Replaced the
  old per-property **accordion** stack, then the earlier one-row-per-record list.
- **Titles** — a short Uni-Grün underline accent (replaced the left-edge colour
  bar — see anti-patterns below).
- **Blockquote** — full-bordered, primary-tinted panel with a serif quotation
  glyph (no icon-font dependency, no side-stripe).
- **Value annotations** — the metadata-value annotation popover
  (`components/annotation`) restyled onto the tokens: a hairline-bordered,
  soft-shadowed `--surface-raised` card (was a dashed box with an asymmetric
  `10px/0` radius). Its width is now intrinsic and viewport-capped
  (`min(22rem, calc(100vw − 2·--space-4))`) and the inner property list stacks
  and wraps, so a long URI or resource link no longer overflows on mobile.
- **Buttons, links, fields** — token-driven, with proper `:focus-visible` rings.

### Mirador — the IIIF viewer

The item page's media region is the **[Mirador](https://github.com/Daniel-KM/Omeka-S-module-Mirador)**
block (Daniel-KM's module). The theme replaced **Universal Viewer** with it in
**v2.6.0**; three theme-side pieces make it fit the system:

1. **Embed fallback** (`view/common/resource-page-block-layout/mirador.phtml`).
   Mirador renders from a IIIF manifest, but a YouTube / oEmbed / raw-HTML media
   is **not** a IIIF canvas, so the manifest is empty and the viewer has nothing
   to show. For items whose media use those ingesters the override renders the
   media's **native player** instead (the same IIIF-vs-embed split the old
   Universal Viewer override carried — only the fallback viewer changed). Image /
   AV-file items fall through to `$this->mirador($resource)` with deep-zoom intact.
2. **Theme-reactive** (`asset/js/mirador-theme.js`, enqueued only by the Mirador
   branch of that partial). The module ships **Mirador 4** as an ES module and
   leaves each live viewer in `window.miradors`; Mirador holds its active
   Material-UI theme in that viewer's Redux store (`config.selectedTheme`,
   choosing from `config.themes.{light,dark}`). The script follows the site's
   light/dark toggle — the same `body[data-theme]` signal the chart modules watch
   (§4, §9) — by dispatching the updateConfig action on the store. Note: Mirador 4
   is a module-local ESM import, so there is **no `window.Mirador`** and **no
   exported `actions`** (both verified against the live viewer); hence the plain
   action object `{ type: 'mirador/UPDATE_CONFIG', config: { selectedTheme } }`
   rather than an action creator. Brand-agnostic and fully guarded: if the
   module's shape changes it no-ops and Mirador keeps its configured theme.
3. **Chrome insulation** (`components/blocks/mirador`). Mirador's controls are
   bare `<button>`s in the light DOM, so the global `primary-button` hover
   (`button:hover…`, 0,3,1) outranks Material-UI's hover (0,2,0) and leaks a
   green fill + lift + glow into the toolbar — the same leak the Universal Viewer
   override fixed. A `.block-mirador`-scoped rule neutralises it.

**Branding lives in the module, not the theme.** Mirador's MUI themes can't read
`oklch()` / `color-mix()`, so — exactly like the chart libraries (§9) — the brand
palette is resolved to sRGB and pasted into the module's **site setting**
(*Site → Mirador → Mirador config*) as JSON. `mirador-theme.js` only switches
*which* theme is active, so this can be tuned without a rebuild. Starting point,
matched to the theme's warm-stone (light) and forest-dark (dark) surfaces:

```json
{
  "selectedTheme": "light",
  "themes": {
    "light": {
      "palette": {
        "mode": "light",
        "primary":    { "main": "#007a50" },
        "secondary":  { "main": "#007a50" },
        "shades":     { "dark": "#f3f0eb", "main": "#fdfcf9", "light": "#ffffff" },
        "background": { "default": "#f8f6f1", "paper": "#fdfcf9" }
      }
    },
    "dark": {
      "palette": {
        "mode": "dark",
        "primary":    { "main": "#4da67b" },
        "secondary":  { "main": "#4da67b" },
        "shades":     { "dark": "#080f0c", "main": "#0e1612", "light": "#151d19" },
        "background": { "default": "#0e1612", "paper": "#151d19" }
      }
    }
  },
  "window": {
    "allowFullscreen": true,
    "allowMaximize": false,
    "sideBarOpenByDefault": false
  },
  "workspaceControlPanel": { "enabled": false }
}
```

> The Mirador config field is **JSON, not JS** — double quotes, no comments, no
> trailing commas. The `window` / `workspaceControlPanel` keys are opinionated
> single-item-embed defaults; drop or tune them as needed.

### Anti-patterns deliberately removed

- **Left/right accent stripes** on titles, callouts and collapsible blocks
  (the classic “AI admin UI” tell) → replaced with underline accents, full
  borders, or background tints.
- **Accordion stacks** (dashed boxes, asymmetric `20px/0` radius, centred
  triggers) for linked resources → replaced with a single consolidated,
  faceted list (see Components above).
- **Gradient text**, glassmorphism, neon-on-dark → not used.
- **Cold grey** neutrals → warm stone (light) / forest (dark).
- **FontAwesome icon webfont** (Omeka core `iconfonts.css` + the `fa-solid`
  woff2, ~91 KiB/page) → removed; glyphs are painted from `currentColor`-tinted
  Lucide SVG masks (`svg-icon()`), so there is no icon-font request.

---

## 9. The module ecosystem — Search & Visualizations

The theme is not consumed in isolation. Two sibling Omeka S **modules**, developed
alongside it, render their own UI into theme pages and are styled to be
indistinguishable from the theme itself:

| Module | Role | How it attaches | Where it is styled |
|---|---|---|---|
| **[DRE-Search](https://github.com/AM-Digital-Research-Environment/DRESearch)** | Typesense-backed faceted search (a Svelte 5 client) | site block layouts (`Research*SearchBlock`), a header search-bar view helper, and a federated results route (`/s/{slug}/dre-search`) | server shell in `asset/css/dre-search.css`; component styles compiled into `asset/dist/dre-search.css` |
| **[ResourceVisualizations](https://github.com/fmadore/ResourceVisualizations)** | ECharts + MapLibre dashboards, charts, maps and a knowledge graph | block layouts (collection / compare / explorer / photo-browse / what's-new…) and resource-page blocks (knowledge graph, item-set dashboard, sibling sparkline…) | one stylesheet, `asset/css/resource-visualizations.css`, plus per-chart JS under `asset/js/` |

**The design tokens are the contract between them.** The custom properties this
theme defines on `:root` (and re-defines per mode) are a *de-facto public API*:
both modules read them and inherit the brand, the warm-stone/forest palette, the
type scale, spacing, radii, shadows and focus rings — and they follow the live
light/dark toggle **for free**, because the theme flips the tokens at
`body[data-theme]` and the modules only ever *reference* them.

### The shared token contract

Modules may rely on these token families (defined in
`asset/sass/abstracts/variables/`). Treat them as stable; renaming one is a
breaking change for the modules.

| Group | Tokens modules consume |
|---|---|
| Brand | `--primary` `--primary-hover` `--primary-contrast` · `--accent` |
| Ink | `--ink-strong` `--ink` `--ink-light` `--muted` |
| Surfaces | `--surface` `--surface-raised` `--surface-sunken` `--surface-overlay` |
| Lines | `--border` `--border-light` `--border-strong` |
| State | `--error` (+ the rest of the `--success/-warning/-info` family) |
| Type | `--font-display` `--font-body` · `--text-xs … --text-2xl` · `--measure-wide` |
| Layout | `--space-*` `--radius-sm/-md/-lg/-full` `--size-control-md/-lg` `--z-dropdown` |
| Effect | `--shadow-xs/-sm/-md/-lg` `--ring-focus` `--transition-fast/-base` |

### The data-colour contract (charts & maps)

Colour in a visualization is **data**, not chrome, so it has its own slice of the
contract — distinct from the UI tokens above:

- **The six brand pigments are the categorical palette.** A multi-series chart
  leads with `--brand-green · --brand-gelb · --brand-hellblau · --brand-braun ·
  --brand-dunkelblau · --brand-gold` (§2), then harmonious extensions for charts
  with more than six series. There is a light set and a **dark-lifted** set — the
  two darkest pigments (Uni-Grün, Dunkelblau) are raised so they don't disappear
  on the forest-dark surface.
- **Canvas / WebGL renderers can't read the tokens directly.** ECharts (zrender)
  and MapLibre don't parse `oklch()` / `color-mix()`, so ResourceVisualizations
  resolves each token to a plain `rgb()` at runtime — a hidden probe + 1×1 canvas
  (`cssColor()` / `readTheme()` in `dashboard-core.js`) — and re-resolves on every
  `[data-theme]` flip. **Never hand a raw `oklch` token to a canvas/WebGL lib;**
  route it through that bridge (or through a `--rv-*` alias it has already
  resolved). This is why the modules can follow the live toggle even though the
  tokens are in a colour space the chart libraries reject.
- **Keep the palette and the tokens identical.** The palette needs twelve stops
  and a dark-lifted variant the tokens don't carry, so the module hard-codes the
  hex values — meaning the brand-anchored stops **duplicate** `--brand-*`. They
  are one brand: when a `--brand-*` value changes, change the module palette in
  the same commit (and vice-versa). A drift between them is the data-side of the
  "competing design variables" failure.

### Rules for keeping the modules in sync

1. **Consume tokens by their exact name; never redefine one.** A module must not
   set `--primary`, `--surface`, … to a *different value* — that is the
   "competing design variables" failure. Read them, don't override them.
2. **Alias into a local namespace if you need to.** ResourceVisualizations maps
   the theme tokens onto `--rv-*` aliases declared **on `body`** (not `:root`),
   so each alias resolves the *active* token from the body's own cascade and the
   `[data-theme]` flip carries through. This is the pattern to copy for any new
   module.
3. **Keep fallbacks on-brand.** Every `var(--token, <fallback>)` carries a literal
   for hosts that lack the DRE tokens. That literal **must be the brand value** —
   Uni-Grün / warm stone (light) / forest (dark) — never a cold grey and never a
   different hue. (The fallback is inert whenever this theme is loaded — the token
   always wins — but it is what an isolated render, a non-DRE host, or a
   maintainer reading the code sees, so it must not encode a "shadow brand.")
4. **Don't invent parallel scales.** No module-local spacing, radius or type
   scale that competes with the theme's. Use `--space-*`, `--radius-*`,
   `--text-*`.
5. **The anti-patterns (§8) apply equally.** No side-stripe accents, no gradient
   text, no glassmorphism — in the modules as much as in the theme.
6. **Data colours are part of the contract too.** A chart palette tracks the six
   `--brand-*` pigments and reaches the tokens through the runtime bridge — see
   *The data-colour contract* above. Don't ship a palette that disagrees with
   `--brand-*`.

> Each module also states this contract at the top of its own stylesheet
> (ResourceVisualizations’ CSS header; DRE-Search’s `dre-search.css`). This
> section is the canonical, theme-side reference; keep them consistent.

---

## 10. Build

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

## 11. Maintenance recipes

**Re-brand to a different colour.** Change **Brand colour** in the theme settings
(or `--primary-base` default in `_colors.scss`). Everything else re-derives.

**Add a token.** Put primitives/derived values in `_tokens.scss` or `_colors.scss`
inside *both* the light and dark blocks if it must differ per mode.

**Style a new component theme-aware.** Use the semantic tokens
(`var(--surface)`, `var(--ink)`, `var(--border)`, `var(--primary)`) — never a raw
hex or a cold grey. Avoid `border-left/right` accent stripes.

**Touch a sibling module’s styles (Search / Visualizations).** Both consume this
theme’s tokens — see §9. Reference tokens by name, keep every
`var(--token, <fallback>)` fallback on-brand (Uni-Grün / warm stone / forest),
and never redefine a theme token to a new value. After editing a module, rebuild
it from its own folder (`npm run build`); the search client also wants
`npm run lint && npm run check`.

**Swap the header logo.** Upload via the **Logo** setting, or replace
`asset/img/africamultiple{,-dark}.webp`.

**Accessibility.** Body/surface pairings target WCAG AA (≥ 4.5:1) in both modes;
focus is always visible (`:focus-visible` ring); motion respects
`prefers-reduced-motion`; the theme toggle is a labelled `aria-pressed` button.
