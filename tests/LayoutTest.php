<?php
/**
 * view/layout/layout.phtml renders on every request, so an undefined method or
 * a warning in it is a site-wide 500. These checks render the real layout,
 * with the real header, banner, footer and shortlist partials and the real
 * IsHomePage, PwaManifest, BrandPalette, CollectionStats and DreSearchUrl
 * helpers. Only Omeka's own view helpers are stubbed.
 */
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/support/ThemeView.php';
require_once __DIR__ . '/support/Navigation.php';

$failures = [];
$checks = 0;

/** A stringable stand-in for Omeka's head/inline helpers and HtmlElement. */
class LayoutStack
{
    public array $files = [];
    public array $attributes = [];
    public function __construct(private string $kind = 'stack') {}
    public function __call(string $name, array $args)
    {
        if ($name === 'prependFile') array_unshift($this->files, $args[0]);
        elseif ($name === 'appendFile') $this->files[] = $args[0];
        elseif ($name === 'setAttribute') $this->attributes[$args[0]] = (string) $args[1];
        elseif ($name === 'appendAttribute') $this->attributes[$args[0]] = trim(($this->attributes[$args[0]] ?? '') . ' ' . $args[1]);
        return $this;
    }
    public function __toString(): string
    {
        if ($this->kind === 'script') {
            return implode("\n", array_map(fn($file) => '<script src="' . htmlspecialchars($file) . '"></script>', $this->files));
        }
        if ($this->kind !== 'stack') {
            $attributes = '';
            foreach ($this->attributes as $name => $value) $attributes .= ' ' . $name . '="' . htmlspecialchars($value) . '"';
            return '<' . $this->kind . $attributes . '>';
        }
        return '';
    }
}

class LayoutTestView extends ThemeTestView
{
    public string $content = '<p>Page content</p>';
    public string $requestUrl = 'https://theme.test/s/a/page/about';
    public array $elements = [];
    public ?LayoutStack $inline = null;
    public ?LayoutStack $head = null;
    public function inlineScript(): LayoutStack { return $this->inline ??= new LayoutStack('script'); }
    public function headScript(): LayoutStack { return $this->head ??= new LayoutStack('script'); }
    public function htmlElement(string $tag): LayoutStack { return $this->elements[$tag] ??= new LayoutStack($tag); }
    public function serverUrl($requestUri = null): string { return $this->requestUrl; }
}

$settings = new class {
    public array $values = [];
    public function get(string $key, $default = null) { return $this->values[$key] ?? $default; }
    public function set(string $key, $value): void { $this->values[$key] = $value; }
};
$services = new class($settings) {
    public function __construct(private object $settings) {}
    public function has(string $name): bool { return $name === 'Omeka\Settings'; }
    public function get(string $name): object { return $this->settings; }
};
$site = new class($services) extends ThemeNavSite {
    public function __construct(private object $services) {}
    public function slug() { return 'a'; }
    public function homepage() { return null; }
    public function getServiceLocator() { return $this->services; }
};

$render = function (array $themeSettings = [], string $requestUrl = 'https://theme.test/s/a/page/about') use ($site, $settings): array {
    $view = new LayoutTestView();
    $view->requestUrl = $requestUrl;
    $view->themeSettings = $themeSettings;
    $chain = new LayoutStack();
    foreach (['headMeta', 'headTitle', 'headLink', 'headStyle'] as $helper) $view->callbacks[$helper] = fn() => $chain;
    $view->callbacks['userBar'] = fn() => '';
    $view->callbacks['jsTranslate'] = fn() => '';
    $view->callbacks['doctype'] = fn() => '<!DOCTYPE html>';
    $view->callbacks['currentSite'] = fn() => $site;
    $view->callbacks['url'] = fn($route, $params = [], $options = []) => '/s/a/' . ($params['controller'] ?? $route);
    $view->callbacks['assetUrl'] = fn($file, $module = null) => '/themes/dre/asset/' . $file . '?v=2.33.0';
    $view->callbacks['format'] = fn($number) => number_format((float) $number);
    // Fresh statistics each render: the cache lives in the stub settings.
    $settings->values = [];
    $html = $view->render('layout/layout', ['site' => $site]);
    return [$html, $view];
};

