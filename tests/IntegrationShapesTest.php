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
    dre_check($failures, $checks, 'rejects malformed state ' . json_encode($invalid), $state === ['property' => null, 'page' => 1, 'search' => '']);
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

// The optional viewer, not attached media, decides whether a manifest is usable.
$v->callbacks['mirador'] = fn() => '<div data-remote-viewer></div>';
$html = $v->render('common/resource-page-block-layout/mirador', ['resource' => new class { public function media() { return []; } }]);
dre_check($failures, $checks, 'remote manifest without local media retains its viewer', str_contains($html, 'data-remote-viewer'));
$v->callbacks['mirador'] = fn() => '';
$html = $v->render('common/resource-page-block-layout/mirador', ['resource' => new class {}]);
dre_check($failures, $checks, 'an empty helper response creates no empty viewer region', !str_contains($html, 'role="application"'));
$v->callbacks['mirador'] = function () { throw new RuntimeException(); };
$html = $v->render('common/resource-page-block-layout/mirador', ['resource' => new class {}]);
dre_check($failures, $checks, 'viewer errors have a usable recovery message without a broken region', str_contains($html, 'Please try reloading') && !str_contains($html, 'role="application"'));

$v->settings = [];
$v->callbacks['thumbnail'] = fn() => '';
$compound = 'items:7-0,234';
$data = ['subjectValues' => [[$row(7, 'Author', $a)]], 'totalCount' => 2, 'page' => 1, 'perPage' => 1,
    'resourceType' => 'items', 'resourceProperty' => $compound, 'resourcePropertiesAll' => ['items' => [['compound_id' => $compound, 'label' => 'Author', 'label_is_translatable' => false]], 'media' => []], 'objectResource' => $a, 'connectionSearch' => 'A'];
$v->callbacks['ConnectionPage'] = fn() => $data;
$html = $v->render('omeka/site/index/linked-resources', ['resource' => $a]);
$doc = new DOMDocument(); @$doc->loadHTML($html); $xp = new DOMXPath($doc);
dre_check($failures, $checks, 'terminal response retains the actual compound selection', $xp->query('//option[@selected][@value="items:7-0,234"]')->length === 1);
dre_check($failures, $checks, 'ordinary continuation links carry search, relationship and page', str_contains($html, 'lr_property=items%3A7-0%2C234&amp;lr_q=A&amp;lr_page=2'));
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

dre_report('IntegrationShapes', $failures, $checks);
