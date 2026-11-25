<?php
namespace OmekaTheme\Helper;
use Laminas\View\Helper\AbstractHelper;

require_once __DIR__ . '/ValueReader.php';
require_once __DIR__ . '/ConnectionQuery.php';

/**
 * Normalize one bounded page of subject values into distinct connection cards,
 * and the whole-set filters common/linked-resources.phtml shows around them.
 *
 * @phpstan-type Facet array{id: string, propertyId: int, label: string, count: int, groupOrder: int}
 * @phpstan-type FilterLink array{label: string, count: int, url: string, current: bool}
 */
final class LinkedConnections extends AbstractHelper
{
    /**
     * @param array<array<array<string, mixed>>> $subjectValues
     * @param list<string>|string|null $valueLang
     * @return array{connections: array<int, array{resource: \Omeka\Api\Representation\AbstractResourceEntityRepresentation, heading: string, rels: list<array{id: string, propertyId: int, label: string}>, relIds: list<string>, relOrder: int}>, facets: list<Facet>, ranked: list<Facet>}
     */
    public function __invoke(array $subjectValues, ?string $headingTerm = null, $valueLang = null): array
    {
        $view = $this->getView();
        $translate = $view->plugin('translate');
        $connections = []; // resourceId => [resource, heading, rels[], relIds[]]
        $facets      = []; // list of [id, label, count, groupOrder]
        $facetIndex  = []; // semantic key => position in $facets
        $groupOrder  = 0;

        foreach ($subjectValues as $values) {
            if (!$values) {
                continue;
            }
            foreach ($values as $value) {
                $resource = $value['resource'] ?? $value['val']->resource();
                if (!$resource) {
                    continue;
                }
                $propertyId = (int) $value['property_id'];
                $rawLabel = ($value['property_alternate_label'] ?? '') ?: $value['property_label'];
                $propertyLabel = ($value['property_alternate_label'] ?? '') ?: $translate($rawLabel);
                // Identity uses the untranslated label and vocabulary property,
                // independently of Omeka's outer (label-only) grouping.
                $key = 'p' . $propertyId . '-' . hash('sha256', $rawLabel);
                if (!isset($facetIndex[$key])) {
                    $facetIndex[$key] = count($facets);
                    $facets[] = [
                        'id' => $key, 'propertyId' => $propertyId,
                        'label' => $propertyLabel, 'count' => 0,
                        'groupOrder' => $groupOrder++,
                    ];
                }
                $fi = $facetIndex[$key];
                $rid = $resource->id();
                if (!isset($connections[$rid])) {
                    $connections[$rid] = [
                        'resource' => $resource,
                        'heading'  => $this->heading($resource, $headingTerm, $valueLang),
                        'rels'     => [],
                        'relIds'   => [],
                    ];
                }
                if (!in_array($key, $connections[$rid]['relIds'], true)) {
                    $connections[$rid]['relIds'][] = $key;
                    $connections[$rid]['rels'][]   = ['id' => $key, 'propertyId' => $propertyId, 'label' => $propertyLabel];
                    $facets[$fi]['count']++;
                }
            }
        }

        // Rank this page's relationships by frequency (most-connected first),
        // ties by server order: a card lists its relationships in this order.
        $ranked = $facets;
        usort($ranked, function ($a, $b) {
            return ($b['count'] <=> $a['count']) ?: ($a['groupOrder'] <=> $b['groupOrder']);
        });
        $rankById = [];
        foreach ($ranked as $i => $facet) {
            $rankById[$facet['id']] = $i;
        }

        // Order each record's own relationship chips by rank. The records keep
        // the order they came in: the whole set was sorted on the server.
        foreach ($connections as &$c) {
            $ranks = array_map(fn($id) => $rankById[$id], $c['relIds']);
            $c['relOrder'] = $ranks ? min($ranks) : 0;
            usort($c['rels'], fn($a, $b) => $rankById[$a['id']] <=> $rankById[$b['id']]);
        }
        unset($c);

        return ['connections' => $connections, 'facets' => $facets, 'ranked' => $ranked];
    }

    /**
     * A card's heading: the site's "browse heading" property when it has a
     * value, else the title. A linked value is read through ValueReader: cast
     * to string it is the linked record's URL, which the card printed as its
     * heading.
     *
     * @param \Omeka\Api\Representation\AbstractResourceEntityRepresentation $resource
     * @param list<string>|string|null $valueLang
     */
    private function heading($resource, ?string $headingTerm, $valueLang): string
    {
        $title = (string) $resource->displayTitle(null, $valueLang);
        if (!$headingTerm) {
            return $title;
        }
        try {
            $value = $resource->value($headingTerm, ['lang' => $valueLang]);
        } catch (\Throwable $e) {
            return $title;
        }
        $entry = is_object($value) ? ValueReader::entry($value) : null;
        return $entry['label'] ?? $title;
    }

