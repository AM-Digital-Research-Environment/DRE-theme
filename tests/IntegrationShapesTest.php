<?php
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/support/ThemeView.php';
require_once __DIR__ . '/support/Navigation.php';
$failures = []; $checks = 0;
$v = new ThemeTestView();
foreach (['items:', 'items:7', 'items:7-', 'items:7-0', 'items:7-234,345', 'media:7-0,234'] as $compound) {
    $state = $v->ConnectionQuery(['resource_property' => $compound, 'page' => '2']);
    dre_check($failures, $checks, 'accepts real compound ' . $compound, $state['property'] === $compound && $state['page'] === 2);
}
foreach ([[], ['items:'], null, 'item_sets:7', 'items:0', 'items:7--', 'media:7-0,', "items:7\n"] as $invalid) {
    $state = $v->ConnectionQuery(['lr_property' => $invalid, 'lr_page' => [], 'lr_q' => []]);
    dre_check($failures, $checks, 'rejects malformed state ' . json_encode($invalid), $state === ['property' => null, 'page' => 1, 'search' => '', 'class' => null, 'sort' => 'title']);
}
foreach (['0' => 0, '12' => 12, '' => null, '-1' => null, '01' => null, '1e3' => null, '12345678901' => null] as $class => $expected) {
    dre_check($failures, $checks, 'kind of record ' . json_encode((string) $class), $v->ConnectionQuery(['lr_class' => (string) $class])['class'] === $expected);
}
dre_check($failures, $checks, 'kind of record must be a string', $v->ConnectionQuery(['lr_class' => [3]])['class'] === null);
foreach (['title' => 'title', 'title-desc' => 'title-desc', 'newest' => 'newest', 'relationship' => 'title', '' => 'title'] as $sort => $expected) {
    dre_check($failures, $checks, 'sort ' . json_encode((string) $sort), $v->ConnectionQuery(['lr_sort' => (string) $sort])['sort'] === $expected);
}
$a = new ThemeTestResource('A', 1); $b = new ThemeTestResource('B', 2);
$row = fn($id, $label, $resource) => ['property_id' => $id, 'property_label' => 'Base', 'property_alternate_label' => $label, 'resource' => $resource];
$result = $v->LinkedConnections([[$row(7, 'Author', $a), $row(8, 'Author', $a), $row(7, 'Editor', $a), $row(7, 'Author', $b), $row(7, 'Author', $a)]]);
dre_check($failures, $checks, 'same label across properties and alternate labels on one property remain distinct', count($result['facets']) === 3 && count($result['connections'][1]['rels']) === 3);
dre_check($failures, $checks, 'duplicate values count distinct records', $result['facets'][0]['count'] === 2);
$v->callbacks['url'] = fn($route, $params = []) => '/s/a/' . ($params['controller'] ?? 'cross-site-search') . '/' . ($params['action'] ?? '');
$site = new ThemeNavSite();
foreach ([0 => true, 1 => false, 2 => false, 3 => true] as $depth => $hasGrandchild) {
    $html = $v->render('common/nav-menu', ['site' => $site, 'navDepth' => $depth]);
    dre_check($failures, $checks, 'configured nav depth ' . $depth, str_contains($html, 'Project archive') === $hasGrandchild && !str_contains($html, 'href="/hidden"'));
    if ($depth !== 1) dre_check($failures, $checks, 'external nav target survives depth ' . $depth, str_contains($html, 'target="_blank" rel="noopener"'));
}
// A panel cell sets its label in the title span its styles address (lost in
// 2.32, when the cells moved to one shared link writer); top-level links don't.
$html = $v->render('common/nav-menu', ['site' => $site, 'navDepth' => 0]);
$doc = new DOMDocument(); @$doc->loadHTML('<?xml encoding="utf-8"?>' . $html); $xp = new DOMXPath($doc);
$cellLinks = $xp->query('//li[contains(@class,"nav-panel__cell")]/a');
$titled = $xp->query('//li[contains(@class,"nav-panel__cell")]/a/span[@class="nav-panel__cell-title"][normalize-space()]');
dre_check($failures, $checks, 'every panel cell link carries its label in .nav-panel__cell-title',
    $cellLinks->length > 0 && $titled->length === $cellLinks->length, $titled->length . ' of ' . $cellLinks->length);
