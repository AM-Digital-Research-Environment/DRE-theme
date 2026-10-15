<?php
namespace OmekaTheme\Helper;

use Laminas\View\Helper\AbstractHelper;

/**
 * Return the current site's search URL: DRE Search when the module is
 * installed, otherwise core's non-redirecting site search.
 *
 * Search is owned by the DRE Search module, not by the theme. Keeping the
 * route, its query parameter and the module probe in one helper prevents the
 * masthead, browse templates, PWA shortcuts and legacy redirects from drifting
 * apart. Templates needing the parameter name call
 * `$this->plugin('DreSearchUrl')->queryParam()`.
 */
class DreSearchUrl extends AbstractHelper
{
    public function __invoke(?string $query = null): string
    {
        try {
            $site = $this->getView()->currentSite();
            if ($site) {
                $url = rtrim((string) $site->url(), '/') . ($this->hasModule() ? '/dre-search' : '/index/search');
                $query = trim((string) $query);
                return $query === '' ? $url : $url . '?' . http_build_query([$this->queryParam() => $query]);
            }
        } catch (\Throwable $e) {
            // A missing site context should not take a page down.
        }

        return '';
    }

    /**
     * DRE Search opened on one corpus with facets already applied, e.g. a
     * project's records: `filtered('research_items', ['project_s' => $title])`
     * gives `…/dre-search?profile=research_items&f.project_s=…`, the search
     * page's own shareable URL. '' without the module: core search has no
     * facets, so callers fall back to their own link.
     *
     * @param array<string,string|string[]> $facets Facet field => value(s).
     */
    public function filtered(string $profile, array $facets): string
    {
        if (!$this->hasModule()) {
            return '';
        }
        $url = $this->__invoke();
        if ($url === '') {
            return '';
        }
        $pairs = ['profile=' . rawurlencode($profile)];
        foreach ($facets as $field => $values) {
            foreach ((array) $values as $value) {
                $value = trim((string) $value);
                if ($value !== '') {
                    $pairs[] = 'f.' . rawurlencode((string) $field) . '=' . rawurlencode($value);
                }
            }
        }
        return $url . '?' . implode('&', $pairs);
    }

    /** Whether the DRE Search module's site search is available. */
    public function hasModule(): bool
    {
        try {
            return (bool) $this->getView()->getHelperPluginManager()->has('dreSearchBar');
        } catch (\Throwable $e) {
            return false;
        }
    }

    /** The free-text parameter the search URL above reads. */
    public function queryParam(): string
    {
        return $this->hasModule() ? 'q' : 'fulltext_search';
    }
}
