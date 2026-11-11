/**
 * The PHP and DOM contract between DRE-theme and its modules, as data.
 *
 * docs/INTEGRATION-CONTRACT.md explains each entry; this list is what
 * `npm run check:contract` (scripts/check-integration-contract.mjs) asserts
 * against the sibling checkouts, and the document must name every entry `id`
 * and every custom property listed here, so the two cannot drift apart.
 *
 * Each entry: `id` (the name the document uses), `kind`, `owner` (the
 * repository that defines the name) and `checks`, each of which names the
 * repository it reads (`theme`, or a key of scripts/lib/siblings.mjs) and a
 * path inside it. A check whose repositories are all `theme` runs everywhere;
 * one that reads a module runs only where that module is checked out.
 *
 * Check types (implemented in check-integration-contract.mjs):
 *
 *   includes    every `text` (a string, or a RegExp source written as
 *               {re: '…'}) occurs in the file
 *   helper      `name` is registered under `view_helpers` in the config file,
 *               as a factory, an invokable or an alias
 *   keys        every key occurs as an array key (`'key' =>`) in the files,
 *               comments excluded: what a helper or service returns
 *   reads       every key is read as `['key']` somewhere in the files: what
 *               the consumer actually uses of that return value
 *   members     every member the consumers call (`pattern`, group 1, inside
 *               the optional `block`) is one the provider defines
 *   properties  the custom properties the theme's file sets are exactly
 *               `names`, and the module's file reads each with `var(--name`
 *   listKeys    the keys of the PHP array constant or config list, in order,
 *               equal `keys`
 *   identical   the files are byte-identical
 *   registers   every identity authority in the table (`label`,
 *               `canonical`) has the same label in the theme's REGISTERS for
 *               its canonical host
 */

/** Where the human-readable contract lives; it must name every entry. */
export const DOCUMENT = 'docs/INTEGRATION-CONTRACT.md';

const re = (source) => ({ re: source });