dre_check($failures, $checks, 'top-level menu links keep a bare label', $xp->query('//a[contains(@class,"nav-item__link")]/span[@class="nav-panel__cell-title"]')->length === 0);
$v->query = ['fulltext_search' => ['invalid']];
$html = $v->render('common/header', ['site' => $site, 'userBar' => '']);
$doc = new DOMDocument(); @$doc->loadHTML($html); $xpath = new DOMXPath($doc);
$ids = []; foreach ($xpath->query('//*[@id]') as $node) $ids[] = $node->getAttribute('id');
dre_check($failures, $checks, 'actual header has unique form and disclosure IDs', count($ids) === count(array_unique($ids)));
dre_check($failures, $checks, 'fallback search uses core GET route and discards array inputs', $xpath->query('//form[@method="get"][@action="/s/a/index/search"]')->length === 2 && $xpath->query('//input[@type="search"][@value=""]')->length === 2);
$v->settings['search_type'] = 'cross-site';
dre_check($failures, $checks, 'cross-site search setting remains honored', str_contains($v->render('common/main-header-search', ['site' => $site]), '/s/a/cross-site-search/results'));

$embed = new class extends ThemeTestResource { public function ingester() { return 'youtube'; } public function altText() { return ''; } public function render(...$args) { return '<iframe title="Video"></iframe>'; } };
$image = new class extends ThemeTestResource { public function ingester() { return 'upload'; } };
$failed = new class extends ThemeTestResource { public function ingester() { return 'oembed'; } public function altText() { return ''; } public function render(...$args) { throw new RuntimeException(); } };
$v->callbacks['mirador'] = fn($resource) => in_array($image, $resource->media(), true) ? '<div data-viewer></div>' : '';
foreach ([[$embed], [$image], [$embed, $image], [], [$failed, $image]] as $i => $media) {
    $resource = new class($media) { public function __construct(private $media) {} public function media() { return $this->media; } };
    $html = $v->render('common/resource-page-block-layout/mirador', ['resource' => $resource]);
    dre_check($failures, $checks, 'mixed-media renderer selection ' . $i, str_contains($html, 'data-viewer') === in_array($image, $media, true) && str_contains($html, '<iframe') === in_array($embed, $media, true));
    if (in_array($failed, $media, true)) dre_check($failures, $checks, 'unavailable embed leaves recovery and viewer', str_contains($html, 'Media is unavailable.') && str_contains($html, 'Open media record'));
}

// An embed's thumbnail alt: its own alt text, else its title — unless that title
// is just the source URL, when the item's title says more.
$owner = new ThemeTestResource('Interview with a griot', 77);
$altFor = function (string $title, string $alt = '') use ($v, $owner): string {
    $embed = new class($title, $alt, $owner) extends ThemeTestResource {
        public array $rendered = [];
        public function __construct(string $title, private string $alt, private $owner) { parent::__construct($title, 9); }
        public function ingester() { return 'youtube'; }
        public function altText() { return $this->alt; }
        public function item() { return $this->owner; }
        public function render(...$args) { $this->rendered = $args[0] ?? []; return ''; }
    };
    $v->callbacks['mirador'] = fn() => '';
    $v->render('common/resource-page-block-layout/mirador', ['resource' => new class($embed) { public function __construct(private $m) {} public function media() { return [$this->m]; } }]);
    return $embed->rendered['thumbnailAttribs']['alt'] ?? '(none)';
};
dre_check($failures, $checks, 'an embed titled with its URL takes the item title as alt',
    $altFor('https://www.youtube.com/watch?v=abc123') === 'Interview with a griot' && $altFor('www.youtube.com/watch?v=abc') === 'Interview with a griot');
