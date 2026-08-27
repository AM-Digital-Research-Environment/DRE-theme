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
| Lines and focus | `--border-light`, `--border`, `--border-strong`, `--focus-color`, `--focus-ring`, `--ring-focus`, `--selection-bg` |
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
3. Regenerate and commit the fallback CSS and JSON.
4. Update `DESIGN.md`, this contract, and `.impeccable/design.json` when the
   change affects portable design guidance.
5. Release the theme before updating module consumers.

### Rename or removal

1. Add the new token and keep the previous name as `var(--new-name)` for at
   least one compatible release.
2. Record the old name, new name, affected repositories, mitigation, and planned
   removal in `AUDIT.md` and the changelog.
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
[`IMPECCABLE-ROADMAP.md`](IMPECCABLE-ROADMAP.md).
