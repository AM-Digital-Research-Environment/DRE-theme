# Coherence review: DRE theme and modules — 2026-11-10

Scope: DRE-theme 2.48.0, DRE Visualizations 2.50.0, DRE Search 1.35.0,
DRE SEO 0.16.0, DRE Linked Data 0.6.0, each at its checked-out HEAD.

Method: one read-only reviewer per repository, plus a cross-repository
comparison of tooling, CI and shared contracts. Nothing was built, installed or
changed. No test suite was run. Findings marked **verified** were re-checked
against the code after the reviewers reported; **as read** means one reviewer
read the code and I did not re-check it; **to verify** means it needs a run or
a look at production.

Coverage limits: the largest files were sampled, not read in full. Not read:
the theme's footer partials and most block layouts; in Visualizations the
snapshot store and publisher bodies, `KnowledgeGraphs.php`, the Python tools
and the three largest controllers; in Search `QueryBuilder`, `Reindexer`,
`IncrementalIndexer` and most card components.

Paths are relative to the folder that holds the five checkouts.

## 1. Summary

The five repositories are individually well kept: token discipline, privacy
filtering, release packaging and "comments explain why" are consistent
strengths, and none of the reviews found a security hole. The incoherence is
between them, not inside them:

1. **Domain rules are re-implemented per repository** (what a project is, which
   URIs count as identity links, who counts as a creator, which template is
   which) and some copies have already drifted.
2. **The PHP and DOM contract between theme and modules is real but
   undocumented and untested**; only the token contract has a drift check.
3. **Tooling has diverged**: five version-bump procedures, three PHP test
   harnesses, PHPStan levels 5 to 8, two default branch names, and release
   workflows that gate on different things.
4. **Translation is wired everywhere and delivered nowhere**: no repository
   ships a catalogue, and several strings bypass the extractors.
5. **Many "contract" tests assert on source text**, so they fail on harmless
   refactors and pass on behavioural regressions.

Section 2 lists concrete defects. Sections 3 to 7 are the cross-cutting
themes, section 8 the per-repository detail, section 9 a suggested order.

## 2. Defects worth fixing regardless of any refactoring

