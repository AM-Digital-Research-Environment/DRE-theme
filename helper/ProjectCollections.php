<?php
namespace OmekaTheme\Helper;

use Laminas\View\Helper\AbstractHelper;

/**
 * A research project and the item sets that hold its records.
 *
 * Every project in AMIRA exists twice: as an item of class `foaf:Project` (its
 * description, team, statement and visualisations) and as the item set
 * MongoDB2OmekaS files its collection's records in. The two hold the same
 * records — every one of them also links to the project through
 * `dcterms:isPartOf` — so the project item is the page a visitor should land
 * on, and the item set is only the collection's container (DRE SEO redirects
 * its page to the project).
 *
 * The link between the two, as MongoDB2OmekaS writes it:
 *
 *  - the item set's own `dcterms:isPartOf` names the project item;
 *  - before that, and as a fallback, both carry the collection code as `dre:id`
 *    (e.g. UFB_AfroDigital).
 *
 * Projects are recognised by class, never by template or item-set id: the theme
 * pins no Omeka ids. Everything degrades to "no project" / [] / 0.
 */
class ProjectCollections extends AbstractHelper
{
    private const PROJECT_CLASS = 'foaf:Project';
    private const LINK_TYPES = ['resource', 'resource:item'];

    public function __invoke(): self
    {
        return $this;
    }

    /** Whether a resource is a research project item. */
    public static function isProject($resource): bool
    {
        try {
            $class = $resource ? $resource->resourceClass() : null;
            return $class && $class->term() === self::PROJECT_CLASS;
        } catch (\Throwable $e) {
            return false;
        }
    }

    /** The (visible) project whose records an item set holds, or null. */
    public function projectOf($itemSet)
    {
        try {
            foreach ($itemSet->value('dcterms:isPartOf', ['all' => true, 'type' => self::LINK_TYPES]) ?: [] as $value) {
                $linked = $value->valueResource();
                if (self::isProject($linked)) {
                    return $linked;
                }
            }
            $code = self::firstLiteral($itemSet, 'dre:id');
            if ($code === '') {
                return null;
            }
            $items = $this->getView()->api()->search('items', [
                'property' => [self::eq('dre:id', $code)],
                'limit' => 5,
            ])->getContent();
            foreach ($items ?: [] as $item) {
                if (self::isProject($item)) {
                    return $item;
                }
            }
        } catch (\Throwable $e) {
            // A failed lookup is "no project", not a broken page.
        }
        return null;
    }

    /**
     * The (visible) item sets holding a project's records: those whose
     * `dcterms:isPartOf` names it, then any sharing its `dre:id`.
     *
     * @return list<object>
     */
    public function collectionsOf($project): array
    {
        $sets = [];
        try {
            $api = $this->getView()->api();
            foreach ($api->search('item_sets', ['property' => [self::res('dcterms:isPartOf', (int) $project->id())]])->getContent() ?: [] as $set) {
                $sets[(int) $set->id()] = $set;
            }
            $code = self::firstLiteral($project, 'dre:id');
            if ($code !== '') {
                foreach ($api->search('item_sets', ['property' => [self::eq('dre:id', $code)]])->getContent() ?: [] as $set) {
                    $sets[(int) $set->id()] ??= $set;
                }
            }
        } catch (\Throwable $e) {
            return [];
        }
        return array_values($sets);
    }

    /** How many visible records link to the project through `dcterms:isPartOf`. */
    public function recordCount($project): int
    {
        try {
            return (int) $this->getView()->api()->search('items', [
                'property' => [self::res('dcterms:isPartOf', (int) $project->id())],
                'limit' => 1,
            ])->getTotalResults();
        } catch (\Throwable $e) {
            return 0;
        }
    }

    /**
     * Where a project's records are explored: DRE Search's research items with
     * the project facet applied (the facet holds the project's title), else
     * core's item browse filtered on `dcterms:isPartOf`.
     */
    public function recordsUrl($project): string
    {
        $view = $this->getView();
        try {
            $search = $view->plugin('DreSearchUrl');
            $url = $search->filtered('research_items', ['project_s' => (string) $project->displayTitle()]);
            if ($url !== '') {
                return $url;
            }
            return (string) $view->url('site/resource', ['controller' => 'item', 'action' => 'browse'], [
                'query' => ['property' => [self::res('dcterms:isPartOf', (int) $project->id())]],
            ], true);
        } catch (\Throwable $e) {
            return '';
        }
    }

    private static function eq(string $term, string $text): array
    {
        return ['joiner' => 'and', 'property' => $term, 'type' => 'eq', 'text' => $text];
    }

    private static function res(string $term, int $id): array
    {
        return ['joiner' => 'and', 'property' => $term, 'type' => 'res', 'text' => (string) $id];
    }

    private static function firstLiteral($resource, string $term): string
    {
        try {
            $value = $resource->value($term);
            return $value ? trim((string) $value) : '';
        } catch (\Throwable $e) {
            return '';
        }
    }
}
