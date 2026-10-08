# Changelog

All notable changes to the DRE theme are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the theme uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Release workflow: add entries under **[Unreleased]** as you work. `npm version
<major|minor|patch>` moves them into a dated section for the new version, and
the release workflow uses that section as the notes of any GitHub release it has
to create.

## [Unreleased]

<!-- Summarise user-visible changes here (Added / Changed / Fixed / Removed / Security). -->

### Added

- **Shared interaction contract:** `docs/DESIGN-INTEGRATION.md` now states the
  behaviour the theme, DRE Search and DRE Visualizations must implement the
  same way. It covers:
  - focus rings that survive forced-colors mode;
  - form-control outline, radius and height;
  - the loading, empty, error, unavailable and no-JavaScript states;
  - tabs, disclosure popovers, copy feedback, fullscreen and heading levels;
  - `window.DREUtils` as a public API;
  - the shared basemap configuration and MapLibre locale;
  - the number locale and print;
  - a wording glossary.
- **The theme tested with its modules:** `tests/local/modules.spec.mjs` mounts
  DRE Search's and DRE Visualizations' built front-ends inside the
  PHP-rendered theme chrome. It covers:
  - the heading outline and overflow;
  - the theme toggle reaching each module;
  - axe in both modes;
  - field outlines and forced-colors focus;
  - search interactions and their states;
  - print;
  - the chart data tables.

  The `module-integration` CI job checks the three repositories out side by
  side to run it. Locally it skips when the siblings are absent.
- **Contract drift workflow:** checks out both modules and fails when their
  copies of the token lint or the generated token table fall behind the theme.
  It runs on changes to those files, weekly, and on demand.
- **Tamper check for the vendored copies:** `npm run vendor:lint` also writes
  `scripts/lib/VENDORED.sha256` into each module. Each module's `lint:tokens`
  refuses to run when a copy no longer matches it.
- `CONTRIBUTING.md` and `.nvmrc`, matching the module repositories.
- **Token lint, bridge fallbacks:** the shared rules now check both branches
  of a mode-dependent bridge fallback, `cssColor('--ink', dark ? … : …)`. A new
  `bridgeAlias` rule rejects binding a bridge function to another name
  (`var c = ns.cssColor`), because calls through an alias escaped the fallback
  check entirely. That is how DRE Visualizations' chart chrome kept a retired
  palette.

### Changed

- **Print:** DRE Search blocks are no longer hidden from print. The module
  prints its results and hides its own controls. A `<button>` whose label is
  content (a project or role chip) opts out of the print sheet's hide-every-button
  rule with `data-print`.
- `DESIGN.md` now describes the light/dark toggle as it is built: its label
  names the action and it carries no `aria-pressed`.
- The README's development setup uses `npm ci`, as `docs/TESTING.md` already
  did.

## [2.33.4] - 2026-10-07

### Removed

- **WissKI URL:** `dre:wisskiUrl` is no longer placed under "Identifiers &
  sources". WissKI was retired on 2026-10-07, and the property is being cleared
  from every AMIRA item and from the Persons and Research Items templates. Until
  that cleanup reaches a record, its leftover WissKI URL renders under "Further
  details". The template fixture drops the property to match (98 properties).

## [2.33.3] - 2026-10-07

### Changed

- **"Save record" moves into the record box:** on item pages it now sits
  beside "Copy link" in the "This record" box, styled as the same secondary
  button. The sticky rail keeps it in view while reading. Below the `$lg`
  breakpoint the box drops under the whole record, so the button under the
  title takes over at those widths. Only one of the two shows at any width,
  and both stay in sync. Media pages, and items without the box, keep the
  button under the title.

## [2.33.2] - 2026-10-07

### Fixed