| # | Where | What | Status |
|---|---|---|---|
| 1 | `DRE-theme/scripts/vendor-lint.mjs:27` | Default target is `../DRE-Search`; the local checkout and the GitHub repository are `DRESearch`. Locally `npm run vendor:lint` skips Search with a warning and `--check` exits 0. CI passes only because it checks the repository out under the alias. The same name is in `tests/local/modules.spec.mjs:24,161` (those tests skip locally) and `scripts/audit-roadmap.mjs:32`. The vendored files are identical in all three modules today. | verified |
| 2 | `DRE-theme/asset/sass/components/linked-resources/_linked-resources.scss:177,247,277,387`, `metadata/_metadata.scss:287`, `research/_research.scss:50` | `outline: none` beside a box-shadow ring. `docs/DESIGN-INTEGRATION.md` requires `outline: 2px solid transparent`; in forced-colours mode these controls lose their focus indicator. | verified |
| 3 | `DRE-LinkedData/asset/js/dre-linked-data.js:243-264` | `download()` calls `loading()` and ends with `settle('idle', '')`, so a successful CSV or JSON download clears the result table. `await response.blob()` is outside any `try`. | verified in code, not run |
| 4 | `DRE-LinkedData/view/common/block-layout/dre-linked-data.phtml:115` | Emits `dre-ld__notice--stale`; the stylesheet has no such rule, so "Dump is out of date" looks like a neutral notice. | verified |
| 5 | `DRE-SEO/src/Service/Concern/ResourceValueReader.php:52-63` and `DRE-LinkedData/config/module.config.php:196-248` | Two identity-link allowlists: SEO has ten authorities with loose patterns (case-insensitive, `m.` and trailing slash allowed, plus ISNI, DOI, Handle), Linked Data seven strict ones. SEO uses Linked Data's list when that module is active, so an item's `sameAs` will change the day Linked Data is deployed. | verified |
| 6 | `DRESearch/src/svelte/App.svelte:185-190` | View modes are decided from the literal profile names `research_items` and `research_locations`, while the server derives map support from the profile. A renamed or added geo corpus gets a map endpoint and no Map button. | verified |
| 7 | `DREVisualizations/asset/js/core/async.js:97`, `dashboard-explorer.js:206`, `src/Controller/Admin/MaintenanceController.php:160` | "Visualization ready." and "visualizations withdrawn" against the shared British-English glossary; the PHP partial says "Visualisations ready." | verified |
| 8 | `DRE-theme/view/common/pagination.phtml:20,38` | `disabled` attribute on a `<span>`; link class `previous` versus span class `prev`; the `<nav aria-label="Pagination">` renders twice on item browse with the same name. | first point verified, rest as read |
| 9 | `DRE-SEO/src/Service/CitationMeta.php:216` | `DC.date` is taken from the value's string cast. The test shim returns the raw value; core's cast goes through `asHtml()`, which for `numeric:timestamp` may be a localised date. | to verify on a live record |
| 10 | `DRE-theme/helper/RecordAccess.php:52` | Default access page slug is `access`; the reviewer reports the navigation copy expects `access-contact`. If the theme setting is not overridden, "More about access" never renders. | to verify against production settings |
| 11 | `DRE-theme/helper/PwaManifest.php:32` | Hausa (`ha`) is in the right-to-left list; it is normally written in Latin script. | as read |
| 12 | `DRE-SEO/view/dre-seo/admin/seo/dashboard.phtml:112-114` | The regenerate form is a bare `ConfirmForm` with no button label set, so the button documented as "Regenerate" probably reads "Confirm". | to verify |
| 13 | `DRE-SEO/src/Service/HeadWriter.php:140-142` | A `json_encode` failure (invalid UTF-8 in one value) drops the whole JSON-LD block silently. | as read |
| 14 | `DRE-SEO/asset/css/admin.css:9` | `#9a9a9a` on white is about 2.8:1 and is used for explanatory sentences. | as read |

## 3. Shared domain rules live in several repositories

| Rule | Copies | Drift |
|---|---|---|
| "A project is an item of class `foaf:Project`" | theme `helper/RecordAccess.php:54` and `ProjectCollections.php:28`; SEO `ProjectResolver.php:35`, `ResourceValueReader.php:326`, SQL in `SitemapRepository.php`; Search `ResourceScopeResolver.php:31` | The theme's two helpers accept different link types; SEO has three variants of "research item" |
| Identity-link allowlist | SEO and Linked Data | Yes, see defect 5 |
| Creator, editor and description term lists | SEO alone has five lists in three orders; Search mappers and Visualizations carry their own | Yes inside SEO: a podcast with both `dcterms:creator` and `marcrel:hst` gets different authors in JSON-LD and in the citation |
| Template id to meaning | SEO `config/instance.config.php:106-184`; Search `config/module.config.php` profiles; Visualizations `config/amira-profile.json`; Linked Data pins template 6 | Not today, but SEO falls back silently to `CreativeWork` for an unmapped template, which is how templates 24–32 once went live unmapped |
| Item-set ids | SEO, Search and Visualizations each pin the same sets (20, 18, 110, 29918, 39095, 39192, …) | Not checked value by value |
| Typing of a record | SEO types by template id (schema.org); Linked Data by resource class (foaf, fabio, bibo) under the same `@id` | Nothing checks the two agree |
| Bare-DOI regex and host label maps | Three and two copies inside the theme | Yes: only one copy strips a `doi:` prefix, and the two URL normalisers disagree on `www.` |
| Number formatting | theme has three formatters, one using `number_format()`; Search prints an unformatted count | Contradicts `DESIGN-INTEGRATION.md` ("`NumberFormatter` with the site locale") |

