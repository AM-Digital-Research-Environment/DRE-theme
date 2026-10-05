<?php
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/ThemeView.php';
require_once __DIR__ . '/Navigation.php';
ThemeTestResource::$canonicalOrigin = 'https://theme.test';
$v = new ThemeTestView();
$v->callbacks['url'] = fn($route, $params = []) => '/s/a/' . ($params['controller'] ?? 'search') . '/' . ($params['action'] ?? 'results');
$site = new ThemeNavSite();
echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Header fixture</title></head><body><a id="skipnav" href="#content">Skip to main content</a>';
echo $v->render('common/header', ['site' => $site, 'userBar' => '']);
echo '<main id="content" class="container"><h1>Research archive</h1><p>Read and explore this collection.</p>';
echo $v->render('common/shortlist-button', ['resource' => new class('A record') extends ThemeTestResource { public function url($site = null, bool $canonical = false): string { return '/s/a/item/1'; } }]);
echo '<div style="height:1600px"></div><a href="#content">Return to content</a></main>';
echo $v->render('common/shortlist');
echo '</body></html>';
