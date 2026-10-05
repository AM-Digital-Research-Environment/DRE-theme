<?php
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/support/ThemeView.php';
$failures = []; $checks = 0;
$view = new ThemeTestView();
$view->settings = ['hierarchy_show_count' => true, 'hierarchy_link_itemSet' => true, 'hierarchy_group_resources' => true, 'exclude_resources_not_in_site' => true];
$group = function ($id, $parent, $set = null) {
    return new class($id, $parent, $set) {
        public function __construct(private int $id, private int $parent, private ?int $set) {}
        public function id() { return $this->id; }
        public function getParentGrouping() { return $this->parent; }
        public function getHierarchy() { return 1; }
        public function getLabel() { return '<Group ' . $this->id . '>'; }
        public function getItemSet() { return $this->set ? new ThemeTestResource('Set', $this->set) : null; }
    };
};
$groups = [$group(1, 0), $group(2, 1, 1), $group(3, 1, 1), $group(4, 1, 2), $group(5, 99, 3), $group(6, 7), $group(7, 6)];
$api = new class($groups) {
    public array $queries = [];
    public function __construct(public array $groups) {}
    public function search($type, $query) {
        $this->queries[] = [$type, $query];
        $rows = $type === 'hierarchy_grouping' ? array_slice($this->groups, ($query['page'] - 1) * 100, 100)
            : ($type === 'item_sets' ? array_map(fn($id) => new ThemeTestResource('Set ' . $id, $id), array_values(array_filter($query['id'], fn($id) => $id !== 2))) : []);
        $total = $type === 'hierarchy_grouping' ? count($this->groups) : 123;
        return new class($rows, $total) {
            public function __construct(private array $rows, private int $total) {}
            public function getContent() { return $this->rows; }
            public function getTotalResults() { return $this->total; }
        };
    }
};
$view->callbacks['api'] = fn() => $api;
$view->callbacks['currentSite'] = fn() => new class {
    public function id() { return 9; }
    public function slug() { return 'a'; }
    public function siteItemSets() {
        return array_map(fn($id) => new class($id) {
            public function __construct(private int $id) {}
            public function itemSet() { return new ThemeTestResource('Set', $this->id); }
        }, [1, 2]);
    }
};
$view->callbacks['url'] = fn($route, $query) => $route === 'site/hierarchy' ? '/group/' . $query['grouping-id'] : '/set/' . $query['id'];
$result = $view->HierarchyTree($groups[0]);
$html = $view->render('common/hierarchy-tree', ['nodes' => $result['nodes']]);
dre_check($failures, $checks, 'every node including orphan and cyclic components renders exactly once', substr_count($html, '<li>') === 7);
dre_check($failures, $checks, 'group labels are escaped', !str_contains($html, '<Group') && str_contains($html, '&lt;Group 1&gt;'));
dre_check($failures, $checks, 'private and site-excluded item sets have no links', !str_contains($html, 'href="/s/a/item/2"') && !str_contains($html, 'href="/s/a/item/3"'));
$setQueries = array_values(array_filter($api->queries, fn($call) => $call[0] === 'item_sets'));
dre_check($failures, $checks, 'authorized set IDs are loaded together once', count($setQueries) === 1 && $setQueries[0][1]['id'] === [1, 2]);
$countQueries = array_values(array_filter($api->queries, fn($call) => $call[0] === 'items'));
dre_check($failures, $checks, 'identical subtree membership reuses a site-scoped count-only query', count($countQueries) === 1 && $countQueries[0][1] === ['item_set_id' => [1], 'limit' => 0, 'site_id' => 9]);
dre_check($failures, $checks, 'collected item sets are distinct and authorized', count($result['itemSets']) === 1);
$view->settings['hierarchy_show_count'] = false;
$view->settings['hierarchy_link_itemSet'] = false;
$api->queries = [];
$result = $view->HierarchyTree($groups[0]);
$html = $view->render('common/hierarchy-tree', ['nodes' => $result['nodes']]);
dre_check($failures, $checks, 'disabled counts perform no item queries', !array_filter($api->queries, fn($call) => $call[0] === 'items'));
dre_check($failures, $checks, 'group links and current-page state survive', str_contains($html, 'href="/group/2"') && str_contains($html, 'aria-current="page"'));
$api->groups = array_map(fn($id) => $group($id, 0, 1), range(1, 205));
$api->queries = [];
$result = $view->HierarchyTree($api->groups[0]);
dre_check($failures, $checks, 'grouping pagination reaches all nodes', count($result['nodes']) === 205 && count(array_filter($api->queries, fn($call) => $call[0] === 'hierarchy_grouping')) === 3);
dre_report('HierarchyPagination', $failures, $checks);
