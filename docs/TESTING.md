# Testing

The theme uses three layers of checks. Production availability is deliberately
not a pull-request prerequisite: deterministic checks gate changes, while the
deployed site is monitored separately.

## Local and pull-request checks

```bash
npm ci
npm run build
npm run test:unit
npm run i18n:check
npm audit --audit-level=high
```

`npm run build` runs the design-token, theme.ini, template, metadata-group,
JavaScript-syntax and PHP checks before compiling Sass. PHP is optional locally
but mandatory in CI. The PHP runner installs an error handler before every
behavior suite, so warnings and deprecations fail the job instead of merely
printing to the log.

CI exercises PHP 8.1, 8.3 and the production runtime, PHP 8.5. A separate job
downloads the official Omeka S 4.2.1 release, copies this checkout into its
`themes/dre` directory, and asks Omeka's real theme manager to parse and activate
the theme. This catches invalid configuration, framework loading problems and an
incorrect Omeka version constraint without bundling Omeka/Laminas dependencies
inside the theme.

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
DRE-theme, DRESearch, and DRE-Visualizations asset URLs and query-string
versions. The suite checks:

- one document `<h1>`;
- browser console/page errors;
- the legacy advanced-search redirect;
- mobile drawer state and horizontal overflow;
- lazy-loaded visualization canvases.

List the selected production checks without opening the site:

```bash
npx playwright test --list
```

Run it locally after installing Chromium:

```bash
npx playwright install chromium
LIVE_BASE_URL=https://data.africamultiple.uni-bayreuth.de npm run test:live
```

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

```powershell
C:/Users/frede/AppData/Local/Programs/Python/Python312/python.exe -m http.server 4173
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

### Reporting findings

Use `.github/ISSUE_TEMPLATE/design-audit-finding.yml` for Phase 2 and later
findings. It requires route, owner, loaded versions, viewport, mode, component
state, evidence, priority, user impact, one proposed Impeccable command or
engineering action, and acceptance checks. Each issue records one primary user
problem; systemic duplicates should link to one shared cause.

The complete surface matrix, example Playwright experiment configuration,
Impeccable command sequence and cross-repository release gates are in
[`IMPECCABLE-ROADMAP.md`](IMPECCABLE-ROADMAP.md). The shared token and module
contract is in [`DESIGN-INTEGRATION.md`](DESIGN-INTEGRATION.md).
