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
| **Imagery** | None. Photography-free by policy: mastheads are carried by type, rule and ground (no photo, no wash by default). Item media is content, not decoration. |

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
| Brand | `--primary` `--primary-hover` `--primary-active` `--primary-muted` `--primary-text` `--primary-contrast` · `--accent*` |
| Masthead roles | `--masthead-bg/-ink/-ink-soft/-rule/-hair/-sunken/-field-bg/-field-border` · `--flag` `--numeral` `--cta-bg` `--cta-ink` |
| State | `--success` `--warning` `--error` `--info` (+ `*-bg`) |
| Links | `--link` `--link-hover` |
| Highlight | `--highlight-bg` (found-term wash; `--dre-hl-bg` is a deprecated alias) |
| Footer | `--footer-surface` `--footer-surface-alt` `--footer-divider` `--footer-text` `--footer-text-muted` |
| Focus / select | `--focus-color` `--focus-ring` `--selection-bg` |

All are defined in `asset/sass/abstracts/variables/_colors.scss`, once for light
(`@mixin am-light-theme`) and once for dark (`@mixin am-dark-theme`).

### Why the token layer covers more than colour

Colour was tokenised first and thoroughly; type, spacing and layout followed
later and partly stayed in Sass. As of v2.22 there is **one scale per decision,
in CSS**:

| Family | Tokens | Rule |
|---|---|---|
| Type size | `--text-2xs … --text-4xl` | the only heading/body sizes; the `$font__h*-size` Sass set is deleted |
| Rhythm | `--leading-tight/-snug/-normal/-relaxed` | headings `-tight`/`-snug`, body `-normal`, long prose `-relaxed` |
| Space | `--space-1…24` (source of truth) + `--space-xs…3xl` aliases | aliases are `var(--space-N)`, never independent literals; nothing off the 4 pt grid |
| Layout | `--container-max` `--container-gutter` `--header-height` `--scroll-offset` `--rail-width` `--label-col` | no px page geometry in components; `--scroll-offset` is derived from `--header-height` and declared once |

`--scroll-offset: calc(var(--header-height) + var(--space-6))` replaces the
duplicated `scroll-padding-top: 6rem` that used to sit in **both**
`base/_theme.scss` and `base/layout/_layout.scss` — a magic number that matched
neither the 74 px header nor its own twin. `abstracts/variables/_layout.scss`
(the last Sass-only geometry: `$header-min-height`, `$wrap-max-width`) is gone.

### Contrast

> **Body and UI text** meets WCAG AA (≥ 4.5:1) against its surface in both
> modes; `--muted` and `--ink-subtle` are AA at 15 px+ and are reserved for
> non-essential text. The pairings are asserted by `npm run lint:tokens`, not by
> hand — the check parses the OKLCH literals, computes contrast for each
> ink/surface pair per mode, and fails the build on a regression.

Each quiet tier clears 4.5:1 against the *worst* surface in its mode
(`--surface-sunken` in light, `--surface-raised` in dark). The previous 60 % L
values were 3.9:1 and 4.4:1 — i.e. the blanket AA claim this document used to
make was not true. Tones derived with `color-mix()` from the admin seed are not
statically knowable and are out of the check's scope; that limitation is stated
in the lint's header rather than papered over.

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

Deliberately **not** the Inter / DM Sans / Fraunces monoculture. **Self-hosted**
woff2 (`asset/fonts/`, `@font-face` in `base/_fonts.scss`) — the byte-identical
Bunny Fonts files (a GDPR-compliant mirror of Google Fonts), but served from the
theme's own origin so there is no third-party font request at all and no
render-blocking CDN stylesheet on the LCP path. latin + latin-ext subsets only.

**Scale.** `--text-*` in `_typography.scss` is the single source of truth: fixed
`rem` steps for product UI so a 13 px label never drifts between breakpoints,
fluid `clamp()` for the display tier (`--text-3xl`, `--text-4xl`). Headings
consume those tokens directly — there is no parallel Sass size set — and their
weights differentiate the ramp (**h1 800 / h2 700 / h3 600**) so the hierarchy
survives at small viewports, where the old ramp had h2 and h3 at the same size
(both 30 px below `$md`) and h1/h2 at the same weight. Heading margins come from
`--space-*`; line height from `--leading-*`. Body is 17 px for long-form reading,
capped by `--measure-*`.

