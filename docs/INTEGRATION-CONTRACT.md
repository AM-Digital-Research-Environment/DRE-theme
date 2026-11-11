# Integration contract: the theme and its modules

The theme and the four DRE modules (DRE Search, DRE Visualizations, DRE SEO and
DRE Linked Data) are separate repositories, released separately, and installed
into one Omeka site independently. Beyond the design tokens, which
[`DESIGN-INTEGRATION.md`](DESIGN-INTEGRATION.md) owns, they depend on each other
through names: view helpers, a service, a route and its parameters, a search
profile and a facet, a resource-page block, CSS custom properties, page events,
data attributes, JavaScript globals, head links and one shared table. This
document lists each name as the code uses it today: who provides it, who
consumes it, its signature or shape, and what happens when it is absent.

Every consumer guards these names (`getHelperPluginManager()->has()`,
`$services->has()`, `window.X || {}`), so a rename never fails loudly: it
degrades to the fallback described below and stays unnoticed. That is why the
names are checked.

## How the contract is checked

The list itself is data:
[`scripts/lib/integration-contract.mjs`](https://github.com/AM-Digital-Research-Environment/DRE-theme/blob/master/scripts/lib/integration-contract.mjs)
(not in the release package, like the rest of `scripts/`).
Each entry below is headed by its `id` in that list, and the check refuses a
list entry this document does not name.

```bash
npm run check:contract   # with the modules checked out beside this repository
```

`scripts/check-integration-contract.mjs` asserts, against the sibling checkouts
(`../DRESearch` or CI's `../DRE-Search`, `../DREVisualizations`, `../DRE-SEO`,
`../DRE-LinkedData`; `scripts/lib/siblings.mjs` finds them), that every helper
is still registered under its exact name in the module's `config/module.config.php`,
that the service is registered and keeps the method and keys the theme reads,
that the profile, facet, route and URL parameters exist in DRE Search, that DRE
Search still reads every `--dre-search-bar-*` property the theme sets, that the
modules still listen for the events the theme's templates trigger, that every
member a module calls on `window.DRETokens` and `window.DREUtils` is one the
theme defines, and that the two copies of the identity table are
byte-identical. The theme half of each entry (the theme still reads what the
list says it reads, and sets exactly the properties listed) runs everywhere.

A module that is not checked out is reported as `MISSING` and its checks are
skipped; under `CI=true` that fails. CI runs the check in the `module-integration`
job of `ci.yml`, which checks the modules out on every push and pull request,
and in the weekly `contract-drift.yml`, which also runs when the contract
changes on `master`. Both check the modules out at their default branch, so a
red run can also mean that a module changed first: fix whichever side drifted.

## At a glance

| `id` | Kind | Provided by | Consumed by (theme unless stated) | Without it |
| --- | --- | --- | --- | --- |
| `dreSearchAssets` | view helper | DRE Search | `view/layout/layout.phtml` | no Search bundle in the head |
| `dreSearchBar` | view helper | DRE Search | `view/common/header.phtml`, `helper/DreSearchUrl.php` | core search form; search links go to core search |
| `dreCitation` | view helper | DRE SEO | `helper/RecordApparatus.php`, `view/common/record-apparatus.phtml` | the curated `dcterms:bibliographicCitation` only |
| `dreBreadcrumb` | view helper | DRE SEO | `view/common/breadcrumb.phtml` | *Home › record* |
| `dreLinkedData` | view helper | DRE Linked Data | `helper/RecordLinkedData.php`; DRE SEO | page URL as permanent link, no RDF or *Same as* rows |
| `DRESearch\Search\CorpusCounts` | service | DRE Search | `helper/CollectionStats.php`; DRE Visualizations | counts from the Omeka API |
| `/dre-search` | route, URL parameters | DRE Search | `helper/DreSearchUrl.php` | `/index/search?fulltext_search=` |
| `research_items` | search profile | DRE Search | `helper/ProjectCollections.php` | (with Search installed) a search that fails |
| `project_id_s` | search facet | DRE Search | `helper/ProjectCollections.php` | (with Search installed) a search that fails |
| `dreSearchProjectRecords` | resource-page block | DRE Search | `view/omeka/site/item/show.phtml` | the linked-resources list stays |
| `--dre-search-bar-*` | CSS custom properties | DRE Search | `asset/sass/components/header/_search.scss` | the bar's own defaults |
| `view.show.before` | page event | theme templates | DRE Visualizations | dashboards without their scripts |
| `view.show.after` | page event | theme templates | DRE SEO, DRE Linked Data | no meta, JSON-LD or alternate links |
| `view.browse.after` | page event | theme templates | DRE SEO, DRE Linked Data | no browse metadata or item-set alternates |
| `view.layout` | page event | `view/layout/layout.phtml` | DRE SEO | no site-wide metadata |
| `data-rv-reveal` | data attribute | DRE Visualizations (name) | theme and DRE Visualizations, both ways | content simply shows |
| `window.DRETokens` | global | theme | DRE Search, DRE Visualizations | each module's own token reader |
| `window.DREUtils` | global | theme | DRE Search, DRE Visualizations | each surface's own status node |
| `RV_LIBS` | global | DRE Visualizations | DRE Search | Search loads MapLibre from a CDN (with SRI) |
| `RV_MAP_CONFIG` | global | DRE Visualizations | DRE Search | Search maps use Carto's basemap styles |
| `describedby` | head link | DRE SEO | harvesters | — |
| `alternate` | head link | DRE Linked Data | harvesters | — |
| `config/identity-authorities.php` | shared table | DRE Linked Data (DRE SEO copies it) | DRE SEO; theme labels | — |

## View helpers

The theme never calls a module helper unguarded except where noted, and it
never renders a module helper's result without reading it through its own
helper first.

### `dreSearchAssets`

- **Provider:** DRE Search, `config/module.config.php` (`view_helpers.invokables`),
  `src/View/Helper/SearchAssets.php`.
- **Signature:** `dreSearchAssets(): string`. Always returns `''`; on a site
  route it injects DRE Search's bundle through `src/View/BundleAssets.php`
  (head preloads, the entry module script in `inlineScript()`).
- **Consumer:** `view/layout/layout.phtml`, before the head is rendered, so the
  header bar (layout chrome) has the bundle on every page, not only on pages
  with a search block.
- **Absent:** guarded by `has('dreSearchAssets')`; nothing is injected.
- **Not guarded against a throw.** The call is not in a `try`, and the layout
  runs on every page: a helper that throws is a site-wide 500. The helper
  itself only reads the current site.

### `dreSearchBar`

- **Provider:** DRE Search, `config/module.config.php` (`view_helpers.factories`),
  `src/View/Helper/SearchBar.php`.
- **Signature:** `dreSearchBar(string $id, string $class = '', bool $collapsible = false): string`.
  Returns `''` outside a site, otherwise:

  ```html
  <div class="main-header__search-bar {class}" data-dre-search-bar data-dre-bar-id="{id}">
    <div class="dre-search-bar__skeleton" aria-hidden="true"></div>
    <noscript><a href="/s/{slug}/dre-search">Search</a></noscript>
  </div>
  <script type="application/json" id="dre-search-bar-state-{id}">{bootstrap}</script>
  ```

  The bundle mounts the bar inside the wrapper: a `.dre-search-bar` root with
  `role="search"`, the field (`role="combobox"`) and the suggestions
  (`role="listbox"`). The wrapper's class `main-header__search-bar` is the
  theme's; DRE Search's `asset/css/dre-search.css` gives it `position: relative`.
- **Consumers:**
  - `view/common/header.phtml` renders it twice:
    `dreSearchBar('header-mobile', 'd-block d-xl-none', true)` as a direct
    child of `.main-header__main-bar` (the mobile magnifier) and
    `dreSearchBar('header-desktop', 'main-header__search-field', false)` inside
    `.main-header__search`. `asset/sass/components/header/_search.scss` styles
    both through the custom properties below.
  - `helper/DreSearchUrl.php`: `has('dreSearchBar')` is the theme's one test of
    "is DRE Search installed", which picks the search URL, its parameter and
    whether `filtered()` links exist.
- **Absent:** the header renders `common/main-header-search` (core site
  search), and every search link goes to core search.
- **Not guarded against a throw**, like `dreSearchAssets`, and for the same
  reason a site-wide risk.

### `dreCitation`

- **Provider:** DRE SEO, `config/module.config.php` (`view_helpers.factories`),
  `src/View/Helper/Citation.php`.
- **Signature:** `dreCitation(ItemRepresentation $item): ?array`. Typed on an
  *item*: the theme calls it from the item page only (`record-apparatus` is
  rendered by `view/omeka/site/item/show.phtml`); any other resource is a
  `TypeError`, which the theme catches and logs.
- **Returns:** `null` when the feature is off, otherwise:

  ```php
  [
      'citable'      => bool,              // false: a person, place, subject…
      'citeAs'       => 'work' | 'entry',  // DRE SEO 0.11+
      'record'       => array,             // CitationRecord::toArray()
      'defaultStyle' => string,            // 'curated' when a curator wrote one
      'styles'       => [id => ['label' => string, 'html' => string], …],
      'downloads'    => [format => ['url' => string, 'label' => string, 'ext' => string], …],
  ]
  ```

- **Consumer:** `helper/RecordApparatus.php` (guarded by `has('dreCitation')`
  and a `try`; a throw is reported through `IntegrationWarning`) and
  `view/common/record-apparatus.phtml`. The theme reads `citable`, `citeAs`,
  `defaultStyle`, `styles[*].label`, `styles[*].html`, `downloads[*].url` and
  `downloads[*].label`. It does not read `record` or `downloads[*].ext`.
- **`html` is echoed raw.** `record-apparatus.phtml` prints `$style['html']`
  without escaping, because the formatter's own `<em>` and record link are
  markup. It is safe only because DRE SEO escapes every field: the formatter
  escapes each value, and its `CitationFormatterTest::testNoFieldCarriesMarkupThroughAnyStyleOrKind`
  feeds hostile markup through every field, kind and style and allows only
  `<em>` and the link through. The hand-entered `curated` style is escaped with
  `htmlspecialchars()` in `Citation.php` itself; that path has no test of its
  own in DRE SEO. Both the test and the escaping call are in the contract check.
- **Absent, `null` or throwing:** the panel shows the record's curated
  `dcterms:bibliographicCitation`, as before the module existed.

### `dreBreadcrumb`

- **Provider:** DRE SEO, `config/module.config.php` (`view_helpers.factories`),
  `src/View/Helper/Breadcrumb.php`; the trail is built by
  `src/Service/BreadcrumbTrail.php`, the same that states the page's
  `BreadcrumbList`.
- **Signature:** `dreBreadcrumb(AbstractResourceEntityRepresentation $resource): ?array`.
- **Returns:** `[['name' => string, 'url' => string], …]` from the site's home
  page to the record, or `null` outside a site or when the record has no page
  in it. The helper catches its own errors and returns `null`.
- **Consumer:** `view/common/breadcrumb.phtml` reads `name` and `url`, labels the
  first crumb *Home* (the trail names it by the site title), and leaves the
  last unlinked.
- **Absent, `null`, fewer than two crumbs or throwing:** *Home › record*. A throw
  is caught silently here, without an `IntegrationWarning`.

### `dreLinkedData`

- **Provider:** DRE Linked Data, `config/module.config.php` (`view_helpers.aliases`
  to `View\Helper\LinkedData`; the same name is also a site block layout),
  `src/View/Helper/LinkedData.php`.
- **Signature:** `dreLinkedData(?AbstractResourceEntityRepresentation $resource = null): self|array`.
  Without an argument it returns the helper, whose `dataset()` describes the
  dataset (DRE SEO reads that; the theme does not).
- **Returns:** `[]` for anything not public or not an item, item set or media,
  otherwise:

  ```php
  [
      'uri'       => '{base}/resource/{id}',  // the persistent identifier
      'page'      => string|null,             // null without a site
      'sameAs'    => [string, …],             // owl:sameAs / skos:exactMatch IRIs
      'downloads' => [['label' => 'Turtle', 'type' => 'text/turtle', 'url' => '…/resource/{id}.ttl'], …],
  ]
  ```

  `downloads` comes from `src/Rdf/Format.php`: Turtle, N-Triples, JSON-LD and
  RDF/XML today.
- **Consumers:** `helper/RecordLinkedData.php` (guarded by `has()` and a `try`;
  a throw is reported through `IntegrationWarning`) reads every key above,
  keeps only `http(s)` URLs, turns `null` `page` into `''`, and labels each
  `sameAs` IRI by host (see the identity table). `helper/RecordApparatus.php`
  shows `uri` as the *Permanent link*. DRE SEO reads the same helper through
  `src/Service/LinkedDataIdentityFactory.php` for `cite-as`, Signposting and
  JSON-LD.
- **Absent, `[]` or throwing:** the page URL is the permanent link and the
  linked-data and *Same as* rows are not shown.

## A service looked up by name

### `DRESearch\Search\CorpusCounts`

- **Provider:** DRE Search, `config/module.config.php`
  (`service_manager.factories`, `Search\CorpusCounts::class` under
  `namespace DRESearch`), `src/Search/CorpusCounts.php`.
- **Signature:** `forSite(?int $siteId = null): array`, returning
  `list<array{k: string, l: string, n: int, s: string}>`: one row per metric,
  in the order of `CorpusCounts::METRICS`, `researchItems`, `projects`,
  `people`, `organisations`, `locations`, `languages`, `subjectsTags`,
  `publications`, `podcasts`, `youtube`; a metric whose profile is not
  configured is left out.
- **Consumers:**
  - `helper/CollectionStats.php` fetches it from the site's service locator by
    the string `'DRESearch\Search\CorpusCounts'`, validates `k` (string) and `n`
    (numeric), relabels `l` and the banner (`view/common/banner.phtml`) prints
    `l`, `n` and `s`. The metric keys are also the keys of `statPages` in
    `config/amira-pages.php`, the page each count links to, and the order of
    the theme's own fallback list.
  - DRE Visualizations, `src/Job/PrecomputeDashboards.php`, by the same string,
    for the snapshot's corpus statistics.
- **Absent or throwing:** the theme counts through the Omeka API by template
  label and item-set title (slower, and a renamed template reads as 0, which it
  logs); a throw is reported through `IntegrationWarning`. Visualizations
  stores no corpus statistics.

## DRE Search's routes, profiles and facets

### `/dre-search`

- **Provider:** DRE Search: the site child route `site/dre-search`
  (`/s/{slug}/dre-search`) in `config/module.config.php`; the page reads `q`,
  `profile` and `f.{field}` (repeatable) from its URL (`src/svelte/lib/urlState.ts`).
- **Consumer:** `helper/DreSearchUrl.php`: `DreSearchUrl($q)` gives
  `/s/{slug}/dre-search?q=…` (masthead, browse pages, PWA shortcut, error pages,
  legacy redirects) and `filtered($profile, $facets)` gives
  `…/dre-search?profile={profile}&f.{field}={value}`.
- **Absent:** `/s/{slug}/index/search?fulltext_search=…`; `filtered()` returns `''`.

### `research_items`

The research-items search profile (resource template 10), a key of
`dre_search.profiles` in DRE Search's `config/module.config.php`.
`helper/ProjectCollections.php::recordsUrl()` opens it filtered on a project.

### `project_id_s`

A filter-only field of `research_items` (`'facet' => true`, never a sidebar
facet): the project's item id, so a project's records link survives a title
change (DRE Search 1.35+, after a reindex). `ProjectCollections::recordsUrl()`
links `filtered('research_items', ['project_id_s' => id])`. Without DRE Search
the link is core's item browse on `dcterms:isPartOf`; with a DRE Search whose
index lacks the field, the search fails, which is why theme 2.48.0 had to
deploy after DRE Search 1.35.

### `dreSearchProjectRecords`

DRE Search's resource-page block (`resource_page_block_layouts`, placed in
`items.main` by default). `view/omeka/site/item/show.phtml` looks it up by name
in the item's main blocks: when it rendered something, the generic
`linkedResources` list is dropped (on a project it lists the same records), and
it is moved to the head of the context blocks.

