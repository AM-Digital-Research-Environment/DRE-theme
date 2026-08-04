<?php
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../helper/CollectionStats.php';

use OmekaTheme\Helper\CollectionStats;

$failures = [];
$checks = 0;

$root = sys_get_temp_dir() . '/dre-collection-stats-' . getmypid();
$dataDir = $root . '/modules/DreVisualizations/asset/data/item-dashboards';
mkdir($dataDir, 0777, true);
file_put_contents($dataDir . '/collection-overview.json', json_encode([
    'stats' => [
        ['key' => 'researchItems', 'label' => 'Research items', 'value' => 42],
        ['key' => 'projects', 'label' => 'Projects', 'value' => 7],
        ['key' => 'people', 'label' => 'People', 'value' => 12],
    ],
]));
if (!defined('OMEKA_PATH')) {
    define('OMEKA_PATH', $root);
}

$settings = new class {
    public array $values = [];
    public function get(string $key, string $default = '') { return $this->values[$key] ?? $default; }
    public function set(string $key, string $value): void { $this->values[$key] = $value; }
};
$services = new class($settings) {
    public function __construct(private object $settings) {}
    public function get(string $name): object { return $this->settings; }
};
$plugins = new class($services) {
    public function __construct(private object $services) {}
    public function getServiceLocator(): object { return $this->services; }
};
$api = new class {
    public int $siteTotal = 1;
    public function search(string $resource, array $query): object
    {
        $total = $resource === 'sites' ? $this->siteTotal : 0;
        return new class($total) {
            public function __construct(private int $total) {}
            public function getTotalResults(): int { return $this->total; }
            public function getContent(): array { return []; }
        };
    }
};
$view = new class($plugins, $api) {
    public function __construct(private object $plugins, private object $api) {}
    public function getHelperPluginManager(): object { return $this->plugins; }
    public function api(): object { return $this->api; }
    public function plugin(string $name): callable { return static fn(string $text): string => $text; }
};

$singleSite = new CollectionStats();
$singleSite->setView($view);
$stats = $singleSite(1);
dre_check($failures, $checks, 'legacy flat precompute is still read (pre-generations module)',
    count($stats) === 3 && $stats[0]['n'] === 42);
dre_check($failures, $checks, 'statistics are cached under a site-specific key',
    count($settings->values) === 1 && str_ends_with((string) array_key_first($settings->values), '_1'));

// --- Generational snapshot layout ----------------------------------------
// The module publishes atomically into generations/<id>/ and swaps
// asset/data/current.json to point at it. When the theme kept reading the old
// flat path, is_readable() simply returned false and the masthead fell back to
// its own thinner API counts — no error, just three missing metrics. Assert the
// pointer is followed, and that the generation WINS over a stale flat file.
$generationId = '20260803T085234Z-964ff56b9f5c';
$generationDir = $root . '/modules/DreVisualizations/asset/data/generations/'
    . $generationId . '/item-dashboards';
mkdir($generationDir, 0777, true);
file_put_contents($generationDir . '/collection-overview.json', json_encode([
    'stats' => [
        ['key' => 'researchItems', 'label' => 'Research items', 'value' => 3975],
        ['key' => 'languages', 'label' => 'Languages', 'value' => 28],
        ['key' => 'podcasts', 'label' => 'Podcasts', 'value' => 43],
        ['key' => 'youtube', 'label' => 'YouTube videos', 'value' => 140],
    ],
]));
file_put_contents($root . '/modules/DreVisualizations/asset/data/current.json', json_encode([
    'schemaVersion' => 1,
    'generationId' => $generationId,
    'basePath' => 'generations/' . $generationId,
]));

$published = new CollectionStats();
$published->setView($view);
$stats = $published(3);
dre_check($failures, $checks, 'current.json pointer resolves the published generation',
    count($stats) === 4 && $stats[0]['n'] === 3975);
dre_check($failures, $checks, 'the generation wins over a stale flat precompute',
    array_column($stats, 'k') === ['researchItems', 'languages', 'podcasts', 'youtube']);

// A pointer naming a generation that was pruned must NOT silently fall back to
// the stale flat file — that would serve figures from an unknown vintage.
file_put_contents($root . '/modules/DreVisualizations/asset/data/current.json', json_encode([
    'schemaVersion' => 1,
    'generationId' => '20260101T000000Z-ffffffffffff',
]));
$missing = new CollectionStats();
$missing->setView($view);
$stats = $missing(4);
dre_check($failures, $checks, 'a pointer to a pruned generation falls through to the API, not the stale flat file',
    $stats && $stats[0]['n'] === 0);

// A malformed generationId is never concatenated into a path. It is treated as
// "no usable manifest", which drops to the legacy flat file — deliberately the
// SAME branch the module's PublishedSnapshot::path() takes, so the two readers
// can never disagree about which artifact is current. (Note this differs from
// the pruned-generation case above: a VALID id whose directory is gone returns
// null rather than falling back, because there the manifest is authoritative.)
file_put_contents($root . '/modules/DreVisualizations/asset/data/current.json', json_encode([
    'schemaVersion' => 1,
    'generationId' => '../../../../etc',
]));
$traversal = new CollectionStats();
$traversal->setView($view);
$stats = $traversal(5);
dre_check($failures, $checks, 'a malformed generation id is rejected, not resolved as a path',
    count($stats) === 3 && $stats[0]['n'] === 42);

unlink($root . '/modules/DreVisualizations/asset/data/current.json');
unlink($generationDir . '/collection-overview.json');
rmdir($generationDir);
rmdir(dirname($generationDir));
rmdir(dirname(dirname($generationDir)));

$api->siteTotal = 2;
$multiSite = new CollectionStats();
$multiSite->setView($view);
$stats = $multiSite(2);

// The fallback ran rather than the precompute: the stub API counts everything
// as 0, so a precompute hit would still be showing 42 here.
dre_check($failures, $checks, 'multi-site installs bypass the global visualization totals',
    $stats && $stats[0]['n'] === 0);

// The fallback's metric set is a contract, not an implementation detail. The
// masthead maps every key to an authority page, and the module precompute's
// buildOverviewStats() must emit the same list in the same order — otherwise
// the catalogue silently reshuffles when an install gains or loses the
// visualizations module. A bare `count($stats) === 8` used to stand here, which
// broke on the first metric change while saying nothing about what diverged.
$keys = array_column($stats, 'k');
dre_check($failures, $checks, 'API fallback emits the ten catalogue metrics in precompute order',
    $keys === [
        'researchItems', 'projects', 'people', 'organisations', 'locations',
        'languages', 'subjectsTags', 'publications', 'podcasts', 'youtube',
    ]);

// Every remaining key resolves to a page in the masthead's $statLinks map, so
// the catalogue has no dead rows. Resource Types was the one that never did.
dre_check($failures, $checks, 'no metric without an authority page',
    !in_array('resourceTypes', $keys, true));

unlink($dataDir . '/collection-overview.json');
rmdir($dataDir);
rmdir(dirname($dataDir));
rmdir(dirname(dirname($dataDir)));
rmdir(dirname(dirname(dirname($dataDir))));
rmdir(dirname(dirname(dirname(dirname($dataDir)))));
rmdir($root);

dre_report('CollectionStats', $failures, $checks);
