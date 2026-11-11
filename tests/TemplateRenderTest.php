<?php
// Templates no other suite rendered: the footer and its partials, the numeric
// data-type inputs, the page-title and item-with-metadata blocks, item and
// item-set browse, and the media page. They were only read as text, if at all,
// so a typo in one was a 500 on its page that no test saw. Core helpers are
// stubbed; the theme's own partials and helpers run for real where they can.
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/support/ThemeView.php';
$failures = []; $checks = 0;

$chain = new class {
    public function __call(string $name, array $args) { return $this; }
    public function __toString(): string { return ''; }
};

function dre_doc(string $html): DOMXPath
{
    $doc = new DOMDocument();
    @$doc->loadHTML('<?xml encoding="utf-8"?><body>' . $html . '</body>');
    return new DOMXPath($doc);
}

/** A view with the core helpers every page template here reaches for. */
function dre_page_view(object $chain): ThemeTestView
{
    $view = new ThemeTestView();
    foreach (['headLink', 'htmlElement', 'searchFilters', 'browse'] as $helper) {
        $view->callbacks[$helper] = fn() => $chain;
    }
    $view->callbacks['assetUrl'] = fn($file) => '/' . $file;
    $view->callbacks['pageTitle'] = fn($title, $level = 2) => "<h{$level}>" . htmlspecialchars((string) $title) . "</h{$level}>";
    $view->callbacks['hyperlink'] = fn($text, $url, array $attrs = []) => '<a href="' . htmlspecialchars($url) . '" class="' . htmlspecialchars($attrs['class'] ?? '') . '">' . htmlspecialchars($text) . '</a>';
    $view->callbacks['DreSearchUrl'] = fn() => '/s/a/dre-search';
    $view->callbacks['url'] = fn() => '/s/a/item';
    $view->callbacks['ResourceTags'] = fn() => '';
    $view->callbacks['thumbnail'] = fn() => '';
    // Which pager a template asks for, in order.
    $view->callbacks['pagination'] = fn($partial = null) => '<!--pager:' . ($partial ?? 'common/pagination') . '-->';
    $view->callbacks['BrowseLayout'] = fn() => ['isGrid' => true, 'hasToggle' => true, 'truncate' => '', 'bodyTerm' => null];
    $view->helpers['BrowseSort'] = new class {
        public function __invoke(): self { return $this; }
        public function selector(string $resource): string { return '<form class="sorting"></form>'; }
    };
    $view->callbacks['partial:common/breadcrumb'] = fn() => '<nav class="breadcrumb"></nav>';
    $view->callbacks['partial:common/record-linked-data'] = fn($vars) => '<!--linked-data:' . $vars['resource']->id() . '-->';
    return $view;
}

function dre_pagers(string $html): array
{
    preg_match_all('/<!--pager:([^>]+)-->/', $html, $m);
    return $m[1];
}

class RenderTestBlocks
{
    public function __construct(private string $html = '') {}
    public function hasBlocks(): bool { return $this->html !== ''; }
    public function getBlocks(): string { return $this->html; }
}

// --- Footer -----------------------------------------------------------------
$view = new ThemeTestView();
$view->callbacks['assetUrl'] = fn($file) => '/' . $file;
$site = new class { public function title() { return 'AMIRA <beta>'; } };
$x = dre_doc($view->render('common/footer', ['site' => $site]));
dre_check($failures, $checks, 'the footer is one contentinfo landmark', $x->query('//footer[contains(@class,"main-footer")]')->length === 1);
dre_check($failures, $checks, 'the footer names the site, escaped', $x->query('//p[@class="main-footer__brand"]')->item(0)?->textContent === 'AMIRA <beta>');
dre_check($failures, $checks, 'the Cluster accounts show by default, each named',
    $x->query('//ul[@class="main-footer__social"]/li/a[@aria-label]')->length === 3);
