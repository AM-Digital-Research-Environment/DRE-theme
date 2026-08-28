# Impeccable Evaluation Roadmap

This roadmap applies Impeccable 4.1.2 to the three repositories that render
AMIRA. It assumes there is no representative local Omeka S instance and treats
the public site as a read-only integration target.

The programme is intentionally evidence-first. It does not authorize a broad
redesign. `PRODUCT.md` preserves product truth, `DESIGN.md` preserves the visual
world, and `DESIGN-INTEGRATION.md` preserves the cross-repository contract.

## Outcomes

The roadmap should produce:

1. a maintained inventory linking visible AMIRA surfaces to the repository and
   component that owns them;
2. a repeatable critique and technical-audit baseline covering theme, search,
   and visualizations together;
3. comp-first proposals for changes that need structural or visual exploration;
4. safe browser-local prototypes against real production markup without any
   production write;
5. deterministic source and fixture tests that catch regressions before deploy;
6. bounded post-deployment validation against the exact versions that are live;
7. a prioritized issue backlog with acceptance criteria and repository owners.

## Current baseline

The theme already has unusually strong foundations:

- a semantic OKLCH token system with executable contrast checks;
- light and dark modes with a persistent user override;
- self-hosted type, shared spacing, layout, radius, depth, and stacking scales;
- PHP, template, JavaScript, metadata-group, and compiled-CSS contract checks;
- unit tests for browser behavior;
- Omeka S discovery and activation in CI;
- a nightly, read-only Playwright smoke test against production.

During the 2026-08-27 inspection, the public site served DRE-theme 2.29.0,
DRE Visualizations 2.28.0, and DRE Search 1.20.0. The theme repository was at
2.30.0 during that audit; the resulting fixes ship in 2.30.1. Production
evidence must therefore always record the asset versions before a finding is
attributed to current source.

## Impeccable command map

Impeccable commands are not a checklist to run indiscriminately. Each owns a
different question.

| Command | When AMIRA should use it | Expected artifact or decision |
| --- | --- | --- |
| `init` | Product purpose, audience, constraints, or evidence changes | Update `PRODUCT.md`; completed for the 4.1.2 migration |
| `document` | Tokens, type, component language, or visual rules materially change | Refresh `DESIGN.md` and `.impeccable/design.json`; completed for the migration baseline |
| `extract` | A repeated theme or module pattern should become a shared token or component | A named reusable contract in DRE-theme, followed by module adoption |
| `shape` | A new page, page block, or major workflow needs UX definition before implementation | A surface brief with user task, content order, states, and acceptance criteria |
| `critique` | A representative route needs heuristic evaluation | Evidence-based UX findings and severity, separated from technical defects |
| `audit` | Accessibility, performance, responsive, semantic, or implementation quality is in question | Reproducible technical findings with automated checks where possible |
| `typeset` | Reading hierarchy, line length, labels, legends, or dense metadata need focused work | Comp-first alternatives using the existing Spectral/Hanken family |
| `layout` | Page grids, rails, facets, dashboard composition, or spacing rhythm need structural work | Distinct layout comps, then a selected responsive implementation |
| `adapt` | A good desktop surface fails on mobile, zoom, print, touch, or constrained containers | Context-specific responsive behavior and tests |
| `clarify` | Labels, empty states, errors, help, chart descriptions, or navigation wording are unclear | Revised, translatable interface copy grounded in product terminology |
| `onboard` | A first-time visitor cannot understand what a corpus, graph, map, or control makes possible | In-context orientation that does not become permanent explanatory clutter |
| `harden` | Long labels, missing media, zero results, failed APIs, no JavaScript, i18n, or browser edge cases are incomplete | Explicit state matrix and regression coverage |
| `optimize` | Search, maps, charts, fonts, or page blocks hurt interaction or loading performance | Measured performance fix with before/after evidence |
| `animate` | Motion can explain arrival, disclosure, filtering, or spatial change | One purposeful motion vocabulary with a complete reduced-motion path |
| `colorize` | Hierarchy lacks meaning that an existing palette role can supply | Existing-token color strategy; no new decorative palette |
| `delight` | A stable surface would benefit from a memorable but quiet scholarly interaction | A bounded enhancement that remains useful and accessible |
| `bolder` | A critique proves a surface is too timid or lacks a clear entry point | Stronger hierarchy, scale, or structural commitment within the current identity |
| `quieter` | A surface has too much competing chrome, color, or motion | Reduced emphasis while preserving task clarity |
| `distill` | Nested panels, duplicated controls, or redundant copy obstruct the task | Simplified structure with no loss of function or evidence |
| `overdrive` | Only for an isolated exploratory comp where the team explicitly wants a convention-breaking idea | A non-production proposal; never an automatic implementation path |
| `polish` | A selected implementation is complete and preparing to ship | One bounded desktop/mobile inspection, one batch of fixes, one confirmation pass |
| `live` | A local static or rendered fixture maps to editable source | Interactive variants; not directly compatible with immutable production HTML |

