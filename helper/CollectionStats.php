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
 *   2. The DRE Visualizations "Collection Overview" precompute on a
 *      single-site installation, so the home band and that block agree.
 *      A global precompute is deliberately bypassed on multi-site installs.
 *   3. The theme's own API-computed counts, so a standalone DRE theme with no
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
     */
    private const CACHE_VERSION = 'v5';

    /** The visualizations module's data directory, relative to OMEKA_PATH. */
    private const PRECOMPUTE_DIR = '/modules/DreVisualizations/asset/data';

    /** The artifact to read, relative to the resolved generation root. */
    private const PRECOMPUTE_FILE = 'item-dashboards/collection-overview.json';

    /** A published generation id, e.g. 20260803T085234Z-964ff56b9f5c. */
    private const GENERATION_ID = '/^[0-9]{8}T[0-9]{6}Z-[a-f0-9]{12}$/';

    /** Templates summed into the "Publications" figure in the API fallback. */
    private const PUBLICATION_TEMPLATES = [
        'Article', 'Working paper', 'Conference paper', 'Book chapter',
        'Book', 'Doctoral thesis', 'Journal issue', 'Book review', 'Online post',
    ];

    public function __invoke(?int $siteId = null): array
    {
        $cacheKey = sprintf('dre_stats_%s_%s', self::CACHE_VERSION, $siteId ?: 'x');

        $cached = $this->readCache($cacheKey);
        if (null !== $cached) {
            return $cached;
        }

        $stats = $this->canUseGlobalPrecompute($siteId)
            ? $this->fromPrecompute()
            : null;
        if (null === $stats) {
            $stats = $this->fromApi($siteId);
        }
        if (null === $stats) {
            return [];
        }

        $this->writeCache($cacheKey, $stats);

        return $stats;
    }

    /**
     * The module precompute describes the archive as a whole. It is safe for
     * this deployment's one-site installation, but must not leak those totals
     * into an unrelated site on a multi-site Omeka instance.
     */
    private function canUseGlobalPrecompute(?int $siteId): bool
    {
        if (null === $siteId) {
            return true;
        }
        try {
            $response = $this->getView()->api()->search('sites', ['limit' => 0]);
            return 1 === (int) $response->getTotalResults();
        } catch (\Throwable $e) {
            // When scope cannot be proven, prefer the site-filtered API path.
            return false;
        }
    }

    // ------------------------------------------------------------------ cache

    private function settings()
    {
        try {
            return $this->getView()->getHelperPluginManager()->getServiceLocator()->get('Omeka\Settings');
        } catch (\Throwable $e) {
            // An unavailable service, a deprecation-as-exception dev config, even
            // an undefined-method Error — none of it may take the home page down.
            return null;
        }
    }

    private function readCache(string $key): ?array
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
                && (time() - (int) $cached['t']) < self::TTL
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

    // ------------------------------------------------------- source 1: module

    /**
     * Read the visualizations module's precompute. Returns null when the module,
     * the file or a usable `stats` array is absent.
     */
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
     */
    private function precomputePath(): ?string
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
                return is_readable($published) ? $published : null;
            }
        }

        // Upgrade compatibility: a module older than the generations layout, or
        // one that has not regenerated since upgrading, still writes it flat.
        $legacy = $dataDir . '/' . self::PRECOMPUTE_FILE;
        return is_readable($legacy) ? $legacy : null;
    }

    private function fromPrecompute(): ?array
    {
        try {
            if (!defined('OMEKA_PATH')) {
                return null;
            }
            $path = $this->precomputePath();
            if (null === $path) {
                return null;
            }
            $data = json_decode((string) file_get_contents($path), true);
            if (!is_array($data) || empty($data['stats']) || !is_array($data['stats'])) {
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

    // ---------------------------------------------------------- source 2: API

    /**
     * The theme's own counts — a smaller set, no subtitles. 'k' selects the
     * Lucide glyph in the banner template.
     */
    private function fromApi(?int $siteId): ?array
    {
        try {
            $view = $this->getView();
            $api = $view->api();
            $translate = $view->plugin('translate');

            // Resolve template + item-set labels to ids (these need real content);
            // the counts below use limit=0 + getTotalResults() — count only.
            $templateId = [];
            foreach ($api->search('resource_templates', ['limit' => 1000])->getContent() as $template) {
                $templateId[$template->label()] = $template->id();
            }
            $setId = [];
            foreach ($api->search('item_sets', ['limit' => 1000])->getContent() as $set) {
                $title = (string) $set->displayTitle();
                if ('' !== $title) {
                    $setId[$title] = $set->id();
                }
            }

            $total = function (array $query) use ($api, $siteId) {
                if ($siteId) {
                    $query['site_id'] = $siteId;
                }
                $query['limit'] = 0;
                return (int) $api->search('items', $query)->getTotalResults();
            };
            $byTemplate = function (string $label) use ($templateId, $total) {
                return isset($templateId[$label]) ? $total(['resource_template_id' => $templateId[$label]]) : 0;
            };
            $bySet = function (string $label) use ($setId, $total) {
                return isset($setId[$label]) ? $total(['item_set_id' => $setId[$label]]) : 0;
            };

            $publications = 0;
            foreach (self::PUBLICATION_TEMPLATES as $label) {
                $publications += $byTemplate($label);
            }

            // Same metrics, same ORDER as the module precompute's
            // buildOverviewStats(), so the masthead does not silently reshuffle
            // when an install gains or loses the visualizations module.
            //
            // Resource Types was dropped after 2.24: every other row answers
            // "how much of X does the collection hold" and links to an authority
            // page, but Type of Resource describes the other records rather than
            // being a corpus of its own — and it is the one key the masthead has
            // no route for, so it was the single dead row in the catalogue.
            return [
                ['k' => 'researchItems', 'l' => $translate('Research items'),  'n' => $byTemplate('Research Items'), 's' => ''],
                ['k' => 'projects',      'l' => $translate('Projects'),        'n' => $byTemplate('Projects'),       's' => ''],
                ['k' => 'people',        'l' => $translate('People'),          'n' => $byTemplate('Persons'),        's' => ''],
                ['k' => 'organisations', 'l' => $translate('Organisations'),   'n' => $byTemplate('Organisation'),   's' => ''],
                ['k' => 'locations',     'l' => $translate('Locations'),       'n' => $byTemplate('Location'),       's' => ''],
                ['k' => 'languages',     'l' => $translate('Languages'),       'n' => $bySet('Languages'),           's' => ''],
                ['k' => 'subjectsTags',  'l' => $translate('Subjects & tags'), 'n' => $bySet('Subjects'),            's' => ''],
                ['k' => 'publications',  'l' => $translate('Publications'),    'n' => $publications,                 's' => ''],
                ['k' => 'podcasts',      'l' => $translate('Podcasts'),        'n' => $bySet('Podcasts'),            's' => ''],
                ['k' => 'youtube',       'l' => $translate('YouTube videos'),  'n' => $bySet('YouTube videos'),      's' => ''],
            ];
        } catch (\Throwable $e) {
            return null;
        }
    }
}
