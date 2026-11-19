<?php
namespace OmekaTheme\Helper;
use Laminas\View\Helper\AbstractHelper;

/**
 * Indexed, cycle-safe hierarchy data with bounded batches of authorized item sets.
 *
 * @phpstan-type Node array{id: int, label: string, url: string|null, active: bool, count: int|null, children: list<array<string, mixed>>, setIds: array<int, true>}
 * @phpstan-type Tree array{nodes: list<Node>, itemSets: list<\Omeka\Api\Representation\ItemSetRepresentation>}
 */
final class HierarchyTree extends AbstractHelper
{
    /**
     * @param object $selected
     * @param list<string>|string|null $valueLang
     * @return Tree
     */
    public function __invoke($selected, $valueLang = null): array
    {
        $view = $this->getView();
        $groupings = [];
        $page = 1;
        do {
            $response = $view->api()->search('hierarchy_grouping', [
                'hierarchy' => $selected->getHierarchy(), 'sort_by' => 'position',
                'page' => $page, 'per_page' => 100,
            ]);
            $batch = $response->getContent();
            $previousCount = count($groupings);
            foreach ($batch as $grouping) $groupings[$grouping->id()] = $grouping;
            if (count($groupings) === $previousCount) break;
            ++$page;
        } while ($batch && ($page - 1) * 100 < $response->getTotalResults());
        $siteSets = [];
        foreach ($view->currentSite()->siteItemSets() as $siteSet) $siteSets[] = $siteSet->itemSet()->id();
        return $this->build(array_values($groupings), (int) $selected->id(), $siteSets, $valueLang);
    }

    /**
     * @param list<object> $groupings
     * @param list<int> $siteSetIds
     * @param list<string>|string|null $valueLang
     * @return Tree
     */
    public function build(array $groupings, int $activeId, array $siteSetIds, $valueLang = null): array
    {
        $view = $this->getView();
        $byId = $children = $sets = $visited = $counts = [];
        $allowed = array_fill_keys($siteSetIds, true);
        foreach ($groupings as $grouping) $byId[$grouping->id()] = $grouping;
        foreach ($byId as $id => $grouping) {
            $parent = (int) $grouping->getParentGrouping();
            $children[isset($byId[$parent]) && $parent !== $id ? $parent : 0][] = $id;
        }
        $wanted = [];
        foreach ($byId as $grouping) {
            $reference = $grouping->getItemSet();
            if ($reference) {
                $setId = (int) $reference->id();
                $sets[$setId] = null;
                if (!$allowed || isset($allowed[$setId])) $wanted[$setId] = $setId;
            }
        }
        foreach (array_chunk(array_values($wanted), 100) as $batch) {
            try {
                foreach ($view->api()->search('item_sets', ['id' => $batch, 'per_page' => 100])->getContent() as $set) $sets[$set->id()] = $set;
            } catch (\Throwable $e) { /* Unavailable sets remain unlinked. */ }
        }
        // Site settings and the site are read once per tree, not once per node.
        $groupResources = (bool) $view->siteSetting('hierarchy_group_resources');
        $showCount = (bool) $view->siteSetting('hierarchy_show_count');
        $siteOnly = (bool) $view->siteSetting('exclude_resources_not_in_site');
        $linkItemSet = (bool) $view->siteSetting('hierarchy_link_itemSet');
        $site = $view->currentSite();
        $format = $view->plugin('TranslateFormat');
        $untitled = $view->translate('[Untitled]');
        $build = function (int $id) use (&$build, &$visited, &$sets, &$counts, $byId, $children, $view, $activeId, $valueLang,
            $groupResources, $showCount, $siteOnly, $linkItemSet, $site, $format, $untitled): ?array {
            if (isset($visited[$id])) return null;
            $visited[$id] = true;
            $grouping = $byId[$id];
            $reference = $grouping->getItemSet();
            $set = null;
            if ($reference) {
                $setId = (int) $reference->id();
                $set = $sets[$setId];
            }
            $label = $grouping->getLabel() ?: ($set ? $set->displayTitle(null, $valueLang) : $untitled);
            if ($reference && !$set) $label = $format->translate('%s (unavailable)', $label);
            $nodes = [];
            $ids = $set ? [$set->id() => true] : [];
            foreach ($children[$id] ?? [] as $childId) {
                $child = $build($childId);
                if ($child) {
                    $nodes[] = $child;
                    if ($groupResources) $ids += $child['setIds'];
                }
            }
            $count = null;
            if ($ids && $showCount) {
                $queryIds = array_keys($ids);
                sort($queryIds);
                $key = implode(',', $queryIds);
                if (!isset($counts[$key])) {
                    $query = ['item_set_id' => $queryIds, 'limit' => 0];
                    if ($siteOnly) $query['site_id'] = $site->id();
                    $counts[$key] = (int) $view->api()->search('items', $query)->getTotalResults();
                }
                $count = $counts[$key];
            }
            $url = null;
            if (!$reference || $set) {
                $url = $set && $linkItemSet
                    ? $set->url()
                    : $view->url('site/hierarchy', ['site-slug' => $site->slug(), 'grouping-id' => $id]);
            }
            return ['id' => $id, 'label' => $label, 'url' => $url, 'active' => $id === $activeId,
                'count' => $count, 'children' => $nodes, 'setIds' => $ids];
        };
        $nodes = [];
        foreach ($children[0] ?? [] as $id) { if ($node = $build($id)) $nodes[] = $node; }
        // Cycles have no root. Render each otherwise-unvisited component once.
        foreach (array_keys($byId) as $id) { if ($node = $build($id)) $nodes[] = $node; }
        return ['nodes' => $nodes, 'itemSets' => array_values(array_filter($sets))];
    }
}