**Reading vs UI.** Long-form reading tiers (the record's abstract, exhibit prose)
are set in Spectral at `--text-lg`/`--leading-relaxed`; everything operational
(labels, chips, controls, metadata values) stays in Hanken. The split is
deliberate and is most visible on the item page.

---

## 6. Other token scales

Defined in `asset/sass/abstracts/variables/_tokens.scss`:

- **Spacing** — 4 pt grid, `--space-1…24` with `--space-xs…3xl` as *aliases of*
  the numeric steps (not independent values).
- **Layout** — `--container-max`, `--container-gutter`, `--header-height`,
  `--scroll-offset`, `--rail-width`, `--label-col`. Page geometry lives here, not
  in component px.
- **Radius** — `--radius-sm…xl` (component default 8 px — institutional, not consumer-round).
- **Shadow / panel** — warm-tinted `--shadow-xs…xl` and the `--panel-*` helpers
  are emitted from `@mixin am-light-tokens` / `am-dark-tokens`, mirroring how
  `_colors.scss` applies its theme mixins. The light values are declared **once**
  (the earlier `:root` + `body[data-theme="light"]` duplication was 14
  hand-synced declarations). `@mixin am-panel-tokens` states the
  custom-property-freeze workaround once instead of commenting it in three blocks.
- **Motion** — `--transition-fast/base/slow` on `--ease-out-quart`; emphasis on `--ease-expo-out`. Suppressed under `prefers-reduced-motion`.
- **Z-index** — named scale (`--z-header`, `--z-modal`, …).
- **Retired in v2.22** — `--white`, `--black` (literal colours in a theme-aware
  system, and the exact tool for breaking dark mode — replaced by the one
  deliberately mode-independent `--plaque-bg`), `--primary-dark` (alias of
  `--primary-hover`), `--secondary` (only ever aliased `--primary`),
  `--complementary` (decorative-only, and differently hued per mode for no stated
  reason — its single call site now reads `--brand-gold`), `--space-40`,
  `--radius-2xl`, `--tracking-tighter`, `--glow-md`, `--ring-focus-sm`,
  `--lift-sm`, `--accent-line-sm`. `--dre-hl-bg` is renamed `--highlight-bg` with
  the old name kept as a deprecated alias for one minor.

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

**Icons** use [Lucide](https://lucide.dev/) geometry—the same family as the AMIRA
dashboard—for cross-product consistency, with **no icon webfont**. Interactive
icons are emitted as accessible inline SVG in templates; CSS pseudo-elements use
the
  `svg-icon($icon, $size, $color)` mixin (`abstracts/mixins/_mixins.scss`): a
  `mask-image` of an inline-SVG data-URI tinted with
  `background-color: currentColor`, so the glyph follows its host's colour token
  and its hover / disabled states exactly as a font glyph did. The sole external
  SVG is `arrow-down-blue.svg`, used by native select fields.

**No FontAwesome.** As of **v2.5.5** the theme stopped loading Omeka core's
`iconfonts.css` (and its ~77 KiB `fa-solid` webfont — ~91 KiB/page). The core
`o-icon-*` classes the theme still renders — pagination `prev`/`next`, media
`grid`/`list`, `search`, `private`/`annotation`
— are repainted with `svg-icon()` masks in `base/elements/_icons.scss`. To add a
glyph: drop a URL-encoded Lucide data-URI into `_mixins.scss` and apply
`svg-icon()`. With the webfont gone, any unstyled `o-icon-*` renders nothing
(an empty `::before`) rather than a “tofu” box.

---

## 8. Components

Most component partials consume the legacy `$color__*` Sass aliases, which are
**repointed at the semantic tokens** in `_colors.scss` — so the whole theme became
theme-aware in one move. Notable bespoke work:

- **Header** — sticky surface with a 3 px Uni-Grün top “flag” rule, quiet utility
  bar, the lockup with light/dark swap, and the sun/moon toggle. On the home page
  the lockup steps down from `<h1>` to a plain home link, because the hero banner
  there carries the site title as the page `<h1>` (one `<h1>` per page).
  **The menu never wraps**: at `$xl`+ `navigation.js` measures the menu's
  one-line width against the lockup→utilities envelope and sets
  `data-nav="inline|drawer"` on `.main-header` — a menu that wouldn't fit on
  one row (half-screen windows, long menus, large fonts) collapses to the
  hamburger/drawer instead of wrapping. Every desktop-menu rule is gated on
  `:not([data-nav="drawer"])`; without JS the old wrap is the fallback.
- **Masthead — the deep plate** — photography-free, and carried by type, rule
  and *ground*: a gold 3 px flag → eyebrow → display title (Spectral, capped at
  50 px) → lede at `--measure-narrow` → two text links, beside a **sunken
  catalogue column** listing what the archive holds. Two variants from one
  partial (`common/banner.phtml`): the full masthead on the home page, and a
  **slim strip** elsewhere that keeps the site title present site-wide (toggle:
  *Show banner on interior pages*). The old three-stop earth-tone wash remains
  available as an optional treatment (*Show the earth-tone wash*, off by
  default) but is no longer the page's only visual idea — it had to work behind
  both a tall hero and a slim strip, so it settled into a generic coloured header
  that carried no information.

  **The band does not follow `--surface`.** Under the pre-2.24 default it did,
  which put a 99.2 % L band on a 97.4 % L page: a 1.8 % step, so the masthead had
  no edge and read as empty space above the content. The band, the sunken column
  and the hairline are one authored triplet in *both* schemes, and gold is the
  single accent — the flag rule, the link arrows and the catalogue numerals,
  nothing else.

  The **catalogue column** answers what is *in* the archive rather than carrying
  a standing note: the same corpus counts that used to sit below the masthead,
  now as hairline rows of label + gold tabular numeral, each linking to its
  authority page. As an index it gives the visitor a way in; as a KPI strip it
  only kept score. The standing note (*Masthead note*) stacks beneath it.

  The masthead no longer carries its own search field above `$xl`, where the
  header's field fills the centre of tier 1 — two fields on one screen is one
  too many. Below `$xl` the header search collapses to a magnifier button, so
  the masthead renders a real field and the first screen always offers somewhere
  to type.

  Three **brand-presence** treatments are expressed purely through the
  `--masthead-*` / `--flag` / `--numeral` / `--cta-*` role tokens — *quiet*
  (stone ground, green on interactive only), *balanced* (the band follows the
  page surface, flags and CTA in Uni-Grün), *bold* (the deep plate — the
  default since 2.24) — so the choice is a token switch, not a rebuild.
  `lint:tokens` checks all three for AA. Home detection lives in
  `helper/IsHomePage.php` (route `site`, or `site/page` matching `homepage()`)
  because the page-title block needs the same answer. Copy comes from the
  **Banner** theme settings and falls back to the site title, so the masthead is
  meaningful out of the box.
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
- **Metadata record — grouped, not dumped** — properties are rendered in named
  groups, never in database order: **Abstract · Description · Subjects · People &
  roles · Origins & context · Rights & access · Identifiers & sources**, with a
  *Further details* bucket that catches any term the map does not name, so
  nothing is ever hidden (`helper/ResourceGroups.php`,
  `common/resource-values.phtml`). *People & roles* is its own group because the
  Research Items template can express **54 `marcrel:*` contributor roles**;
  folded into context they would swamp it, and the group is claimed by a
  vocabulary **prefix** rather than 54 enumerated terms so a role added upstream
  cannot silently demote an Author to "Further details". The intellectual
  content leads at a real reading measure; identifiers, IDs and URIs come last;
  `Subject` values are chips rather than a run of links. The label rail
  (`--label-col`, 12 rem) uses a 14 px sentence-case Hanken label — the previous
  10.625 rem rail of 13 px uppercase at `--ink-subtle` wrapped "Copyright Date" /
  "Access Rights" to two lines *and* was the theme's worst contrast case.

  Citation (with DOI, permalink, licence, access rights and a feature-detected
  *Copy citation*) lives in a sticky rail (`--rail-width`,
  `common/record-apparatus.phtml`), so a reader meets the apparatus without
  scrolling past it — a journal article with a DOI used to have no citation,
  licence or download affordance anywhere near the top. The rail is
  theme-provided but does not take the right region over: an admin's *Right
  sidebar* blocks render below it, and with neither present the rail is dropped
  and the record takes the full measure. The inner value markup is byte-identical
  to before (`.property` / `<dt>` / `<dd class="value …">`), because the
  uri-dereferencer, the annotation tooltips and the sibling modules select
  against it. Sidebar regions and the rail itself keep the stacked flow.
- **Buttons, links, fields** — token-driven, with proper `:focus-visible`
  rings. The filled-primary look is **opt-in via the `.button` class** (plus a
  few core form contexts the theme can't add a class to: search/login submits,
  the sort-selector and header-search buttons), *not* the bare `button`
  element. Styling every `<button>` leaked the green fill / shadow / hover-lift
  into embedded modules (DRE Search, DRE Visualizations), which then fought
  back with `!important` resets; scoping to a class lets each module own its
  controls and the theme request the primary look explicitly. The button
  **state** selectors are still wrapped in `:where()` (zero added specificity),
  so a module's own single-class styling beats the theme's
  hover/active/disabled treatment. The global `:focus-visible` rule still
  guarantees the focus ring everywhere.
- **Found-term highlight** — `mark` / `ins` carry the same translucent accent
  wash DRE Search paints on result matches (`color-mix(in oklab, var(--accent)
  28%, transparent)`), so "your term" reads identically in core search, faceted
  browse and the Svelte client.
- **Search empty state** — the sitewide no-results view is a quiet centred
  pause with a path onward (spelling/breadth/transliteration hints, advanced
  search carrying the query over, browse-all) instead of a one-line shrug
  (`view/omeka/site/index/search.phtml` + `components/search-results`).
- **Print** (`utilities/_print.scss`) — researchers print item records: chrome
  (header, footer band, controls, banner wash, Mirador) drops away, the light
  palette is re-applied over any dark state, the rem scale steps down to a
  bookish body, and external links spell out their URLs for citation.
- **Arrival** — the home hero's eyebrow → title → tagline → CTA rise onto the
  wash on a short stagger (`--ease-expo-out`, one-shot, CSS-only); the wash
  itself never moves. Entirely absent under `prefers-reduced-motion`.

### Mirador — the IIIF viewer

The item page's media region is the **[Mirador](https://github.com/Daniel-KM/Omeka-S-module-Mirador)**
block (Daniel-KM's module). The theme replaced **Universal Viewer** with it in
**v2.6.0**; four theme-side pieces make it fit the system:

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
   bare `<button>`s in the light DOM. The global `primary-button` used to style
   every `<button>` and leaked a green fill + lift + glow into the toolbar — the
   same leak the Universal Viewer override fixed. Now that the primary look is
   `.button`-scoped (see *Buttons, links, fields*), bare Mirador buttons no
   longer inherit it, so the leak is fixed at the source; the
   `.block-mirador`-scoped neutraliser remains as belt-and-suspenders against
   any future broad `button` rule.
4. **Card framing** (`components/blocks/mirador`, v2.26.0). Mirador draws its own
   chrome but no outer edge, so the media region bled into the page while every
   other region on the record page read as a bordered panel. The block takes the
   panel triplet (`--panel-border` / `--panel-radius` / `--panel-shadow`) plus
   `overflow: hidden` to clip the viewer's square corners. This is the one part
   of the viewer's look that *can't* live in the module config, because it is
   about the block's place in the page rather than the viewer's insides.

   > `overflow: hidden` is safe here, but not for the reason it looks like.
   > Mirador's menus are **not** portaled to `<body>` — they mount inside
   > `#mirador-<n>`, i.e. inside the block (verified on the live viewer, against
   > the usual MUI assumption). They survive the clip only because their
   > `.MuiPopover-root` is `position: fixed`, so its containing block is the
   > viewport. Tooltips *are* portaled out of the block, and native fullscreen
   > promotes the viewer to the top layer. **Therefore: never give this block or
   > any ancestor `transform`, `filter`, `perspective`, `backdrop-filter`,
   > `contain: paint/layout/strict/content`, or a `will-change` naming those** —
   > each makes the box a containing block for fixed descendants, and every menu
   > would be cut off at the viewer's edge. The existing `isolation: isolate` is
   > deliberately none of them. The framing is scoped away from the embed-fallback
   > branch (`.block-media-embed`), whose iframe carries its own radius.

**Branding lives in the module, not the theme.** Mirador's MUI themes can't read
`oklch()` / `color-mix()`, so — exactly like the chart libraries (§9) — the brand
palette is resolved to sRGB and pasted into the module's **site setting**
(*Site → Mirador → Mirador config*) as JSON. `mirador-theme.js` only switches
*which* theme is active, so this can be tuned without a rebuild.

Mode-independent settings live under `theme`; each mode's palette lives under
`themes.light` / `themes.dark`, which Mirador deep-merges over `theme` when
`mirador-theme.js` flips `selectedTheme`. The first pass (v2.6.0) set only the
two greens and the surface stack, which left four Material Design defaults
showing through — the config below closes all four:

| | Stock Mirador 4 | Here |
| --- | --- | --- |
| **Type** | no `typography.fontFamily` → MUI falls back to Roboto/Helvetica, inside a page set in Hanken Grotesk | Hanken Grotesk throughout; `h1`–`h4` in Spectral, the one place the display serif belongs (they carry the info panel's headings) |
| **Hairlines** | one `section_divider`, `rgba(0,0,0,.25)` — cold on cream, invisible on forest dark | all three border tiers: `--border-strong` for panel and thumbnail-rail edges, `--border` for toolbars, `--border-light` for metadata rows |
| **Overlays** | cyan / magenta / pure yellow, unchanged since 2019 | brand pigments, keeping the convention scholars read: Hellblau = *there is an annotation*, Gelb = *you are touching it*, Uni-Grün = *this is the current one* |
| **Panel steps** | light `shades.light` is `#ffffff` on a `#fdfcf9` paper — a 0.8% step, so companion-window toolbars read as empty space; dark aliases `background.default` to a different tier than light does | `shades` and `background` map the *same* tokens to the same keys in both modes (sunken / surface / background) |

Only `styleOverrides` whose Mirador default is a plain object are touched
(`MuiAppBar`, `CompanionWindowSection`); the callback-based ones take
`({ theme })` and would be *replaced* rather than merged, dropping the layout
rules they also carry. Those hairlines are handled in the theme's own
`.block-mirador` layer instead, where they read live tokens.

Paste into *Site → Mirador → Mirador config (item)*, replacing what is there:

```json
{
  "osdConfig": {
    "maxZoomPixelRatio": 10
  },
  "selectedTheme": "light",
  "window": { "allowFullscreen": true, "allowMaximize": false, "allowClose": false, "sideBarOpenByDefault": false },
  "workspaceControlPanel": { "enabled": false },

  "theme": {
    "typography": {
      "fontFamily": "\"Hanken Grotesk\", system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif",
      "h1": { "fontFamily": "Spectral, Georgia, serif", "fontWeight": 700, "letterSpacing": "-0.02em" },
      "h2": { "fontFamily": "Spectral, Georgia, serif", "fontWeight": 700, "letterSpacing": "-0.01em" },
      "h3": { "fontFamily": "Spectral, Georgia, serif", "fontWeight": 600, "letterSpacing": "0em" },
      "h4": { "fontFamily": "Spectral, Georgia, serif", "fontWeight": 600, "letterSpacing": "0em" },
      "subtitle1": { "fontWeight": 600, "letterSpacing": "0.01em" },
      "button": { "fontWeight": 600, "letterSpacing": "0.04em" },
      "overline": { "fontWeight": 600, "letterSpacing": "0.12em" }
    }
  },

  "themes": {
    "light": {
      "palette": {
        "mode": "light",
        "primary": { "main": "#007a50", "contrastText": "#fdfcf9" },
        "secondary": { "main": "#006440" },
        "shades": { "dark": "#f3f0eb", "main": "#fdfcf9", "light": "#f8f6f1" },
        "background": { "default": "#f8f6f1", "paper": "#fdfcf9" },
        "text": { "primary": "#3c342d", "secondary": "#5f5650", "disabled": "#716a66" },
        "divider": "#dbd7d1",
        "section_divider": "#bfbab3",
        "error": { "main": "#cc272e" },
        "notification": { "main": "#f59c08", "contrastText": "#f59c08" },
        "hitCounter": { "default": "#bfbab3" },
        "highlights": { "primary": "#ca7210", "secondary": "#44b8f2" },
        "action": {
          "hover": "rgba(0, 122, 80, 0.08)",
          "selected": "rgba(0, 122, 80, 0.12)",
          "focus": "rgba(0, 122, 80, 0.16)"
        },
        "annotations": {
          "chipBackground": "#f3f0eb",
          "hidden": { "globalAlpha": 0 },
          "default": { "strokeStyle": "#44b8f2", "globalAlpha": 1 },
          "hovered": { "strokeStyle": "#f59c08", "globalAlpha": 1 },
          "selected": { "strokeStyle": "#007a50", "globalAlpha": 1 }
        },
        "search": {
          "default": { "fillStyle": "#ca7210", "globalAlpha": 0.28 },
          "hovered": { "fillStyle": "#f59c08", "globalAlpha": 0.34 },
          "selected": { "fillStyle": "#cca352", "globalAlpha": 0.5 }
        }
      },
      "components": {
        "MuiAppBar": {
          "styleOverrides": {
            "colorDefault": { "backgroundColor": "#f3f0eb", "color": "#3c342d" }
          }
        },
        "CompanionWindowSection": {
          "styleOverrides": {
            "root": { "borderBlockEnd": "1px solid #eae8e3" }
          }
        }
      }
    },

    "dark": {
      "palette": {
        "mode": "dark",
        "primary": { "main": "#4da67b", "contrastText": "#05100b" },
        "secondary": { "main": "#74b794" },
        "shades": { "dark": "#080f0c", "main": "#0e1612", "light": "#151d19" },
        "background": { "default": "#080f0c", "paper": "#0e1612" },
        "text": { "primary": "#e3e1db", "secondary": "#b0aea7", "disabled": "#9c9891" },
        "divider": "#2c3531",
        "section_divider": "#49534e",
        "error": { "main": "#ff645f" },
        "notification": { "main": "#f59c08", "contrastText": "#f59c08" },
        "hitCounter": { "default": "#49534e" },
        "highlights": { "primary": "#db8a40", "secondary": "#44b8f2" },
        "action": {
          "hover": "rgba(77, 166, 123, 0.10)",
          "selected": "rgba(77, 166, 123, 0.16)",
          "focus": "rgba(77, 166, 123, 0.22)"
        },
        "annotations": {
          "chipBackground": "#1e2622",
          "hidden": { "globalAlpha": 0 },
          "default": { "strokeStyle": "#44b8f2", "globalAlpha": 1 },
          "hovered": { "strokeStyle": "#f59c08", "globalAlpha": 1 },
          "selected": { "strokeStyle": "#4da67b", "globalAlpha": 1 }
        },
        "search": {
          "default": { "fillStyle": "#db8a40", "globalAlpha": 0.28 },
          "hovered": { "fillStyle": "#f59c08", "globalAlpha": 0.34 },
          "selected": { "fillStyle": "#cca352", "globalAlpha": 0.5 }
        }
      },
      "components": {
        "MuiAppBar": {
          "styleOverrides": {
            "colorDefault": { "backgroundColor": "#151d19", "color": "#e3e1db" }
          }
        },
        "CompanionWindowSection": {
          "styleOverrides": {
            "root": { "borderBlockEnd": "1px solid #1e2622" }
          }
        }
      }
    }
  }
}
```

Every literal above is the sRGB resolution of a theme token — light `primary`
`#007a50` is `--primary`, `secondary` `#006440` is `--primary-text`, `divider`
`#dbd7d1` is `--border`, `section_divider` `#bfbab3` is `--border-strong`, and so
on through both modes. Re-derive them (rather than eyeballing) whenever
`_colors.scss` moves: `scripts/lib/contrast.mjs` already carries the OKLCH → sRGB
matrices these were computed with.

The one that is easy to get wrong is Braun. `--brand-braun` is `#d57912`, but the
token the search wash must match is `--accent`, which is
`color-mix(in oklab, var(--accent-base), black 4%)` = **`#ca7210`** in light and
`…, white 12%` = `#db8a40` in dark. Since `--highlight-bg` is `--accent` at 28%,
`search.default` at `globalAlpha 0.28` is then byte-identical to the `<mark>` the
site shares with DRE Search — a hit looks the same in the viewer and in search
results. Light shipped the raw pigment until v2.26.0; reach for `--accent`, never
`--brand-braun`, for anything that has to agree with `<mark>`.

> The Mirador config field is **JSON, not JS** — double quotes, no comments, no
> trailing commas.

### Where this config actually lives

Not where you would guess, and the distinction has cost a debugging round trip:

- **Global** — *Admin → Settings → Players → Mirador config (item)*
  (`/admin/setting`, setting key `mirador_config_item`).
- **Per site** — *Admin → Sites → [site] → Settings tab*
  (`/admin/site/s/<slug>`, same key). **The site value wins**; editing only the
  global one changes nothing on a site that has its own.

Keep both in step — the global copy is the fallback for any site that doesn't
override, and letting them drift is how this section went stale in the first
place. The unsuffixed key is Mirador **4**; `mirador_config_item_2` / `_3` are
the v2 / v3 fields and are unused here.

`mirador_config_collection` (the item-set viewer) is a **separate field** still
holding the pre-v2.26 config. It was left alone deliberately: the colour fix
applies equally, but the `window` / `workspaceControlPanel` lockdown below does
*not* — closing and rearranging windows is the point of a multi-item view.

### The single-item lockdown

`window` and `workspaceControlPanel` are what make a general-purpose IIIF
workbench behave as an embedded record-page viewer:

- `workspaceControlPanel.enabled: false` — drops *Add resource*, *Jump to
  window*, *Workspace settings*, *Workspace options*.
- `allowMaximize: false`, `allowClose: false` — a record page hosts exactly one
  window, and closing it left an empty workspace recoverable only by reload.
  **`allowClose` is the load-bearing one**: `allowMaximize: false` alone leaves
  the Close button in place, which is the actual trap.
- `allowFullscreen: true`, `sideBarOpenByDefault: false` — deep-zoom stays
  reachable; the info panel opens on request rather than eating the canvas.

Verified on the deployed viewer: with these set, the window bar carries only
*Toggle sidebar*, *Window views & thumbnail display* and *Full screen*.

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
- **Stock-theme furniture inherited from Lively** — the green `border-bottom`
  under every `.regions-container`, its 50 px gaps and `-30px` sidebar offsets,
  and the asymmetric `#content` search padding (`3rem 10rem 4rem 4rem` inside a
  1160 px box) → hairline `--border`, spacing from the scale, geometry from
  `--container-*` / `--measure-*`.
- **The flat metadata dump** — one `<dl>` of every property in database order,
  with administrative identifiers weighted like authorship → grouped record
  (Components above).
- **Duplicate `<h1>`s** — the live home page rendered the banner title *and* the
  page title ("Home") as two `<h1>`s. The page-title block now stands down
  wherever the masthead already states the page's title.
- **Eleven bordered, shadowed, hover-lifting stat cards** under the hero — a lot
  of chrome for eleven numbers, competing with the hero it was meant to ground →
  a hairline strip of tabular numerals (v2.22), then the **catalogue column**
  beside the headline (v2.24), where the same figures read as an index rather
  than a scoreboard. (The shared `.rv-stat-card` look is still right *inside* a
  dashboard.)

---

## 9. The module ecosystem — Search & Visualizations

The theme is not consumed in isolation. Two sibling Omeka S **modules**, developed
alongside it, render their own UI into theme pages and are styled to be
indistinguishable from the theme itself:

| Module | Role | How it attaches | Where it is styled |
|---|---|---|---|
| **[DRE Search](https://github.com/AM-Digital-Research-Environment/DRESearch)** | Typesense-backed faceted search (a Svelte 5 client) | site block layouts (`Research*SearchBlock`), a header search-bar view helper, and a federated results route (`/s/{slug}/dre-search`) | server shell in `asset/css/dre-search.css`; component styles compiled into `asset/dist/dre-search.css` |
| **[DRE Visualizations](https://github.com/AM-Digital-Research-Environment/DRE-Visualizations)** | ECharts + MapLibre dashboards, charts, maps and a knowledge graph | block layouts (collection / compare / explorer / photo-browse / what's-new…) and resource-page blocks (knowledge graph, item-set dashboard, sibling sparkline…) | one stylesheet, `asset/css/dre-visualizations.css`, plus per-chart JS under `asset/js/` |

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
| Type | `--font-display` `--font-body` · `--text-2xs … --text-2xl` · `--leading-tight/-snug/-normal/-relaxed` · `--measure-wide` |
| Layout | `--space-*` `--radius-sm/-md/-lg/-full` `--size-control-md/-lg` `--z-dropdown` · `--container-max` `--container-gutter` `--header-height` `--scroll-offset` `--rail-width` `--label-col` |
| Highlight | `--highlight-bg` (was `--dre-hl-bg`; deprecated compatibility alias retained) |
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
  and MapLibre don't parse `oklch()` / `color-mix()`, so DRE Visualizations
  resolves each token to a plain `rgb()` at runtime — a hidden probe + 1×1 canvas
  (`cssColor()` / `readTheme()` in `dashboard-core.js`) — and re-resolves on every
  `[data-theme]` flip. **Never hand a raw `oklch` token to a canvas/WebGL lib;**
  route it through that bridge (or through a `--rv-*` alias it has already
  resolved). This is why the modules can follow the live toggle even though the
  tokens are in a colour space the chart libraries reject.
- **Keep the palette and the tokens identical.** **Stops 1–6 are the `--brand-*`
  pigments and must stay in sync; stops 7–12 are an independent harmonious
  extension.** The palette needs those twelve stops and a dark-lifted variant the
  tokens don't carry, so the module hard-codes the hex values — meaning stops 1–6
  **duplicate** `--brand-*`. They are one brand: when a `--brand-*` value changes,
  change the module palette in the same commit (and vice-versa). A drift between
  them is the data-side of the "competing design variables" failure. (The module
  README states this same split verbatim.)
- **Community halos have their own family.** In the knowledge graph a ring
  encodes *community* while the fill encodes *entity type*, so the halo palette
  (`ns.HALO`, beside the categorical palette in `dashboard-core.js`) is
  deliberately distinct from the fills but stays in the brand's warm pigment
  world: deep pigment-pot tones on light, lifted luminous tones on dark,
  swapped in place by `readTheme()` on every toggle.
- **Type crosses the bridge too.** `cssFont()` resolves `--font-body` /
  `--font-display` the same way `cssColor()` resolves colours, so in-canvas
  chart text (axes, legends, tooltips) is Hanken Grotesk and the rare in-canvas
  title is Spectral — no more library-default sans.

### Rules for keeping the modules in sync

1. **Consume tokens by their exact name; never redefine one.** A module must not
   set `--primary`, `--surface`, … to a *different value* — that is the
   "competing design variables" failure. Read them, don't override them.
2. **Alias into a local namespace if you need to.** DRE Visualizations maps
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
7. **A renamed token ships with an alias.** The theme keeps the old name as
   `var(--new-name)` for at least one minor release and records the change in the
   breaking-change register (`AUDIT.md` §4) and the changelog. Modules update at
   their own pace; nothing silently loses its colour. `--dre-hl-bg` →
   `--highlight-bg` is the worked example: DRE Search now reads
   `var(--highlight-bg, var(--dre-hl-bg, <literal>))`, which is correct against
   both theme versions.
8. **If a module reaches for a token the theme lacks, add it to the theme.**
   DRE Visualizations' bridge carried `var(--text-2xs, 0.6875rem)` with a note
   that it would adopt a theme token "if one is ever added" — a hole in a shared
   scale is something two projects can drift apart in. `--text-2xs` is now a theme
   token.

> Each module also states this contract at the top of its own stylesheet
> (DRE Visualizations’ CSS header; DRE Search’s `dre-search.css`). This
> section is the canonical, theme-side reference; keep them consistent.

---

## 10. Build

```bash
npm install
npm run build        # token-contract lint, then gulp css → asset/css/style.css
npm run watch        # rebuild on change
npm run lint:tokens  # design-token contract check alone (scripts/check-design-tokens.mjs)
```

`lint:tokens` encodes the §8 anti-patterns (raw hex outside `var()` fallback
position, coloured side-stripes, gradient text, px type) and fails the build
on a regression; its allowlist records the sanctioned exceptions. Since v2.22 it
also asserts the properties this document *claims*, rather than restating them:

| Check | What it enforces |
|---|---|
| Contrast | Computed WCAG ratio for every ink/surface pair, per mode, plus the footer band and both brand-presence *bold* grounds — parsed straight out of the OKLCH literals in `_colors.scss` (`scripts/lib/contrast.mjs`) |
| One type scale | No surviving `$font__h1-sm-size … $font__h6-base-size` reference; headings resolve from `--text-*` |
| Layout tokens | No off-grid px page geometry in the layout partials (hairlines ≤ 3 px excepted, `@media` breakpoints exempt) |

`lint:ini` walks the tree in Node rather than shelling out to `grep`: the old
`execSync('grep …')` returned an empty string on any platform without grep — i.e.
Windows, i.e. `npm run build` — and "nothing is read anywhere" made the check
report *every* admin field as dead. A lint that fails open on one OS and closed
on another is worse than no lint.

### Verifying the PHP

The theme is developed without a local PHP binary, which is why
`lint:templates` counts brackets instead of parsing. That is a net for a
truncated file; it cannot see a mistyped `::`, and a broken template fails at
request time, in production, on the one page that renders it. Three layers now
close that gap:

| Layer | Needs PHP? | Catches |
|---|---|---|
| `lint:templates` | no | truncation, tag/bracket imbalance, unresolved `partial()` paths, helper-casing drift |
| `lint:groups` | no | a metadata property that falls through to “Further details”, or lands in the wrong group |
| `lint:php` → `php -l` + `tests/*Test.php` | yes | real grammar errors; and the grouping **logic** (exact-beats-prefix, ordering, losslessness) |

`lint:php` finds a PHP on `PATH`, else a pulled `php:8.3-cli` image, else prints
install instructions and **exits 0** — a contributor without PHP is not blocked.
CI (`.github/workflows/ci.yml`) runs `lint:php:require` across PHP 8.1 / 8.3 /
8.4, so the gate is hard exactly where it can always run. 8.1 is the floor Omeka
S 4.2 declares; 8.4 is where implicit-nullable parameters became a deprecation.

**Syntax is not correctness**, and the metadata map is the proof. It was first
written from the field names visible in the `MongoDB2OmekaS` mapper source, and
every file parsed — but the *Research Items* template carries **54 `marcrel:*`
contributor roles the mapper generates rather than spells out**, so `marcrel:aut`
(the Author) was unmapped and would have rendered last, under the administrative
identifiers. That is the precise failure the record redesign exists to fix. No
syntax check would ever have found it; `lint:groups` finds it in 40 ms, because
it asserts the map against the **real** template
(`tests/fixtures/research-items-template.json`, refreshed with
`npm run fixtures:refresh`) rather than against a second copy of the developer's
assumptions. Hence the prefix rules in `helper/ResourceGroups.php`: a map that
enumerates 54 roles is one upstream role away from the same bug.

Toolchain (latest as of build): **gulp 5**, **dart-sass 1.100**, **gulp-sass 6**,
**gulp-postcss 10**, **autoprefixer 10.5**. Browser targets in
`package.json › browserslist`: modern evergreen + **Safari/iOS ≥ 16.2**. That
floor is deliberate, not conservative — the single-seed engine is built on
`color-mix()` (Safari 16.2+) and `oklch()` (15.4+), neither of which autoprefixer
can polyfill, so the support promise must match what the CSS actually needs
(raised from ≥ 14 in v2.14.0).

### SCSS architecture

```
abstracts/variables/_tokens.scss      ← spacing, LAYOUT, radii, rhythm, shadows, motion, z-index
abstracts/variables/_colors.scss      ← OKLCH brand palette, light/dark, masthead roles, $color__* aliases
abstracts/variables/_typography.scss  ← Spectral + Hanken, the one type scale, $font__* aliases
abstracts/mixins/_mixins.scss         ← buttons, container, clearfix
base/ … components/ … utilities/      ← consume the tokens above
```

> `abstracts/variables/_layout.scss` was removed in v2.22. It held the last two
> pieces of page geometry CSS could not read (`$header-min-height: 74px`,
> `$wrap-max-width: 1300px`) while the container mixin said 1440 px and the
> search page hard-coded 1160 px — three container widths, none of them a token.
> They are now `--header-height` and `--container-max`.

> **Module system:** the partials use Dart Sass `@use`/`@forward` (migrated from
> the deprecated `@import` in v2.14.0). `abstracts/_index.scss` `@forward`s the
> variables + mixins; each leaf partial starts with `@use "…/abstracts" as *;` for
> the token + mixin contract; the section aggregators (`base/_base.scss`,
> `components/_components.scss`, …) `@forward` their leaves. The CSS file header is
> prepended **post-compile** by gulp (`prependHeader()` in `gulpfile.js`), not
> emitted from `style.scss`: a loud `/* */` comment immediately before
> `@use "abstracts"` is re-emitted by Dart Sass at every one of the ~50 files that
> load the abstracts module, so the header is kept out of the Sass graph.

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
