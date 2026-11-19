<?php
namespace OmekaTheme\Helper;
use Laminas\View\Helper\AbstractHelper;

require_once __DIR__ . '/ValueReader.php';

/**
 * Normalize one bounded page of subject values into distinct connection cards,
 * and the labels common/linked-resources.phtml shows around them.
 *
 * @phpstan-type Facet array{id: string, propertyId: int, label: string, count: int, groupOrder: int}
 * @phpstan-type FilterOption array{value: string, label: string, selected: bool}
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

        // Rank relationships by frequency (most-connected first), ties by server
        // order. Both the facet pills and the "relationship" sort follow this rank.
        $ranked = $facets;
        usort($ranked, function ($a, $b) {
            return ($b['count'] <=> $a['count']) ?: ($a['groupOrder'] <=> $b['groupOrder']);
        });
        $rankById = [];
        foreach ($ranked as $i => $facet) {
            $rankById[$facet['id']] = $i;
        }

        // Give each record a sort key (its highest-ranked relationship) and order its
        // own relationship chips by rank.
        foreach ($connections as &$c) {
            $ranks = array_map(function ($id) use ($rankById) {
                return $rankById[$id];
            }, $c['relIds']);
            $c['relOrder'] = $ranks ? min($ranks) : 0;
            usort($c['rels'], function ($a, $b) use ($rankById) {
                return $rankById[$a['id']] <=> $rankById[$b['id']];
            });
        }
        unset($c);

        // Default render order = the "relationship" sort (rank, then title), so the
        // JS sort is a no-op on load and there is no reflow.
        uasort($connections, function ($a, $b) {
            return ($a['relOrder'] <=> $b['relOrder']) ?: strcasecmp($a['heading'], $b['heading']);
        });

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
        $label = (string) $this->getView()->translate($class->label());
        return mb_strtoupper(mb_substr($label, 0, 1)) . mb_substr($label, 1);
    }

    /**
     * The options of the "Filter all connections by relationship" select:
     * per resource type that links here, "All" then each relationship, grouped
     * under the type only when more than one type links here. A relationship
     * the URL names but no longer offers stays selectable as `unknown`, so the
     * form does not silently switch filter.
     *
     * @param array<string, list<array{compound_id: string, label: string, label_is_translatable?: bool}>> $propertiesByType
     * @param list<string> $types the resource types with values, in order
     * @param array<string, string> $typeLabels translated, keyed by type
     * @return array{unknown: string|null, groups: list<array{label: string|null, options: list<FilterOption>}>}
     */
    public function filterOptions(string $resourceType, string $selected, array $propertiesByType, array $types, array $typeLabels): array
    {
        $translate = $this->getView()->plugin('translate');
        $known = [$resourceType . ':'];
        foreach ($propertiesByType as $options) {
            foreach ($options as $option) {
                $known[] = $option['compound_id'];
            }
        }
        $grouped = count($types) > 1;
        $groups = [];
        foreach ($types as $type) {
            $all = $type . ':';
            $options = [['value' => $all, 'label' => $grouped ? $translate('All') : $translate('All relationships'), 'selected' => $selected === $all]];
            foreach ($propertiesByType[$type] ?? [] as $option) {
                $options[] = [
                    'value' => $option['compound_id'],
                    'label' => !empty($option['label_is_translatable']) ? $translate($option['label']) : $option['label'],
                    'selected' => $selected === $option['compound_id'],
                ];
            }
            $groups[] = ['label' => $grouped ? ($typeLabels[$type] ?? $type) : null, 'options' => $options];
        }
        return ['unknown' => in_array($selected, $known, true) ? null : $selected, 'groups' => $groups];
    }
}
