<?php
// view/common/pagination.phtml and its top/bottom wrappers, rendered as Omeka's
// pagination helper renders them (the same variables, no database).
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/support/ThemeView.php';
$failures = []; $checks = 0;
$view = new ThemeTestView();
$view->callbacks['hyperlink'] = fn($text, $href, array $attributes = []) => '<a href="' . htmlspecialchars($href)
    . '"' . implode('', array_map(fn($k, $v) => ' ' . $k . '="' . htmlspecialchars((string) $v) . '"', array_keys($attributes), $attributes))
    . '>' . htmlspecialchars($text) . '</a>';
// Core's helper: the request's query as hidden inputs, minus the names given.
$requestQuery = ['sort_by' => 'title'];
$view->callbacks['queryToHiddenInputs'] = function (array $remove = []) use (&$requestQuery) {
    $html = '';
    foreach (array_diff_key($requestQuery, array_flip($remove)) as $name => $value) {
        $html .= '<input type="hidden" name="' . htmlspecialchars($name) . '" value="' . htmlspecialchars((string) $value) . '">';
    }
    return $html;
};

/** The variables Omeka\View\Helper\Pagination::__toString() passes. */
function dre_pager(int $page, int $pageCount, int $perPage = 25): array
{
    $total = $pageCount * $perPage - 3;
    return [
        'totalCount' => $total, 'perPage' => $perPage, 'currentPage' => $page,
        'previousPage' => max(1, $page - 1), 'nextPage' => min($pageCount, $page + 1),
        'pageCount' => $pageCount, 'query' => [], 'offset' => ($page - 1) * $perPage,
        'firstPageUrl' => '?page=1', 'previousPageUrl' => '?page=' . max(1, $page - 1),
        'nextPageUrl' => '?page=' . min($pageCount, $page + 1), 'lastPageUrl' => '?page=' . $pageCount,
        'pagelessUrl' => '?',
    ];
}

function dre_xpath(string $html): DOMXPath
{
    $doc = new DOMDocument();
    @$doc->loadHTML('<?xml encoding="utf-8"?>' . $html);
    return new DOMXPath($doc);
}

// First page: Previous is unavailable, Next is a link.
$x = dre_xpath($view->render('common/pagination', dre_pager(1, 4)));
$nav = $x->query('//nav[contains(@class,"pagination")]');
dre_check($failures, $checks, 'a lone pager is one landmark named "Pagination"',
    $nav->length === 1 && $nav->item(0)->getAttribute('aria-label') === 'Pagination');
dre_check($failures, $checks, 'the row count states the range', str_contains($x->query('//span[@class="row-count"]')->item(0)->textContent, '1–25 of 97'));
$previous = $x->query('//*[contains(concat(" ", @class, " "), " previous ")]');
dre_check($failures, $checks, 'the unavailable Previous is a span with aria-disabled, not the invalid disabled attribute',
    $previous->length === 1 && $previous->item(0)->nodeName === 'span'
    && $previous->item(0)->getAttribute('aria-disabled') === 'true' && !$previous->item(0)->hasAttribute('disabled')
    && $previous->item(0)->getAttribute('aria-label') === 'Previous');
dre_check($failures, $checks, 'no element of the pager carries a disabled attribute', $x->query('//*[@disabled]')->length === 0);
dre_check($failures, $checks, 'the old "prev" class is gone', $x->query('//*[contains(concat(" ", @class, " "), " prev ")]')->length === 0);
$next = $x->query('//a[contains(concat(" ", @class, " "), " next ")]');
dre_check($failures, $checks, 'Next is a link to the following page', $next->length === 1 && $next->item(0)->getAttribute('href') === '?page=2');
dre_check($failures, $checks, 'the page form keeps the other query parameters and shows the page',
    $x->query('//form[@class="pager"]/input[@type="hidden"][@name="sort_by"]')->length === 1
    && $x->query('//input[@name="page"][@value="1"]')->length === 1);

// Last page: Previous is a link with the same class the span had, Next is unavailable.
$x = dre_xpath($view->render('common/pagination', dre_pager(4, 4)));
$previous = $x->query('//*[contains(concat(" ", @class, " "), " previous ")]');
dre_check($failures, $checks, 'the available Previous shares the class of the unavailable one',
    $previous->length === 1 && $previous->item(0)->nodeName === 'a' && $previous->item(0)->getAttribute('href') === '?page=3');
$next = $x->query('//*[contains(concat(" ", @class, " "), " next ")]');
dre_check($failures, $checks, 'the unavailable Next is aria-disabled', $next->length === 1 && $next->item(0)->nodeName === 'span'
    && $next->item(0)->getAttribute('aria-disabled') === 'true');
dre_check($failures, $checks, 'the last page counts to the total', str_contains($x->query('//span[@class="row-count"]')->item(0)->textContent, '76–97 of 97'));

// A default sort, as SetBrowseDefaults leaves the request on every site browse:
// the form drops the flags and the sorts they stand for, as core's pager does.
$requestQuery = ['fulltext_search' => 'Bayreuth', 'sort_by' => 'created', 'sort_order' => 'desc',
    'sort_by_default' => '', 'sort_order_default' => '', 'page' => '2'];
$x = dre_xpath($view->render('common/pagination', ['query' => $requestQuery] + dre_pager(2, 4)));
$hidden = array_map(fn($n) => $n->getAttribute('name'), iterator_to_array($x->query('//form[@class="pager"]/input[@type="hidden"]')));
dre_check($failures, $checks, 'a default sort is not re-submitted by the page form (full-text relevance survives)',
    $hidden === ['fulltext_search'], implode(', ', $hidden));
// An explicit sort is the visitor's, and stays. (SetBrowseDefaults sets the
// flags to null, which http_build_query, and so the request query, omits.)
$requestQuery = ['sort_by' => 'title', 'sort_order' => 'asc'];
$x = dre_xpath($view->render('common/pagination', ['query' => $requestQuery] + dre_pager(2, 4)));
$hidden = array_map(fn($n) => $n->getAttribute('name'), iterator_to_array($x->query('//form[@class="pager"]/input[@type="hidden"]')));
dre_check($failures, $checks, 'an explicit sort is kept by the page form', $hidden === ['sort_by', 'sort_order'], implode(', ', $hidden));
$requestQuery = ['sort_by' => 'title'];

// One page: no pager controls; no results: the empty message.
$x = dre_xpath($view->render('common/pagination', dre_pager(1, 1)));
dre_check($failures, $checks, 'a single page shows the count without pager controls', $x->query('//div[@class="pager-wrapper"]')->length === 0);
$empty = $view->render('common/pagination', ['totalCount' => 0] + dre_pager(1, 1));
dre_check($failures, $checks, 'no results says so', str_contains($empty, '0 results'));

// A browse page's two pagers are two distinguishable landmarks.
$both = $view->render('common/pagination-top', dre_pager(2, 4)) . $view->render('common/pagination-bottom', dre_pager(2, 4));
$labels = array_map(fn($n) => $n->getAttribute('aria-label'), iterator_to_array(dre_xpath($both)->query('//nav')));
dre_check($failures, $checks, 'the top and bottom pagers have different names', $labels === ['Pagination, top', 'Pagination, bottom'], implode(' | ', $labels));

// Which pager each browse page asks for (top, then bottom) is rendered by
// tests/TemplateRenderTest.php.

dre_report('Pagination', $failures, $checks);
