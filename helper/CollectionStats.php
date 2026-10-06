<?php
namespace OmekaTheme\Helper;

use Laminas\View\Helper\AbstractHelper;

/**
 * Collection-overview statistics for the home hero's stat band.
 *
 * This logic used to sit inline in view/common/banner.phtml — roughly 140 lines
 * of caching, cross-module filesystem reads and API fall-back inside a view
 * template. It is data access, not presentation, so it lives here; the template
 * now just renders whatever array this returns.
 *
 * Resolution order:
 *   1. Cache — Omeka's DB-backed settings, not a per-container temp file. The
 *      org runs several containerised Omeka instances, so a filesystem cache in
 *      sys_get_temp_dir() meant each node recomputed and they could disagree,
 *      and an ephemeral tmpfs dropped it on every deploy. The key carries a
 *      schema version so a change to the metric set ignores a stale shape.
 *   2. DRESearch public source counts for this site, when its service is available.
 *   3. A DRE Visualizations precompute explicitly matching the requested site.
 *      Unscoped snapshots are used only for unscoped requests.
 *   4. The theme's own API-computed counts, so a standalone DRE theme with no
 *      visualizations module still grounds the hero.
 *
 * Every stage is wrapped in catch(\Throwable): this renders on the home page of
 * every site, and no stat band is always better than a 500. A failure returns
 * an empty array and the hero renders without the band.
 *
 * Returns a list of ['k' => key, 'l' => label, 'n' => value, 's' => subtitle].
 */
class CollectionStats extends AbstractHelper
{
    /** Cache lifetime in seconds. */
    private const TTL = 3600;

    /**
     * Bump when the shape or metric set changes, to invalidate old caches.
     * v5: dropped Resource types, added Languages / Podcasts / YouTube videos.
     * v6: cache source labels; translate them for each visitor after retrieval.
     * v7: prefer the shared DRESearch corpus definitions, with explicit public scope.
     * v8: stale-on-error values and retry markers.
     * v9: snapshots must match the requested site scope exactly.
     * v10: API-fallback Publications counts the Publications item set, not template labels.
     */
    private const CACHE_VERSION = 'v10';

    /** The visualizations module's data directory, relative to OMEKA_PATH. */
    private const PRECOMPUTE_DIR = '/modules/DreVisualizations/asset/data';

    /** The artifact to read, relative to the resolved generation root. */
    private const PRECOMPUTE_FILE = 'item-dashboards/collection-overview.json';

    /** A published generation id, e.g. 20260803T085234Z-964ff56b9f5c. */
    private const GENERATION_ID = '/^[0-9]{8}T[0-9]{6}Z-[a-f0-9]{12}$/';

    public function __invoke(?int $siteId = null): array
    {
        $cacheKey = sprintf('dre_stats_%s_%s', self::CACHE_VERSION, $siteId ?: 'x');

        $cached = $this->readCache($cacheKey);
        if (null !== $cached) {
            return $this->localize($cached);
        }

        // Retain last good counts during transient upstream failures, and avoid
        // retrying expensive fallbacks on every request during an outage.
        $stale = $this->readCache($cacheKey, 86400);
        if ($this->readCache($cacheKey . '_retry', 60) !== null) {
            return $this->localize($stale ?? []);
        }
        $stats = $this->fromSearchProfiles($siteId);
        if (null === $stats) {
            $stats = $this->fromPrecompute($siteId);
        }
        if (null === $stats) {
            $stats = $this->fromApi($siteId);
        }
        if (null === $stats) {
            $this->writeCache($cacheKey . '_retry', []);
            return $this->localize($stale ?? []);
        }

        $this->writeCache($cacheKey, $stats);

        return $this->localize($stats);
    }

    /** Optional integration: source membership is owned by DRESearch's profiles. */
    private function fromSearchProfiles(?int $siteId): ?array
    {
        try {
            $services = $this->services();
            $service = 'DRESearch\Search\CorpusCounts';
            if (!$services->has($service)) return null;
            $stats = $services->get($service)->forSite($siteId);
            if ($stats === null) return null;
            if (!is_array($stats)) throw new \UnexpectedValueException('Invalid corpus counts');
            foreach ($stats as $stat) {
                if (!is_array($stat) || !isset($stat['k'], $stat['n']) || !is_string($stat['k']) || !is_numeric($stat['n'])) {
                    throw new \UnexpectedValueException('Invalid corpus count');
                }
            }
            return $stats;
        } catch (\Throwable $e) {
            $this->reportFailure('search-counts', $e);
            return null;
        }
    }

    /** Rate-limited operational diagnostics, without metadata or visitor input. */
    private function reportFailure(string $stage, \Throwable $error): void
    {
        try {
            $this->getView()->IntegrationWarning($this->getView()->currentSite(), 'statistics ' . $stage, $error);
        } catch (\Throwable $ignored) { /* Diagnostics must not prevent rendering. */ }
    }

