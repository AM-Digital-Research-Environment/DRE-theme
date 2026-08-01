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
dre_check($failures, $checks, 'single-site installs use the shared visualization precompute',
    count($stats) === 3 && $stats[0]['n'] === 42);
dre_check($failures, $checks, 'statistics are cached under a site-specific key',
    count($settings->values) === 1 && str_ends_with((string) array_key_first($settings->values), '_1'));

$api->siteTotal = 2;
$multiSite = new CollectionStats();
$multiSite->setView($view);
$stats = $multiSite(2);
dre_check($failures, $checks, 'multi-site installs bypass the global visualization totals',
    count($stats) === 8 && $stats[0]['n'] === 0);

unlink($dataDir . '/collection-overview.json');
rmdir($dataDir);
rmdir(dirname($dataDir));
rmdir(dirname(dirname($dataDir)));
rmdir(dirname(dirname(dirname($dataDir))));
rmdir(dirname(dirname(dirname(dirname($dataDir)))));
rmdir($root);

dre_report('CollectionStats', $failures, $checks);