## The search bar's styling surface

### `--dre-search-bar-*`

DRE Search's README ("Styling the header search bar") declares the bar's class
names below `.dre-search-bar` internal and exposes these custom properties,
read in `src/svelte/components/SearchBar.svelte`; set on `.dre-search-bar` or
any ancestor, each defaults to the bar's own look.

| Property | Search's default | Theme sets (`_search.scss`) |
| --- | --- | --- |
| `--dre-search-bar-position` | `relative` | mobile: `static` |
| `--dre-search-bar-min-height` | `auto` | desktop: `var(--size-control-lg)` |
| `--dre-search-bar-radius` | `var(--radius-full)` | — |
| `--dre-search-bar-suggest-offset` | `var(--space-1)` | mobile: `calc(var(--space-2) + var(--size-control-lg) + var(--space-2))` |
| `--dre-search-bar-suggest-inset-inline-start` | `auto` | desktop: `0`; mobile: `var(--space-3)` |
| `--dre-search-bar-suggest-inset-inline-end` | `0` | desktop: `0`; mobile: `var(--space-3)` |
| `--dre-search-bar-suggest-width` | `min(26rem, 92vw)` | `auto` |
| `--dre-search-bar-suggest-max-width` | `none` | desktop: `none` |
| `--dre-search-bar-overlay-inset-inline-start` | `auto` | mobile: `var(--space-3)` |
| `--dre-search-bar-overlay-inset-inline-end` | `0` | mobile: `var(--space-3)` |
| `--dre-search-bar-overlay-width` | `min(20rem, 80vw)` | mobile: `auto` |
| `--dre-search-bar-overlay-top` | `50%` | mobile: `100%` |
| `--dre-search-bar-overlay-transform` | `translateY(-50%)` | mobile: `translateY(var(--space-2))` |