dre_check($failures, $checks, 'a real embed title or alt text is kept',
    $altFor('Griot performance, 2019') === 'Griot performance, 2019' && $altFor('https://youtu.be/x', 'A griot sings') === 'A griot sings');

// The optional viewer, not attached media, decides whether a manifest is usable.
$v->callbacks['mirador'] = fn() => '<div data-remote-viewer></div>';
$html = $v->render('common/resource-page-block-layout/mirador', ['resource' => new class { public function media() { return []; } }]);
dre_check($failures, $checks, 'remote manifest without local media retains its viewer', str_contains($html, 'data-remote-viewer'));
$v->callbacks['mirador'] = fn() => '';
$html = $v->render('common/resource-page-block-layout/mirador', ['resource' => new class {}]);
dre_check($failures, $checks, 'an empty helper response creates no empty viewer region', !str_contains($html, 'block-mirador'));
$v->callbacks['mirador'] = function () { throw new RuntimeException(); };
$html = $v->render('common/resource-page-block-layout/mirador', ['resource' => new class {}]);
dre_check($failures, $checks, 'viewer errors have a usable recovery message without a broken region', str_contains($html, 'Please try reloading') && !str_contains($html, 'role="region"'));

$v->settings = [];
$v->callbacks['thumbnail'] = fn() => '';
$compound = 'items:7-0,234';
$data = ['subjectValues' => [[$row(7, 'Author', $a)]], 'totalCount' => 2, 'setTotal' => 40, 'typeTotals' => ['items' => 2, 'media' => 0], 'page' => 1, 'perPage' => 1,
    'resourceType' => 'items', 'resourceProperty' => $compound, 'resourcePropertiesAll' => ['items' => [
        ['compound_id' => $compound, 'label' => 'Author', 'label_is_translatable' => false, 'property_id' => 7, 'count' => 30, 'matched' => 2],
        ['compound_id' => 'items:8-0', 'label' => 'Editor', 'label_is_translatable' => false, 'property_id' => 8, 'count' => 10, 'matched' => 0]], 'media' => []],
    'resourceClasses' => [['id' => 5, 'label' => 'person', 'count' => 1], ['id' => 0, 'label' => '', 'count' => 1]], 'resourceClass' => null, 'sort' => 'title-desc',
    'objectResource' => $a, 'connectionSearch' => 'A'];
$v->callbacks['ConnectionPage'] = fn() => $data;
$html = $v->render('omeka/site/index/linked-resources', ['resource' => $a]);
$doc = new DOMDocument(); @$doc->loadHTML('<?xml encoding="utf-8"?>' . $html); $xp = new DOMXPath($doc);
$text = fn($node) => trim(preg_replace('/\s+/u', ' ', $node->textContent));
dre_check($failures, $checks, 'the head leads with the whole linked set, not the page',
    $text($xp->query('//*[contains(@class,"resources-linked__summary")]')->item(0)) === '40 linked records');
dre_check($failures, $checks, 'the status line places the page within the matching records',
    str_contains($text($xp->query('//*[@data-lr-status]')->item(0)), 'Showing 1–1 of 2 matching records') && $xp->query('//*[@data-lr-status]//a[@data-connection-link][.="Clear filters"]')->length === 1);
dre_check($failures, $checks, 'the selected relationship is the current filter link, with its whole-set count',
    $xp->query('//a[@aria-current="true"][contains(@class,"lr-facet")][contains(.,"Author")][contains(.,"2")]')->length === 1);
dre_check($failures, $checks, 'a relationship the search empties is listed but not linked',
    $xp->query('//span[contains(@class,"is-empty")][contains(.,"Editor")]')->length === 1 && $xp->query('//a[contains(.,"Editor")]')->length === 0);