## Surface inventory

Use stable routes for page types and API-resolved IDs for records whose IDs may
change. A visual audit log should record URL, timestamp, viewport, active mode,
loaded asset versions, data state, and owning repository.

### Core theme and mixed-integration surfaces

| Surface | Representative route | Main components | Owners | Impeccable focus |
| --- | --- | --- | --- | --- |
| Home | `/s/amira/page/home` | Header, deep-plate masthead, introductory prose, Collection Overview block, footer | Theme + Visualizations + Search header | `critique`, `audit`, `layout`, `typeset`, `adapt` |
| Research gateway | `/s/amira/page/research` | Navigation, interior banner, page-grid cards and links | Theme | `critique`, `clarify`, `layout`, `adapt` |
| Index gateway | `/s/amira/page/index` | Authority-entry navigation and card groups | Theme | `critique`, `clarify`, `distill` |
| Item browse | `/s/amira/item` | Browse controls, resource grid/list, pagination, empty state | Theme | `audit`, `layout`, `adapt`, `harden` |
| Item-set browse | `/s/amira/item-set` | Collection search entry, layout toggle, resource cards, pagination | Theme | `critique`, `audit`, `adapt` |
| Item record | `/s/amira/item/32328` (canonical Mirador sample), plus an API-resolved current record | Mirador, grouped metadata, record apparatus, linked resources, dashboard, knowledge graph, location map | Theme + Visualizations + Mirador | `critique`, `typeset`, `layout`, `harden`, `adapt` |
| Media record | Resolve with `/api/media?per_page=1`, then `/s/amira/media/{id}` | Media viewer, metadata, record chrome | Theme | `audit`, `adapt`, `harden` |
| Installation and mode controls | Any route | Theme toggle, PWA control, navigation drawer, back to top | Theme | `audit`, `adapt`, `polish` |

The fixed item route is useful for continuity but must not be the only record
sample. Each audit round should add one content-rich research item, one person or
organisation, one item with missing media or sparse metadata, and one unusually
long title or multilingual label.

### DRE Search surfaces

| Surface | Representative route | Main components | Focus |
| --- | --- | --- | --- |
| Federated search | `/s/amira/dre-search` | Query field, corpus tabs, union results, facets, sort, pagination | `critique`, `audit`, `clarify`, `adapt`, `harden` |
| Research items | `/s/amira/page/research-items` | Year range, dense facets, list/gallery results | `layout`, `adapt`, `optimize` |
| Research projects | `/s/amira/page/research-projects` | Project cards and linked filters | `critique`, `clarify` |
| People | `/s/amira/page/people` | Compact cards, role and affiliation facets | `typeset`, `layout`, `harden` |
| Organisations | `/s/amira/page/organisations` | Type and role facets, compact cards | `layout`, `clarify` |
| Locations | `/s/amira/page/locations` | Authority results and optional map | `adapt`, `onboard`, `optimize` |
| Subjects and tags | `/s/amira/page/subjects-tags` | Two authority types, counts, filters | `clarify`, `typeset` |
| Publications | `/s/amira/page/publications` | Bibliographic cards, year/type/author facets | `typeset`, `harden`, `adapt` |
| Podcasts and YouTube | `/s/amira/page/podcasts`, `/s/amira/page/youtube-videos` | Media-forward cards, transcript state, people and language facets | `critique`, `harden`, `adapt` |

For every search corpus, include query success, zero results, one active filter,
multiple filters with a selected zero-count option, loading, unavailable
Typesense, long facet labels, keyboard navigation, and mobile filter disclosure.

