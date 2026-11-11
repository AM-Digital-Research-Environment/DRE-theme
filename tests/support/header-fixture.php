<?php
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/ThemeView.php';
require_once __DIR__ . '/Navigation.php';
ThemeTestResource::$canonicalOrigin = 'https://theme.test';
$v = new ThemeTestView();
$v->callbacks['url'] = fn($route, $params = []) => '/s/a/' . ($params['controller'] ?? 'search') . '/' . ($params['action'] ?? 'results');
$site = new ThemeNavSite();
// `--dre-search-bar`: the header as it renders with DRE Search installed. The
// markup is DRE Search's SearchBar.php (src/View/Helper/SearchBar.php): the
// theme's wrapper class plus the mount node and its bootstrap blob, which the
// module's bundle turns into the bar (tests/local/modules.spec.mjs).
if (in_array('--dre-search-bar', $argv ?? [], true)) {
    $v->callbacks['dreSearchBar'] = function (string $id, string $class = '', bool $collapsible = false): string {
        $bootstrap = json_encode([
            'variant' => 'bar', 'available' => true, 'item_url_base' => '/s/a/item', 'results_url' => '/s/a/dre-search',
            'placeholder' => 'Search…', 'collapsible' => $collapsible,
            'endpoints' => ['suggest_all' => '/dre-search/api/suggest-all'],
        ], JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $class = htmlspecialchars(trim('main-header__search-bar ' . $class), ENT_QUOTES);
        $id = htmlspecialchars($id, ENT_QUOTES);
        return '<div class="' . $class . '" data-dre-search-bar data-dre-bar-id="' . $id . '">'
            . '<div class="dre-search-bar__skeleton" aria-hidden="true"></div>'
            . '<noscript><a href="/s/a/dre-search">Search</a></noscript></div>'
            . '<script type="application/json" id="dre-search-bar-state-' . $id . '">' . $bootstrap . '</script>';
    };
}
echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Header fixture</title></head><body><a id="skipnav" href="#content">Skip to main content</a>';
echo $v->render('common/header', ['site' => $site, 'userBar' => '']);
echo '<main id="content" class="container"><h1>Research archive</h1><p>Read and explore this collection.</p>';
echo $v->render('common/shortlist-button', ['resource' => new class('A record') extends ThemeTestResource { public function url($site = null, bool $canonical = false): string { return '/s/a/item/1'; } }]);
echo '<div style="height:1600px"></div><a href="#content">Return to content</a></main>';
echo $v->render('common/shortlist');
echo '</body></html>';