dre_check($failures, $checks, 'filter links keep the search and sort and return to the first page',
    $xp->query('//a[contains(.,"All relationships")][@href="/s/a/item/1?lr_property=items%3A&lr_q=A&lr_sort=title-desc#linked-resources"]')->length === 1);
dre_check($failures, $checks, 'kinds of record are capitalised and counted, the unclassed named',
    $xp->query('//a[contains(@class,"lr-facet")][contains(.,"Person")][contains(@href,"lr_class=5")]')->length === 1
    && $xp->query('//a[contains(@class,"lr-facet")][contains(.,"Unclassified")][contains(@href,"lr_class=0")]')->length === 1
    && $xp->query('//a[@aria-current="true"][contains(.,"All kinds")][contains(.,"2")]')->length === 1);
dre_check($failures, $checks, 'the search form carries the relationship and the chosen sort',
    $xp->query('//form[@data-connection-form]//input[@type="hidden"][@name="lr_property"][@value="items:7-0,234"]')->length === 1
    && $xp->query('//select[@name="lr_sort"]/option[@selected][@value="title-desc"]')->length === 1);
dre_check($failures, $checks, 'ordinary continuation links carry search, relationship, sort and page', str_contains($html, 'lr_property=items%3A7-0%2C234&amp;lr_q=A&amp;lr_sort=title-desc&amp;lr_page=2'));
dre_check($failures, $checks, 'connection paging links are rel=nofollow', (bool) preg_match('/<a data-connection-page rel="nofollow" href="[^"]*lr_page=2/', $html));
dre_check($failures, $checks, 'a single resource type gets no type heading', $xp->query('//*[contains(@class,"resources-linked__facet-type")]')->length === 0);
$v->callbacks['ConnectionPage'] = fn() => ['resourceProperty' => 'items:7', 'resourceClass' => 99, 'resourceClasses' => [['id' => 99, 'label' => '', 'count' => 0]], 'subjectValues' => [], 'totalCount' => 0] + $data;
$html = $v->render('omeka/site/index/linked-resources', ['resource' => $a]);
$doc = new DOMDocument(); @$doc->loadHTML('<?xml encoding="utf-8"?>' . $html); $xp = new DOMXPath($doc);
dre_check($failures, $checks, 'an unknown relationship or kind in the URL stays current and undoable',
    $xp->query('//a[@aria-current="true"][contains(.,"Selected relationship")]')->length === 1
    && $xp->query('//a[@aria-current="true"][contains(.,"Selected kind of record")]')->length === 1
    && $xp->query('//p[contains(@class,"connections__empty")]//a[.="Clear filters"]')->length === 1);
$v->callbacks['ConnectionPage'] = fn() => ['totalCount' => 1, 'setTotal' => 1, 'perPage' => 25, 'resourceProperty' => 'items:', 'connectionSearch' => '',
    'resourceClasses' => [['id' => 5, 'label' => 'person', 'count' => 1]], 'resourcePropertiesAll' => ['items' => [$data['resourcePropertiesAll']['items'][0]], 'media' => []]] + $data;
$html = $v->render('omeka/site/index/linked-resources', ['resource' => $a]);
dre_check($failures, $checks, 'a lone unfiltered connection renders no filters, search or status', str_contains($html, 'connection__title')
    && !str_contains($html, 'data-connection-form') && !str_contains($html, 'lr-facet') && !str_contains($html, 'data-lr-status') && (bool) preg_match('#<b>1</b>\s*linked record\s*<#', $html));
$v->callbacks['ConnectionPage'] = fn() => $data;
$html = $v->render('common/resource-page-block-layout/linked-resources', ['resource' => $a]);
dre_check($failures, $checks, 'initial connection records are server rendered with enhancement recovery controls', str_contains($html, 'connection__title') && str_contains($html, 'data-connection-retry'));

