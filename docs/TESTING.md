# Testing

The theme uses three layers of checks. Production availability is deliberately
not a pull-request prerequisite: deterministic checks gate changes, while the
deployed site is monitored separately.

## Local and pull-request checks

```bash
npm ci
npx playwright install chromium firefox webkit   # once; on Linux add --with-deps
npm run verify         # exactly what CI's build job runs
npm run test:browser   # or `npm test` for test:unit + test:browser
```

`npm run verify` runs, in order:

1. `npm run build` — the design-token, theme.ini, template, metadata-group,
   JavaScript-syntax and PHP checks (`lint:source`), then the Sass build, then
   the compiled-CSS integrity check (`lint:css`);
2. `npm run i18n:check` — `language/template.pot` matches the templates;
3. `npm run test:unit` — the `node:test` suites in `tests/js/`, including the
   build tests (metadata header, prefixing, failed-compilation output
   preservation, watch-mode recovery) and negative tests proving each custom
   lint fails on a seeded violation;
4. `npm audit --audit-level=high`;
5. `scripts/check-stale-css.mjs` — the committed `asset/css/style.css` is what
   the build produces. In CI's clean checkout any difference fails. Locally, a
   difference that comes with uncommitted Sass, `theme.ini` or `package.json`
   changes is only a reminder to commit the rebuilt CSS with them.

### PHP

`npm run lint:php` (part of `build`) runs `php -l` over every template, helper
and test, then the dependency-free PHP behavior suites. It uses a `php` on
`PATH` if there is one, otherwise a pulled Docker image (`php:8.3-cli`, or
`DRE_PHP_IMAGE`), and skips with instructions when it finds neither. CI always
has PHP and runs `npm run lint:php:require`, where a missing PHP is a failure.
The PHP runner installs an error handler before every behavior suite, so
warnings and deprecations fail the job instead of merely printing to the log.

CI exercises PHP 8.1 (the floor of Omeka S 4.2.1), 8.3, and 8.5 — the
production runtime (8.5.10). A local PHP of another version does not report
8.5-only deprecations; CI's 8.5 job does, or check locally with Docker:

```sh
docker pull php:8.5-cli
DRE_PHP_RUNNER=docker DRE_PHP_IMAGE=php:8.5-cli npm run lint:php
```

A separate CI job downloads the official Omeka S release named by
`OMEKA_S_VERSION` in `.github/workflows/ci.yml` (currently 4.2.1), verifies its
SHA-256, copies this checkout into its `themes/dre` directory, and asks Omeka's
real theme manager to parse and activate the theme. This catches invalid
configuration, framework loading problems and an incorrect Omeka version
constraint without bundling Omeka/Laminas dependencies inside the theme. The
nightly smoke workflow warns when Omeka publishes a newer release.

Release validation reuses CI at the resolved tag SHA. Packaging waits for all
jobs, archives that same SHA, and separately validates the installed archive.

## Local browser regressions

`test:browser` uses `playwright.local.config.mjs`: it renders actual PHP
partials and loads the theme's checked-in CSS and scripts against a routed
fixture origin, so PHP must be on `PATH`. No production server or database is
needed. In Chromium, Firefox and WebKit it covers narrow/wide layouts, both
themes, reduced motion, navigation without JavaScript, partial script failures,
nested menus, keyboard disclosures and focus restoration, search submission,
enlarged text/forced colors, shortlist persistence and exports, record anchors,
the browse grid's fallback and Masonry behavior, and scoped axe accessibility
checks. On Windows, `DRE_BROWSER_CHANNEL=msedge` can select an installed Edge
for the Chromium project. `test-results/local/` contains failure traces and the
representative desktop/mobile screenshots.

PHP tests cover rendered block/citation output, bounded endpoint queries,
manifest failures, hierarchy batching, cycles and private sets, site-scoped
statistics and outages, brand contrast, compound relationship selections and
optional viewer fallbacks. JavaScript tests cover history/pager
synchronization, layout lifecycle, PWA prompt consumption, submenu Escape,
linked filtering and theme adapters.

## Relationship integration test

