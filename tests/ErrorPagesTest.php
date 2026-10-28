<?php
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/support/ThemeView.php';
$failures = []; $checks = 0;

// view/error/*.phtml through the shared view/common/error-page partial.
$site = new class {
    public function url(): string { return '/s/amira'; }
    public function slug(): string { return 'amira'; }
};
$view = new ThemeTestView();
$titles = []; $meta = [];
$element = new class { public array $classes = []; public function appendAttribute(string $n, string $v): void { $this->classes[] = $v; } };
$view->callbacks['htmlElement'] = fn() => $element;
$view->callbacks['headTitle'] = function (string $title) use (&$titles) { $titles[] = $title; };
$view->callbacks['headMeta'] = fn() => new class($meta) {
    public function __construct(public array &$meta) {}
    public function setName(string $n, string $c): void { $this->meta[$n] = $c; }
};
$view->callbacks['currentSite'] = fn() => $site;
$view->callbacks['url'] = fn(string $route, array $params) => '/s/' . $params['site-slug'] . '/' . $params['controller'];
$view->callbacks['basePath'] = fn(string $path = '') => $path;
$view->callbacks['dreSearchBar'] = fn() => '';

$dom = function (string $html): DOMXPath {
    $doc = new DOMDocument(); @$doc->loadHTML('<?xml encoding="utf-8"?>' . $html);
    return new DOMXPath($doc);
};

$html = $view->render('error/404', ['message' => '<b>raw</b>', 'exception' => new RuntimeException('trace <x>')]);
$xp = $dom($html);
dre_check($failures, $checks, '404 has one h1 naming the problem', $xp->query('//h1')->length === 1 && trim($xp->query('//h1')->item(0)->textContent) === 'Page not found');
dre_check($failures, $checks, '404 titles the page and marks the body', $titles === ['Page not found'] && in_array('error-page-body error-404', $element->classes, true));
dre_check($failures, $checks, '404 offers DRE Search with the module present', $xp->query('//form[@role="search"][@action="/s/amira/dre-search"]//input[@name="q"]')->length === 1);
dre_check($failures, $checks, '404 links home and to the records', $xp->query('//a[@href="/s/amira"]')->length === 1 && $xp->query('//a[@href="/s/amira/item"]')->length === 1);
$debug = ini_get('display_errors');
dre_check($failures, $checks, '404 details follow display_errors and are escaped',
    $debug ? (str_contains($html, '&lt;b&gt;raw&lt;/b&gt;') && !str_contains($html, '<b>raw</b>')) : !str_contains($html, 'raw'));

unset($view->callbacks['dreSearchBar']);
$xp = $dom($view->render('error/403'));
dre_check($failures, $checks, '403 falls back to core search without the module', $xp->query('//form[@action="/s/amira/index/search"]//input[@name="fulltext_search"]')->length === 1);

$xp = $dom($view->render('error/index', ['exception' => new RuntimeException('boom')]));
dre_check($failures, $checks, 'a generic error offers no search, only the way home', $xp->query('//form')->length === 0 && $xp->query('//a[@href="/s/amira"]')->length === 1);

// An error before the site resolves (unknown slug) still renders.
$view->callbacks['currentSite'] = function () { throw new RuntimeException('no site'); };
$xp = $dom($view->render('error/404'));
dre_check($failures, $checks, 'without a site the page links to the installation root and skips search',
    $xp->query('//form')->length === 0 && $xp->query('//a[@href="/"]')->length === 1 && $xp->query('//a[@href="/s/amira/item"]')->length === 0);

dre_report('Error pages', $failures, $checks);