export const CONTRACT = [
  // --- View helpers ---------------------------------------------------------
  {
    id: 'dreSearchAssets',
    kind: 'view helper',
    owner: 'search',
    checks: [
      { type: 'helper', repo: 'search', file: 'config/module.config.php', name: 'dreSearchAssets' },
      { type: 'includes', repo: 'search', file: 'src/View/Helper/SearchAssets.php', text: [re(String.raw`function __invoke\(\)\s*:\s*string`)] },
      { type: 'includes', repo: 'theme', file: 'view/layout/layout.phtml', text: ["has('dreSearchAssets')", 'echo $this->dreSearchAssets();'] },
    ],
  },
  {
    id: 'dreSearchBar',
    kind: 'view helper',
    owner: 'search',
    checks: [
      { type: 'helper', repo: 'search', file: 'config/module.config.php', name: 'dreSearchBar' },
      {
        type: 'includes', repo: 'search', file: 'src/View/Helper/SearchBar.php',
        text: [
          re(String.raw`function __invoke\(string \$id, string \$class = '', bool \$collapsible = false`),
          "'main-header__search-bar '",
          'data-dre-search-bar',
        ],
      },
      {
        type: 'includes', repo: 'theme', file: 'view/common/header.phtml',
        text: ["has('dreSearchBar')", "dreSearchBar('header-mobile', 'd-block d-xl-none', true)", "dreSearchBar('header-desktop', 'main-header__search-field', false)"],
      },
      { type: 'includes', repo: 'theme', file: 'helper/DreSearchUrl.php', text: ["has('dreSearchBar')"] },
      { type: 'includes', repo: 'theme', file: 'asset/sass/components/header/_search.scss', text: ['.main-header__search-bar.d-xl-none'] },
    ],
  },
  {
    id: 'dreCitation',
    kind: 'view helper',
    owner: 'seo',
    checks: [
      { type: 'helper', repo: 'seo', file: 'config/module.config.php', name: 'dreCitation' },
      { type: 'includes', repo: 'seo', file: 'src/View/Helper/Citation.php', text: [re(String.raw`function __invoke\(ItemRepresentation \$item\)\s*:\s*\?array`)] },
      {
        type: 'keys', repo: 'seo', files: ['src/View/Helper/Citation.php'],
        keys: ['citable', 'citeAs', 'defaultStyle', 'styles', 'downloads', 'label', 'html', 'url'],
      },
      // The theme echoes `html` raw (view/common/record-apparatus.phtml), so
      // DRE SEO's escaping is part of the contract and must stay tested there.
      { type: 'includes', repo: 'seo', file: 'tests/Service/CitationFormatterTest.php', text: ['testNoFieldCarriesMarkupThroughAnyStyleOrKind'] },
      { type: 'includes', repo: 'seo', file: 'src/View/Helper/Citation.php', text: ["htmlspecialchars($curated, ENT_QUOTES, 'UTF-8')"] },
      { type: 'includes', repo: 'theme', file: 'helper/RecordApparatus.php', text: ["has('dreCitation')", '$view->dreCitation($resource)'] },
      {
        type: 'reads', repo: 'theme', files: ['helper/RecordApparatus.php', 'view/common/record-apparatus.phtml'],
        keys: ['citable', 'citeAs', 'defaultStyle', 'styles', 'downloads', 'label', 'html', 'url'],
      },
      { type: 'includes', repo: 'theme', file: 'view/common/record-apparatus.phtml', text: ["<?php echo $style['html']; ?>"] },
    ],
  },
  {
    id: 'dreBreadcrumb',
    kind: 'view helper',
    owner: 'seo',
    checks: [
      { type: 'helper', repo: 'seo', file: 'config/module.config.php', name: 'dreBreadcrumb' },
      { type: 'includes', repo: 'seo', file: 'src/View/Helper/Breadcrumb.php', text: [re(String.raw`function __invoke\(AbstractResourceEntityRepresentation \$resource\)\s*:\s*\?array`)] },
      { type: 'keys', repo: 'seo', files: ['src/Service/BreadcrumbTrail.php'], keys: ['name', 'url'] },
      { type: 'includes', repo: 'theme', file: 'view/common/breadcrumb.phtml', text: ["has('dreBreadcrumb')", '$this->dreBreadcrumb($resource)'] },
      { type: 'reads', repo: 'theme', files: ['view/common/breadcrumb.phtml'], keys: ['name', 'url'] },
    ],
  },
  {
    id: 'dreLinkedData',
    kind: 'view helper',
    owner: 'linkedData',
    checks: [
      { type: 'helper', repo: 'linkedData', file: 'config/module.config.php', name: 'dreLinkedData' },
      { type: 'includes', repo: 'linkedData', file: 'src/View/Helper/LinkedData.php', text: [re(String.raw`function __invoke\(\?AbstractResourceEntityRepresentation \$resource = null\)`)] },
      { type: 'keys', repo: 'linkedData', files: ['src/View/Helper/LinkedData.php'], keys: ['uri', 'page', 'sameAs', 'downloads'] },
      { type: 'keys', repo: 'linkedData', files: ['src/Rdf/Format.php'], keys: ['label', 'type', 'url'] },
      { type: 'includes', repo: 'theme', file: 'helper/RecordLinkedData.php', text: ["has('dreLinkedData')", '$view->dreLinkedData($resource)'] },
      { type: 'reads', repo: 'theme', files: ['helper/RecordLinkedData.php'], keys: ['uri', 'page', 'sameAs', 'downloads', 'label', 'type', 'url'] },
      // DRE SEO is the module's other consumer: Signposting and JSON-LD.
      { type: 'includes', repo: 'seo', file: 'src/Service/LinkedDataIdentityFactory.php', text: ["has('dreLinkedData')"] },
    ],
  },

  // --- A service looked up by name -----------------------------------------
  {
    id: 'DRESearch\\Search\\CorpusCounts',
    kind: 'service',
    owner: 'search',
    checks: [
      { type: 'includes', repo: 'search', file: 'config/module.config.php', text: ['namespace DRESearch;', 'Search\\CorpusCounts::class =>'] },
      {
        type: 'includes', repo: 'search', file: 'src/Search/CorpusCounts.php',
        text: ['namespace DRESearch\\Search;', re(String.raw`class CorpusCounts\b`), re(String.raw`public function forSite\(\?int \$siteId = null\)\s*:\s*array`)],
      },
      { type: 'keys', repo: 'search', files: ['src/Search/CorpusCounts.php'], keys: ['k', 'l', 'n', 's'] },
      // The metric keys, in order: the masthead links each to a page
      // (config/amira-pages.php statPages) and the theme's fallback emits the
      // same list when DRE Search is absent.
      {
        type: 'listKeys', repo: 'search', file: 'src/Search/CorpusCounts.php', list: 'METRICS',
        keys: ['researchItems', 'projects', 'people', 'organisations', 'locations', 'languages', 'subjectsTags', 'publications', 'podcasts', 'youtube'],
      },
      {
        type: 'listKeys', repo: 'theme', file: 'config/amira-pages.php', list: 'statPages',
        keys: ['researchItems', 'projects', 'people', 'organisations', 'locations', 'languages', 'subjectsTags', 'publications', 'podcasts', 'youtube'],
      },
      { type: 'includes', repo: 'theme', file: 'helper/CollectionStats.php', text: ["'DRESearch\\Search\\CorpusCounts'", '->forSite($siteId)'] },
      { type: 'reads', repo: 'theme', files: ['helper/CollectionStats.php', 'view/common/banner.phtml'], keys: ['k', 'l', 'n', 's'] },
      { type: 'includes', repo: 'visualizations', file: 'src/Job/PrecomputeDashboards.php', text: ["'DRESearch\\Search\\CorpusCounts'", '->forSite($siteId)'] },
    ],
  },

  // --- DRE Search's routes, profiles and facets ------------------------------
  {
    id: '/dre-search',
    kind: 'route and URL parameters',
    owner: 'search',
    checks: [
      { type: 'includes', repo: 'search', file: 'config/module.config.php', text: [re(String.raw`'dre-search' => \[\s*'type'\s*=> \\Laminas\\Router\\Http\\Literal::class,\s*'options' => \[\s*'route'\s*=> '/dre-search',`)] },
      { type: 'includes', repo: 'search', file: 'src/svelte/lib/urlState.ts', text: ["FILTER_PREFIX = 'f.'", "PROFILE_KEY = 'profile'", "params.get('q')"] },
      { type: 'includes', repo: 'theme', file: 'helper/DreSearchUrl.php', text: ["'/dre-search'", "'profile='", "'f.'", "? 'q' :"] },
    ],
  },
  {
    id: 'research_items',
    kind: 'search profile',
    owner: 'search',
    checks: [
      { type: 'includes', repo: 'search', file: 'config/module.config.php', text: [re(String.raw`'profiles' => \[\s*(?://[^\n]*\s*)*'research_items' => \[`)] },
      { type: 'includes', repo: 'theme', file: 'helper/ProjectCollections.php', text: ["filtered('research_items'"] },
    ],
  },
  {
    id: 'project_id_s',
    kind: 'search facet',
    owner: 'search',
    checks: [
      { type: 'includes', repo: 'search', file: 'config/module.config.php', text: [re(String.raw`'project_id_s' => \[[^\]]*'facet' => true`)] },
      { type: 'includes', repo: 'theme', file: 'helper/ProjectCollections.php', text: ["['project_id_s' =>"] },
    ],
  },
  {
    id: 'dreSearchProjectRecords',
    kind: 'resource page block',
    owner: 'search',
    checks: [
      { type: 'includes', repo: 'search', file: 'config/module.config.php', text: ["'dreSearchProjectRecords' =>"] },
      { type: 'includes', repo: 'theme', file: 'view/omeka/site/item/show.phtml', text: ["$mainBlocks['dreSearchProjectRecords']"] },
    ],
  },

  // --- The search bar's public styling surface -------------------------------
  {
    id: '--dre-search-bar-*',
    kind: 'CSS custom properties',
    owner: 'search',
    checks: [
      {
        type: 'properties', repo: 'search', file: 'src/svelte/components/SearchBar.svelte',
        theme: 'asset/sass/components/header/_search.scss',
        names: [
          '--dre-search-bar-min-height',
          '--dre-search-bar-position',
          '--dre-search-bar-suggest-inset-inline-start',
          '--dre-search-bar-suggest-inset-inline-end',
          '--dre-search-bar-suggest-width',
          '--dre-search-bar-suggest-max-width',
          '--dre-search-bar-suggest-offset',
          '--dre-search-bar-overlay-inset-inline-start',
          '--dre-search-bar-overlay-inset-inline-end',
          '--dre-search-bar-overlay-width',
          '--dre-search-bar-overlay-top',
          '--dre-search-bar-overlay-transform',
        ],
      },
    ],
  },

  // --- Page events the theme's templates must trigger -------------------------
  {
    id: 'view.show.before',
    kind: 'view event',
    owner: 'theme',
    checks: [
      { type: 'includes', repo: 'theme', file: 'view/omeka/site/item/show.phtml', text: ["$this->trigger('view.show.before')"] },
      { type: 'includes', repo: 'visualizations', file: 'Module.php', text: ["'view.show.before'"] },
    ],
  },
  {
    id: 'view.show.after',
    kind: 'view event',
    owner: 'theme',
    checks: [
      { type: 'includes', repo: 'theme', file: 'view/omeka/site/item/show.phtml', text: ["$this->trigger('view.show.after')"] },
      { type: 'includes', repo: 'theme', file: 'view/omeka/site/media/show.phtml', text: ["$this->trigger('view.show.after')"] },
      { type: 'includes', repo: 'seo', file: 'Module.php', text: ["'view.show.after'"] },
      { type: 'includes', repo: 'linkedData', file: 'Module.php', text: ["'view.show.after'"] },
    ],
  },
  {
    id: 'view.browse.after',
    kind: 'view event',
    owner: 'theme',
    checks: [
      { type: 'includes', repo: 'theme', file: 'view/omeka/site/item/browse.phtml', text: ["$this->trigger('view.browse.after')"] },
      { type: 'includes', repo: 'seo', file: 'Module.php', text: ["'view.browse.after'"] },
      { type: 'includes', repo: 'linkedData', file: 'Module.php', text: ["'view.browse.after'"] },
    ],
  },
  {
    id: 'view.layout',
    kind: 'view event',
    owner: 'theme',
    checks: [
      { type: 'includes', repo: 'theme', file: 'view/layout/layout.phtml', text: ["$this->trigger('view.layout')"] },
      { type: 'includes', repo: 'seo', file: 'Module.php', text: ["'view.layout'"] },
    ],
  },

  // --- Data attributes and globals -------------------------------------------
  {
    id: 'data-rv-reveal',
    kind: 'data attribute',
    owner: 'visualizations',
    checks: [
      { type: 'includes', repo: 'theme', file: 'view/common/resource-card.phtml', text: ['data-rv-reveal="'] },
      { type: 'includes', repo: 'theme', file: 'asset/js/reveal.js', text: ["querySelectorAll('[data-rv-reveal]')", "'data-reveal', 'hidden'", "'data-reveal', 'shown'"] },
      { type: 'includes', repo: 'theme', file: 'asset/sass/utilities/_reveal.scss', text: ['[data-reveal="hidden"]', '[data-reveal="shown"]'] },
      { type: 'includes', repo: 'visualizations', file: 'asset/js/core/reveal.js', text: ["querySelectorAll('[data-rv-reveal]')", "'data-reveal', 'hidden'", "'data-reveal', 'shown'"] },
      { type: 'includes', repo: 'visualizations', file: 'view/common/block-layout/featured-collections.phtml', text: ['data-rv-reveal="'] },
    ],
  },
  {
    id: 'window.DRETokens',
    kind: 'global',
    owner: 'theme',
    checks: [
      { type: 'includes', repo: 'theme', file: 'asset/js/dre-token-bridge.js', text: ['window.DRETokens = ns;'] },
      {
        type: 'members', provider: { repo: 'theme', file: 'asset/js/dre-token-bridge.js', pattern: String.raw`\bns\.(\w+)\s*=` },
        consumers: [
          { repo: 'search', file: 'src/svelte/lib/tokenBridge.ts', block: String.raw`interface DRETokensGlobal \{([^}]*)\}`, pattern: String.raw`^\s*(\w+)\??\s*[(:]` },
          { repo: 'visualizations', file: 'asset/js/core/theme.js', pattern: String.raw`\btokens\.(\w+)` },
        ],
      },
    ],
  },
  {
    id: 'window.DREUtils',
    kind: 'global',
    owner: 'theme',
    checks: [
      { type: 'includes', repo: 'theme', file: 'asset/js/utils.js', text: ['window.DREUtils = {'] },
      {
        type: 'members', provider: { repo: 'theme', file: 'asset/js/utils.js', block: String.raw`window\.DREUtils = \{([^}]*)\}`, pattern: String.raw`^\s*(\w+)\s*:` },
        consumers: [
          { repo: 'search', file: 'src/svelte/lib/announce.ts', block: String.raw`interface DREUtils \{([^}]*)\}`, pattern: String.raw`^\s*(\w+)\??\s*[(:]` },
          { repo: 'visualizations', file: 'asset/js/core/async.js', pattern: String.raw`\butils\.(\w+)` },
          { repo: 'visualizations', file: 'asset/js/core/embed.js', pattern: String.raw`\butils\.(\w+)` },
        ],
      },
    ],
  },
  {
    id: 'RV_LIBS',
    kind: 'global',
    owner: 'visualizations',
    checks: [
      { type: 'includes', repo: 'visualizations', file: 'asset/js/core/base.js', text: ["libs: 'RV_LIBS'"] },
      { type: 'includes', repo: 'search', file: 'src/svelte/lib/maplibreLoader.ts', text: ['RV_LIBS'] },
    ],
  },
  {
    id: 'RV_MAP_CONFIG',
    kind: 'global',
    owner: 'visualizations',
    checks: [
      { type: 'includes', repo: 'visualizations', file: 'asset/js/core/base.js', text: ["mapConfig: 'RV_MAP_CONFIG'"] },
      { type: 'includes', repo: 'search', file: 'src/svelte/lib/maplibreLoader.ts', text: ['RV_MAP_CONFIG'] },
    ],
  },

  // --- Head links -------------------------------------------------------------
  {
    id: 'describedby',
    kind: 'head link',
    owner: 'seo',
    checks: [
      { type: 'includes', repo: 'seo', file: 'src/Service/Signposting.php', text: ["'rel' => 'describedby'", '$this->identity->documents($resource)'] },
    ],
  },
  {
    id: 'alternate',
    kind: 'head link',
    owner: 'linkedData',
    checks: [
      { type: 'includes', repo: 'linkedData', file: 'Module.php', text: ['->appendAlternate('] },
    ],
  },

  // --- The identity-link table -------------------------------------------------
  {
    id: 'config/identity-authorities.php',
    kind: 'shared table',
    owner: 'linkedData',
    checks: [
      { type: 'identical', files: [{ repo: 'linkedData', file: 'config/identity-authorities.php' }, { repo: 'seo', file: 'config/identity-authorities.php' }] },
      { type: 'registers', repo: 'linkedData', file: 'config/identity-authorities.php', theme: 'helper/RecordLinkedData.php' },
    ],
  },
];
