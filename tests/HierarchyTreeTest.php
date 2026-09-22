<?php
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/support/ThemeView.php';
require_once __DIR__ . '/../helper/HierarchyTree.php';
$failures = []; $checks = 0;
$view = new ThemeTestView();
$api = new class {
    public array $reads = [];
    public array $queries = [];
    public function read($type, $id) {
        $this->reads[] = $id;
        if ($id === 2) throw new RuntimeException('Private');
        return new class($id) { public function __construct(private int $id) {} public function getContent() { return new ThemeTestResource('Set ' . $this->id, $this->id); } };
    }
    public function search($type, $query) {
        $this->queries[] = $query;
        return new class { public function getTotalResults(): int { return 123; } };
    }
};
$view->callbacks['api'] = fn() => $api;
$view->callbacks['currentSite'] = fn() => new class { public function slug() { return 'a'; } public function id() { return 1; } };
$view->callbacks['url'] = fn($route, $params) => '/s/a/hierarchy/' . $params['grouping-id'];
$view->settings = ['hierarchy_group_resources' => true, 'hierarchy_show_count' => true, 'hierarchy_link_itemSet' => true];
$group = fn($id, $parent, $set) => new class($id, $parent, $set) {
    public function __construct(private int $id, private int $parent, private ?int $set) {}
    public function id() { return $this->id; }
    public function getParentGrouping() { return $this->parent; }
    public function getLabel() { return '<Group ' . $this->id . '>'; }
    public function getItemSet() { return $this->set ? new ThemeTestResource('', $this->set) : null; }
};
$groups = [$group(1, 0, 1), $group(2, 1, 2), $group(3, 1, 1), $group(4, 0, 3), $group(5, 6, null), $group(6, 5, null), $group(7, 99, null)];
$helper = new OmekaTheme\Helper\HierarchyTree(); $helper->setView($view);
$result = $helper->build($groups, 1, [1, 2]);
$html = $view->render('common/hierarchy-tree', ['nodes' => $result['nodes']]);
dre_check($failures, $checks, 'all nodes including orphan and cycle components render once', substr_count($html, '<li>') === 7);
dre_check($failures, $checks, 'labels are escaped', !str_contains($html, '<Group') && str_contains($html, '&lt;Group 1&gt;'));
dre_check($failures, $checks, 'private and excluded sets remain unlinked', !str_contains($html, 'href="/s/a/item/2"') && !str_contains($html, 'href="/s/a/item/3"'));
dre_check($failures, $checks, 'distinct accessible sets are read once and excluded sets not read', $api->reads === [1, 2]);
dre_check($failures, $checks, 'reused subtree membership shares a count-only query', count($api->queries) === 1 && $api->queries[0]['limit'] === 0);
dre_check($failures, $checks, 'collected sets contain only available distinct records', count($result['itemSets']) === 1);
$view->settings['hierarchy_link_itemSet'] = false;
$view->settings['hierarchy_show_count'] = false;
$result = $helper->build([$group(1, 0, 2)], 1, [2]);
dre_check($failures, $checks, 'all-private tree returns an empty set list and null target', $result['itemSets'] === [] && $result['nodes'][0]['url'] === null);
dre_report('HierarchyTree', $failures, $checks);