dre_check($failures, $checks, 'the institution marks carry their names as alt text and intrinsic sizes',
    $x->query('//img[@alt="University of Bayreuth"][@width][@height]')->length === 1);
dre_check($failures, $checks, 'without contact settings there is no contact band, without legal links no legal list',
    $x->query('//*[contains(@class,"footer-contact-info")]')->length === 0 && $x->query('//ul[@class="main-footer__links"]')->length === 0);
$view->themeSettings = [
    'contact_info_position' => ['footer'], 'contact_info_email' => 'dre@example.test', 'contact_info_phone' => '+49 <1>',
    'footer_bottom_privacy_link' => 'https://example.test/privacy', 'twitter_url' => 'https://x.example/dre',
];
$x = dre_doc($view->render('common/footer', ['site' => $site]));
dre_check($failures, $checks, 'contact details in the footer are escaped links',
    $x->query('//a[@href="mailto:dre@example.test"]')->length === 1 && $x->query('//a[@href="tel:+49 <1>"]')->item(0)?->textContent === '+49 <1>');
dre_check($failures, $checks, 'a privacy link without a title shows its URL',
    $x->query('//ul[@class="main-footer__links"]/li/a')->item(0)?->textContent === 'https://example.test/privacy');
dre_check($failures, $checks, 'a configured network joins the defaults with its label', $x->query('//a[@aria-label="X (Twitter)"]')->length === 1);

// --- Numeric data-type inputs ------------------------------------------------
$view = new ThemeTestView();
$view->callbacks['headLink'] = fn() => $chain;
$view->callbacks['assetUrl'] = fn($file, $module = null) => '/' . $module . '/' . $file;
$view->callbacks['formHidden'] = fn($e) => '<input type="hidden" name="' . $e . '">';
$view->callbacks['formNumber'] = fn($e) => '<input type="number" name="' . $e . '">';
$view->callbacks['formSelect'] = fn($e) => '<select name="' . $e . '"></select>';
$element = new class {
    public function __call(string $name, array $args): string { return preg_replace('/^get|Element$/', '', $name); }
};
foreach (['integer' => 1, 'timestamp' => 7, 'duration' => 6] as $type => $fields) {
    $x = dre_doc($view->render("common/numeric-{$type}", ['element' => $element]));
    dre_check($failures, $checks, "numeric-{$type} renders its value field and {$fields} labelled input(s)",
        $x->query('//input[@type="hidden"][@name="Value"]')->length === 1
        && $x->query('//label[contains(@class,"sub-label")][.//input or .//select]')->length === $fields);
}

// --- Page-title block ---------------------------------------------------------
$view = new ThemeTestView();
$view->callbacks['IsHomePage'] = fn() => false;
dre_check($failures, $checks, 'the page-title block is the page h1, escaped',
    trim($view->render('common/block-layout/page-title', ['pageTitle' => 'About <us>'])) === '<h1 class="title">About &lt;us&gt;</h1>');
$view->callbacks['IsHomePage'] = fn() => true;
$view->callbacks['currentSite'] = fn() => $site;
dre_check($failures, $checks, 'on the home page the masthead owns the h1 and the block stands down',
    trim($view->render('common/block-layout/page-title', ['pageTitle' => 'Home'])) === '');

// --- Item-with-metadata block ---------------------------------------------------
class RenderTestItem extends ThemeTestResource
{
    public $titleValue = null;
    public function resourceTemplate() { return null; }
    public function value(string $term, array $options = []) { return $term === 'dcterms:title' ? $this->titleValue : null; }
    public function displayValues(array $options = []): string { return '<dl class="values" data-chrome="' . var_export($options['recordChrome'] ?? true, true) . '"></dl>'; }
    public function itemSets(): array { return []; }
    public function media(): array { return []; }
}
$view = new ThemeTestView();
$view->callbacks['ResourceTags'] = fn() => '';
$item = new RenderTestItem('<Untitled & co>', 3);
$attachment = new class($item) {
    public function __construct(public $record) {}
    public function item() { return $this->record; }
};
$x = dre_doc($view->render('common/block-layout/item-with-metadata', ['attachments' => [$attachment]]));
$heading = $x->query('//h3[@class="item-with-metadata__heading"]')->item(0);
dre_check($failures, $checks, 'an attached item without a title value renders its escaped title and no language',
    $heading && trim($heading->textContent) === '<Untitled & co>' && $x->query('//span[@class="language"]')->length === 0);
