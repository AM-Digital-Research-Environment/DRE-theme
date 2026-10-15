<?php
/**
 * helper/DeferScripts.php against containers shaped like Laminas' HeadScript:
 * an ArrayObject of stdClass items with `type`, `attributes` and `source`.
 */
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../helper/DeferScripts.php';

use OmekaTheme\Helper\DeferScripts;

$failures = [];
$checks = 0;

function defer_item(string $type, array $attributes = [], ?string $source = null): object
{
    return (object) ['type' => $type, 'attributes' => $attributes, 'source' => $source];
}

$scripts = new class {
    public ArrayObject $container;
    public function __construct() { $this->container = new ArrayObject(); }
    public function getContainer(): ArrayObject { return $this->container; }
};
$scripts->container->append(defer_item('text/javascript', ['src' => '/jquery.min.js']));
$scripts->container->append(defer_item('text/javascript', ['src' => '/global.js']));
$scripts->container->append(defer_item('text/javascript', ['src' => '/token-bridge.js', 'defer' => true]));
$scripts->container->append(defer_item('text/javascript', ['src' => '/analytics.js', 'async' => 'async']));
$scripts->container->append(defer_item('module', ['src' => '/dre-search.js']));
$scripts->container->append(defer_item('application/ld+json', ['noescape' => true], '{"@type":"Thing"}'));
$scripts->container->append(defer_item('text/javascript', [], 'window.RV_DATA_BASE = "/";'));
$mark = count($scripts->container);
$scripts->container->append(defer_item('text/javascript', [], 'Omeka.jsTranslate = function (s) { return s; };'));
$scripts->container->append(defer_item('text/javascript', ['src' => '/lg-itemfiles-config.js']));

$helper = new DeferScripts();
$helper->asModules($scripts, $mark);
$helper($scripts);
$items = $scripts->container->getArrayCopy();

dre_check($failures, $checks, 'jQuery and global.js are deferred, in order',
    ($items[0]->attributes['defer'] ?? null) === 'defer' && ($items[1]->attributes['defer'] ?? null) === 'defer');
dre_check($failures, $checks, 'a classic script that calls $ during parsing is deferred after them',
    ($items[8]->attributes['defer'] ?? null) === 'defer');
dre_check($failures, $checks, 'an already deferred, async or module script is left as it was',
    $items[2]->attributes['defer'] === true && !isset($items[3]->attributes['defer'])
    && $items[4]->type === 'module' && !isset($items[4]->attributes['defer']));
dre_check($failures, $checks, 'data blocks and earlier inline scripts are untouched',
    $items[5]->type === 'application/ld+json' && !isset($items[5]->attributes['defer'])
    && $items[6]->type === 'text/javascript');
dre_check($failures, $checks, 'core\'s jsTranslate snippet runs as a module, after global.js',
    $items[7]->type === 'module');
dre_check($failures, $checks, 'a file after the mark stays a classic (deferred) script', $items[8]->type === 'text/javascript');

$helper(new stdClass());
$helper->asModules(null, 0);
dre_check($failures, $checks, 'an unrecognised container is left alone without an error', true);

dre_report('DeferScripts', $failures, $checks);