    /**
     * The application's services, reached through the current site. The helper
     * plugin manager's getServiceLocator() is deprecated in laminas-servicemanager
     * 3 and raises E_USER_DEPRECATED on every call.
     */
    private function services()
    {
        $site = $this->getView()->currentSite();
        if (!$site) {
            throw new \RuntimeException('Statistics need a current site.');
        }
        return $site->getServiceLocator();
    }

    /** Counts are shared across locales; labels belong to the current request. */
    private function localize(array $stats): array
    {
        $translate = $this->getView()->plugin('translate');
        $labels = [
            'researchItems' => $translate('Research items'),
            'projects' => $translate('Projects'),
            'people' => $translate('People'),
            'organisations' => $translate('Organisations'),
            'locations' => $translate('Locations'),
            'languages' => $translate('Languages'),
            'subjectsTags' => $translate('Subjects & tags'),
            'publications' => $translate('Publications'),
            'podcasts' => $translate('Podcasts'),
            'youtube' => $translate('YouTube videos'),
        ];
        foreach ($stats as &$stat) {
            $stat['l'] = $labels[$stat['k'] ?? ''] ?? $translate((string) ($stat['l'] ?? ''));
        }
        unset($stat);
        return $stats;
    }

    // ------------------------------------------------------------------ cache

    private function settings()
    {
        try {
            return $this->services()->get('Omeka\Settings');
        } catch (\Throwable $e) {
            // An unavailable service, a deprecation-as-exception dev config, even
            // an undefined-method Error — none of it may take the home page down.
            return null;
        }
    }

    private function readCache(string $key, int $ttl = self::TTL): ?array
    {
        $settings = $this->settings();
        if (!$settings) {
            return null;
        }
        try {
            $cached = json_decode((string) $settings->get($key, ''), true);
            if (is_array($cached)
                && isset($cached['t'], $cached['stats'])
                && is_array($cached['stats'])
                && (time() - (int) $cached['t']) < $ttl
            ) {
                return $cached['stats'];
            }
        } catch (\Throwable $e) {
            return null;
        }
        return null;
    }

    private function writeCache(string $key, array $stats): void
    {
        $settings = $this->settings();
        if (!$settings) {
            return;
        }
        try {
            $settings->set($key, json_encode(['t' => time(), 'stats' => $stats]));
        } catch (\Throwable $e) {
            // A cache write failure is not worth a page error; recompute next time.
        }
    }

    // ------------------------------------------------------- source: module

    /**
     * Resolve the precompute through the module's generation pointer.
     *
     * The module publishes atomically: artifacts are staged, then the directory
     * is renamed and asset/data/current.json is swapped to point at it
     * (Precompute/SnapshotPublisher.php). Readers must therefore go through the
     * pointer — this mirrors the module's own
     * Precompute/PublishedSnapshot::path(), which a theme cannot call because
     * the class is absent whenever the module is.
     *
     * Getting this wrong is silent: the flat pre-generation path simply stops
     * existing, is_readable() returns false, and the masthead quietly serves the
     * thinner API fallback instead. That is exactly what happened between the
     * module adopting generations and theme 2.24.1 — the band lost Languages,
     * Podcasts and YouTube videos and nothing anywhere reported an error.
     *
     * Returns [artifact path, site id the snapshot was built for]. The module
     * records that scope in the pointer (`scope.siteId`), not in the artifact —
     * as its own DataController checks — so a legacy flat file is unscoped.
     */
    private function precomputeSource(): ?array
    {
        $dataDir = OMEKA_PATH . self::PRECOMPUTE_DIR;

        $manifestPath = $dataDir . '/current.json';
        if (is_readable($manifestPath)) {
            $manifest = json_decode((string) file_get_contents($manifestPath), true);
            $generationId = is_array($manifest) ? (string) ($manifest['generationId'] ?? '') : '';
            // Validated, not trusted as a path fragment: this string is
            // concatenated into a filesystem path.
            if (preg_match(self::GENERATION_ID, $generationId)) {
                $published = $dataDir . '/generations/' . $generationId . '/' . self::PRECOMPUTE_FILE;
                $scope = $manifest['scope']['siteId'] ?? null;
                return is_readable($published) ? [$published, is_int($scope) && $scope > 0 ? $scope : null] : null;
            }
        }

        // Upgrade compatibility: a module older than the generations layout, or
        // one that has not regenerated since upgrading, still writes it flat.
        $legacy = $dataDir . '/' . self::PRECOMPUTE_FILE;
        return is_readable($legacy) ? [$legacy, null] : null;
    }