### DRE Visualizations surfaces

| Surface | Representative route | Main components | Focus |
| --- | --- | --- | --- |
| Collection overview | `/s/amira/page/home` | Stat cards, overview charts, cluster map | `critique`, `audit`, `typeset`, `adapt` |
| Project explorer | `/s/amira/page/project-explorer` | Entity selector and project dashboard | `onboard`, `clarify`, `layout`, `harden` |
| Compare | `/s/amira/page/compare` | A/B selectors, paired charts, overlap statistics | `critique`, `clarify`, `adapt` |
| Spatial exploration | `/s/amira/page/spatial-exploration` | Entity and country controls, MapLibre map, layers | `audit`, `onboard`, `adapt`, `optimize` |
| Networks | `/s/amira/page/networks` | Entity network, filters, search, legend, details | `audit`, `onboard`, `harden`, `optimize` |
| Publications analytics | `/s/amira/page/publications-visualisations` | Bibliographic charts, maps, networks, word clouds | `critique`, `typeset`, `distill` |
| Podcast analytics | `/s/amira/page/podcasts-visualisations` | Episode, transcript, topic, and contributor views | `clarify`, `layout`, `adapt` |
| YouTube analytics | `/s/amira/page/youtube-visualisations` | Video, playlist, speaker, transcript, and topic views | `clarify`, `layout`, `adapt` |

Visualization checks must cover loading, no data, failed fetch, collapsed and
expanded disclosure, keyboard operation, theme change after render, container
resize, fullscreen, touch gestures, ordinary page scrolling, text alternative,
and export where provided.

## Testing without a local Omeka S instance

No single substitute reproduces production. Use a layered strategy in which
each layer has a narrow responsibility.

### Layer 1 — deterministic repository contracts

Run on every pull request:

```bash
npm ci
npm run build
npm run test:unit
npm run i18n:check
npm audit --audit-level=high
```

Keep PHP syntax and behavior mandatory in CI, including Omeka S discovery and
activation. Extend the existing lints when a design claim can be tested from
source: token parity, allowed breakpoints, fallback synchronization, semantic
heading contracts, required state classes, and unresolved partials.

### Layer 2 — isolated component fixtures

Create a small, static fixture catalogue from representative server-rendered
markup, sanitized of personal data and unstable content. It should include:

- theme header, drawer, masthead, resource card, pagination, record groups,
  apparatus rail, linked-resource disclosure, and empty state;
- DRE Search query, tab, facet, selected-filter, result-card, zero-result,
  loading, and unavailable states;
- DRE Visualizations chrome, loading, empty, error, legend, toolbar, disclosure,
  fallback table, and map-control shells.

Fixtures are contracts, not a second application. Keep markup minimal, document
its production source, and refresh deliberately when the corresponding Omeka or
module template changes. A static catalogue gives Impeccable `live` an editable
source target and makes comp-first variants possible without an Omeka database.

### Layer 3 — browser-local production prototypes

It is feasible to test CSS and limited JavaScript against the public site without
changing the server. Playwright can load production and inject a local stylesheet
or script into that one isolated browser context.

Use a dedicated experiment configuration rather than the nightly smoke suite:

```js
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/visual-experiments',
  use: {
    baseURL: 'https://data.africamultiple.uni-bayreuth.de',
    bypassCSP: true,
    trace: 'retain-on-failure',
  },
});
```

A prototype test can then use:

```js
test.beforeEach(async ({ page }) => {
  await page.route('**/*', async (route) => {
    const method = route.request().method();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      await route.abort('blockedbyclient');
      return;
    }
    await route.continue();
  });
});

test('record comp against production markup', async ({ page }) => {
  await page.goto('/s/amira/item/32328');
  await expect(page.locator('link[href*="/themes/DRE-theme/"]'))
    .toHaveAttribute('href', /v=2\.29\.0/);
  await page.addStyleTag({ path: 'tests/visual-experiments/record-comp.css' });
  await page.screenshot({ path: 'artifacts/record-comp.png', fullPage: true });
});
```

The version assertion above is illustrative and must be updated to the version
the experiment is intentionally targeting. Never silently loosen it.