The theme sets them on its own wrappers: `.main-header__search` (desktop) and
`.main-header__search-bar.d-xl-none` (mobile, which also takes
`position: static` itself so the field and its suggestions anchor to the header
row). The desktop field fills its tier with suggestions spanning it; the mobile
field drops below the header row inside 12px gutters, with its suggestions
below it.

DRE Search 1.35.0, the release deployed when this was written, reads none of
them. Until the release that does (the first after 1.35.0, DRE Search #59) is
deployed, a clearly marked compatibility block in `_search.scss` sets the same
values on the internal classes `.dre-search-bar__input-wrap`,
`.dre-search-bar__suggest` and `.dre-search-bar--collapsible`; delete it then.
`tests/local/modules.spec.mjs` checks the header bar's geometry with the sibling
Search build, as shipped and, when that build reads the properties, with the
compatibility block removed.

## Page events

Omeka's own templates trigger these events; a theme that overrides a template
must trigger them too, or the module that listens does nothing on that page.

### `view.show.before`

Triggered by `view/omeka/site/item/show.phtml` (before any resource-page block
renders, and its output buffered and printed in its usual place) and
`view/omeka/site/media/show.phtml`. DRE Visualizations listens on the item and
item-set show pages to add its dashboard scripts; fired after the blocks, as it
once was, the dashboards broke.

### `view.show.after`

Triggered by `view/omeka/site/item/show.phtml` and `view/omeka/site/media/show.phtml`
(the item-set show page is core's template). DRE SEO listens on item, item-set
and media pages (meta, JSON-LD, Signposting) and on pages; DRE Linked Data adds
its `alternate` links.

### `view.browse.after`

Triggered by `view/omeka/site/item/browse.phtml`, `view/omeka/site/item-set/browse.phtml`
and `view/hierarchy/site/index/hierarchy.phtml`. DRE SEO listens for browse
metadata; DRE Linked Data for the item-set landing page
(`/s/{slug}/item-set/{id}` is the item browse).

### `view.layout`

Triggered by `view/layout/layout.phtml` on every page; DRE SEO adds its
site-wide head output.

## Data attributes and globals

### `data-rv-reveal`

- **Owner:** DRE Visualizations (the `rv-` prefix), with the theme as an equal
  user: `data-rv-reveal="<delay ms>"` marks an element that fades and rises as
  it enters the viewport, and the observer moves `data-reveal` from `hidden` to
  `shown`. The CSS is duplicated byte for byte (`utilities/_reveal.scss` and
  the module's `[data-reveal]` rules), and both honour reduced motion.
- **Emitters:** the theme's `view/common/resource-card.phtml`; DRE
  Visualizations' `view/common/block-layout/featured-collections.phtml`.
- **Observers:** the theme's `asset/js/reveal.js` and DRE Visualizations'
  `asset/js/core/reveal.js`. Each observes *every* `[data-rv-reveal]` on the
  page. They differ: the theme leaves elements already on screen alone (no
  flash, no delayed paint), the module hides every one. On a page that loads
  both, theme cards above the fold are hidden by the module and shown again
  when its observer fires.
- **Absent (no script, no observer, reduced motion):** content simply shows;
  nothing sets `data-reveal`.

### `window.DRETokens`

- **Provider:** the theme, `asset/js/dre-token-bridge.js`, on every page:
  `cssColor`, `cssFont`, `cssValue`, `toRGB`, `isDark`, `onThemeChange`
  ([`DESIGN-INTEGRATION.md`](DESIGN-INTEGRATION.md), "JavaScript token bridge").
- **Consumers:** DRE Search, `src/svelte/lib/tokenBridge.ts` (`toRGB`,
  `cssColor`, `cssFont`, `isDark`, `onThemeChange`); DRE Visualizations,
  `asset/js/core/theme.js` (the same five).
- **Absent:** each module resolves tokens itself (a probe element and a 1×1
  canvas) and follows `prefers-color-scheme` only when no `data-theme` is set.

### `window.DREUtils`

- **Provider:** the theme, `asset/js/utils.js`: `onReady`, `debounce`,
  `announce`, `flashLabel` ([`DESIGN-INTEGRATION.md`](DESIGN-INTEGRATION.md),
  "Theme JavaScript API").
- **Consumers:** DRE Search, `src/svelte/lib/announce.ts` (`announce`); DRE
  Visualizations, `asset/js/core/async.js` (`announce`) and
  `asset/js/core/embed.js` (`flashLabel`).
- **Absent:** each surface announces through its own status node.

### `RV_LIBS`

Not a theme name: DRE Visualizations' `asset/js/core/base.js` publishes the
vendored library URLs (MapLibre, ECharts, d3) from its inert
`<script type="application/json" id="rv-config-N">` blocks, and DRE Search's
`src/svelte/lib/maplibreLoader.ts` loads MapLibre from it, so the page holds
one same-origin copy. Without it Search uses a copy already on the page, else
its pinned CDN copy with Subresource Integrity.

### `RV_MAP_CONFIG`

The same route for the shared basemap configuration (`lightStyle`,
`darkStyle`, `glyphs`, `attribution`, `selfHosted`); DRE Search reads
`lightStyle` and `darkStyle` with `||`, never `??`
([`DESIGN-INTEGRATION.md`](DESIGN-INTEGRATION.md), "Maps"), and falls back to
Carto's styles without it.

## Head links

### `describedby`

DRE SEO, `src/Service/Signposting.php`: `<link rel="describedby">` (and the
same set in the HTTP `Link` header) for the `/cite` CSL JSON, BibTeX and RIS
downloads of an item, and for DRE Linked Data's RDF documents
(`dreLinkedData`'s `downloads`), or Omeka's API JSON-LD without the module.

### `alternate`

DRE Linked Data, `Module.php` (`view.show.after`, `view.browse.after`):
`<link rel="alternate">` to the same RDF documents, by media type. So with both
modules a record page links each RDF document twice, once per relation; both
are correct (FAIR Signposting reads `describedby`, content negotiation and
crawlers `alternate`). The theme adds neither.

## The identity-link table

### `config/identity-authorities.php`

DRE Linked Data's table of the authorities whose IRIs are identity links
(Wikidata, Library of Congress, GND, VIAF, ORCID, ISNI, ROR, GeoNames: a
`label`, a `pattern` and the `canonical` IRI). DRE SEO carries a byte-identical
copy; both modules pin its sha256 in their tests. It drives `dreLinkedData`'s
`sameAs` and DRE SEO's JSON-LD `sameAs`.

The theme does not read the table. It labels each `sameAs` IRI by host with
its own `RecordLinkedData::REGISTERS`, which also covers registers the table
does not (DOI, IdRef, OpenAlex, BnF). The contract check asserts that every
authority's canonical host has an entry there with the same label, so a new
authority is not shown as a bare host name.

## Theme helpers are theme-internal

`ValueReader`, `FormatNumber`, `ProjectCollections` and `IntegrationWarning`
are not part of the contract: no module calls them. DRE Visualizations has its
own `Precompute\ProjectCollections` and DRE SEO its own `ResourceValueReader`,
separate implementations of related rules. Should a module start calling a
theme helper, add it here and to the contract list first.

## Changing a name

1. Add the new name beside the old one in the providing repository, and keep
   the old one for at least one release.
2. Move the consumers, then update this document and
   `scripts/lib/integration-contract.mjs` in the same change as the consumer.
3. Note it under `[Unreleased]` in each repository's `CHANGELOG.md`, with the
   deploy order when it matters (as theme 2.48.0 did for `project_id_s`).
4. Remove the old name in a later, coordinated release.
