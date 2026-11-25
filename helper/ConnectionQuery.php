<?php
namespace OmekaTheme\Helper;

use Laminas\View\Helper\AbstractHelper;

/** Validated state shared by the record page and Omeka's terminal endpoint. */
final class ConnectionQuery extends AbstractHelper
{
    /** The orders the whole linked set can be read in; the first is the default. */
    public const SORTS = ['title', 'title-desc', 'newest'];

    /**
     * Omeka 4.2.1: type:property[-templatePropertyIds]; zero means no template.
     * A kind of record is a resource class id, zero for records without one.
     *
     * @param array<mixed> $query
     * @return array{property: string|null, page: int, search: string, class: int|null, sort: string}
     */
    public function __invoke(array $query): array
    {
        $property = $query['lr_property'] ?? $query['resource_property'] ?? null;
        $property = is_string($property) && strlen($property) <= 4096
            && preg_match('/^(items|media):(?:[1-9][0-9]*(?:-(?:[0-9]+(?:,[0-9]+)*)?)?)?$/D', $property)
            ? $property : null;
        $page = $query['lr_page'] ?? $query['page'] ?? 1;
        $page = is_scalar($page) ? filter_var($page, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]) : false;
        $search = $query['lr_q'] ?? '';
        $search = is_string($search) ? mb_substr(trim($search), 0, 200) : '';
        $class = $query['lr_class'] ?? null;
        $class = is_string($class) && preg_match('/^(?:0|[1-9][0-9]{0,9})$/D', $class) ? (int) $class : null;
        $sort = $query['lr_sort'] ?? null;
        $sort = in_array($sort, self::SORTS, true) ? $sort : self::SORTS[0];
        return ['property' => $property, 'page' => $page ?: 1, 'search' => $search, 'class' => $class, 'sort' => $sort];
    }
}
