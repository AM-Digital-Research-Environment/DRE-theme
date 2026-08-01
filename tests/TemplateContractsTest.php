<?php
require_once __DIR__ . '/bootstrap.php';

$failures = [];
$checks = 0;
$root = dirname(__DIR__);
$read = static fn(string $path): string => (string) file_get_contents($root . '/' . $path);

$header = $read('view/common/header.phtml');
dre_check($failures, $checks, 'the site lockup never owns the document h1',
    !str_contains($header, '<h1') && !str_contains($header, '$titleTag'));
dre_check($failures, $checks, 'theme-toggle translations are supplied by the template',
    str_contains($header, 'data-label-light=') && str_contains($header, 'data-label-dark='));

foreach ([
    'view/omeka/site/item/browse.phtml',
    'view/omeka/site/item-set/browse.phtml',
    'view/omeka/site/media/browse.phtml',
    'view/omeka/site/page/browse.phtml',
] as $file) {
    dre_check($failures, $checks, "{$file} has a level-one page title",
        (bool) preg_match('/pageTitle\([^;]+,\s*1\)/s', $read($file)));
}

$attachment = $read('view/common/block-layout/item-with-metadata.phtml');
dre_check($failures, $checks, 'an attached item without a title value is null-safe',
    str_contains($attachment, '$titleObj ? (string) $titleObj->lang() :'));
dre_check($failures, $checks, 'attached item title and language are escaped separately',
    str_contains($attachment, '$escape($title)') && str_contains($attachment, '$escape($titleLang)'));

$values = $read('view/common/resource-values.phtml');
dre_check($failures, $checks, 'resource language and class attributes use attribute escaping',
    str_contains($values, '$escapeAttr(implode') && str_contains($values, '$escapeAttr($valueLang)'));

foreach (['item', 'item-set', 'media'] as $resource) {
    $redirect = "view/omeka/site/{$resource}/search.phtml";
    dre_check($failures, $checks, "legacy {$resource} search redirects to DRE Search",
        is_file($root . '/' . $redirect) && str_contains($read($redirect), 'dre-search-redirect'));
}

dre_check($failures, $checks, 'Faceted Browse overrides are gone',
    !is_dir($root . '/view/faceted-browse') && !is_file($root . '/asset/js/faceted-browse.js'));

dre_report('TemplateContracts', $failures, $checks);