To exercise the real Omeka query builder, unpack the official Omeka S 4.2.1
release including its vendor libraries, enable PHP's `pdo_sqlite` and `mbstring`
extensions, and run:

```sh
OMEKA_PATH=/path/to/omeka-s php tests/integration/connections.php
```

In PowerShell, set `$env:OMEKA_PATH` before running `php`. The integration test
creates an in-memory SQLite database. It checks distinct counts/pagination,
compound template-property filters, item/media relations, literal title search,
visibility and site restrictions. It does not use a live Omeka database.

## Dependencies

The direct Node/Sass/PostCSS build replaced Gulp and its vulnerable `braces`
dependency chain. Dependabot proposes npm updates weekly (as one group, each
release at least five days old) and GitHub Actions updates weekly (as one
group); every update still has to pass the build, tests and audit gate.
`composer.json` is not watched: it only mirrors `theme.ini`'s Omeka constraint,
and `npm run lint:ini` keeps the two identical.


## Production smoke test

`.github/workflows/live-smoke.yml` runs nightly and can also be dispatched
manually. `tests/browser/surfaces.mjs` is the machine-readable route, owner,
selector, state, and smoke-sample inventory. The Playwright suite is split into
`core`, `search`, `visualizations`, and `integration` files so a failure points
at the right repository boundary while `npm run test:live` still runs them as
one bounded suite.

Every page context imports `read-only-test.mjs`, which aborts and fails the test
on any request that could mutate production. `GET`, `HEAD`, and `OPTIONS` are
allowed. DRESearch requires `POST` for retrieval, so only its exact same-origin
public query routes (`search`, `suggest`, `suggest-all`, `search-all`, `union`,
and `map`) are allowed, only with an anonymous JSON request. Admin, Omeka API,
export, authenticated, cross-origin, and path-prefix lookalike requests remain
blocked. This allowlist reflects the module's `SearchController`: these actions
validate input, rate-limit, and proxy read queries; indexing and maintenance use
separate admin/event paths.

After each test the suite attaches `production-request-safety.json`, including
any allowed query-shaped POST, and `dre-asset-versions.json` with the loaded
DRE-theme, DRESearch, DRE-Visualizations, and Mirador asset URLs and query-string
versions. The suite checks:

- one page-level `<h1>` (embedded application headings are tracked separately);
- browser console/page errors and failed first-party document/script/style requests;
- the legacy advanced-search redirect;
- mobile drawer state and horizontal overflow;
- lazy-loaded visualization canvases.
- the canonical DRESearch surface at `/s/amira/dre-search`;
- the Mirador workspace and digitized canvas at `/s/amira/item/32328`;
- the research gateway's links to research sections, projects, and items;
- duplicate IDs on those three integration routes.

List the selected production checks without opening the site:

```bash
npx playwright test --list
```

Run it locally after installing Chromium:

```bash
npx playwright install chromium
LIVE_BASE_URL=https://data.africamultiple.uni-bayreuth.de npm run test:live
```

Failure traces and screenshots go to `test-results/live/`, so a live run never
wipes the local suite's `test-results/local/`. The published visualization
snapshot alone (`current.json` and its required datasets) can be checked with
`npx playwright test tests/browser/visualizations.spec.mjs -g snapshot`.

### Acceptance audits

Two heavier read-only scripts are run by hand, not by CI. They use the same
production-request guard and write screenshots and JSON reports to the
Git-ignored `artifacts/roadmap-acceptance/`:

- `npm run audit:roadmap` — the DRESearch surface in light/dark at 320, 390 and
  1280px: keyboard tabs, mobile chooser, filters, empty state, drawer, 200%
  text zoom and long translated labels.
- `npm run audit:surfaces` — the main routes at 390px with axe-core (WCAG 2.1
  AA), map-control sizes, overflow and timing samples. `AUDIT_ROUTES=a,b`
  narrows the route list.

