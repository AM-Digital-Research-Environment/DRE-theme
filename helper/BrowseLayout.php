<?php
namespace OmekaTheme\Helper;

use Laminas\View\Helper\AbstractHelper;

/**
 * Resolves the browse-page layout state (grid vs list) in one place.
 *
 * This preamble used to be copy-pasted, verbatim, into four templates
 * (item/browse, item-set/browse, the browse-preview block, and the media/browse
 * that has since been deleted for having no route to render it).
 * Each copy also read `$_GET['view']` directly, bypassing the MVC request.
 *
 * Returns an array so a template can destructure what it needs:
 *
 *   $layout = $this->browseLayout();
 *   $layout['isGrid']      bool    render the masonry grid rather than the list
 *   $layout['hasToggle']   bool    the theme setting offers a visitor toggle
 *   $layout['gridState']   string  'disabled' when Grid is the active button
 *   $layout['listState']   string  'disabled' when List is the active button
 *   $layout['setting']     string  the raw browse_layout theme setting
 *   $layout['bodyTerm']    string  site setting: property shown as card body
 *   $layout['truncate']    string  theme setting: '', 'full', 'fadeout', 'ellipsis'
 *
 * The "active" button is the disabled one — that is the pre-existing
 * convention in browse.js and the stylesheet, kept deliberately.
 */
class BrowseLayout extends AbstractHelper
{
    public function __invoke(): array
    {
        $view = $this->getView();

        $setting = (string) ($view->themeSetting('browse_layout') ?: 'grid');
        $isGrid = str_contains($setting, 'grid');

        // Visitor override (?view=grid|list), read through the request rather
        // than $_GET. Anything else is ignored and the theme setting stands.
        $requested = $this->requestedView();
        if ('list' === $requested) {
            $isGrid = false;
        } elseif ('grid' === $requested) {
            $isGrid = true;
        }

        return [
            'setting' => $setting,
            'isGrid' => $isGrid,
            'hasToggle' => str_contains($setting, 'toggle'),
            'gridState' => $isGrid ? 'disabled' : '',
            'listState' => $isGrid ? '' : 'disabled',
            'bodyTerm' => $view->siteSetting('browse_body_property_term'),
            'truncate' => (string) ($view->themeSetting('truncate_body_property') ?: ''),
        ];
    }

    /**
     * The ?view= query parameter, or '' when absent/unavailable.
     *
     * Wrapped because the `params` view helper is an MVC-context helper; on any
     * surface where it cannot resolve we simply fall back to the theme setting
     * rather than letting a browse page 500.
     */
    private function requestedView(): string
    {
        try {
            $view = $this->getView();
            if (!$view->getHelperPluginManager()->has('params')) {
                return '';
            }
            return (string) $view->params()->fromQuery('view', '');
        } catch (\Throwable $e) {
            return '';
        }
    }
}
