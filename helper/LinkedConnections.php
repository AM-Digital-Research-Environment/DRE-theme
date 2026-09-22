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
        $facetIndex  = []; // propertyId => position in $facets
        $groupOrder  = 0;

        foreach ($subjectValues as $values) {
            if (!$values) {
                continue;
            }
            $first = $values[0];
            $propertyId = $first['property_id'];
            $propertyLabel = ($first['property_alternate_label'] ?? '') ?: $translate($first['property_label']);

            if (!isset($facetIndex[$propertyId])) {
                $facetIndex[$propertyId] = count($facets);
                $facets[] = [
                    'id' => $propertyId,
                    'label' => $propertyLabel,
                    'count' => 0,
                    'groupOrder' => $groupOrder,
                ];
            }
            $fi = $facetIndex[$propertyId];

            foreach ($values as $value) {
                $resource = $value['val']->resource();
                if (!$resource) {
                    continue;
                }
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
                if (!in_array($propertyId, $connections[$rid]['relIds'], true)) {
                    $connections[$rid]['relIds'][] = $propertyId;
                    $connections[$rid]['rels'][]   = ['id' => $propertyId, 'label' => $propertyLabel];
                    $facets[$fi]['count']++;
                }
            }
            $groupOrder++;
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
