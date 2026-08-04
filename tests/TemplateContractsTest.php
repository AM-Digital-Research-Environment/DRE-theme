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

// The rail once printed `https://…/item/10297` where the licence should read
// "CC-BY-NC-SA-4.0": casting a linked value to string yields the linked item's
// URL. These pin the reading idiom, not the markup.
$apparatus = $read('view/common/record-apparatus.phtml');
dre_check($failures, $checks, 'the apparatus resolves linked values through the linked record',
    str_contains($apparatus, '$value->valueResource()->displayTitle()'));
dre_check($failures, $checks, 'the apparatus reads every value, not only the first',
    str_contains($apparatus, "['all' => true]"));
dre_check($failures, $checks, 'the apparatus permalink is absolute',
    str_contains($apparatus, '$resource->url(null, true)'));
dre_check($failures, $checks, 'the apparatus never renders a value by casting the value object',
    !preg_match('/\(string\)\s*\$resource->value\(/', $apparatus));

foreach (['item', 'item-set', 'media'] as $resource) {
    $redirect = "view/omeka/site/{$resource}/search.phtml";
    dre_check($failures, $checks, "legacy {$resource} search redirects to DRE Search",
        is_file($root . '/' . $redirect) && str_contains($read($redirect), 'dre-search-redirect'));
}

dre_check($failures, $checks, 'Faceted Browse overrides are gone',
    !is_dir($root . '/view/faceted-browse') && !is_file($root . '/asset/js/faceted-browse.js'));

dre_report('TemplateContracts', $failures, $checks);