- **Menu flash on page load:** since v2.32 every page painted the whole menu
  tree expanded (and hid the hamburger) until `navigation.js` initialised at
  DOMContentLoaded, then snapped it shut. That was most visible on heavy record
  pages. The expanded list is now the fallback only without JavaScript, or
  when `navigation.js` has still not initialised by window load (`.nav-failed`,
  set by the header's inline script). With JS the closed inline row or the
  drawer toggle paints from the start.
- **Value annotations open on load:** with the site's annotation setting on
  "expanded", v2.33 opened every annotation popover on load, over the record.
  Popovers now always start closed. Core itself never expands them, because it
  casts the setting to a boolean.
- **Value annotation layout:** core renders an annotation's values through
  `common/value-annotation-resource-values`, which fell through to the grouped
  record template. Each popover got section headings, a "Copy section link"
  button and the label rail, which squeezed values into a column one letter
  wide. A theme override now renders a flat label-over-value list, with linked
  records as title links and no thumbnail.

### Changed

- **Full text last:** `bibo:content`, the extracted full text of open-access
  publications (often 100–200 KB), moves from "Description" to its own "Full
  text" group. That group renders after every metadata group, "Further
  details" included, so the metadata is no longer buried below the text.

### Removed

- **Record contents and section links:** the "On this record" contents nav,
  the "Copy section link" buttons, the self-linking group headings and
  `asset/js/section-links.js` (all added in v2.32). A record is now just its
  grouped fields. Sections keep their `id`s, so fragment links still resolve.

## [2.33.1] - 2026-10-06

### Development

- **ESLint:** ESLint 10 (`eslint.config.mjs`, the recommended rules) replaces
  the parse-only `scripts/check-js.mjs` as `npm run lint:js`, so it runs in
  `build`, `verify` and CI. Theme scripts are linted as ES2022 browser scripts
  (the Safari 16.2 floor), the tooling and tests as Node modules. Its first
  run found unused catch bindings (now ES2019 `catch {}`), redundant regex
  escapes in the shortlist export, ambiguous regex spaces and literal BOM
  bytes in a script comment. None changed behaviour.
- **Layout test:** `tests/LayoutTest.php` renders the real `layout.phtml`, the
  page every request goes through, with its header, banner, footer and
  shortlist partials and the theme's own helpers. It covers:
  - brand and colour fallbacks, including CSS injection
  - PWA on and off, and shortlist off
  - script order and the font preload
  - home vs interior masthead, and a single h1
  - banner stat rows
- **Header and reveal tests:** `tests/js/chrome.test.mjs` covers scroll
  padding and header auto-hide, and that `reveal.js` leaves on-screen cards
  alone and hides nothing under reduced motion or without
  IntersectionObserver.
- **PHPStan in CI:** PHPStan 2.3.0 (level 5, PHP 8.1–8.5) analyses `helper/`
  against the unpacked Omeka S release. Its first finding, an unused closure
  variable in `HierarchyTree`, is fixed.

## [2.33.0] - 2026-10-06

### Fixed

- The home stat band's API fallback counts **Publications** as members of the
  public *Publications* item set, matching DRESearch and the DRE Visualizations
  precompute. It used to add up nine resource-template labels. That missed
  every template added since (Research data, Newspaper article, Encyclopedia
  entry and the other 24-32 types), and still counted records detached from the
  set because they kept their publication template. On AMIRA the old sum gave
  559 against the set's 555. The statistics cache moves to `v10`, so no
  label-based figure is served after the upgrade.
- **Asset block:** a page no longer fails when an attached asset has been
  deleted. Its link and caption still render. Page links were passed through
  `escapeUrl` (`rawurlencode`), which turned every link into a 404; they are now
  attribute-escaped paths.
- **Item pages:** the connections block no longer reloads, or loses its facet
  and sort, when the visitor follows an in-page link (skip link, Record
  contents, section anchors). It reloads only when the connection state
  changes. Re-applying the filters already shown adds no history entry.
- **Home stat band:** the DRE Visualizations snapshot is read again. Its site
  scope comes from `current.json` (`scope.siteId`), where the module records it,
  instead of a `siteId` key the artifact never carries.
- **Statistics:** services are reached through the current site. The helper
  plugin manager's deprecated `getServiceLocator()` raised a deprecation on
  every home-page view. Failures are logged through `IntegrationWarning`.
- **Core search fallback:** "View all results" for site pages goes to the page
  browse route instead of a 404.
- **Legacy advanced search** (`/item/search`, `/item-set/search`,
  `/media/search`): redirects to DRE Search through the MVC response and carries
  the full-text query across. Without DRE Search, core's advanced-search form
  renders instead of an empty results page.
- **Hierarchy page:** a grouping whose item set the visitor cannot read is
  titled "[Untitled]" instead of failing.
- **Logo:** a deleted logo asset falls back to the bundled lockup instead of
  rendering `<img src="">`.
- **Value annotations** follow core's site setting: hidden, collapsed or
  expanded, and shown by default when unset. Previously they were hidden unless
  set, and "expanded" was ignored. **Sites that relied on them being hidden by
  default should choose "Hide value annotations" in the site settings.**
- **Item-with-metadata block:** the record page's chrome (contents nav, h2
  sections, copy buttons) no longer appears inside the block, so heading order
  is preserved.