Append `-- --local-assets` to either to serve sibling checkouts' builds
(`../DRE-Search`, `../DREVisualizations`, this theme's CSS) in place of the
deployed assets, inside that browser only.

The scheduled job is intentionally separate from pull-request CI because a
deployment, network or production-data issue should not make a source change
flaky.

## Design validation without a local Omeka instance

The absence of a representative local Omeka database does not make production
the development environment. Design work uses four distinct layers:

1. deterministic source, PHP, template, token and unit checks;
2. static component fixtures for source-mapped visual work;
3. browser-local CSS or JavaScript injection against anonymous production pages;
4. read-only production smoke tests after deployment.

An injected experiment exists only inside one Playwright browser context. It
must use a dedicated configuration, assert the deployed theme/module asset
versions, and use the shared production-request guard. The narrow DRESearch
query allowlist is the only exception to inherently safe HTTP methods.
Injected JavaScript is limited to disposable visual-state setup and interaction
prototypes; it must not submit forms, call write APIs, visit authenticated admin
routes or transmit production data.

The nightly smoke suite remains free of visual experiments. Dynamic production
screenshots are evidence rather than pull-request gates because content sync,
map tiles, deployment timing and generated datasets can change independently of
this repository.

### Editable component catalogue

The sanitized catalogue at `tests/fixtures/design-system/index.html` renders
representative theme markup and neutral DRESearch/DRE-Visualizations state
shells against the checked-in theme CSS. It is the preferred source-mapped
target for Impeccable `live` and comp-first work.

Serve the repository locally, then open the fixture in a browser:

```sh
python -m http.server 4173      # or: python3 -m http.server 4173
```

```text
http://localhost:4173/tests/fixtures/design-system/
```

The catalogue contains invented content and makes no API or analytics request.
Its README records the production templates that each structure represents and
the deliberate refresh policy.

### Browser-local production experiment

`playwright.visual.config.mjs` is separate from the nightly configuration. Its
tests are skipped unless explicitly enabled, use the same mutation blocker,
bypass CSP only inside the isolated browser context, and write traces and
screenshots below the Git-ignored `artifacts/visual-experiments/` directory.

An experiment must name the deployed theme version it is designed to inspect.
For the version observed on 2026-08-27, PowerShell syntax is:

```powershell
$env:RUN_VISUAL_EXPERIMENTS = '1'
$env:EXPECTED_THEME_VERSION = '2.29.0'
$env:LIVE_BASE_URL = 'https://data.africamultiple.uni-bayreuth.de'
npm run test:visual:experiment
```

Update `EXPECTED_THEME_VERSION` only after inspecting the production asset URL;
do not weaken or remove the guard to make an experiment pass. Rules in an
experiment stylesheet must remain scoped below a body attribute installed by
that experiment. They are disposable evidence, not theme source.

After compatible releases are deployed, the header and module touch checks can
measure the served CSS without adding any local stylesheet. Name every expected
version and select only those acceptance files:

```powershell
$env:RUN_VISUAL_EXPERIMENTS = '1'
$env:USE_DEPLOYED_ASSETS = '1'
$env:EXPECTED_THEME_VERSION = '2.30.1'
$env:EXPECTED_DRESEARCH_VERSION = '1.20.1'
$env:EXPECTED_VISUALIZATIONS_VERSION = '2.28.1'
npx playwright test --config=playwright.visual.config.mjs `
  tests/visual-experiments/header-touch-targets.visual.mjs `
  tests/visual-experiments/module-touch-targets.visual.mjs
```

`USE_DEPLOYED_ASSETS=1` disables all CSS injection in those files. A failure is
therefore deployment evidence, not a prototype result. Keep it opt-in: the
nightly suite remains a small functional and semantic monitor rather than a
visual-release gate.

### Reporting findings

Use `.github/ISSUE_TEMPLATE/design-audit-finding.yml` for Phase 2 and later
findings. It requires route, owner, loaded versions, viewport, mode, component
state, evidence, priority, user impact, one proposed Impeccable command or
engineering action, and acceptance checks. Each issue records one primary user
problem; systemic duplicates should link to one shared cause.

The complete surface matrix, example Playwright experiment configuration,
Impeccable command sequence and cross-repository release gates are in
[`history/IMPECCABLE-ROADMAP.md`](history/IMPECCABLE-ROADMAP.md). The shared token and module
contract is in [`DESIGN-INTEGRATION.md`](DESIGN-INTEGRATION.md).