$property = new class { public function label() { return 'Description'; } };
$value = new class {
    public function lang() { return ''; } public function type() { return 'literal'; }
    public function valueAnnotation() { return null; } public function isPublic() { return true; }
    public function asHtml(...$args) { return 'Readable metadata'; }
};
$values = ['dcterms:description' => ['property' => $property, 'alternate_label' => '', 'values' => [$value]],
    'dcterms:subject' => ['property' => $property, 'alternate_label' => '', 'values' => [$value]]];
$html = $v->render('common/resource-values', ['resource' => $a, 'values' => $values]);
dre_check($failures, $checks, 'record sections keep stable fragment IDs', str_contains($html, 'id="record-1-description"'));
$html = $v->render('common/resource-values', ['resource' => $a, 'values' => $values]);
dre_check($failures, $checks, 'repeated metadata blocks have unique section IDs', str_contains($html, 'id="record-1-2-description"'));

// Item page: the apparatus (citation) follows the record and precedes context
// blocks in DOM order, so a single-column phone layout cites before it charts.
$pageBlocks = new class {
    public array $regions = [];
    public string $region = 'main';
    public function __invoke($resource, $region = 'main') { $this->region = $region; return $this; }
    public function getBlocksArray(): array { return $this->regions[$this->region] ?? []; }
    public function hasBlocks(): bool { return (bool) $this->getBlocksArray(); }
    public function getBlocks(): string { return implode('', $this->getBlocksArray()); }
};
$chain = new class { public function __call($name, $args) { return $this; } };
$v->callbacks += ['headLink' => fn() => $chain, 'htmlElement' => fn() => $chain, 'ResourceTags' => fn() => '', 'pageTitle' => fn($title) => '<h1>' . $title . '</h1>', 'resourcePageBlocks' => $pageBlocks];
$v->callbacks['partial:common/shortlist-button'] = fn() => '';
$v->callbacks['partial:common/record-apparatus'] = fn() => '<section data-apparatus>Cite this record</section>';
$pageBlocks->regions['main'] = ['mirador' => '<div data-mirador></div>', 'values' => '<div data-values></div>', 'linkedResources' => '<div data-linked></div>', 'dreSimilarItems' => '<section data-similar></section>'];
$html = $v->render('omeka/site/item/show', ['item' => $a]);
$at = fn($marker) => strpos($html, $marker);
dre_check($failures, $checks, 'item page orders record, citation, then context blocks',
    $at('data-mirador') < $at('data-values') && $at('data-values') < $at('data-apparatus') && $at('data-apparatus') < $at('data-linked') && $at('data-linked') < $at('data-similar') && str_contains($html, 'item-record__context'));
$pageBlocks->regions['main'] = ['values' => '<div data-values></div>', 'dreLinkedItemsDashboard' => '<div data-charts></div>',
    'dreSearchProjectRecords' => '<details data-project-records></details>', 'linkedResources' => '<div data-linked></div>'];
$html = $v->render('omeka/site/item/show', ['item' => $a]);
$at = fn($marker) => strpos($html, $marker);
dre_check($failures, $checks, "a project's records lead the context and replace Linked resources",
    $at('data-apparatus') < $at('data-project-records') && $at('data-project-records') < $at('data-charts') && !str_contains($html, 'data-linked'));
$pageBlocks->regions['main'] = ['values' => '<div data-values></div>', 'dreLinkedItemsDashboard' => '<div data-charts></div>',
    'linkedResources' => '<div data-linked></div>'];
$html = $v->render('omeka/site/item/show', ['item' => $a]);
$at = fn($marker) => strpos($html, $marker);
dre_check($failures, $checks, 'linked resources lead the context, ahead of the visualisations',
    $at('data-apparatus') < $at('data-linked') && $at('data-linked') < $at('data-charts'));
$pageBlocks->regions['main'] = ['values' => '<div data-values></div>'];
$html = $v->render('omeka/site/item/show', ['item' => $a]);
dre_check($failures, $checks, 'item page without context blocks renders no empty context wrapper', str_contains($html, 'data-values') && !str_contains($html, 'item-record__context'));

