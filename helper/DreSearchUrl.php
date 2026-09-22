<?php
namespace OmekaTheme\Helper;

use Laminas\View\Helper\AbstractHelper;

/**
 * Return the current site's DRE Search route.
 *
 * Search is owned by the DRE Search module, not by the theme. Keeping the
 * route in one helper prevents browse templates, PWA shortcuts and legacy
 * redirects from drifting apart.
 */
class DreSearchUrl extends AbstractHelper
{
    public function __invoke(): string
    {
        try {
            $site = $this->getView()->currentSite();
            if ($site) {
                $view = $this->getView();
                $hasSearch = $view->getHelperPluginManager()->has('dreSearchBar');
                return rtrim((string) $site->url(), '/') . ($hasSearch ? '/dre-search' : '/index/search');
            }
        } catch (\Throwable $e) {
            // A missing site context should not take a page down.
        }

        return '';
    }
}