dre_check($failures, $checks, 'the attached item\'s values render without the record page chrome', $x->query('//dl[@data-chrome="false"]')->length === 1);
$item->titleValue = new class { public function lang() { return 'fr"><b>'; } };
$x = dre_doc($view->render('common/block-layout/item-with-metadata', ['attachments' => [$attachment]]));
dre_check($failures, $checks, 'the title language is shown, escaped', $x->query('//span[@class="language"]')->item(0)?->textContent === 'fr"><b>' && $x->query('//b')->length === 0);

// --- Item-set browse ---------------------------------------------------------------
class RenderTestSet extends ThemeTestResource
{
    public function resourceName(): string { return 'item_sets'; }
}
$view = dre_page_view($chain);
$html = $view->render('omeka/site/item-set/browse', ['itemSets' => [new RenderTestSet('Set one', 11), new RenderTestSet('Set <two>', 12)]]);
$x = dre_doc($html);
dre_check($failures, $checks, 'item-set browse has one level-one title', $x->query('//h1')->length === 1 && trim($x->query('//h1')->item(0)->textContent) === 'Item sets');
dre_check($failures, $checks, 'item-set browse renders a card per set, typed by the resource', $x->query('//div[contains(@class,"item-set") and contains(@class,"resource")]')->length === 2);
dre_check($failures, $checks, 'item-set browse asks for the top pager, then the bottom one', dre_pagers($html) === ['common/pagination-top', 'common/pagination-bottom']);

// --- Item browse -------------------------------------------------------------------
$view = dre_page_view($chain);
$html = $view->render('omeka/site/item/browse', ['items' => [new ThemeTestResource('First', 21), new ThemeTestResource('Second', 22)]]);
$x = dre_doc($html);
dre_check($failures, $checks, 'item browse has one level-one title', $x->query('//h1')->length === 1 && trim($x->query('//h1')->item(0)->textContent) === 'Items');
dre_check($failures, $checks, 'item browse renders a card per item, the first ones staggered',
    $x->query('//div[contains(@class,"item") and contains(@class,"resource")][@data-rv-reveal]')->length === 2);
dre_check($failures, $checks, 'item browse asks for the top pager, then the bottom one', dre_pagers($html) === ['common/pagination-top', 'common/pagination-bottom']);
dre_check($failures, $checks, 'item browse uses the curated sort selector', $x->query('//form[@class="sorting"]')->length === 1);

$view->query = ['fulltext_search' => ' orixá '];
$x = dre_doc($view->render('omeka/site/item/browse', ['items' => []]));
dre_check($failures, $checks, 'a fruitless search gets the empty state with hints and two ways on',
    $x->query('//div[@class="search-empty"]//ul[@class="search-empty__hints"]/li')->length === 3
    && $x->query('//div[@class="search-empty__actions"]/a')->length === 2);
$view->query = [];
$x = dre_doc($view->render('omeka/site/item/browse', ['items' => []]));
dre_check($failures, $checks, 'empty filters say so, without search hints',
    str_contains($x->query('//p[@class="search-empty__lead"]')->item(0)?->textContent ?? '', 'No items match') && $x->query('//ul[@class="search-empty__hints"]')->length === 0);

