<?php
namespace OmekaTheme\Helper;
use Laminas\View\Helper\AbstractHelper;

/** Indexed, cycle-safe hierarchy data with one read per distinct item set. */
class HierarchyTree extends AbstractHelper
{
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
            foreach ($batch as $grouping) $groupings[$grouping->id()] = $grouping;
            ++$page;
        } while ($batch && ($page - 1) * 100 < $response->getTotalResults());
        $siteSets = [];
        foreach ($view->currentSite()->siteItemSets() as $siteSet) $siteSets[] = $siteSet->itemSet()->id();
        return $this->build(array_values($groupings), (int) $selected->id(), $siteSets, $valueLang);
    }

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
        $build = function (int $id) use (&$build, &$visited, &$sets, &$counts, $byId, $children, $allowed, $view, $activeId, $valueLang): ?array {
            if (isset($visited[$id])) return null;
            $visited[$id] = true;
            $grouping = $byId[$id];
            $reference = $grouping->getItemSet();
            $set = null;
            if ($reference) {
                $setId = (int) $reference->id();
                if (!array_key_exists($setId, $sets)) {
                    $sets[$setId] = null;
                    if (!$allowed || isset($allowed[$setId])) {
                        try { $sets[$setId] = $view->api()->read('item_sets', $setId)->getContent(); }
                        catch (\Throwable $e) { /* Unavailable sets remain unlinked. */ }
                    }
                }
                $set = $sets[$setId];
            }
            $label = $grouping->getLabel() ?: ($set ? $set->displayTitle(null, $valueLang) : $view->translate('[Untitled]'));
            if ($reference && !$set) $label .= $view->translate(' (Private)');
            $nodes = [];
            $ids = $set ? [$set->id() => true] : [];
            foreach ($children[$id] ?? [] as $childId) {
                $child = $build($childId);
                if ($child) {
                    $nodes[] = $child;
                    if ($view->siteSetting('hierarchy_group_resources')) $ids += $child['setIds'];
                }
            }
            $count = null;
            if ($ids && $view->siteSetting('hierarchy_show_count')) {
                $queryIds = array_keys($ids);
                sort($queryIds);
                $key = implode(',', $queryIds);
                if (!isset($counts[$key])) {
                    $query = ['item_set_id' => $queryIds, 'limit' => 0];
                    if ($view->siteSetting('exclude_resources_not_in_site')) $query['site_id'] = $view->currentSite()->id();
                    $counts[$key] = (int) $view->api()->search('items', $query)->getTotalResults();
                }
                $count = $counts[$key];
            }
            $url = null;
            if (!$reference || $set) {
                $url = $set && $view->siteSetting('hierarchy_link_itemSet')
                    ? $set->url()
                    : $view->url('site/hierarchy', ['site-slug' => $view->currentSite()->slug(), 'grouping-id' => $id]);
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