try {
    [$html, $view] = $render();
    $doc = new DOMDocument();
    @$doc->loadHTML($html);
    $xpath = new DOMXPath($doc);

    dre_check($failures, $checks, 'an unsaved masthead setting serves the bold brand (tracks theme.ini)',
        ($view->elements['body']->attributes['data-brand'] ?? null) === 'bold');
    dre_check($failures, $checks, 'the default brand seed is Uni-Grün', str_contains($html, '--primary-base: #009260;'));
    dre_check($failures, $checks, 'the skip link precedes the header and targets main',
        strpos($html, 'id="skipnav"') < strpos($html, 'class="main-header"') && $xpath->query('//main[@id="content"]')->length === 1);
    dre_check($failures, $checks, 'the page content renders inside main',
        str_contains($xpath->query('//main[@id="content"]')->item(0)?->textContent ?? '', 'Page content'));
    $scripts = $view->inline->files;
    dre_check($failures, $checks, 'utils.js runs before every other theme script',
        str_contains($scripts[0] ?? '', 'js/utils.js'), implode(', ', $scripts));
    dre_check($failures, $checks, 'the shortlist script loads when the feature is on (default)',
        (bool) array_filter($scripts, fn($file) => str_contains($file, 'js/shortlist.js')));
    dre_check($failures, $checks, 'the font preload targets the Spectral weight every page renders',
        str_contains($html, 'spectral-latin-800-normal.woff2') && !str_contains($html, 'spectral-latin-600-normal.woff2'));
    dre_check($failures, $checks, 'PWA is on by default: manifest island and install script render',
        str_contains($html, 'id="dre-pwa-manifest"') && str_contains($html, 'js/pwa-install.js'));
    $manifest = $xpath->query('//script[@id="dre-pwa-manifest"]')->item(0);
    dre_check($failures, $checks, 'the manifest island is valid JSON', is_array(json_decode($manifest?->textContent ?? '', true)));
    dre_check($failures, $checks, 'an interior page renders the slim page banner, not the home masthead',
        str_contains($html, 'site-banner--page') && !str_contains($html, 'site-banner--home'));

    [$html, $view] = $render(['masthead_brand' => 'loud', 'primary_color' => 'red; } body { display:none', 'pwa_enable' => 0, 'research_shortlist' => 0]);
    dre_check($failures, $checks, 'an unknown masthead value falls back to bold',
        ($view->elements['body']->attributes['data-brand'] ?? null) === 'bold');
    dre_check($failures, $checks, 'a malformed brand colour cannot inject CSS and falls back to Uni-Grün',
        str_contains($html, '--primary-base: #009260;') && !str_contains($html, 'display:none'));
    dre_check($failures, $checks, 'PWA off: no manifest island and no install script',
        !str_contains($html, 'dre-pwa-manifest') && !str_contains($html, 'pwa-install.js'));
    dre_check($failures, $checks, 'shortlist off: no script, dialog or header control',
        !array_filter($view->inline->files, fn($file) => str_contains($file, 'shortlist.js'))
        && !str_contains($html, 'data-shortlist-dialog') && !str_contains($html, 'data-shortlist-open'));

    [$html] = $render(['primary_color' => '#7A1F5C', 'masthead_brand' => 'quiet']);
    dre_check($failures, $checks, 'a valid custom brand seed is used', str_contains($html, '--primary-base: #7A1F5C;'));

    [$html, $view] = $render([], 'https://theme.test/s/a/');
    dre_check($failures, $checks, 'the site root renders the home masthead and its search',
        str_contains($html, 'site-banner--home') && str_contains($html, 'site-banner__search'));
    dre_check($failures, $checks, 'with no statistics source the masthead renders without a stat band',
        !str_contains($html, 'site-banner__catalogue'));
    dre_check($failures, $checks, 'the home page owns exactly one h1 (the masthead title)',
        substr_count($html, '<h1') === 1 && str_contains($html, '<h1 class="site-banner__title">'));

    // The banner with statistics: linked rows for known metrics, plain rows for
    // unknown keys, and escaped, formatted values.
    $banner = new LayoutTestView();
    $banner->callbacks['CollectionStats'] = fn() => [
        ['k' => 'researchItems', 'l' => 'Research items', 'n' => 3975, 's' => ''],
        ['k' => 'mystery', 'l' => '<b>Unknown</b>', 'n' => 7, 's' => 'sub'],
    ];
    $banner->callbacks['currentSite'] = fn() => $site;
    $banner->callbacks['url'] = fn() => '/s/a/dre-search';
    $banner->callbacks['assetUrl'] = fn($file) => '/' . $file;
    $html = $banner->render('common/banner', ['site' => $site, 'isHome' => true]);
    dre_check($failures, $checks, 'known metrics link to their authority page with a formatted count',
        // Formatted in the process locale: "3,975", "3 975" or, under POSIX, "3975".
        (bool) preg_match('#<a class="site-banner__entry" href="/s/a/page/research-items">.*?Research items.*?3\D{0,3}975#su', $html));
    dre_check($failures, $checks, 'an unknown metric renders as an unlinked, escaped row',
        str_contains($html, '<div class="site-banner__entry">') && str_contains($html, '&lt;b&gt;Unknown&lt;/b&gt;'));
} catch (Throwable $e) {
    dre_check($failures, $checks, 'the layout renders without errors or warnings', false,
        get_class($e) . ': ' . $e->getMessage() . ' @ ' . basename($e->getFile()) . ':' . $e->getLine());
}

dre_report('Layout', $failures, $checks);