// An item set's own page is item browse with the set: its title, the project
// notice and a search scoped to the project's records.
$project = new ThemeTestResource('A <project>', 1797);
$view = dre_page_view($chain);
$view->callbacks['resourcePageBlocks'] = fn($r, $region = 'main') => new RenderTestBlocks($region === 'main' ? '<p class="block-main"></p>' : '');
$view->helpers['ProjectCollections'] = new class($project) {
    public function __construct(private $project) {}
    public function __invoke(): self { return $this; }
    public function projectOf($set) { return $this->project; }
    public function recordsUrl($p): string { return '/s/a/dre-search?f.project_id_s=1797'; }
};
$html = $view->render('omeka/site/item/browse', ['items' => [new ThemeTestResource('First', 21)], 'itemSet' => new RenderTestSet('The set', 30)]);
$x = dre_doc($html);
dre_check($failures, $checks, 'a set page is titled by the set, with Items as its h2',
    trim($x->query('//h1')->item(0)?->textContent ?? '') === 'The set' && trim($x->query('//div[@class="item-set-items"]/h2')->item(0)?->textContent ?? '') === 'Items');
dre_check($failures, $checks, 'a project\'s set says whose records these are, escaped, as a note',
    $x->query('//div[@class="record-notice"][@role="note"]//a[@href="/s/a/item/1797"]')->item(0)?->textContent === 'A <project>');
dre_check($failures, $checks, 'a project\'s set searches the project\'s records',
    $x->query('//a[@class="collection-search"][@href="/s/a/dre-search?f.project_id_s=1797"]')->length === 1);
dre_check($failures, $checks, 'the set\'s blocks render in the main region, with its linked-data block',
    $x->query('//div[@class="main-region"]//p[@class="block-main"]')->length === 1 && str_contains($html, '<!--linked-data:30-->'));

// --- Hierarchy page --------------------------------------------------------------
$view = dre_page_view($chain);
$view->callbacks['HierarchyTree'] = fn() => ['nodes' => [], 'itemSets' => []];
$grouping = new class {
    public function getLabel() { return 'Grouping <one>'; }
    public function getItemSet() { return null; }
    public function getHierarchy() { return $this; }
};
$html = $view->render('hierarchy/site/index/hierarchy', ['hierarchyGrouping' => $grouping, 'itemSet' => null, 'items' => [new ThemeTestResource('First', 21)]]);
$x = dre_doc($html);
dre_check($failures, $checks, 'a hierarchy page is titled by its grouping, escaped', $x->query('//h1')->item(0)?->textContent === 'Grouping <one>');
dre_check($failures, $checks, 'a hierarchy page lists its items and asks for the top pager, then the bottom one',
    $x->query('//ul[@class="resource-list"]/li')->length === 1 && dre_pagers($html) === ['common/pagination-top', 'common/pagination-bottom']);

// --- Media page --------------------------------------------------------------------
class RenderTestMedia extends ThemeTestResource
{
    public function __construct(string $title, int $id, private $parent) { parent::__construct($title, $id); }
    public function resourceName(): string { return 'media'; }
    public function item() { return $this->parent; }
}
$view = dre_page_view($chain);
$view->callbacks['resourcePageBlocks'] = fn($r, $region = 'main') => new RenderTestBlocks($region === 'main' ? '<p class="block-main"></p>' : '');
$media = new RenderTestMedia('Scan <1>', 40, new ThemeTestResource('Parent & item', 41));
$html = $view->render('omeka/site/media/show', ['media' => $media]);
$x = dre_doc($html);
dre_check($failures, $checks, 'the media page has one escaped level-one title', $x->query('//h1')->length === 1 && $x->query('//h1')->item(0)->textContent === 'Scan <1>');
dre_check($failures, $checks, 'the media page links to its item', $x->query('//p[contains(@class,"media-parent-item")]/a[@href="/s/a/item/41"]')->length === 1);
dre_check($failures, $checks, 'the media page renders its blocks and its linked-data block',
    $x->query('//div[@class="main-region"]//p[@class="block-main"]')->length === 1 && str_contains($html, '<!--linked-data:40-->'));

dre_report('TemplateRender', $failures, $checks);
