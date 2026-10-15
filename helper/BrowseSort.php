<?php
namespace OmekaTheme\Helper;

use Laminas\View\Helper\AbstractHelper;

/**
 * The sort options an item list offers a visitor.
 *
 * Core builds the list from every sortable column, and the Numeric Data Types
 * module adds one entry per numeric property and data type: an item-set page
 * offered 25 options, from "Date Valid (numeric:interval)" to "page end
 * (numeric:integer)", most of them empty for the records listed. The visitor's
 * list keeps Title, the dates a reader sorts by (`dcterms:date`,
 * `dcterms:issued`, `dcterms:created`, as timestamps, under their plain
 * label) and the date a record was added. A sort already in the URL still
 * works; it is only not offered.
 *
 * Numeric Data Types adds its sorts from the `view.sort-selector` event, which
 * core fires inside renderSortSelector() — after any list a theme passes in.
 * selector() therefore fires the event itself and curates what comes back.
 *
 * Properties are looked up by term, once per request, so the theme pins no
 * property ids.
 */
class BrowseSort extends AbstractHelper
{
    public const DATE_TERMS = ['dcterms:date', 'dcterms:issued', 'dcterms:created'];

    /** @var array<int,string>|null property id => label */
    private ?array $dateProperties = null;

    /** The curated sort configuration for a resource type ('' when unavailable). */
    public function __invoke(string $resourceType = 'items'): array
    {
        try {
            $config = $this->getView()->browse()->getBrowseService()->getSortConfig('public', $resourceType);
        } catch (\Throwable $e) {
            return [];
        }
        $sorts = self::curate(is_array($config) ? $config : [], $this->dateProperties ??= $this->findDateProperties());
        if (isset($sorts['created'])) {
            // Core's sort selector prints labels as given.
            $sorts['created'] = $this->getView()->translate($sorts['created']);
        }
        return $sorts;
    }

    /**
     * The sort form for a list, as core's renderSortSelector() builds it but
     * with the curated options; core's form when no sort is configured.
     */
    public function selector(string $resourceType = 'items'): string
    {
        $view = $this->getView();
        try {
            $config = $view->browse()->getBrowseService()->getSortConfig('public', $resourceType);
            if (!$config) {
                return '';
            }
            $query = $view->params()->fromQuery();
            $fulltext = isset($query['fulltext_search']) && is_string($query['fulltext_search']) && trim($query['fulltext_search']) !== '';
            if ($fulltext) {
                $config[''] = 'Relevance'; // @translate
            }
            $params = [
                'sortConfig' => $config,
                'sortByQuery' => (isset($query['sort_by_default']) && $fulltext) ? '' : $view->params()->fromQuery('sort_by'),
                'sortOrderQuery' => (isset($query['sort_order_default']) && $fulltext) ? 'desc' : $view->params()->fromQuery('sort_order'),
            ];
            $result = $view->trigger('view.sort-selector', $params, true);
            $args = (is_array($result) || $result instanceof \ArrayObject) ? (array) $result : $params;
            $sorts = self::curate((array) ($args['sortConfig'] ?? []), $this->dateProperties ??= $this->findDateProperties());
            foreach ($sorts as $key => $label) {
                $sorts[$key] = $view->translate($label);
            }
            $args['sortConfig'] = $sorts;
            return (string) $view->partial('common/sort-selector', $args);
        } catch (\Throwable $e) {
            return (string) $view->browse()->renderSortSelector($resourceType);
        }
    }

    /**
     * Title first, then the reader's dates, then the date added; the resource
     * class (one class per list here) and every other numeric sort dropped.
     *
     * @param array<string,string> $config Sort key => label, as core builds it.
     * @param array<int,string> $dateProperties Property id => label.
     * @return array<string,string>
     */
    public static function curate(array $config, array $dateProperties): array
    {
        $title = $dates = $rest = [];
        foreach ($config as $key => $label) {
            $key = (string) $key;
            if ($key === 'resource_class_label') {
                continue;
            }
            if (str_starts_with($key, 'numeric:')) {
                if (preg_match('~^numeric:timestamp:(\d+)$~', $key, $m) && isset($dateProperties[(int) $m[1]])) {
                    $dates[$key] = $dateProperties[(int) $m[1]];
                }
                continue;
            }
            if ($key === 'title') {
                $title[$key] = $label;
            } elseif ($key === 'created') {
                $rest[$key] = 'Date added'; // @translate
            } else {
                $rest[$key] = $label;
            }
        }
        // Keep the reader's dates in DATE_TERMS order, not the column order.
        $ordered = [];
        foreach (array_keys($dateProperties) as $id) {
            if (isset($dates['numeric:timestamp:' . $id])) {
                $ordered['numeric:timestamp:' . $id] = $dates['numeric:timestamp:' . $id];
            }
        }
        return $title + $ordered + $rest;
    }

    /** @return array<int,string> */
    private function findDateProperties(): array
    {
        $out = [];
        try {
            $api = $this->getView()->api();
            foreach (self::DATE_TERMS as $term) {
                $property = $api->searchOne('properties', ['term' => $term])->getContent();
                if ($property) {
                    $out[(int) $property->id()] = (string) $property->label();
                }
            }
        } catch (\Throwable $e) {
            return [];
        }
        return $out;
    }
}