Recommendation: reuse the mechanism that already works for tokens. Generate
one **instance contract** file (template ids, item-set ids, class terms, role
term lists, the authority allowlist) from `MongoDB2OmekaS/config/profiles/amira.json`,
vendor it into each consumer with the same hash manifest, and let the existing
"Contract drift" workflow check it. Each module keeps its own config format but
gains a test that its pins equal the contract. Short of that, two cheap steps:
make SEO log or list unmapped template ids on its dashboard, and delete SEO's
fallback allowlist in favour of one list.

## 4. The contract between theme and modules

Only design tokens are documented and checked. In practice the repositories
also depend on each other through:

- **View helpers**: `dreSearchAssets`, `dreSearchBar` (also the theme's
  "is Search installed" test), `dreCitation`, `dreBreadcrumb`, `dreLinkedData`
  (consumed by both the theme and SEO).
- **A service looked up by string**: `DRESearch\Search\CorpusCounts`, in
  `DRE-theme/helper/CollectionStats.php:92` and
  `DREVisualizations/src/Job/PrecomputeDashboards.php:209`. A rename makes
  both degrade silently; neither repository tests the name.
- **Internal class names**: the theme styles `.dre-search-bar__input-wrap` and
  `.dre-search-bar__suggest` (`asset/sass/components/header/_search.scss:89,98`)
  to out-rank a Svelte-scoped rule. Nothing in Search marks them as public.
- **Data attributes and globals**: `data-rv-reveal` is a prefix reserved for
  Visualizations but emitted and observed by the theme too
  (`view/common/resource-card.phtml:58`, `asset/js/reveal.js:25`);
  `window.DRETokens`, `window.DREUtils`, `RV_LIBS`, `RV_MAP_CONFIG`.
- **HTML passed as strings**: the theme echoes `dreCitation`'s `html` raw; it
  is safe because SEO escapes every field, by convention only.
- **Facet and profile names**: the theme links on `research_items` and
  `project_id_s`.
- **Head links**: SEO (`describedby`) and Linked Data (`alternate`) both add
  links to the same four RDF documents.

Recommendations:

1. Extend `docs/DESIGN-INTEGRATION.md` (or add `docs/INTEGRATION-CONTRACT.md`)
   with the helper signatures and return shapes, the service name, the public
   class names and the data attributes. It currently lists three repositories
   and no PHP contract.
2. Add contract tests where the dependency is consumed: the theme's
   `module-integration` CI job already checks the modules out, so it can assert
   that each helper, service and class name still exists.
3. Replace the theme's override of Search's internal classes with custom
   properties exposed on `.dre-search-bar`.
4. Add a test in SEO that a title containing `<script>` is escaped in all
   citation styles.

## 5. Tooling and release divergence

| | theme | Visualizations | Search | SEO | Linked Data |
|---|---|---|---|---|---|
| Default branch | `master` | `main` | `main` | `main` | `main` |
| Version bump | `npm version` (syncs 4 files) | by hand in 4 files, checked afterwards | `npm run bump` | by hand in 2 files | by hand in 2 files |
| Release notes | CHANGELOG section | CHANGELOG section | CHANGELOG section | CHANGELOG section | `--generate-notes` |
| Release gate | re-runs CI | re-runs CI | re-runs CI | unit only, no integration suite | `composer check` on PHP 8.2 only; no smoke test, no PHPStan |
| Actions pinned by SHA | yes | yes | yes | no (`@v7`) | no (`@v7`) |
| PHP tests | plain scripts | plain scripts, 17 assert helpers | PHPUnit 12 | PHPUnit 13 | custom 24-line runner |
| PHPStan level | 6, CI only | 5, empty baseline | 8 | 6, 12 baselined, broad ignores | 6, no baseline |
| phpcs | – | – | PSR-12 | PSR-12 | – |
| Browser engines | 3 | Chromium | Chromium | n/a | no JS test or lint |
| Minimum PHP | CI from 8.1 | 8.4 | 8.4 | 8.4 | 8.2 |
| Omeka constraint | `^4.2.1` | `^4.2.1` | `^4.2.1` | `^4.2.0` | `^4.2.0` |
| `.editorconfig` | yes | yes (copy) | yes (copy) | yes (differs) | missing |
| Agent instructions | `AGENTS.md` + `CLAUDE.md` | none | `CLAUDE.md` | `CLAUDE.md` with paths from another machine | none |
| Changelog heading | `[x] - date` | `[x] - date` | `[x] - date` | `[x] — date` | `[x] — date` |

