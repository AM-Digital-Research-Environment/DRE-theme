<?php
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/ThemeView.php';
$v = new ThemeTestView();
$r = new ThemeTestResource('Archive record');
$r->values['dcterms:bibliographicCitation'] = [new ThemeTestValue('A scholarly citation.')];
echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Theme regression fixture</title></head><body><main><h1>Archive record</h1>';
echo $v->render('common/record-apparatus', ['resource' => $r]);
echo $v->render('common/value-annotation', ['valueAnnotation' => new class { public function displayValues() { return '<p>Editorial note <a href="#record">Related record</a></p>'; } }]);
echo '<div class="browse-controls">';
echo $v->render('common/browse-layout-toggle', ['layout' => ['hasToggle' => true, 'isGrid' => true]]);
echo '</div><div class="resources resource-grid"><div class="grid-sizer"></div><div class="gutter-sizer"></div>';
foreach (range(1, 6) as $n) {
    echo $v->render('common/resource-card', ['resource' => new ThemeTestResource('Record ' . $n, $n), 'body' => 'Collection description for browsing.', 'showTags' => false, 'isGrid' => true]);
}
echo '</div>';
// The pager under a list, with the variables Omeka's pagination helper passes.
$v->callbacks['hyperlink'] = fn($text, $href, array $attributes = []) => '<a href="' . htmlspecialchars($href) . '"'
    . implode('', array_map(fn($k, $val) => ' ' . $k . '="' . htmlspecialchars((string) $val) . '"', array_keys($attributes), $attributes))
    . '>' . htmlspecialchars($text) . '</a>';
$v->callbacks['queryToHiddenInputs'] = fn(array $remove = []) => '';
echo $v->render('common/pagination', [
    'totalCount' => 97, 'perPage' => 25, 'currentPage' => 2, 'previousPage' => 1, 'nextPage' => 3, 'pageCount' => 4,
    'query' => [], 'offset' => 25, 'firstPageUrl' => '?page=1', 'previousPageUrl' => '?page=1',
    'nextPageUrl' => '?page=3', 'lastPageUrl' => '?page=4', 'pagelessUrl' => '?',
]);
echo '</main></body></html>';