- **Connections:** page size falls back to the global `pagination_per_page`
  setting, as in core. The summary count is pluralised ("1 connection").
- **Navigation:** Ctrl/Shift/Cmd+Enter on a menu link opens a new tab or window
  again.
- **Copy buttons** no longer get stuck on "Copied" after a double click.
  Feedback is announced through a shared status region.
- **Research shortlist:** CSV exports start with a UTF-8 BOM, so Excel shows
  accented titles correctly. Switching citation style with the arrow keys
  updates the saved citation.
- **Print:** the masthead prints in ink, not cream on white. Records keep their
  citation, DOI, permalink and licence on paper.
- **Windows High Contrast (forced colors):** icon-only controls, checkbox state
  and field focus indicators remain visible.

### Changed

- **Accessibility:**
  - Field and checkbox borders meet 3:1 non-text contrast through the new
    `--field-border` token (additive; documented in
    `docs/DESIGN-INTEGRATION.md`). Checkboxes and radios are native controls
    with `accent-color`.
  - The grid/list toggle marks the current view with `aria-pressed` instead of
    disabling it, so keyboard focus is not lost.
  - "Save record" keeps one accessible name, including the record title, and
    shows a check mark when saved.
  - The header shortlist button's name includes its count.
  - The theme toggle no longer reports a contradictory pressed state.
- **HTML-block prose** renders at the container's full width again. The
  narrow measure cap added on 2026-09-07 contradicted the recorded design
  decision (DESIGN.md; T13 in `docs/history/DESIGN-ROADMAP.md`).
- **Record titles** on item, media and item-set pages use the Headline tier
  (`--text-3xl`, 700), as DESIGN.md specifies. Long titles no longer push the
  abstract below the fold.
- **Resource cards** switch to the side-by-side layout based on the card's own
  width (container query), not the viewport. Cards no longer squeeze or
  overflow beside both browse sidebars.
- **Typography:** headings after running text get more space above them, and
  abstracts and HTML-block paragraphs use `text-wrap: pretty`. Global focus
  styles no longer change element corner radii. Asymmetric `20px 0` corners are
  replaced with the radius tokens.
- **Performance:**
  - Masonry (24 KB) loads only where the browser lacks native `display:
    grid-lanes`. The native path previously tested a syntax no browser ships.
  - The shortlist script loads only when the feature is enabled.
  - Cards already on screen are no longer hidden and re-revealed on load.
  - The font preload targets Spectral 800, the weight of every page's banner
    title and h1.
  - The browser targets exclude Opera Mini, KaiOS, UC and QQ (which cannot
    render `color-mix()`): 7.4 KB less CSS.
- Theme scripts share `DREUtils` (`onReady`, `debounce`, `announce`,
  `flashLabel`). The drawer's labels moved from inline global constants to data
  attributes.

### Removed

- The unused `ContrastColor` view helper, the `window.DRETheme` global, the
  tooltip component, the dead client-side connection search, and about 4 KB of
  CSS for markup the theme no longer renders (27 fewer `!important`).
- `docs/RELEASE-*.md`: release notes now live in this changelog. Historical
  audits, roadmaps and reviews moved to `docs/history/`.

### Development

- `npm run verify` runs the CI contract locally. `npm test` now includes the
  browser suite. `npm version` keeps `theme.ini`, CITATION, the CSS header and
  this changelog in step.
- New tests:
  - rendered template regressions (`tests/TemplateFixesTest.php`)
  - negative fixtures for every custom lint
  - non-text contrast assertions
  - browser tests for fragment navigation, toggle focus and per-engine Masonry
    loading
- CI:
  - pins and verifies the Omeka S release by SHA-256
  - caches Playwright browsers
  - warns when Omeka S has a newer release
  - Dependabot groups action updates and drops the composer entry

## [2.32.0] - 2026-10-05

Relationship correctness, research tools, navigation improvements, and a build
toolchain without the vulnerable Gulp dependency chain. Builds on 2.31.1.

### Added