Recommendations, cheapest first:

1. Pin Actions by SHA in SEO and Linked Data, and make both release workflows
   call their own `ci.yml` as the other three do.
2. Pick one bump mechanism. Search's `bump` script and the theme's
   `npm version` hook both work; Visualizations, SEO and Linked Data edit files
   by hand. SEO and Linked Data have no Node toolchain, so a small PHP or shell
   script with the same behaviour is enough.
3. Align the Omeka constraint (`^4.2.1`) and decide one minimum PHP.
4. Give Visualizations and Linked Data an `AGENTS.md`; fix the stale
   `C:/Users/frede/...` paths in `DRE-SEO/CLAUDE.md:23-25`.
5. Add an opt-in `npm run lint:phpstan` to the theme. Today
   `npm run verify` can be green with zero PHP tests run, because
   `scripts/check-php.mjs` skips with exit 0 when no PHP is found.
6. Longer term, one PHP test harness. PHPUnit is already in two repositories;
   Visualizations has no `composer.json` at all, so the cheap first step there
   is a single shared assert helper.
7. Consider a shared `.github` repository with reusable workflows for the
   release steps (version check, archive, leak check, notes from CHANGELOG),
   which all five now implement separately.

## 6. Testing

- **Source-text contracts.** `DRE-theme/tests/TemplateContractsTest.php`
  asserts on PHP source strings (for example
  `'$value->valueResource()->displayTitle()'`), `scripts/check-touch-targets.mjs`
  uses distance-windowed regexes on Sass, and
  `DREVisualizations/scripts/check-accessibility-contracts.mjs` is 23
  substring checks, one of which pins a duplicated code path in place. The
  theme already has a renderer (`tests/support/ThemeView.php`) and
  Visualizations already tests the same behaviour in Playwright, so many of
  these can become rendered assertions or be retired. This also unblocks the
  theme's value-resolution refactoring (section 8).
- **Fixtures re-typed by hand.** Visualizations' browser fixtures
  (`tests/browser/fixtures.mjs:49-70`) re-write the PHP partials in
  JavaScript. The theme renders its partials through PHP for the same purpose.
- **Templates never rendered.** Theme: pagination, footer, numeric templates,
  several block layouts; `item/browse`, `item-set/browse` and `media/show` are
  only read as text. SEO: both admin views. A typo there is a 500.
- **Untested boundaries.** Search: `SearchController`, the admin POST actions,
  the jobs, the orchestrator, the CLI and the circuit breaker. SEO:
  `CitationController` (404 for private items, ETag, 304). Visualizations:
  admin and embed controllers, the quiet-period refresh loop, the uninstall
  file deletion. Linked Data: install through the module manager, the dump job
  through the dispatcher, and MariaDB (the smoke test uses hand-written SQLite
  tables).
- **JavaScript.** Linked Data has 283 lines with no lint or test (defect 3
  would have been caught). Visualizations unit-tests the core but none of its
  five largest controllers. Search has no test for the map view, export menu,
  year slider or mobile filter drawer, and runs Chromium only although
  `YearRangeFacet.svelte` carries an iOS workaround.
- **No coverage figure anywhere.**
- **Small, high-value additions:** a five-line test that Visualizations'
  palette stops 1–6 equal the vendored `--brand-*` values (the contract says
  they must; nothing checks it); a required-properties-per-`@type` table test
  for SEO's JSON-LD; a count-based rather than per-file token ratchet in the
  theme.

## 7. Design and user-interface consistency

Token consumption is the strongest part of the family: every module names
theme tokens with checked fallbacks. What remains:

- **Shared widgets are re-drawn per module.** Loading, empty and error panels
  with a spinner exist in Visualizations (twice: `core/async.js` and a second
  implementation in `dashboard.js`), Linked Data and Search. Search copies the
  theme's secondary button by hand and defines the visually-hidden rule eleven
  times under five class names. A small theme-owned set of classes (state
  panel, spinner, `sr-only`, chip) would remove the copies.
