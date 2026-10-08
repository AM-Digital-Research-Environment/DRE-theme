# DRE Design Integration Contract

This document defines how DRE-theme, DRE Search, and DRE Visualizations render
as one interface. `DESIGN.md` is the portable visual authority. This file owns
the engineering contract that crosses repository boundaries.

## Repositories and ownership

| Repository | UI responsibility | Integration points |
| --- | --- | --- |
| [DRE-theme](https://github.com/AM-Digital-Research-Environment/DRE-theme) | Global layout, header, navigation, masthead, footer, Omeka browse and record views, semantic tokens, theme switching, Mirador framing | CSS custom properties, `window.DRETokens`, theme partials, guarded module view helpers |
| [DRE Search](https://github.com/AM-Digital-Research-Environment/DRESearch) | Federated autocomplete and results, corpus-specific search blocks, facets, cards, sorting, paging, gallery and optional map views | `dreSearchAssets`, `dreSearchBar`, `/s/{slug}/dre-search`, theme token consumption |
| [DRE Visualizations](https://github.com/AM-Digital-Research-Environment/DRE-Visualizations) | ECharts dashboards, MapLibre maps and networks, d3-force knowledge graphs, comparison and explorer blocks | Omeka page blocks and resource-page blocks, `window.DRETokens`, theme token consumption |

The theme owns the visual API. Modules may alias its properties into a local
namespace, but they do not redefine the meaning of a theme token. When a module
needs a missing shared role, add it to the theme and consume it after release.

## Shared CSS token API

The source files are under `asset/sass/abstracts/variables/`. Renaming a token in
this table is a cross-repository breaking change.

| Family | Stable tokens |
| --- | --- |
| Brand and action | `--primary-base`, `--primary`, `--primary-hover`, `--primary-active`, `--primary-muted`, `--primary-text`, `--primary-contrast`, `--accent`, `--accent-hover`, `--accent-muted`, `--accent-text` |
| Text | `--ink-strong`, `--ink`, `--ink-light`, `--ink-subtle`, `--muted`, `--ink-on-pastel` |
| Surfaces | `--background`, `--surface`, `--surface-raised`, `--surface-sunken`, `--surface-overlay`, `--panel-bg`, `--panel-border`, `--panel-radius`, `--panel-shadow` |
| Lines and focus | `--border-light`, `--border`, `--border-strong`, `--field-border`, `--focus-color`, `--focus-ring`, `--ring-focus`, `--selection-bg` |
| Status | `--success`, `--success-bg`, `--warning`, `--warning-bg`, `--error`, `--error-bg`, `--info`, `--info-bg` |
| Typography | `--font-display`, `--font-body`, `--font-mono`, `--text-2xs` through `--text-4xl`, `--leading-tight`, `--leading-snug`, `--leading-normal`, `--leading-relaxed` |
| Spacing and geometry | `--space-1` through `--space-24`, semantic `--space-*` aliases, `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl`, `--radius-full`, `--size-control-sm` through `--size-control-xl` |
| Layout | `--container-max`, `--container-gutter`, `--header-height`, `--scroll-offset`, `--rail-width`, `--label-col`, `--measure-narrow`, `--measure-base`, `--measure-wide` |
| Motion and depth | `--transition-fast`, `--transition-base`, `--transition-slow`, `--ease-out-quart`, `--ease-expo-out`, `--shadow-xs` through `--shadow-xl`, `--glow-sm`, `--lift-xs` |
| Stacking | `--z-banner`, `--z-dropdown`, `--z-sticky`, `--z-header`, `--z-drawer`, `--z-stage`, `--z-modal`, `--z-tooltip` |
| Found terms | `--highlight-bg`; `--dre-hl-bg` remains a deprecated compatibility alias |
| Fixed brand pigments | `--brand-green`, `--brand-braun`, `--brand-gelb`, `--brand-dunkelblau`, `--brand-hellblau`, `--brand-gold` |
| Entity meaning | `--entity-person`, `--entity-project`, `--entity-organisation`, `--entity-subject`, `--entity-location`, `--entity-genre`, `--entity-language`, `--entity-contributor`, `--entity-item`, `--entity-item-related`, `--entity-item-shared`, `--entity-grouping`, `--type-entity-term` |

Local component stacking is not part of the global scale. Small integers remain
appropriate for siblings inside a component that already establishes a stacking
context. The named scale is for page-level layers. A fullscreen visualization
uses `--z-stage`, above the drawer and below dialogs and tooltips.

## Theme-mode contract

The theme resolves the active mode before first paint and always writes
`data-theme="light"` or `data-theme="dark"` to both `<html>` and `<body>`.
Modules must use that resolved mode.

| Need | Correct implementation |
| --- | --- |
| A color or surface that changes by mode | Read the semantic token; it already resolves correctly. |
| A dark-only CSS branch | `:root[data-theme="dark"]` or `body[data-theme="dark"]`; in Svelte, use an appropriate `:global(...)` selector. |
| The current mode in JavaScript | `window.DRETokens.isDark()` |
| A callback after a mode change | `window.DRETokens.onThemeChange(callback)` |

Do not use `matchMedia('(prefers-color-scheme: dark)')` to determine the active
theme. The visitor may have selected a mode that differs from the operating
system. `prefers-reduced-motion` remains a valid accessibility preference and
must be honoured independently.

## JavaScript token bridge

`asset/js/dre-token-bridge.js` exposes `window.DRETokens` on every themed page.
It exists for canvas, SVG attributes, ECharts, and MapLibre, where raw CSS
custom properties or OKLCH values cannot always be passed directly.

| Call | Purpose |
| --- | --- |
| `DRETokens.cssColor('--primary')` | Resolve the live CSS color to `rgb()` or `rgba()`. |
| `DRETokens.cssFont('--font-body')` | Resolve the active font stack. |
| `DRETokens.cssValue('--space-4')` | Read an arbitrary computed token. |
| `DRETokens.toRGB(value)` | Convert a browser-parseable color to sRGB. |
| `DRETokens.isDark()` | Read the resolved theme mode. |
| `DRETokens.onThemeChange(callback)` | Subscribe to mode changes and receive an unsubscribe function. |

A canvas or WebGL component that resolves colors once must subscribe and repaint
after a theme change. A page should never mix freshly themed HTML controls with
a canvas frozen in its initial palette.

## Generated fallbacks

`npm run build:tokens` writes two committed artifacts:

- `asset/css/dre-tokens-fallback.css` for CSS consumers;
- `asset/css/dre-tokens-fallback.json` for JavaScript and configuration code.

A module has two supported approaches:

1. Load the fallback stylesheet before its own CSS and use bare
   `var(--token-name)` calls.
2. Keep inline `var(--token-name, literal)` fallbacks and copy every literal from
   the generated JSON table.

The token lint checks that generated outputs and inline fallbacks remain current.
Do not type a visually similar fallback by eye. Fallbacks are most likely to
drift precisely because they are invisible when DRE-theme is present.

## Typography, layout, and responsive behavior

Modules consume the theme's type, line-height, spacing, radius, measure, control,
and stacking scales. They do not create equivalent private scales.

The viewport breakpoint ladder is:

```text
600px · 768px · 1024px · 1200px · 1460px
```

Prefer container queries for a block whose layout depends only on its own width.
This is especially important inside Omeka page grids, rails, and nested block
groups, where the component width may differ substantially from the viewport.

The theme header has an additional runtime fit check: its navigation switches
between inline and drawer modes according to rendered width. Module content must
not assume that a desktop viewport always implies inline navigation.

## Data-color contract

Data color encodes meaning and therefore has rules distinct from UI chrome.

- The first six categorical colors are the six Africa Multiple brand pigments.
- DRE Visualizations may extend the palette for higher-cardinality charts, but
  the first six stops and their dark-lifted counterparts remain aligned with the
  theme.
- Entity types use the named `--entity-*` family so a type keeps one hue across
  search, charts, maps, and networks.
- Community halos are intentionally distinct from entity fills because they
  encode a different variable. They remain within the warm pigment world and
  provide separate light and dark sets.
- Map label halos and lightbox overlays may use fixed black or white where the
  underlying third-party map or user image is unpredictable. Keep these
  exceptions local and documented.
- Never give ECharts or MapLibre an unresolved `oklch()` or `color-mix()` value.
  Resolve it through `window.DRETokens` and repaint on mode change.

When a brand pigment changes, update the visualization palette and its contract
tests in the same coordinated release.

## CSS ownership and specificity

Theme styles establish the baseline for native Omeka markup. Module components
own their internal selectors and must be able to override the theme with one
semantic class rather than `!important` shields.

- Avoid high-specificity global rules for `button`, inputs, links, and native
  disclosures.
- Use module namespaces such as `dre-*` and `rv-*` for internal component rules.
- A module may alias a theme token to its namespace on `body`, where the alias
  resolves against the active mode. It must not assign a different value to the
  original theme token.
- Keep native states visible: `:hover`, `:focus-visible`, `:active`, disabled,
  loading, empty, and error.
- Do not style generated Svelte scope classes or unstable library internals as a
  long-term integration surface.

## Touch-target contract

High-frequency actions use `--size-control-lg` (2.75rem, 44px at the root
size), including global chrome, primary search controls, paging, and native map
navigation. Keep the icon visually quiet inside the larger interactive box.

- Prefer a real 44px `width`, `height`, `min-width`, or `min-height` so pointer,
  focus, and visual geometry agree.
- A centred pseudo-element may extend a compact icon toolbar only on coarse
  pointers, only when adjacent hit areas cannot overlap, and only when the
  element retains its visible keyboard focus treatment.
- Dense, repeated controls such as thirteen corpus tabs may use the WCAG 2.2
  spacing exception when 44px boxes would make the surface harder to scan.
  Record the exception beside the component and preserve adequate separation.
- Enlarging an absolutely positioned close control must also reserve content
  space so the action never obscures text.
- Pin shared-size claims in the owning repository and confirm deployed geometry
  on a representative narrow route before closing the implementation issue.

## Semantic embedding contract

The outer Omeka page remains the document. An embedded application may own an
internal landmark and heading hierarchy only when the integration boundary has
a stable, descriptive accessible name.

- Mirador is wrapped in a translated, named `role="application"` boundary. Its
  React-owned `main` and H1 remain untouched inside that scope.
- A visualization heading contains title text only. Related actions live in a
  named sibling `role="toolbar"`; icon-only controls also have their own names.
- An asynchronous visualization keeps one persistent `role="status"` node with
  `aria-live="polite"` and `aria-atomic="true"`. Set `aria-busy="true"` on its
  stable container only while work is active, clear it for every terminal
  outcome, and announce ready, empty, and unavailable states without moving
  focus.
- Do not repair module semantics by moving or relabelling library-owned DOM
  after mount. Change the owning module or establish a standards-based outer
  boundary, then pin the contract in that repository's tests.

## Shared interaction contract

The token API keeps the three repositories the same colour; this section keeps
them the same *product*. Each rule names one behaviour that a visitor meets in
more than one repository, so it must not be implemented two ways.

### Focus and forced colours

- A focus ring drawn with `box-shadow: var(--ring-focus)` is always paired with
  `outline: 2px solid transparent`, never `outline: none`. Forced-colors mode
  (Windows High Contrast) drops box-shadows and paints the transparent outline
  in the system focus colour; `outline: none` leaves no focus indicator at all.
- A control that uses an outline instead takes `2px solid var(--focus-color)`
  with `outline-offset: 2px`, as the theme's buttons do.
- A CSS-mask icon (`mask: url(...)` over `background-color: currentColor`)
  needs the theme's forced-colors rule: `forced-color-adjust: none;
  background-color: CanvasText`, upgraded to `preserve-parent-color` +
  `currentColor` where supported (`_mixins.scss`, `%svg-icon-forced`).

### Form controls and buttons

| Part | Rule |
| --- | --- |
| Input, select, search field outline | `1px solid var(--field-border)`; `--border*` are separators, not control boundaries |
| Input and standard-control radius | `--radius-md`; `--radius-sm` only for small inline controls, never for a text field |
| Control height | `--size-control-lg` for primary, paging, and map controls; `--size-control-sm`/`-md` for dense toolbars. No literal rem heights |
| Primary button | `--primary` fill, `--primary-contrast` text |
| Secondary button | transparent ground, `1px solid var(--border-strong)`, `--primary-text`; hover `--primary-muted` + `--primary` border (theme `secondary-button` mixin) |
| Checkbox and radio | native, `accent-color: var(--primary)` |
| Chip, tag, pill | `--radius-full`, label typography (`--text-xs`, weight 600); entity-typed chips take their `--entity-*` hue |
| Card thumbnail | beside the text only when the card itself is at least 28rem wide (container query; a card with inline padding queries its content box accordingly); a small avatar or emblem beside a name may stay inline at every width |
| Letter-spacing | `--tracking-*` tokens only |

### Asynchronous states

Every asynchronous surface (a visualization block, a search result list, a map)
goes through the same states, with the same markup and wording.

| State | Markup | Visible text |
| --- | --- | --- |
| Loading | one persistent `role="status"` node (`aria-live="polite"`, `aria-atomic="true"`) per surface; `aria-busy="true"` on the stable container while work is active; skeleton or spinner is `aria-hidden` | *Loading…* — announced by the status node; shown beside a spinner, or replaced visually by a skeleton that has the shape of the result |
| Empty | status node carries the message | surface-specific, e.g. *No records match that search.* |
| Error | message plus a **Try again** button that reruns the request; technical detail (HTTP status, request id, server message) goes to `console`, never to the visitor | surface-specific, e.g. *The map could not be loaded.* |
| Unavailable | quiet message, no retry | *Search is temporarily unavailable.* |
| No JavaScript | `<noscript>` inside the reserved space | *This visualization needs JavaScript.* |

A skeleton shimmer draws its highlight from `--surface`, not `white`, runs
`1.6s ease-in-out infinite`, and stops under `prefers-reduced-motion: reduce`.

### Shared widgets

- **Tabs.** WAI-ARIA tabs with roving `tabindex`; the panel is named by
  `aria-labelledby` pointing at its tab. Activation is *automatic* (arrow keys
  select) when switching is local and instant, and *manual* (arrow keys move
  focus, Enter/Space select) when it costs a network request. Record which one
  a component uses beside it.
- **Disclosure popovers** (`<details>` menus such as cite, export, share): Escape
  closes the open popover and returns focus to its `<summary>`; a click outside
  closes it without moving focus.
- **Copy feedback.** Swap the button label to *Copied* for 2000 ms and announce
  it through `window.DREUtils.announce()` (or `DREUtils.flashLabel()`). When the
  theme is absent, announce through the surface's existing status node rather
  than adding a second one.
- **Fullscreen.** One icon button per surface, `aria-pressed` reflecting state,
  label swapping between *Fullscreen* and *Exit fullscreen*; the fullscreen
  layer sits at `--z-stage`.
- **Headings.** A page block's title is `h2`; a chart, panel, or result-list
  heading inside it is `h3`. A block rendered without a title of its own may
  promote its inner headings to `h2`.

### Theme JavaScript API

`window.DREUtils` is public alongside `window.DRETokens`; modules call it when
present and keep a local fallback for isolated rendering.

| Call | Purpose |
| --- | --- |
| `DREUtils.announce(message)` | Speak a short message through the one shared, visually hidden status region |
| `DREUtils.flashLabel(button, message, ms = 2000)` | Temporary label swap plus announcement (copy feedback) |
| `DREUtils.debounce(fn, ms)` | Trailing-edge debounce |
| `DREUtils.onReady(fn)` | Run after DOM parse |

### Maps

- `window.RV_MAP_CONFIG` is the one basemap configuration shared by both
  modules. `lightStyle` and `darkStyle` are either a non-empty URL or absent;
  consumers still read them with `||`, never `??`, so an empty string can never
  become a style URL. DRE Visualizations writes its self-hosted default there,
  so a DRE Search map on the same page uses the same basemap.
- Every MapLibre map passes `locale` built from the module's translated strings
  (zoom, compass, fullscreen, attribution, and cooperative-gesture hints) and
  uses one navigation-control preset: `{ showCompass: false }`.

### Numbers and locale

Client-side `Intl` formatting takes its locale from `document.documentElement.lang`
and falls back to `'en'` — the same locale the server used for the page — never
from `navigator.language`. Server-side counts use `NumberFormatter` with the site
locale. Counts, years, and paging use tabular numerals.

### Print

A module surface prints its content and hides its own controls (facets,
toolbars, map and chart controls) with its own print rules; the theme no longer
hides whole module blocks. The theme's print sheet hides every `<button>`,
`.button`, and form control, so a button whose label *is* content (a chip naming
a project or role) carries `data-print` to stay visible, and a label that names
what printed (the active corpus tab) is repeated as plain text.

### Wording glossary

Use these strings verbatim in every repository; translations key on them.

| Concept | String |
| --- | --- |
| Loading | Loading… |
| Retry | Try again |
| Clear every active filter | Clear all filters |
| No result for a query | No records match that search. |
| Search service down | Search is temporarily unavailable. |
| Map failed | The map could not be loaded. |
| Chart failed | The visualization could not be loaded. |
| Copy confirmation | Copied |
| Enter / leave fullscreen | Fullscreen / Exit fullscreen |
| Layout switch label | View as |
| Layout options | Grid · List · Map |
| Download data | Download data (CSV) |
| No JavaScript | This visualization needs JavaScript. |

## Degraded and isolated rendering

The integrated site is the primary product, but each repository must remain
understandable in isolation.

- DRE Search displays a quiet unavailable state when Typesense is not configured.
- A module preview that lacks DRE-theme loads the generated fallback layer.
- Visualization blocks reserve space and expose a translated no-JavaScript or
  unavailable message when their runtime cannot start.
- Canvas and WebGL information that matters to comprehension requires a textual,
  tabular, or link-based alternative.
- Theme templates guard optional module helpers with the Omeka helper plugin
  manager and preserve a functional fallback where one exists.

## Coordinated change procedure

### Additive token change

1. Add the token to the theme in every applicable mode.
2. Add contrast or structural checks when the token carries a testable claim.
3. Regenerate and commit the fallback CSS and JSON, then copy them and the
   shared lint rules into both modules with `npm run vendor:lint` and commit
   there too. The `Contract drift` workflow fails while a module copy is stale.
4. Update `DESIGN.md`, this contract, and `.impeccable/design.json` when the
   change affects portable design guidance.
5. Release the theme before updating module consumers.

### Rename or removal

1. Add the new token and keep the previous name as `var(--new-name)` for at
   least one compatible release.
2. Record the old name, new name, affected repositories, mitigation, and planned
   removal in the breaking-change register (`docs/history/AUDIT.md` §4) and
   under `[Unreleased]` in `CHANGELOG.md`.
3. Update DRE Search and DRE Visualizations independently.
4. Verify all representative live surfaces after the deployed versions align.
5. Remove the alias only in an explicitly coordinated breaking release.

### Module needs a missing role

Open an issue in DRE-theme. Agree on a semantic, reusable name rather than a
module-prefixed implementation detail. Add the token to the theme and generated
fallbacks, then consume it from the module.

## Validation matrix

Every cross-repository visual change should cover:

- light and dark modes;
- desktop, 390px mobile, and the intermediate width where navigation collapses;
- keyboard focus and 200% text zoom;
- the home page, a browse grid, an item record, federated search, and at least
  one visualization surface affected by the change;
- loading, empty, error, unavailable, and long-content states where relevant;
- the deployed asset versions, recorded before interpreting a production result.

The detailed route inventory, browser-injection protocol, Impeccable command
sequence, and phased work programme are in
[`history/IMPECCABLE-ROADMAP.md`](history/IMPECCABLE-ROADMAP.md).
