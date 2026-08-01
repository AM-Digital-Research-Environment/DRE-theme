<?php
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../helper/BrowseLayout.php';
require_once __DIR__ . '/../helper/ContrastColor.php';
require_once __DIR__ . '/../helper/DreSearchUrl.php';
require_once __DIR__ . '/../helper/IsHomePage.php';

use OmekaTheme\Helper\BrowseLayout;
use OmekaTheme\Helper\ContrastColor;
use OmekaTheme\Helper\DreSearchUrl;
use OmekaTheme\Helper\IsHomePage;

$failures = [];
$checks = 0;

$contrast = new ContrastColor();
dre_check($failures, $checks, 'near-black wins against the brand green',
    $contrast('#009260', ['#ffffff', '#1a1a1a']) === '#1a1a1a');
dre_check($failures, $checks, 'three-digit colours are normalized',
    $contrast('#fff', ['#000']) === '#000000');
dre_check($failures, $checks, 'invalid candidates are ignored',
    $contrast('#ffffff', ['not-a-color', '#000000']) === '#000000');
dre_check($failures, $checks, 'invalid base input falls back safely',
    $contrast('var(--hostile)', ['#ffffff', '#1a1a1a']) === '#1a1a1a');

$params = new class {
    public string $view = 'list';
    public function fromQuery(string $key, string $default = ''): string
    {
        return $key === 'view' ? $this->view : $default;
    }
};
$pluginManager = new class($params) {
    public function __construct(private object $params) {}
    public function has(string $name): bool { return $name === 'params'; }
};
$browseView = new class($params, $pluginManager) {
    public function __construct(private object $params, private object $plugins) {}
    public function themeSetting(string $name) { return ['browse_layout' => 'togglegrid', 'truncate_body_property' => 'ellipsis'][$name] ?? null; }
    public function siteSetting(string $name) { return $name === 'browse_body_property_term' ? 'dcterms:abstract' : null; }
    public function getHelperPluginManager(): object { return $this->plugins; }
    public function params(): object { return $this->params; }
};
$browse = new BrowseLayout();
$browse->setView($browseView);
$layout = $browse();
dre_check($failures, $checks, 'valid visitor browse override wins', !$layout['isGrid'] && $layout['hasToggle']);
dre_check($failures, $checks, 'browse metadata settings are returned once',
    $layout['bodyTerm'] === 'dcterms:abstract' && $layout['truncate'] === 'ellipsis');

$site = new class {
    public function url(): string { return 'https://example.test/s/archive/'; }
    public function homepage(): object { return new class { public function slug(): string { return 'home'; } }; }
};
$homeView = new class($site) {
    public string $url = 'https://example.test/s/archive/page/home';
    public function __construct(private object $site) {}
    public function currentSite(): object { return $this->site; }
    public function serverUrl(bool $current = false): string { return $this->url; }
};
$home = new IsHomePage();
$home->setView($homeView);
dre_check($failures, $checks, 'configured home-page slug is recognized', $home() === true);
$notHome = new IsHomePage();
$homeView->url = 'https://example.test/s/archive/item/1';
$notHome->setView($homeView);
dre_check($failures, $checks, 'an item route is not the home page', $notHome() === false);

$search = new DreSearchUrl();
$search->setView($homeView);
dre_check($failures, $checks, 'DRE Search URL is derived from the current site',
    $search() === 'https://example.test/s/archive/dre-search');

dre_report('Helpers', $failures, $checks);