- **Server-rendered connections** that work as ordinary GET forms and links.
  Title searches cover all connected records with literal substring matching.
  Shareable `lr_property`, `lr_q` and `lr_page` state preserves Omeka's compound
  relationship filters; legacy `resource_property` and `page` links still work,
  including browser Back after an enhanced request. Facets and sorting refine
  the current page. Failed requests keep the results and offer retry or
  full-page continuation; stale requests cannot replace newer results.
- **Record contents** linking to stable section anchors. Repeated metadata
  blocks get distinct IDs; optional copy buttons preserve the URL's query state.
  Metadata language filtering and value rendering are unchanged.
- **Research shortlist** (General Settings → *Research shortlist*, on by
  default): up to 200 records saved on the current browser origin, with remove,
  clear, Undo clear, and Markdown/CSV/JSON export. A record saved from browse
  gains citation/download details once visited. Undo merges with later saves; at
  the limit, remaining records can be restored after making room. Storage
  failures keep an in-memory list and ask the reader to export before leaving.
  The shortlist is a working bibliography, not a citation service: it reuses
  DRE-SEO citation/download output where available, does not synchronise between
  devices or accounts, and is removed by clearing browser/site data. CSV exports
  neutralise spreadsheet formula prefixes; stored URLs are restricted to the
  site's origin.

### Changed

- Navigation supports configured depth, active branches, hidden pages and
  external targets, and is usable before JavaScript initialises. Drawer mode
  follows actual menu overflow, survives mobile resizing and restores visible
  focus at desktop widths.
- Core search has unique disclosure/input IDs, keyboard dismissal and a working
  GET fallback when DRESearch is unavailable.
- Native embeds and Mirador can appear together. The Mirador module decides
  whether a usable manifest exists, including external manifests without
  attached media. Empty viewer output produces no empty application region;
  failed optional integrations leave recovery information and rate-limited
  diagnostics.
- `ConnectionPage` uses Omeka 4.2.1's subject-values query builder with its
  site/ACL predicates and visibility filters, projects distinct selector rows,
  pages distinct record IDs and hydrates only the bounded page through Omeka's
  API. (The isolated SQLite test's 1,002 visible item edges yield three selector
  rows, and a one-record page hydrates one record — query cardinality, not
  production latency. Third-party adapters that modify the builder need their
  own integration testing.)
- Hierarchy groupings and authorised item sets are read in batches of 100.
  Cycles, orphans and unavailable sets stay renderable; identical subtree counts
  are reused.
- Visualisation statistics snapshots must match the requested site scope
  exactly, otherwise the site-filtered API fallback runs. The cache version
  changed so old scope assumptions are not reused. Stale-on-error behaviour and
  retry backoff are unchanged.
- Core search and hierarchy cards share `ResourceCardData`. Browse grids stay
  readable if Masonry is missing or fails, reuse one instance per grid, and
  relayout after images load.
- Development audits and browser configurations are excluded from the install
  archive. GitHub Actions use verified immutable commit pins.

### Security

- Gulp, gulp-sass and gulp-postcss are replaced by `scripts/build-css.mjs`,
  which calls Sass and PostCSS directly and uses Node's filesystem watcher. This
  resolves the eight high-severity `braces` audit findings
  (GHSA-vfj7-8cjw-p6xm). Compiled CSS, browser targets, the version header and
  the npm build/watch commands are unchanged; a failed compilation leaves the
  last good CSS intact and watch mode recovers after source errors.
- Compatible lockfile security updates.

### Upgrade and validation notes

