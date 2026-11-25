<?php
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/ThemeView.php';
require_once __DIR__ . '/Navigation.php';
ThemeTestResource::$canonicalOrigin = 'https://theme.test';
$v = new ThemeTestView();
$v->callbacks['url'] = fn($route, $params = []) => '/s/a/' . ($params['controller'] ?? 'search') . '/' . ($params['action'] ?? 'results');
$site = new ThemeNavSite();
$resource = new ThemeTestResource('Networks of knowledge in West Africa', 42);
$property = new class { public function label() { return 'Description'; } };
$literal = fn($text) => new class($text) {
    public function __construct(private string $text) {}
    public function lang() { return ''; } public function type() { return 'literal'; }
    public function valueAnnotation() { return null; } public function isPublic() { return true; }
    public function asHtml(...$args) { return htmlspecialchars($this->text, ENT_QUOTES); }
};
$values = [];
foreach (['dcterms:description' => 'Field notes, published research and shared archives document the circulation of knowledge across institutions and communities.',
    'dcterms:subject' => 'Archives and knowledge production', 'dcterms:date' => '2026'] as $term => $text) {
    $values[$term] = ['property' => $property, 'alternate_label' => '', 'values' => [$literal($text)]];
}
echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Research tools fixture</title></head><body><a id="skipnav" href="#content">Skip to main content</a>';
echo $v->render('common/header', ['site' => $site, 'userBar' => '']);
echo '<main id="content" class="container"><h1>' . $v->escapeHtml($resource->displayTitle()) . '</h1>';
echo $v->render('common/shortlist-button', ['resource' => $resource, 'detail' => true]);
echo $v->render('common/resource-values', ['resource' => $resource, 'values' => $values]);
echo '<section aria-labelledby="browse-title"><h2 id="browse-title">Explore related records</h2><div class="browse-controls">';
echo $v->render('common/browse-layout-toggle', ['layout' => ['hasToggle' => true, 'isGrid' => true]]);
echo '</div><div class="resources resource-grid"><div class="grid-sizer"></div><div class="gutter-sizer"></div>';
foreach (range(1, 6) as $n) {
    echo $v->render('common/resource-card', ['resource' => new ThemeTestResource('Research record ' . $n, $n),
        'body' => str_repeat('Collection description for browsing. ', $n % 3 + 1), 'showTags' => false, 'isGrid' => true]);
}
echo '</div></section>';
// The Linked resources block over a large linked set: the whole-set total, its
// counted relationship and kind filters, a page of cards. `filtered` renders
// the block as the connection endpoint answers once Creator is chosen.
$filtered = ($argv[1] ?? '') === 'filtered';
$connectionRow = fn($n, $label) => ['resource_id' => $n, 'property_id' => $label === 'Creator' ? 2 : 3, 'property_label' => $label,
    'property_alternate_label' => null, 'resource' => new ThemeTestResource('Linked record ' . $n, 100 + $n)];
$relationship = fn($id, $label, $count, $matched) => ['label' => $label, 'property_id' => $id, 'label_is_translatable' => true,
    'compound_id' => 'items:' . $id . '-0', 'count' => $count, 'matched' => $matched];
$v->callbacks['thumbnail'] = fn() => '';
$v->callbacks['ConnectionPage'] = fn() => [
    'subjectValues' => [array_map(fn($n) => $connectionRow($n, $filtered ? 'Creator' : 'Subject'), [1, 2, 3])],
    'totalCount' => $filtered ? 30 : 147, 'setTotal' => 147, 'typeTotals' => ['items' => 147, 'media' => 0],
    'page' => 1, 'perPage' => 3, 'resourceType' => 'items', 'resourceProperty' => $filtered ? 'items:2-0' : 'items:',
    'resourcePropertiesAll' => ['items' => [$relationship(3, 'Subject', 120, 120), $relationship(2, 'Creator', 30, 30), $relationship(4, 'Contributor', 5, 5)], 'media' => []],
    'resourceClasses' => $filtered ? [['id' => 7, 'label' => 'Person', 'count' => 30]]
        : [['id' => 5, 'label' => 'Bibliographic Resource', 'count' => 100], ['id' => 7, 'label' => 'Person', 'count' => 30], ['id' => 0, 'label' => '', 'count' => 17]],
    'resourceClass' => null, 'sort' => 'title', 'objectResource' => $resource, 'connectionSearch' => ''];
echo $v->render('common/resource-page-block-layout/linked-resources', ['resource' => $resource]);
echo '</main>';
echo $v->render('common/shortlist');
echo '</body></html>';
