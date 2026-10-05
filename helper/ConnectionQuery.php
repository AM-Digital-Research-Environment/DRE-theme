<?php
namespace OmekaTheme\Helper;

use Laminas\View\Helper\AbstractHelper;

/** Validated state shared by the record page and Omeka's terminal endpoint. */
class ConnectionQuery extends AbstractHelper
{
    /** Omeka 4.2.1: type:property[-templatePropertyIds]; zero means no template. */
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
        return ['property' => $property, 'page' => $page ?: 1, 'search' => $search];
    }
}