JavaScript injection is appropriate only for visual state setup or disposable
interaction experiments. It must not add calls to `fetch`, `XMLHttpRequest`,
`sendBeacon`, form submission, the Omeka API with a write method, or an
authenticated admin route. The page's existing anonymous DRESearch retrieval
POSTs may continue through the exact path allowlist in the shared request guard;
every other write-shaped request is aborted. The blocker is a second line of
defence, not permission to write risky experiment code.

This method changes only the local page DOM. Reloading or closing the browser
removes the experiment. It is suitable for computed-style checks, layout
experiments, responsive screenshots, focus and disclosure behavior, and trying
a selected comp against real module markup. It cannot validate PHP rendering,
database queries, module configuration forms, migrations, or server-side errors.

Browser DevTools snippets or local overrides can provide the same disposable
effect for a human review session, but Playwright is preferred when the result
must be reproducible and reviewed in Git.

### Layer 4 — read-only production smoke tests

Keep production checks separate from pull-request gates. Extend the existing
nightly suite in bounded groups:

- semantic smoke: one meaningful `<h1>`, landmarks, no duplicate IDs, no page or
  console errors;
- responsive smoke: 390px, an intermediate desktop width, and horizontal
  overflow;
- integration smoke: DRE Search mounts, one visualization canvas or map loads,
  theme changes repaint dependent content;
- navigation smoke: drawer, disclosure, legacy search redirect, pagination;
- availability smoke: representative API data exists before resolving dynamic
  record and media routes.

Do not turn dynamic production screenshots into a strict pull-request gate.
Content synchronization, data regeneration, deployment timing, fonts, maps, and
third-party tiles introduce noise that is unrelated to a source change.

### Layer 5 — bounded post-deployment review

After coordinated releases are deployed:

1. record the three loaded asset versions;
2. inspect desktop and mobile together in light and dark mode;
3. run the production smoke suite;
4. run only the surface group affected by the release;
5. fix all observed release defects in one batch;
6. confirm once and stop.

## Phased roadmap

### Phase 0 — Migrate the Impeccable context

Status: completed by the 4.1.2 migration.

- Replace `.impeccable.md` with schema-marked `PRODUCT.md`.
- Restructure `DESIGN.md` to canonical frontmatter plus the eight standard
  sections.
- Generate `.impeccable/design.json` schema version 2.
- Record the comp-first workflow in `.impeccable/config.json`.
- Separate the cross-repository engineering contract into
  `DESIGN-INTEGRATION.md`.
- Re-run the Impeccable doctor and repository validation.

Acceptance: Impeccable resolves both product and design context, the doctor has
no migration finding, and the sidecar parses as JSON.

### Phase 1 — Build the audit harness and evidence register

Status: completed in DRE-theme on 2026-08-27. A manual production run passed all
14 grouped checks against the deployed site. The nightly run remains the
operational monitor, and Phase 2 can now begin from this baseline.

- [x] Add a machine-readable surface manifest with URL, mode, owner, expected key
  selectors, and asset-version extraction.
- [x] Split live Playwright tests into core theme, search, visualization, and shared
  integration groups while retaining one command.
- [x] Add safe mutation blocking to every production test context.
- [x] Add a local-only visual-experiment configuration with CSP bypass, artifact
  output, and explicit version guards.
- [x] Create the first static fixture catalogue for editable, source-mapped
  Impeccable `live` sessions.
- [x] Define a finding template: route, owner, mode, viewport, evidence, severity,
  user impact, proposed command, and acceptance check.

Acceptance: a contributor can locate the correct test surface and owner without
knowing the Omeka page configuration, and can run a visual prototype without
any production write capability.

### Phase 2 — Establish a critique and audit baseline

Status: in progress. The first home/global-chrome critique and technical audit
are recorded. The selected Priority A semantic hardening and Priority B
touch-target adaptation are implemented in source:

- DRE-theme commit `0840207` gives Mirador a translated, named application
  boundary and adds a deployment-gated canonical-route assertion;
- DRE Visualizations commit `5e2851d6` separates chart titles from named action
  toolbars and adds a persistent async status contract;
- the local component fixture now represents both visualization semantics and
  tests them independently of an Omeka installation.
- DRE-theme commit `d2e7e7b` gives the mobile header search, install, mode, and
  menu controls real 44px boxes and pins the contract with a source check and
  320/390px live-injection experiment;