    private function fromPrecompute(?int $siteId): ?array
    {
        try {
            if (!defined('OMEKA_PATH')) {
                return null;
            }
            $source = $this->precomputeSource();
            if (null === $source) {
                return null;
            }
            [$path, $scope] = $source;
            $data = json_decode((string) file_get_contents($path), true);
            if (!is_array($data) || empty($data['stats']) || !is_array($data['stats'])) {
                return null;
            }

            // A snapshot must describe exactly the requested scope, even on
            // one-site installations. Older artifacts carried their own siteId.
            if (isset($data['siteId'])) {
                $scope = (int) $data['siteId'];
            }
            if ($scope !== $siteId) {
                return null;
            }

            $built = [];
            foreach ($data['stats'] as $stat) {
                if (!is_array($stat) || !isset($stat['label'], $stat['value'])) {
                    continue;
                }
                $built[] = [
                    'k' => (string) ($stat['key'] ?? ''),
                    'l' => (string) $stat['label'],
                    'n' => (int) $stat['value'],
                    's' => isset($stat['subtitle']) ? (string) $stat['subtitle'] : '',
                ];
            }

            // A precompute with only a card or two is a half-written file; fall
            // through to the API rather than render a thin band.
            return count($built) >= 3 ? $built : null;
        } catch (\Throwable $e) {
            return null;
        }
    }

    // ---------------------------------------------------------- source: API

    /**
     * The theme's own counts — a smaller set, no subtitles. 'k' selects the
     * Lucide glyph in the banner template.
     */
    private function fromApi(?int $siteId): ?array
    {
        try {
            $view = $this->getView();
            $api = $view->api();


            // Exact template-label predicates avoid hydrating the template catalogue.
            // Resolve only the five public item-set titles needed by this fallback.
            // The key is versioned with that title list: a mapping cached before a
            // title was added would count it as 0 until the entry expired.
            $setId = $this->readCache('dre_stats_set_ids_v2', 86400);
            if (null === $setId) {
                $setId = [];
                foreach (['Languages', 'Subjects', 'Publications', 'Podcasts', 'YouTube videos'] as $title) {
                    $setId[$title] = [];
                    $page = 1;
                    do {
                        $response = $api->search('item_sets', [
                            'is_public' => true,
                            'property' => [['property' => 'dcterms:title', 'type' => 'eq', 'text' => $title]],
                            'page' => $page,
                            'per_page' => 100,
                        ]);
                        $sets = $response->getContent();
                        foreach ($sets as $set) {
                            $setId[$title][] = $set->id();
                        }
                        ++$page;
                    } while ($sets && ($page - 1) * 100 < $response->getTotalResults());
                }
                $this->writeCache('dre_stats_set_ids_v2', $setId);
            }

            $total = function (array $query) use ($api, $siteId) {
                if ($siteId) {
                    $query['site_id'] = $siteId;
                }
                $query['limit'] = 0;
                $query['is_public'] = true;
                return (int) $api->search('items', $query)->getTotalResults();
            };
            $byTemplate = function (string $label) use ($total) {
                return $total(['resource_template_label' => $label]);
            };
            $bySet = function (string $label) use ($setId, $total) {
                return !empty($setId[$label]) ? $total(['item_set_id' => $setId[$label]]) : 0;
            };

            // Same metrics, same ORDER as the module precompute's
            // buildOverviewStats(), so the masthead does not silently reshuffle
            // when an install gains or loses the visualizations module.
            //
            // Resource Types was dropped after 2.24: every other row answers
            // "how much of X does the collection hold" and links to an authority
            // page, but Type of Resource describes the other records rather than
            // being a corpus of its own — and it is the one key the masthead has
            // no route for, so it was the single dead row in the catalogue.
            //
            // Publications is the Publications item set, as in DRESearch and the
            // precompute, never a sum of template labels. The publication
            // templates grow with every new upstream type, and the set is also
            // curated: records detached from it keep their publication template,
            // so a label sum both missed new types and counted removed records.
            return [
                ['k' => 'researchItems', 'l' => 'Research items',  'n' => $byTemplate('Research Items'), 's' => ''],
                ['k' => 'projects',      'l' => 'Projects',        'n' => $byTemplate('Projects'),       's' => ''],
                ['k' => 'people',        'l' => 'People',          'n' => $byTemplate('Persons'),        's' => ''],
                ['k' => 'organisations', 'l' => 'Organisations',   'n' => $byTemplate('Organisation'),   's' => ''],
                ['k' => 'locations',     'l' => 'Locations',       'n' => $byTemplate('Location'),       's' => ''],
                ['k' => 'languages',     'l' => 'Languages',       'n' => $bySet('Languages'),           's' => ''],
                ['k' => 'subjectsTags',  'l' => 'Subjects & tags', 'n' => $bySet('Subjects'),            's' => ''],
                ['k' => 'publications',  'l' => 'Publications',    'n' => $bySet('Publications'),        's' => ''],
                ['k' => 'podcasts',      'l' => 'Podcasts',        'n' => $bySet('Podcasts'),            's' => ''],
                ['k' => 'youtube',       'l' => 'YouTube videos',  'n' => $bySet('YouTube videos'),      's' => ''],
            ];
        } catch (\Throwable $e) {
            $this->reportFailure('api-counts', $e);
            return null;
        }
    }
}
