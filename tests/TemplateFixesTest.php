<?php
/**
 * Rendered regressions for the 2026-10-06 review fixes: each check renders the
 * actual template through the stub view and asserts on its output.
 */
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/support/ThemeView.php';
require_once __DIR__ . '/support/Navigation.php';

$failures = [];
$checks = 0;

/** Swallows any fluent helper chain (headLink()->appendStylesheet(...), ...). */
$chain = new class {
    public array $calls = [];
    public function __call(string $name, array $args) { $this->calls[] = $name; return $this; }
    public function __toString(): string { return ''; }
};

// --- Asset block: deleted asset, and page links that stay paths ------------
$view = new ThemeTestView();
$view->callbacks['thumbnail'] = fn() => '<img src="/thumb.jpg">';
$page = new class {
    public function siteUrl() { return '/s/amira/page/about-us'; }
    public function title() { return 'About <us>'; }
};
$html = $view->render('common/block-layout/asset', ['attachments' => [
    ['asset' => null, 'page' => $page, 'alt_link_title' => '', 'caption' => 'Kept caption'],
]]);
dre_check($failures, $checks, 'an Asset block whose asset was deleted still renders its link and caption',
    str_contains($html, 'Kept caption') && str_contains($html, 'About &lt;us&gt;'));
dre_check($failures, $checks, 'Asset block page links are attribute-escaped paths, not rawurlencoded',
    str_contains($html, 'href="/s/amira/page/about-us"') && !str_contains($html, '%2F'), $html);

// --- Core search fallback: site pages browse through their own route ------
$routes = [];
$view = new ThemeTestView();
$view->callbacks['htmlElement'] = fn() => $chain;
$view->callbacks['pageTitle'] = fn($title) => '<h1>' . htmlspecialchars($title) . '</h1>';
$view->callbacks['hyperlink'] = fn($text, $url) => '<a href="' . htmlspecialchars($url) . '">' . htmlspecialchars($text) . '</a>';
$view->callbacks['url'] = function ($route, $params = [], $options = []) use (&$routes) {
    $routes[] = $route;
    return '/' . $route . '?' . http_build_query($options['query'] ?? []);
};
$sitePage = new class {
    public function link($text) { return '<a href="/s/a/page/p">' . htmlspecialchars($text) . '</a>'; }
    public function title() { return 'A page'; }
};
$view->render('omeka/site/index/search', ['query' => 'orixá', 'results' => [
    'site_pages' => ['resources' => [$sitePage], 'total' => 3],
]]);
dre_check($failures, $checks, '"View all results" for site pages uses site/page-browse, not /page/browse',
    in_array('site/page-browse', $routes, true) && !in_array('site/resource', $routes, true), implode(', ', $routes));

// --- Legacy advanced search -------------------------------------------------
$response = new class {
    public array $headers = [];
    public int $status = 200;
    public function getHeaders() { return $this; }
    public function addHeaderLine(string $name, string $value) { $this->headers[$name] = $value; return $this; }
    public function setStatusCode(int $code) { $this->status = $code; return $this; }
};
$services = new class($response) {
    public function __construct(private object $response) {}
    public function get(string $name) { return $this; }
    public function getMvcEvent() { return $this; }
    public function getResponse() { return $this->response; }
};
$site = new class($services) {
    public function __construct(private object $services) {}
    public function url() { return '/s/amira/'; }
    public function getServiceLocator() { return $this->services; }
};
$view = new ThemeTestView();
$view->callbacks['currentSite'] = fn() => $site;
$view->callbacks['headTitle'] = fn() => $chain;
$view->callbacks['hyperlink'] = fn($text, $url) => '<a href="' . htmlspecialchars($url) . '">' . htmlspecialchars($text) . '</a>';
$view->callbacks['dreSearchBar'] = fn() => '';
$view->query = ['fulltext_search' => 'Oyo kingdom'];
$html = $view->render('common/dre-search-redirect', ['resourceType' => 'item']);
dre_check($failures, $checks, 'legacy advanced search redirects through the MVC response',
    $response->status === 302 && ($response->headers['Location'] ?? '') === '/s/amira/dre-search?q=Oyo+kingdom',
    json_encode($response->headers));