- DRESearch commit `1e2269d` applies the same token to high-frequency search,
  clear, sort, view, export, copy, and paging actions and adds regression tests;
- DRE Visualizations commit `aec09b45` enlarges native MapLibre navigation and
  popup-close controls on coarse pointers while preserving compact desktop
  geometry and clear popup text.

Production still serves the older versions recorded above. Keep the remaining
live acceptance checks open until coordinated releases are deployed.

Run `critique` and `audit` as separate passes over five groups:

1. global chrome and home;
2. browse and records;
3. federated and corpus search;
4. dashboards and compare/explorer tools;
5. maps, networks, media, and IIIF.

Score each route on task clarity, hierarchy, information architecture,
interaction feedback, accessibility, responsive resilience, performance, state
completeness, and cross-repository cohesion. Preserve the difference between a
heuristic preference and a reproducible defect.

Acceptance: every finding has evidence, one owner, one priority, and a command
or engineering action. Duplicate symptoms across routes are consolidated under
one systemic cause.

### Phase 3 — Shared-system extraction

Use `extract` for repeated patterns discovered in Phase 2:

- token roles missing from the theme;
- duplicated empty, loading, unavailable, error, and disclosure patterns;
- shared entity colors and legend treatments;
- search and visualization control sizing;
- common chart descriptions and accessible fallback structures;
- module fallback and mode-change utilities.

Acceptance: shared meaning lives once in DRE-theme or a documented neutral
contract. Module code consumes it without redefining the original token.

### Phase 4 — Comp-first refinement sprints

Prioritize by user impact rather than command novelty. Likely sprint order:

1. `typeset` and `layout` for long records, bibliographic results, dense facets,
   dashboard titles, legends, and comparison pages;
2. `adapt` for mobile facets, record rails, intermediate-width navigation,
   map controls, fullscreen visualizations, and print;
3. `clarify` and `onboard` for corpus terminology, zero results, project
   explorer, spatial exploration, network gestures, and chart descriptions;
4. `harden` for missing media, sparse metadata, failed APIs, long multilingual
   labels, unavailable Typesense, no JavaScript, and empty datasets;
5. `optimize` for deferred module assets, chart and map initialization, payload
   size, layout shift, and route-specific bundles.

Each structural or visual sprint starts with three on-brand comps that vary one
primary axis each. The selected comp is then implemented and validated against
fixtures and production markup. `bolder`, `quieter`, `distill`, `animate`,
`colorize`, and `delight` are used only when the baseline evidence calls for
their specific effect.

Acceptance: the chosen implementation preserves the identity lock, has complete
states, passes deterministic checks, and survives the route matrix relevant to
the change.

### Phase 5 — Production hardening

- Add keyboard and screen-reader expectations for interactive visualizations.
- Add text-zoom, forced-colors, reduced-motion, and touch checks where the
  browser tooling can assert behavior reliably.
- Audit third-party and canvas focus order, escape behavior, fullscreen layers,
  and scroll ownership.
- Measure LCP, CLS, INP proxies, script weight, and time to usable search or
  visualization on selected routes.
- Validate French-length copy and transliterated names without truncating
  meaning.
- Document sanctioned exceptions with a narrow selector and rationale.

Acceptance: edge states and accessibility paths are part of the component
contract, not manual-release folklore.

### Phase 6 — Polish and release

Run `polish` only after implementation and hardening are complete. Inspect the
affected desktop and mobile surfaces in one round, fix the complete defect set,
and confirm once. Coordinate release order when token or integration changes
cross repositories.

Acceptance: source checks, unit tests, the appropriate module checks, packaging,
and post-deployment smoke tests all pass against the versions recorded in the
release note.

### Phase 7 — Ongoing governance

- Run `impeccable doctor` after an Impeccable upgrade and before a major design
  programme.
- Run `document` only when the implemented visual system has materially changed.
- Review the surface manifest and production sample IDs quarterly.
- Treat the nightly production suite as monitoring, not a pull-request gate.
- Keep completed historical findings in `DESIGN-ROADMAP.md`; keep new work in
  GitHub issues and this programme document.
- Review deprecated token aliases at each coordinated release.

## Finding priorities

