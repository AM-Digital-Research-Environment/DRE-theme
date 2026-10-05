<?php
namespace OmekaTheme\Helper;
use Laminas\View\Helper\AbstractHelper;

/** Normalize one bounded page of subject values into distinct connection cards. */
class LinkedConnections extends AbstractHelper
{
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
                    $heading = $headingTerm
                        ? $resource->value($headingTerm, ['default' => $resource->displayTitle(null, $valueLang), 'lang' => $valueLang])
                        : $resource->displayTitle(null, $valueLang);
                    $connections[$rid] = [
                        'resource' => $resource,
                        'heading'  => (string) $heading,
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
}
