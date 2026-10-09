<?php
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../helper/CollectionStats.php';
require_once __DIR__ . '/../helper/IntegrationWarning.php';

use OmekaTheme\Helper\CollectionStats;
use OmekaTheme\Helper\IntegrationWarning;

$failures = [];
$checks = 0;

// A leftover DRE Visualizations snapshot in the pre-2.29 public layout (flat
// file, generation pointer and generation), scoped to the site under test. The
// helper must never read it: the module no longer publishes there, and its
// current snapshot only copies DRESearch's counts. Theme <=2.35 still read this
// tree, so its branch failed silently once the module moved to private storage.
// Any 42 below means a precompute reader came back.
$root = sys_get_temp_dir() . '/dre-collection-stats-' . getmypid();
$legacyData = $root . '/modules/DreVisualizations/asset/data';
$generationId = '20260803T085234Z-964ff56b9f5c';
$leftover = ['stats' => [
    ['key' => 'researchItems', 'label' => 'Research items', 'value' => 42],
    ['key' => 'projects', 'label' => 'Projects', 'value' => 7],
    ['key' => 'people', 'label' => 'People', 'value' => 12],
]];
mkdir($legacyData . '/generations/' . $generationId . '/item-dashboards', 0777, true);
mkdir($legacyData . '/item-dashboards', 0777, true);
file_put_contents($legacyData . '/item-dashboards/collection-overview.json', json_encode(['siteId' => 1] + $leftover));
file_put_contents($legacyData . '/generations/' . $generationId . '/item-dashboards/collection-overview.json', json_encode($leftover));
file_put_contents($legacyData . '/current.json', json_encode([
    'schemaVersion' => 1,
    'generationId' => $generationId,
    'scope' => ['type' => 'canonical-site', 'siteId' => 1],
]));
if (!defined('OMEKA_PATH')) {
    define('OMEKA_PATH', $root);
}

$settings = new class {
    public array $values = [];
    public function get(string $key, string $default = '') { return $this->values[$key] ?? $default; }
    public function set(string $key, string $value): void { $this->values[$key] = $value; }
};
$logger = new class {
    public array $warnings = [];
    public function warn(string $message): void { $this->warnings[] = $message; }
};
$services = new class($settings, $logger) {
    public function __construct(private object $settings, private object $logger) {}
    public ?object $counts = null;
    public function has(string $name): bool { return $name === 'DRESearch\Search\CorpusCounts' && $this->counts !== null; }
    public function get(string $name): object
    {
        return match ($name) {
            'DRESearch\Search\CorpusCounts' => $this->counts,
            'Omeka\Logger' => $this->logger,
            default => $this->settings,
        };
    }
};
// The helper reaches services through the current site, never through the
// helper plugin manager's deprecated getServiceLocator().
$site = new class($services) {
    public function __construct(private object $services) {}
    public function getServiceLocator(): object { return $this->services; }
};
$api = new class {
    public array $queries = [];
    public bool $fail = false;
    public function search(string $resource, array $query): object
    {
        $this->queries[] = [$resource, $query];
        if ($this->fail) throw new RuntimeException("Unavailable");
        $total = 0;
        // Only the Publications set resolves, so its count predicate is observable.
        $content = $resource === 'item_sets' && ($query['property'][0]['text'] ?? '') === 'Publications'
            ? [new class { public function id(): int { return 29918; } }]
            : [];
        return new class($total, $content) {
            public function __construct(private int $total, private array $content) {}
            public function getTotalResults(): int { return $this->total; }
            public function getContent(): array { return $this->content; }
        };
    }
};
$view = new class($site, $api) {
    public string $locale = 'en';
    private ?IntegrationWarning $warning = null;
    public function __construct(private object $site, private object $api) {}
    public function getHelperPluginManager(): object { throw new LogicException('Deprecated service locator path used'); }
    public function currentSite(): object { return $this->site; }
    public function IntegrationWarning($resource, string $component, Throwable $error): void
    {
        if (!$this->warning) { $this->warning = new IntegrationWarning(); $this->warning->setView($this); }
        ($this->warning)($resource, $component, $error);
    }
    public function api(): object { return $this->api; }
    public function plugin(string $name): callable {
        return fn(string $text): string => $this->locale === 'fr' ? 'fr:' . $text : $text;
    }
};

$singleSite = new CollectionStats();
$singleSite->setView($view);
$stats = $singleSite(1);
dre_check($failures, $checks, 'a leftover visualizations snapshot is never read',
    count($stats) === 10 && $stats[0]['n'] === 0);
dre_check($failures, $checks, 'statistics are cached under a site-specific key',
    isset($settings->values['dre_stats_v10_1']));

$queries = count($api->queries);
$view->locale = 'fr';
$translated = $singleSite(1);
dre_check($failures, $checks, 'a cache hit translates labels for the current visitor',
    $translated[0]['l'] === 'fr:Research items' && count($api->queries) === $queries);