| Priority | Definition | Response |
| --- | --- | --- |
| P0 | Prevents access, loses data meaning, creates an unsafe production action, or breaks the shared theme/module contract | Stop release; fix across owners immediately |
| P1 | Blocks or seriously confuses a primary task, keyboard path, mobile layout, or record interpretation | Schedule in the current milestone |
| P2 | Visible inconsistency, incomplete state, or maintainability drift with a credible regression path | Schedule after P1 work or combine with the affected component |
| P3 | Enhancement opportunity with no current task failure | Keep only with a clear hypothesis and success test |

## Definition of done for a design issue

- The issue names one primary user problem and one owning repository.
- The affected routes and component states are listed.
- Current production asset versions are recorded when live evidence is used.
- The relevant Impeccable command and surface mode are named.
- Comp-first work includes three distinct on-brand directions and a recorded
  selection.
- Light, dark, desktop, mobile, keyboard, zoom, reduced motion, and long-content
  checks are included where applicable.
- DRE Search and DRE Visualizations are checked whenever a shared token or global
  component rule changes.
- New UI copy is translatable and avoids unsupported claims.
- Deterministic tests run before deployment; production smoke runs afterward.
- Documentation and sidecar are refreshed only when system-level truth changes.

## GitHub issue structure

Create one tracking issue in DRE-theme and implementation issues in the
repository that owns the work:

1. [**Tracking: Impeccable 4.1.2 evaluation programme for
   AMIRA**](https://github.com/AM-Digital-Research-Environment/DRE-theme/issues/2)
   — DRE-theme.
2. [**Build a safe visual-audit harness and representative surface
   manifest**](https://github.com/AM-Digital-Research-Environment/DRE-theme/issues/1)
   — DRE-theme.
3. [**Audit DRE Search with the shared Impeccable surface and state
   matrix**](https://github.com/AM-Digital-Research-Environment/DRESearch/issues/21)
   — DRESearch.
4. [**Audit DRE Visualizations with the shared Impeccable surface and state
   matrix**](https://github.com/AM-Digital-Research-Environment/DRE-Visualizations/issues/11)
   — DRE-Visualizations.
5. [**Improve mobile chrome controls to the shared 44px hit-area
   target**](https://github.com/AM-Digital-Research-Environment/DRE-theme/issues/3)
   — DRE-theme.
6. [**Harden Mirador's embedded heading and landmark
   hierarchy**](https://github.com/AM-Digital-Research-Environment/DRE-theme/issues/4)
   — DRE-theme and the Mirador integration.
7. [**Replace the global reduced-motion kill switch with intentional
   alternatives**](https://github.com/AM-Digital-Research-Environment/DRE-theme/issues/5)
   — DRE-theme.
8. [**Separate visualization headings, toolbars, and async status
   semantics**](https://github.com/AM-Digital-Research-Environment/DRE-Visualizations/issues/12)
   — DRE-Visualizations.
9. [**Validate 44px MapLibre touch controls after
   deployment**](https://github.com/AM-Digital-Research-Environment/DRE-Visualizations/issues/13)
   — DRE-Visualizations.

The tracking issue links the implementation work and uses the phases in this
document as its checklist. New visual fixes are opened only after Phase 2
produces evidence; the backlog is not pre-populated with speculative style
changes.

## Risks and controls

| Risk | Control |
| --- | --- |
| Production differs from the checked-out source | Assert and record theme and module asset versions before interpreting evidence. |
| A browser experiment accidentally writes data | Use anonymous pages; allow inherently safe methods plus only the exact DRESearch query POST paths verified in its controller; block all other write-shaped requests; avoid admin routes; and prohibit write-capable injected code. |
| Dynamic records make tests flaky | Resolve representative IDs from the public API and keep stable semantic assertions. |
| Visual snapshots change with synchronized content | Use stable component crops or fixtures; keep dynamic production screenshots informative rather than gating. |
| Static fixtures drift from Omeka templates | Store source route and refresh date; add selector and structure contracts against production. |
| Cross-repository token changes deploy out of order | Add aliases, publish theme first, then modules, then remove aliases only in a coordinated breaking release. |
| Canvas checks miss accessible meaning | Require a keyboard path and textual/list alternative in addition to pixel or canvas presence. |
| The roadmap becomes an endless polish loop | Use bounded Impeccable verification and close issues against explicit acceptance criteria. |
