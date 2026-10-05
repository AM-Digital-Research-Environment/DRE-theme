# 2.32.0 — relationship correctness and research tools

This release builds on 2.31.1 and adds relationship correctness, research tools,
navigation improvements and a build toolchain without the vulnerable Gulp
dependency chain.

## Research features

- Connections render on the server and support ordinary GET forms and links.
  Title searches cover all connected records, with literal substring matching.
  Shareable `lr_property`, `lr_q` and `lr_page` state preserves Omeka's compound
  relationship filters. Legacy `resource_property` and `page` links still work,
  including browser Back after an enhanced request. Facets and sorting explicitly
  refine the current page. Failed requests preserve results and offer retry or
  full-page continuation; stale requests cannot replace newer results.
- Record contents link to stable section anchors. Repeated metadata blocks get
  distinct IDs. Optional copy buttons preserve the URL's query state. Existing
  metadata language filtering and value rendering remain supported.
- The research shortlist saves up to 200 records on the current browser origin,
  with remove, clear, Undo clear, and Markdown/CSV/JSON export. Enable or disable
  it under **General Settings → Research shortlist**; it is enabled by default.
  A browse save gains available citation/download details when its record is
  visited. Undo merges with later saves; if the limit is reached, remaining
  records can be restored after making room. Storage failures preserve an
  in-memory list and ask the reader to export before leaving.

The shortlist is a working bibliography, not a new citation service. It uses
existing DRE-SEO citation/download output where available. It does not synchronize
between devices or accounts. Clearing browser/site data removes saved records.
CSV exports neutralize spreadsheet formula prefixes; stored URLs are restricted
to the site's origin.

## Correctness and maintenance

Navigation supports configured depth, active branches, hidden pages and external
targets. It stays available before JavaScript initializes. Drawer mode responds
to actual menu overflow, survives mobile resizing and restores visible focus at
desktop widths. Core search has unique disclosure/input IDs, keyboard dismissal
and a working GET fallback when DRESearch is unavailable.

Native embeds and Mirador can appear together. The Mirador module decides whether
a usable manifest exists, including external manifests without attached media.
Empty viewer output produces no empty application region; failed optional
integrations leave recovery information and rate-limited diagnostics.

`ConnectionPage` uses Omeka 4.2.1's subject-values query builder with its site/ACL
predicates and visibility filters. It projects distinct selector rows, pages
distinct record IDs and hydrates only the bounded page through Omeka's API. The
isolated SQLite test creates 1,002 visible item edges: these yield three distinct
selector rows, and a one-record page hydrates one record. This verifies query
cardinality, not production latency. Third-party adapters modifying the builder
need integration testing.

Hierarchy groupings and authorized item sets are read in batches of 100. Cycles,
orphans and unavailable sets remain renderable, and identical subtree counts are
reused. Visualization statistics snapshots must match the requested site scope
exactly; otherwise the site-filtered API fallback runs. The cache version changes
to prevent old scope assumptions from being reused. The existing stale-on-error
behavior and retry backoff are preserved; no shared refresh lease is introduced.

Core search and hierarchy cards share `ResourceCardData`. Browse grids remain
readable if Masonry is missing or fails, reuse one instance per grid, and relayout
after image loading. Development audits and browser configurations are excluded
from install archives. GitHub Actions use verified immutable commit pins.

## Validation and release notes

See [TESTING.md](https://github.com/AM-Digital-Research-Environment/DRE-theme/blob/master/docs/TESTING.md)
for local PHP, JavaScript, browser and Omeka integration commands. Browser fixtures
render the actual theme partials and load local assets; they do not contact the
production database. CI includes Chromium, Firefox and WebKit, plus PHP 8.1, 8.3
and 8.5. The Omeka integration tests load its bootstrap compatibility overrides.

Compatible lockfile security updates are included. The eight high-severity
Gulp/`braces` audit findings (GHSA-vfj7-8cjw-p6xm) are resolved by removing Gulp,
gulp-sass and gulp-postcss. `scripts/build-css.mjs` calls Sass and PostCSS directly
and uses Node's filesystem watcher. The compiled CSS, browser targets, theme
version header and existing npm build/watch commands are preserved. Failed
compilations leave the last successful CSS intact; watch mode continues after
source errors. The normal audit gate remains enabled, and Dependabot continues
its weekly npm, Composer and GitHub Actions updates.

Before production release, exercise a high-degree item/media relationship,
compare site counts with membership, and verify an external IIIF manifest and a
mixed embed/image record with the installed modules. Run the existing read-only
smoke suite after deployment and manually check screen-reader navigation. Local
fixtures do not establish production MySQL timing or physical-device results.
