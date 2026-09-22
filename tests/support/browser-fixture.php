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
echo $v->render('common/browse-layout-toggle', ['layout' => ['hasToggle' => true, 'gridState' => true, 'listState' => false]]);
echo '</div><div class="resources resource-grid">';
foreach (range(1, 6) as $n) {
    echo $v->render('common/resource-card', ['resource' => new ThemeTestResource('Record ' . $n, $n), 'body' => 'Collection description for browsing.', 'showTags' => false, 'isGrid' => true]);
}
echo '</div></main></body></html>';