- Browser fixtures render the actual theme partials with local assets and never
  contact the production database. CI covers Chromium, Firefox and WebKit, and
  PHP 8.1, 8.3 and 8.5; the Omeka integration tests load Omeka's bootstrap
  compatibility overrides. See
  [TESTING.md](https://github.com/AM-Digital-Research-Environment/DRE-theme/blob/master/docs/TESTING.md).
- Before a production release: exercise a high-degree item/media relationship,
  compare site counts with membership, and verify an external IIIF manifest and
  a mixed embed/image record with the installed modules. After deployment, run
  the read-only smoke suite and check screen-reader navigation by hand. Local
  fixtures do not establish production MySQL timing or physical-device results.

## [2.31.1] - 2026-09-22

The first published release of the 2.31 line (2.31.0 was tagged but never
published; 2.31.1 also makes the local browser fixtures resolve the colour theme
before first paint). Reliability, accessibility and performance across browsing,
metadata, hierarchy pages and optional module integrations.

### Fixed

- Browse grids stay readable when JavaScript or Masonry fails; layout choices
  stay in step with history and pagination.
- Value annotations are keyboard accessible; submenu Escape and consumed install
  prompts behave correctly; custom brand colours meet contrast requirements.
- Missing media, private hierarchy sets and malformed query parameters are
  handled safely; linked resources paginate with bounded server queries.

### Changed

- Reusable manifest, citation, connection, hierarchy and card helpers.
  Hierarchy reads and counts are cached; the last good statistics are kept
  during upstream outages.
- sharp updated; release validation requires the packaged tag to pass the full
  CI suite.
- Rendered PHP regression tests and deterministic Chromium, Firefox and WebKit
  accessibility/browser checks.

Install the attached `DRE-theme.zip`; it includes compiled assets and does not
require Node.js.

## [2.30.3] - 2026-09-07

### Changed

- The global reduced-motion override is replaced by component-specific
  behaviour: immediate drawer/disclosure changes, stationary card/button
  feedback, reduced Masonry movement, and preserved colour/focus cues.
- Standalone statistics no longer hydrate the full template catalogue: exact
  public item-set titles are resolved and those mappings reused for 24 hours.

### Added

- A read-only deployment snapshot health check, release-data preservation
  instructions, and reproducible responsive/keyboard/accessibility audit
  scripts.

Live 2.30.2 with Search 1.21.1 passed all 18 smoke tests before this release;
the new local assets passed six light/dark viewport and text-zoom cases. Install
the complete theme archive. See
[release deployment](https://github.com/AM-Digital-Research-Environment/DRE-theme/blob/master/docs/RELEASE-DEPLOYMENT.md)
for preserving visualisation data when updating modules.

## [2.30.2] - 2026-09-07

Packages the reviewed reliability, accessibility and layout improvements.

### Changed

- Interior mastheads are simpler: the site title wraps without truncation and
  gives the page heading priority.
- Editorial paragraph and list width is bounded for easier reading.
- Cached collection labels are independent of the visitor's language.
- Homepage totals use DRESearch 1.21.0 public corpus definitions, with explicit
  public site scope and standalone fallbacks.
- Live smoke readiness checks are stronger and keep failed requests,
  screenshots and traces.

### Upgrade

Install **DRE-theme.zip**, **DRESearch.zip 1.21.0** and **DreVisualizations.zip
2.28.3** from their release assets. Install the complete Search module package,
including Composer vendor files and every hashed JavaScript/CSS chunk. Preserve
the Visualizations `asset/data` when replacing module code, then run
**Regenerate now**; theme statistics refresh within one hour. The coordinated
module releases add compact mobile search controls, much smaller header assets,
stale-autocomplete protection, visible dashboard recovery states and consistent
corpus membership rules. New release versions change public asset URLs, which
invalidates older cached bundles.

All 18 live smoke tests passed after snapshot regeneration; the frontend changes
were also checked in local compiled fixtures at mobile and desktop widths.

## Earlier releases

Versions before 2.30.2 are documented in
[GitHub Releases](https://github.com/AM-Digital-Research-Environment/DRE-theme/releases).

[Unreleased]: https://github.com/AM-Digital-Research-Environment/DRE-theme/compare/v2.33.4...HEAD
[2.33.4]: https://github.com/AM-Digital-Research-Environment/DRE-theme/compare/v2.33.3...v2.33.4
[2.33.3]: https://github.com/AM-Digital-Research-Environment/DRE-theme/compare/v2.33.2...v2.33.3
[2.33.2]: https://github.com/AM-Digital-Research-Environment/DRE-theme/compare/v2.33.1...v2.33.2
[2.33.1]: https://github.com/AM-Digital-Research-Environment/DRE-theme/compare/v2.33.0...v2.33.1
[2.33.0]: https://github.com/AM-Digital-Research-Environment/DRE-theme/compare/v2.32.0...v2.33.0
[2.32.0]: https://github.com/AM-Digital-Research-Environment/DRE-theme/compare/v2.31.1...v2.32.0
[2.31.1]: https://github.com/AM-Digital-Research-Environment/DRE-theme/compare/v2.30.3...v2.31.1
[2.30.3]: https://github.com/AM-Digital-Research-Environment/DRE-theme/compare/v2.30.2...v2.30.3
[2.30.2]: https://github.com/AM-Digital-Research-Environment/DRE-theme/releases/tag/v2.30.2