- **Pagination.** Three implementations in the theme (browse pager,
  linked-resources Previous/Next, core page pagination) and a fourth in
  Search. `DESIGN.md` asks for one control cluster.
- **Chips and pills.** At least six pill styles in the theme with separate
  padding and radius, no shared mixin; Search draws its own.
- **Focus.** The theme breaks its own rule in six places (defect 2); Search
  mixes outline and ring idioms without a documented split.
- **Token gaps the lint does not see.** Raw `rem` spacing in Search
  components, raw durations in the theme's navigation and carousel, 8–10 px
  type in Visualizations' heatmap (below the smallest type token), and admin
  templates in Search and SEO with raw hex. The theme's ratchet is per file,
  so an allow-listed file can gain violations.
- **Dark-mode aliases.** Visualizations keeps two dark blocks that "must stay
  identical" in a 4,868-line stylesheet; loading the theme's generated
  fallback stylesheet would remove both.
- **Script delivery.** The theme minifies everything; Visualizations minifies
  two bundles and ships 30–60 KB controllers readable; Linked Data ships
  unminified.
- **Wording.** British English holds except defect 7.
- **Admin screens** are outside every rule: unescaped translations, raw hex,
  unlabelled table inputs (SEO), two markups for the same warning.

## 8. Per-repository findings

### DRE-theme

- Value-to-label/href resolution is written five times across `RecordAccess`,
  `RecordApparatus` and `RecordIdentifiers`; extract one value reader. The
  source-text test at `tests/TemplateContractsTest.php:47-56` currently blocks
  this.
- `RecordAccess::projectsOf()` re-implements `ProjectCollections::isProject()`
  with different link types; `firstLiteral()` is copied verbatim.
- AMIRA page slugs and navigation copy are hard-coded in
  `view/common/banner.phtml:126-137` and `nav-menu.phtml:12-54`, and again in
  the browser tests. One data file would serve all three.
- `CollectionStats` falls back to counting by template label and item-set
  title; a renamed template silently yields 0.
- `CollectionStats` and `IntegrationWarning` write to the settings table
  during public page views, without a lock, and never delete old cache keys.
- Translated strings are echoed unescaped in about seven templates, while the
  record partials escape all of them; `lint:templates` could enforce it.
- Three naming conventions in the header (BEM, Bootstrap-style utilities,
  snake_case).
- Probably dead Sass: `.lr-type`, `.lr-search__*`; classes emitted with no
  rule: `media-object`, `regions-container--main`.
- `theme-color` metas follow the operating system, not the visitor's explicit
  choice.
- `DESIGN.md:459` mentions `window.DRE_MIRADOR_CONFIG`, which the reviewer did
  not find in the code (to verify).

### DRE Visualizations

- `Aggregators` is about 3,900 lines across eleven traits; the
  `refactor/runner-traits` branch and the roadmap show this is known.
- `Runner` takes 20 constructor parameters, eight of them paths that are
  packed and unpacked three times.
- Numeric ids are central (`config/amira-profile.json`); class and property
  terms are not: `'foaf:Organization'` 13 times, `'dcterms:isPartOf'` 36
  times, the "affiliation" idiom repeated at least eight times.
- Documentation is behind the Runner split (`CONTRIBUTING.md:134,141`,
  `README.md:207,600`, two template docblocks).
- Stat-card labels and radar axes are English literals baked into the
  snapshot (28 of them), outside both string catalogues.
- `asset/data/fulltext/…-words.json` (1.1 MB) is derived from private
  `bibo:content`, generated by hand, served from the public asset tree and
  outside the snapshot withdrawal lifecycle. It carries word counts, not item
  ids, so it looks deliberate; `docs/SECURITY_AND_PRIVACY.md` should say so.
- Word-cloud data refreshes only by manual dispatch.
- Twelve check scripts, three with their own VM sandbox; the behavioural ones
  belong in `tests/js`.
