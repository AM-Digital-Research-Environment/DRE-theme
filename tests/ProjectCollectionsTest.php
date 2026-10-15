<?php
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/support/ThemeView.php';
require_once __DIR__ . '/../helper/ProjectCollections.php';
require_once __DIR__ . '/../helper/BrowseSort.php';
require_once __DIR__ . '/../helper/DreSearchUrl.php';

use OmekaTheme\Helper\BrowseSort;
use OmekaTheme\Helper\ProjectCollections;

$failures = []; $checks = 0;

/** A resource with a class and single-value reads, as ProjectCollections needs. */
class CollectionTestResource extends ThemeTestResource
{
    public ?string $classTerm = null;
    public function resourceClass()
    {
        if ($this->classTerm === null) return null;
        $term = $this->classTerm;
        return new class($term) { public function __construct(private string $t) {} public function term(): string { return $this->t; } };
    }
    public function value(string $term, array $options = [])
    {
        $all = $this->values[$term] ?? [];
        return ($options['all'] ?? false) ? $all : ($all[0] ?? null);
    }
}

$project = new CollectionTestResource('African Knowledges and the History Publication since the 1970s', 1797);
$project->classTerm = 'foaf:Project';
$project->values['dre:id'] = [new ThemeTestValue('UBT_ELTVTapes2021')];
$section = new CollectionTestResource('Knowledges', 1671);
$section->classTerm = 'frapo:ResearchGroup';

$set = new CollectionTestResource('U-Matic Tapes of the Liberia Broadcasting System', 6263);
$set->values['dre:id'] = [new ThemeTestValue('UBT_ELTVTapes2021')];

$queries = [];
$found = [];
$view = new ThemeTestView();
$view->callbacks['currentSite'] = fn() => new class { public function url() { return '/s/a'; } };
$view->callbacks['api'] = function () use (&$queries, &$found) {
    return new class($queries, $found) {
        public function __construct(private array &$queries, private array &$found) {}
        public function search(string $resource, array $query) {
            $this->queries[] = [$resource, $query];
            $content = $this->found[$resource] ?? [];
            return new class($content) {
                public function __construct(private array $c) {}
                public function getContent() { return $this->c; }
                public function getTotalResults() { return count($this->c); }
            };
        }
    };
};
$helper = new ProjectCollections();
$helper->setView($view);

// --- Item set → project --------------------------------------------------------
$set->values['dcterms:isPartOf'] = [new ThemeTestValue('', 'resource:item', $section), new ThemeTestValue('', 'resource:item', $project)];
dre_check($failures, $checks, 'an item set names its project through dcterms:isPartOf, skipping a non-project link',
    $helper->projectOf($set) === $project && $queries === []);

unset($set->values['dcterms:isPartOf']);
$found = ['items' => [$section, $project]];
$result = $helper->projectOf($set);
dre_check($failures, $checks, 'without the link, the project sharing the set\'s dre:id is found, by class',
    $result === $project
    && ($queries[0][1]['property'][0]['property'] ?? null) === 'dre:id'
    && ($queries[0][1]['property'][0]['text'] ?? null) === 'UBT_ELTVTapes2021');

$found = ['items' => [$section]];
dre_check($failures, $checks, 'an item set with no project resolves to none', $helper->projectOf($set) === null);
$bare = new CollectionTestResource('Persons', 18);
$queries = [];
dre_check($failures, $checks, 'an item set with neither link nor dre:id costs no query', $helper->projectOf($bare) === null && $queries === []);

// --- Project → collections and records ----------------------------------------
$queries = [];
$found = ['item_sets' => [$set]];
$sets = $helper->collectionsOf($project);
dre_check($failures, $checks, 'a project\'s collections are found by isPartOf and by dre:id, once each',
    $sets === [$set] && count($queries) === 2
    && ($queries[0][1]['property'][0]['type'] ?? null) === 'res' && ($queries[0][1]['property'][0]['text'] ?? null) === '1797'
    && ($queries[1][1]['property'][0]['property'] ?? null) === 'dre:id');

$found = ['items' => array_fill(0, 487, $set)];
dre_check($failures, $checks, 'a project\'s record count is the isPartOf count', $helper->recordCount($project) === 487);

$view->callbacks['dreSearchBar'] = fn() => '';
dre_check($failures, $checks, 'a project\'s records open in DRE Search on the project facet',
    $helper->recordsUrl($project) === '/s/a/dre-search?profile=research_items&f.project_s=African%20Knowledges%20and%20the%20History%20Publication%20since%20the%201970s');
dre_check($failures, $checks, 'the search URL helper drops empty facet values and repeats multi-values',
    $view->helper('DreSearchUrl')->filtered('research_items', ['type_s' => ['Text', 'Image'], 'project_s' => ' ']) === '/s/a/dre-search?profile=research_items&f.type_s=Text&f.type_s=Image');
unset($view->callbacks['dreSearchBar']);
$urls = [];
$view->callbacks['url'] = function (...$args) use (&$urls) { $urls[] = $args; return '/s/a/item?filtered'; };
dre_check($failures, $checks, 'without DRE Search, the records open in core browse filtered on isPartOf',
    $helper->recordsUrl($project) === '/s/a/item?filtered'
    && ($urls[0][2]['query']['property'][0]['property'] ?? null) === 'dcterms:isPartOf'
    && ($urls[0][2]['query']['property'][0]['text'] ?? null) === '1797');
dre_check($failures, $checks, 'a non-project is not a project', !ProjectCollections::isProject($section) && !ProjectCollections::isProject(null));

// --- Sort options --------------------------------------------------------------
$core = [
    'created' => 'Created',
    'resource_class_label' => 'Resource class',
    'title' => 'Title',
    'numeric:timestamp:7' => 'Date (numeric:timestamp)',
    'numeric:interval:22' => 'Date Available (numeric:interval)',
    'numeric:timestamp:23' => 'Date Issued (numeric:timestamp)',
    'numeric:timestamp:24' => 'Date Modified (numeric:timestamp)',
    'numeric:integer:122' => 'volume (numeric:integer)',
];
$curated = BrowseSort::curate($core, [7 => 'Date', 23 => 'Date Issued', 20 => 'Date Created']);
dre_check($failures, $checks, 'the sort list keeps title, the reader\'s dates by plain label, then the date added',
    $curated === ['title' => 'Title', 'numeric:timestamp:7' => 'Date', 'numeric:timestamp:23' => 'Date Issued', 'created' => 'Date added'],
    json_encode($curated));
dre_check($failures, $checks, 'with no date property known, no numeric sort is offered',
    BrowseSort::curate($core, []) === ['title' => 'Title', 'created' => 'Date added']);

dre_report('ProjectCollections', $failures, $checks);