dre_check($failures, $checks, 'the redirect body still offers a link to DRE Search', str_contains($html, 'dre-search?q=Oyo+kingdom'));

unset($view->callbacks['dreSearchBar']);
$response->status = 200; $response->headers = [];
$advanced = null;
$view->callbacks['partial:common/advanced-search'] = function ($vars) use (&$advanced) { $advanced = $vars; return '<fieldset>core advanced search</fieldset>'; };
$view->callbacks['pageTitle'] = fn($title) => '<h1>' . htmlspecialchars($title) . '</h1>';
$view->callbacks['htmlElement'] = fn() => $chain;
$view->callbacks['url'] = fn() => '/s/amira/item-set';
$html = $view->render('common/dre-search-redirect', ['resourceType' => 'itemSet']);
dre_check($failures, $checks, 'without DRE Search the core advanced-search form renders instead of a redirect',
    $response->status === 200 && str_contains($html, 'core advanced search') && str_contains($html, 'Advanced item set search')
    && ($advanced['resourceType'] ?? null) === 'itemSet' && str_contains($html, 'action="/s/amira/item-set"'));

// --- Header: a deleted logo asset falls back to the bundled lockup ---------
$view = new ThemeTestView();
$view->callbacks['url'] = fn($route, $params = []) => '/s/a/search/results';
$view->themeSettings = ['logo' => 17];
$view->callbacks['themeSettingAssetUrl'] = fn() => null;
$html = $view->render('common/header', ['site' => new ThemeNavSite(), 'userBar' => '']);
dre_check($failures, $checks, 'a deleted logo asset renders the bundled lockup, never an empty src',
    str_contains($html, 'site-logo--light') && !str_contains($html, 'src=""'));
dre_check($failures, $checks, 'the theme toggle names its action without a contradictory pressed state',
    !preg_match('/data-theme-toggle[^>]*aria-pressed/', $html));
$view->themeSettings['research_shortlist'] = 0;
dre_check($failures, $checks, 'a disabled shortlist renders no header control',
    !str_contains($view->render('common/header', ['site' => new ThemeNavSite(), 'userBar' => '']), 'data-shortlist-open'));

// --- Resource values: annotation modes and embedded (chrome-free) output ---
$property = new class { public function label() { return 'Description'; } };
$annotated = fn($text, $note) => new class($text, $note) {
    public function __construct(private string $text, private ?object $note) {}
    public function lang() { return ''; } public function type() { return 'literal'; }
    public function valueAnnotation() { return $this->note; } public function isPublic() { return true; }
    public function asHtml(...$args) { return htmlspecialchars($this->text, ENT_QUOTES); }
};
$note = new class { public function displayValues() { return '<p>Editorial note</p>'; } };
$values = [];
foreach (['dcterms:description' => 'An abstract.', 'dcterms:subject' => 'Archives', 'dcterms:date' => '2026'] as $term => $text) {
    $values[$term] = ['property' => $property, 'alternate_label' => '', 'values' => [$annotated($text, $note)]];
}
$view = new ThemeTestView();
$resource = new ThemeTestResource('Record', 9);
$html = $view->render('common/resource-values', ['resource' => $resource, 'values' => $values]);
dre_check($failures, $checks, 'value annotations show by default, as in core', str_contains($html, 'Editorial note'));
dre_check($failures, $checks, 'collapsed annotations start closed', !str_contains($html, '<details class="annotation-btn" open'));
$view->settings['show_value_annotations'] = 'expanded';
dre_check($failures, $checks, '"expanded" opens the annotation disclosure',
    str_contains($view->render('common/resource-values', ['resource' => $resource, 'values' => $values]), '<details class="annotation-btn" open'));
