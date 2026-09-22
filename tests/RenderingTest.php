<?php
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/support/ThemeView.php';
$failures = []; $checks = 0;
$view = new ThemeTestView();
$view->callbacks['ResourceTags'] = fn() => '';
$resource = new ThemeTestResource('<Record>');
$attachment = new class($resource) {
    public function __construct(public $record) {}
    public function item() { return $this->record; }
    public function media() { return null; }
    public function caption(): string { return '<p>Curated caption</p>'; }
};
foreach (['file', 'item-showcase'] as $block) {
    foreach (['file_name', 'item_title', 'none'] as $option) {
        $view->showTitleOption = $option;
        $html = $view->render('common/block-layout/' . $block, ['attachments' => [$attachment], 'showTitleOption' => $option]);
        $doc = new DOMDocument(); @$doc->loadHTML($html);
        $xpath = new DOMXPath($doc);
        dre_check($failures, $checks, "$block renders a no-media item ($option)", $xpath->query('//div[contains(@class,"caption")]')->length === 1);
        dre_check($failures, $checks, "$block balances its wrappers ($option)", substr_count($html, '<div') === substr_count($html, '</div>'));
    }
    $attachment->record = null;
    $html = $view->render('common/block-layout/' . $block, ['attachments' => [$attachment], 'showTitleOption' => 'file_name']);
    dre_check($failures, $checks, "$block skips removed attachments cleanly", !str_contains($html, 'Curated caption'));
    $attachment->record = $resource;
}

$resource->values = [
    'dcterms:bibliographicCitation' => [new ThemeTestValue('<script>citation</script>')],
    'dcterms:license' => [new ThemeTestValue('', 'resource', new ThemeTestResource('CC BY', 2)), new ThemeTestValue('Additional terms')],
    'bibo:doi' => [new ThemeTestValue('10.1234/example')],
];
$html = $view->render('common/record-apparatus', ['resource' => $resource]);
dre_check($failures, $checks, 'curated citation is escaped in actual output', str_contains($html, '&lt;script&gt;citation&lt;/script&gt;'));
dre_check($failures, $checks, 'all license values render with readable linked titles', str_contains($html, 'CC BY') && str_contains($html, 'Additional terms') && str_contains($html, '/item/2'));
dre_check($failures, $checks, 'DOI and canonical permalink are usable links', str_contains($html, 'href="https://doi.org/10.1234/example"') && str_contains($html, 'href="https://example.test/s/a/item/1"'));
$view->callbacks['dreCitation'] = fn() => ['styles' => ['apa' => ['label' => 'APA', 'html' => '<em>Generated</em>']], 'defaultStyle' => 'apa', 'citable' => false];
$html = $view->render('common/record-apparatus', ['resource' => $resource]);
dre_check($failures, $checks, 'authority uses honest labels', str_contains($html, 'This record') && str_contains($html, 'Copy link'));
dre_check($failures, $checks, 'one style has no tablist or dangling tab reference', !str_contains($html, 'role="tab') && !str_contains($html, 'aria-labelledby="record-cite-1-tab-'));
$view->callbacks['dreCitation'] = function () { throw new RuntimeException('module unavailable'); };
dre_check($failures, $checks, 'module failures retain curated citation', str_contains($view->render('common/record-apparatus', ['resource' => $resource]), '&lt;script&gt;citation'));

$endpointResource = new class {
    public array $options = [];
    public function subjectValueTotalCount(...$args): int { return 10000; }
    public function displaySubjectValues(array $options): string { $this->options = $options; return 'rendered'; }
};
foreach ([null, '', ['items:'], [['items:']], 'item_sets:1', 'items:bad', 'items:1:2', 'media:2'] as $input) {
    $view->query = ['resource_property' => $input, 'page' => ['bad']];
    $view->render('omeka/site/index/linked-resources', ['resource' => $endpointResource]);
    dre_check($failures, $checks, 'endpoint bounds results and normalizes query ' . json_encode($input), $endpointResource->options['perPage'] === 50 && $endpointResource->options['page'] === 1 && $endpointResource->options['resourceProperty'] === ($input === 'media:2' ? 'media:2' : 'items:'));
}
$view->query = ['page' => 2];
$view->render('omeka/site/index/linked-resources', ['resource' => $endpointResource]);
dre_check($failures, $checks, 'continuation page reaches later connections', $endpointResource->options['page'] === 2);
$view->settings['pagination_per_page'] = 100000;
$view->query = ['page' => 999999];
$view->render('omeka/site/index/linked-resources', ['resource' => $endpointResource]);
dre_check($failures, $checks, 'oversized settings and out-of-range pages are clamped', $endpointResource->options['perPage'] === 100 && $endpointResource->options['page'] === 100);

$view->settings = ['filter_locale_values' => true, 'browse_heading_property_term' => 'dcterms:title', 'browse_body_property_term' => 'dcterms:description'];
$view->callbacks['thumbnail'] = function () { throw new RuntimeException('thumbnail work was not requested'); };
$card = $view->ResourceCardData($resource, ['showThumbnail' => false, 'showBody' => false]);
dre_check($failures, $checks, 'disabled card components perform no thumbnail work', $card['thumbnail'] === '' && $card['body'] === null);
dre_check($failures, $checks, 'custom card heading respects the locale filter', end($resource->options)[1]['lang'] === ['fr', '']);
dre_report('Rendering', $failures, $checks);