$view->locale = 'en';
dre_check($failures, $checks, 'translation does not mutate shared cached labels',
    $singleSite(1)[0]['l'] === 'Research items'
    && json_decode($settings->values['dre_stats_v10_1'], true)['stats'][0]['l'] === 'Research items');

$settings->values = [];
$api->queries = [];
$singleSite(null);
dre_check($failures, $checks, 'unscoped requests use their own cache key and no site predicate',
    isset($settings->values['dre_stats_v10_x'])
    && !array_filter($api->queries, fn($call) => $call[0] === 'items' && isset($call[1]['site_id'])));

// The fallback's metric set is a contract, not an implementation detail. The
// masthead maps every key to an authority page, and DRESearch's
// CorpusCounts::METRICS emits the same list in the same order — otherwise the
// catalogue silently reshuffles when an install gains or loses DRESearch. A bare `count($stats) === 8` used to stand here, which
// broke on the first metric change while saying nothing about what diverged.
$keys = array_column($stats, 'k');
dre_check($failures, $checks, 'API fallback emits the ten catalogue metrics in DRESearch order',
    $keys === [
        'researchItems', 'projects', 'people', 'organisations', 'locations',
        'languages', 'subjectsTags', 'publications', 'podcasts', 'youtube',
    ]);

// Every remaining key resolves to a page in the masthead's $statLinks map, so
// the catalogue has no dead rows. Resource Types was the one that never did.
dre_check($failures, $checks, 'no metric without an authority page',
    !in_array('resourceTypes', $keys, true));

$api->queries = [];
$settings->values = [];
$singleSite(101);
$firstQueries = $api->queries;
$api->queries = [];
$singleSite(102);
dre_check($failures, $checks, 'fallback does not hydrate the template catalogue',
    !array_filter($firstQueries, fn($call) => $call[0] === 'resource_templates'));
dre_check($failures, $checks, 'fallback resolves only five exact public item-set titles',
    count(array_filter($firstQueries, fn($call) => $call[0] === 'item_sets'
        && $call[1]['is_public'] === true
        && $call[1]['property'][0]['type'] === 'eq')) === 5);
dre_check($failures, $checks, 'item-set mappings are reused across site count caches',
    !array_filter($api->queries, fn($call) => $call[0] === 'item_sets'));
dre_check($failures, $checks, 'fallback count predicates retain public site scope and do not fetch content',
    count(array_filter($api->queries, fn($call) => $call[0] === 'items'
        && $call[1]['site_id'] === 102 && $call[1]['is_public'] === true
        && $call[1]['limit'] === 0 && isset($call[1]['resource_template_label']))) === 5);
// Publications span a growing, non-contiguous template range, and records
// detached from the set keep their publication template. Like DRESearch, the
// fallback counts set membership, never a sum of template labels.
dre_check($failures, $checks, 'publications are counted by the Publications item set',
    count(array_filter($api->queries, fn($call) => $call[0] === 'items'
        && ($call[1]['item_set_id'] ?? null) === [29918]
        && !isset($call[1]['resource_template_label'])
        && $call[1]['site_id'] === 102 && $call[1]['is_public'] === true
        && $call[1]['limit'] === 0)) === 1);

$services->counts = new class {
    public ?int $site = null;
    public function forSite(?int $site): array {
        $this->site = $site;
        return [['k' => 'locations', 'l' => 'Locations', 'n' => 205, 's' => '']];
    }
};
$settings->values = [];
$stats = $singleSite(1);
dre_check($failures, $checks, 'configured search corpora take priority over legacy totals',
    $stats[0]['n'] === 205 && $services->counts->site === 1);

// Keep last good site counts during an outage, then throttle retries.
$settings->values = ['dre_stats_v10_88' => json_encode(['t' => time() - 4000, 'stats' => [['k' => 'locations', 'n' => 123]]])];
$services->counts = new class { public function forSite($site) { return [['invalid' => true]]; } };
$api->fail = true;
$stats = $singleSite(88);
dre_check($failures, $checks, 'malformed upstream counts and API failure preserve stale values', $stats[0]['n'] === 123);
$queries = count($api->queries);
$singleSite(88);
dre_check($failures, $checks, 'outage retries are throttled', count($api->queries) === $queries);
dre_check($failures, $checks, 'failures record rate-limit markers through IntegrationWarning',
    isset($settings->values['dre_theme_warning_' . hash('sha256', 'statistics search-counts')],
        $settings->values['dre_theme_warning_' . hash('sha256', 'statistics api-counts')]));
dre_check($failures, $checks, 'failures are logged once per stage',
    count($logger->warnings) === 2 && str_contains($logger->warnings[0], 'statistics search-counts'));
$stats = $singleSite(89);
dre_check($failures, $checks, 'outage without cached values returns an empty band', $stats === []);

$remove = function (string $path) use (&$remove): void {
    if (!is_dir($path)) {
        unlink($path);
        return;
    }
    foreach (array_diff(scandir($path), ['.', '..']) as $entry) {
        $remove($path . '/' . $entry);
    }
    rmdir($path);
};
$remove($root);

dre_report('CollectionStats', $failures, $checks);