$view->settings['show_value_annotations'] = '';
dre_check($failures, $checks, 'the empty option hides value annotations',
    !str_contains($view->render('common/resource-values', ['resource' => $resource, 'values' => $values]), 'Editorial note'));
dre_check($failures, $checks, 'a record page keeps its contents nav, h2 sections and copy buttons',
    str_contains($html, 'Record contents') && str_contains($html, '<h2 class="record__group-title">') && str_contains($html, 'data-section-copy'));
$view->assets = [];
$embedded = $view->render('common/resource-values', ['resource' => $resource, 'values' => $values, 'recordChrome' => false]);
dre_check($failures, $checks, 'embedded values drop the record chrome and use h4 group titles',
    !str_contains($embedded, 'Record contents') && !str_contains($embedded, '<h2') && !str_contains($embedded, 'data-section-copy')
    && str_contains($embedded, '<h4 class="record__group-title">'));
dre_check($failures, $checks, 'embedded values do not load the section-link script',
    !array_filter($view->assets, fn($asset) => str_contains($asset, 'section-links')));

// --- Shortlist button: one stable name that carries the record's title ----
$view = new ThemeTestView();
$html = $view->render('common/shortlist-button', ['resource' => new ThemeTestResource('Orixá <archive>', 3)]);
dre_check($failures, $checks, 'the save toggle is named with its record and starts unpressed',
    str_contains($html, 'aria-label="Save record: Orixá &lt;archive&gt;"') && str_contains($html, 'aria-pressed="false"'));

// --- Browse toggle: pressed state, never disabled --------------------------
$html = $view->render('common/browse-layout-toggle', ['layout' => ['hasToggle' => true, 'isGrid' => false]]);
dre_check($failures, $checks, 'the browse toggle reports the active view as pressed and disables nothing',
    str_contains($html, 'class="list" aria-pressed="true"') && str_contains($html, 'class="grid" aria-pressed="false"')
    && !str_contains($html, 'disabled') && str_contains($html, 'role="group"'));

// --- Hierarchy: an unreadable grouping set does not take the page down ----
$view = new ThemeTestView();
foreach (['headLink', 'htmlElement', 'searchFilters', 'pagination', 'browse', 'trigger'] as $helper) {
    $view->callbacks[$helper] = fn() => $chain;
}
$view->callbacks['assetUrl'] = fn($file) => '/' . $file;
$view->callbacks['pageTitle'] = fn($title) => '<h1>' . htmlspecialchars($title) . '</h1>';
$view->callbacks['hyperlink'] = fn($text, $url) => '<a href="' . htmlspecialchars($url) . '">' . htmlspecialchars($text) . '</a>';
$view->callbacks['DreSearchUrl'] = fn() => '/s/a/dre-search';
$view->callbacks['HierarchyTree'] = fn() => ['nodes' => [], 'itemSets' => []];
$privateSet = new class {
    public function id() { return 7; }
    public function displayTitle(...$args) { throw new RuntimeException('Entity was not found.'); }
};
$grouping = new class($privateSet) {
    public function __construct(private object $set) {}
    public function getLabel() { return ''; }
    public function getItemSet() { return $this->set; }
    public function getHierarchy() { return $this; }
};
try {
    $html = $view->render('hierarchy/site/index/hierarchy', ['hierarchyGrouping' => $grouping, 'itemSet' => null, 'items' => []]);
    dre_check($failures, $checks, 'a grouping whose set the visitor cannot read is titled [Untitled]', str_contains($html, '<h1>[Untitled]</h1>'), $html);
} catch (Throwable $e) {
    dre_check($failures, $checks, 'a grouping whose set the visitor cannot read is titled [Untitled]', false, get_class($e) . ': ' . $e->getMessage());
}

dre_report('TemplateFixes', $failures, $checks);