    /**
     * What kind of record a card is: its resource class label (Person, Still
     * Image, Bibliographic Resource), '' when unclassed. FaBiO's labels are
     * lower case ("poem", "still image"), which beside "Event" on a series'
     * works read as a typo: the first letter is raised, as a label starts a
     * line.
     *
     * @param \Omeka\Api\Representation\AbstractResourceEntityRepresentation $resource
     */
    public function typeLabel($resource): string
    {
        $class = $resource->resourceClass();
        if (!$class) {
            return '';
        }
        return $this->capitalise((string) $this->getView()->translate($class->label()));
    }

    /**
     * A link to the block in another state: the record's URL with the
     * connection parameters, defaults and empty values left out, back on the
     * first page unless a page is given.
     *
     * @param array{property: string, class: int|null, search: string, sort: string, page?: int} $state
     */
    public static function stateUrl(string $baseUrl, array $state): string
    {
        $query = array_filter([
            'lr_property' => $state['property'],
            'lr_class' => $state['class'] === null ? null : (string) $state['class'],
            'lr_q' => $state['search'],
            'lr_sort' => $state['sort'] === ConnectionQuery::SORTS[0] ? null : $state['sort'],
            'lr_page' => ($state['page'] ?? 1) > 1 ? (string) $state['page'] : null,
        ], fn($value) => $value !== null && $value !== '');
        return $baseUrl . ($query ? '?' . http_build_query($query) : '') . '#linked-resources';
    }

    /**
     * The relationship filters: per resource type that links here, "All" then
     * each relationship, counted over the whole linked set (within the search
     * and kind of record), most-linked first. Types get a heading only when
     * both link here. A relationship the URL names but no longer offers is
     * shown as the current one, so the block never silently switches filter.
     *
     * @param array<string, list<array{compound_id: string, label: string, label_is_translatable?: bool, matched: int}>> $propertiesByType
     * @param array<string, int> $typeTotals
     * @param array<string, string> $typeLabels translated, keyed by type
     * @param array{property: string, class: int|null, search: string, sort: string} $state
     * @return list<array{label: string|null, links: list<FilterLink>}>
     */
    public function relationshipFilters(string $baseUrl, array $state, int $selectedCount, array $propertiesByType, array $typeTotals, array $typeLabels): array
    {
        $translate = $this->getView()->plugin('translate');
        $types = array_keys(array_filter($propertiesByType));
        $grouped = count($types) > 1;
        $known = false;
        $groups = [];
        foreach ($types as $type) {
            $links = [];
            // Literal msgids, so the extractor finds them.
            $all = ['compound_id' => $type . ':', 'label' => (string) ($grouped ? $translate('All') : $translate('All relationships')),
                'label_is_translatable' => false, 'matched' => $typeTotals[$type] ?? 0];
            foreach (array_merge([$all], $propertiesByType[$type]) as $option) {
                $current = $state['property'] === $option['compound_id'];
                $known = $known || $current;
                $links[] = [
                    'label' => !empty($option['label_is_translatable']) ? (string) $translate($option['label']) : $option['label'],
                    'count' => $option['matched'],
                    'url' => self::stateUrl($baseUrl, ['property' => $option['compound_id']] + $state),
                    'current' => $current,
                ];
            }
            $groups[] = ['label' => $grouped ? ($typeLabels[$type] ?? $type) : null, 'links' => $links];
        }
        if (!$known && $groups) {
            array_unshift($groups[0]['links'], ['label' => (string) $translate('Selected relationship'), 'count' => $selectedCount,
                'url' => self::stateUrl($baseUrl, $state), 'current' => true]);
        }
        return $groups;
    }

    /**
     * The kind-of-record filters: "All kinds", then each resource class among
     * the records the relationship and search select, most frequent first.
     * Each record has one class (or none), so the counts add up to "All kinds".
     *
     * @param list<array{id: int, label: string, count: int}> $classes
     * @param array{property: string, class: int|null, search: string, sort: string} $state
     * @return list<FilterLink>
     */
    public function kindFilters(string $baseUrl, array $state, array $classes): array
    {
        $translate = $this->getView()->plugin('translate');
        $links = [[
            'label' => (string) $translate('All kinds'),
            'count' => array_sum(array_column($classes, 'count')),
            'url' => self::stateUrl($baseUrl, ['class' => null] + $state),
            'current' => $state['class'] === null,
        ]];
        foreach ($classes as $class) {
            if ($class['id'] === 0) {
                $label = (string) $translate('Unclassified');
            } elseif ($class['label'] === '') {
                $label = (string) $translate('Selected kind of record');
            } else {
                $label = $this->capitalise((string) $translate($class['label']));
            }
            $links[] = [
                'label' => $label,
                'count' => $class['count'],
                'url' => self::stateUrl($baseUrl, ['class' => $class['id']] + $state),
                'current' => $state['class'] === $class['id'],
            ];
        }
        return $links;
    }

    private function capitalise(string $label): string
    {
        return mb_strtoupper(mb_substr($label, 0, 1)) . mb_substr($label, 1);
    }
}