- Dead inline-dashboard path in `dashboard.js:333-343,376-379`; 19
  `innerHTML = ''` clears left after `ns.setChildren` was introduced.
- The anonymous embeddings-refresh POST triggers an outbound GitHub request;
  confirm the throttle is taken before the call (to verify).

### DRE Search

- The six mappers repeat one document skeleton; Podcast and Video are nearly
  line-for-line identical. Extracting it also fixes the thin mapper tests.
- The list of kinds is hand-written in five places; TypeScript types mirror
  the PHP profile by hand and the schema lint covers only a sliver.
- Vocabulary terms appear in mapper code as fallbacks duplicating the profile.
- `Module.php` holds 95 lines of DDL with a hand-kept create/drop pair.
- `ROADMAP.md` and several header comments are behind the code.
- When key minting fails the proxy falls back to the admin key (it never
  reaches the browser); the health endpoint should report it.
- CSS is neither formatted nor linted beyond the token rules.

### DRE SEO

- No public UI: the theme renders everything from `dreCitation()` and
  `dreBreadcrumb()`.
- Template pins live in three maps plus a hand-copied test fixture.
- `CitationFormatter` is bilingual English/French, a leftover of the IWAC
  port; a German page gets English connectives. Generated descriptions
  (" by ", " et al.", "Untitled") and the download labels bypass translation.
- PHPStan ignores `argument.type`, `method.notFound` and `class.notFound`
  globally; analysing against the real Omeka tree, as the theme does, would
  remove that.
- `/cite/{id}` paths are string-built in two places instead of using the
  route.
- Every API save clears the sitemap cache, including during a bulk sync.

### DRE Linked Data

- Not deployed. Before it is:
  - set the base URI in the same step as activation (unset, identifiers follow
    the request host, and SEO uses them as `cite-as`);
  - decide whether `Accept: application/json` on record pages should redirect
    to JSON-LD (it does since 0.6.0, including for jQuery's default header);
  - run the visibility SQL and a full dump once on a MariaDB copy;
  - confirm that Omeka's batch operations fire the events the staleness
    counter listens to, and that the module-config form carries CSRF;
  - bring the release workflow to parity with CI.
- Publication is global, not per site: a public item outside the AMIRA site
  would be published with a page URL that may not exist.
- No translation infrastructure at all (strings are wrapped but never
  extracted); no `.editorconfig`, phpcs, or agent instructions.
- `scripts/lib/VENDORED.sha256` says the token check verifies it; this
  repository's check does not. The CSS header cites a test file that does not
  exist.
- The 0.6.0 changelog records that the documented cron command had failed on
  every install since 0.3.0, so the install path has not been exercised end to
  end.

## 9. Suggested order

**Small and safe (hours each)**

1. Defects 1, 2, 4, 7, 8 and 11; defect 3 with a first JS test for Linked Data.
2. Pin Actions and align release gates in SEO and Linked Data.
3. Palette-versus-brand test in Visualizations; sha-manifest check in Linked
   Data.
4. Stale documentation: Visualizations README and CONTRIBUTING, Search
   ROADMAP and headers, SEO `CLAUDE.md` paths, the theme's `DRE-Search` name.
5. Verify defects 9, 10 and 12 on production.

**Medium (a day or two each)**

6. Write the integration contract and add contract tests to the theme's
   module-integration job.
7. One identity-link allowlist; one creator/description term list in SEO.
8. Search: send `views` in the bootstrap; extract the mapper skeleton.
9. Theme: one value reader, one project predicate; move slugs to a data file.
10. Replace source-text contracts with rendered assertions.
11. One version-bump procedure and one release workflow shape.

**Larger (decide first)**

12. The instance-contract file generated from the sync profile.
13. Translation: either declare the platform English-only in each README, or
    ship `de` and `fr` and fix the strings that bypass the extractors.
14. Theme-owned shared widgets (state panel, spinner, chip, pager).
15. Visualizations: finish the `Aggregators`/`Runner` split; split the
    stylesheet.
16. Linked Data deployment checklist (section 8).
