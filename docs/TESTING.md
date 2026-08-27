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
manually. Its Playwright suite is read-only and checks representative home,
browse, record, media and DRE Search pages for:

- one document `<h1>`;
- browser console/page errors;
- the legacy advanced-search redirect;
- mobile drawer state and horizontal overflow;
- lazy-loaded visualization canvases.

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
versions, and block every request method except `GET`, `HEAD` and `OPTIONS`.
Injected JavaScript is limited to disposable visual-state setup and interaction
prototypes; it must not submit forms, call write APIs, visit authenticated admin
routes or transmit production data.

The nightly smoke suite remains free of visual experiments. Dynamic production
screenshots are evidence rather than pull-request gates because content sync,
map tiles, deployment timing and generated datasets can change independently of
this repository.

The complete surface matrix, example Playwright experiment configuration,
Impeccable command sequence and cross-repository release gates are in
[`IMPECCABLE-ROADMAP.md`](IMPECCABLE-ROADMAP.md). The shared token and module
contract is in [`DESIGN-INTEGRATION.md`](DESIGN-INTEGRATION.md).