// On a project's page, with DRE Search installed, the Linked resources block
// defers its work: the page drops it under the project's records, and renders
// it after all when DRE Search's block is empty.
$deferredMarker = $v->helper('ProjectCollections')::DEFERRED_LINKED_RESOURCES;
$project = new class('Project', 9) extends ThemeTestResource {
    public function resourceClass() { return new class { public function term() { return 'foaf:Project'; } }; }
};
$connectionCalls = 0;
$v->callbacks['ConnectionPage'] = function () use (&$connectionCalls, $data) { $connectionCalls++; return $data; };
$v->callbacks['dreSearchBar'] = fn() => '';
$html = $v->render('common/resource-page-block-layout/linked-resources', ['resource' => $project]);
dre_check($failures, $checks, "a project's Linked resources block runs no connection query while DRE Search may list its records",
    trim($html) === $deferredMarker && $connectionCalls === 0);
$html = $v->render('common/resource-page-block-layout/linked-resources', ['resource' => $a]);
dre_check($failures, $checks, 'any other record renders its connections at once', str_contains($html, 'connection__title') && $connectionCalls === 1);
$pageBlocks->regions['main'] = ['values' => '<div data-values></div>', 'dreSearchProjectRecords' => '', 'linkedResources' => $deferredMarker];
$html = $v->render('omeka/site/item/show', ['item' => $a]);
dre_check($failures, $checks, 'a deferred block is rendered for real when DRE Search lists no records',
    str_contains($html, 'connection__title') && !str_contains($html, $deferredMarker));
$pageBlocks->regions['main'] = ['values' => '<div data-values></div>',
    'dreSearchProjectRecords' => '<details data-project-records></details>', 'linkedResources' => $deferredMarker];
$connectionCalls = 0;
$html = $v->render('omeka/site/item/show', ['item' => $a]);
dre_check($failures, $checks, "a deferred block goes, unrendered, under the project's records",
    str_contains($html, 'data-project-records') && !str_contains($html, $deferredMarker) && $connectionCalls === 0);
$pageBlocks->regions = ['main' => ['values' => '<div data-values></div>'], 'right' => ['linkedResources' => $deferredMarker]];
$html = $v->render('omeka/site/item/show', ['item' => $a]);
dre_check($failures, $checks, 'a deferred block in a sidebar, where nothing replaces it, is rendered for real',
    str_contains($html, 'connection__title') && !str_contains($html, $deferredMarker));
$pageBlocks->regions = [];
unset($v->callbacks['dreSearchBar']);

// The media list links each media by its title: the thumbnail inside the link
// says nothing more unless the picture is described.
$v->callbacks['thumbnail'] = fn($media, $type = null, array $attributes = []) => '<img alt="' . htmlspecialchars($attributes['alt'] ?? '') . '">';
$listMedia = fn(string $title, string $alt) => new class($title, $alt) extends ThemeTestResource {
    public function __construct(string $title, private string $alt) { parent::__construct($title, 30); }
    public function altText() { return $this->alt; }
    public function altTextResolved() { return $this->alt; }
};
$owner = new class([$listMedia('Market photograph', ''), $listMedia('Second view', 'Stalls under awnings')]) extends ThemeTestResource {
    public function __construct(private array $list) { parent::__construct('Owner', 31); }
    public function media(): array { return $this->list; }
};
$html = $v->render('common/resource-page-block-layout/media-list', ['resource' => $owner]);
dre_check($failures, $checks, 'a media list link names its media once: an undescribed thumbnail has an empty alt',
    substr_count($html, 'Market photograph') === 1 && str_contains($html, '<img alt="">'));
dre_check($failures, $checks, 'a described thumbnail keeps its description', str_contains($html, '<img alt="Stalls under awnings">'));
$v->callbacks['thumbnail'] = fn() => '';

dre_report('IntegrationShapes', $failures, $checks);
