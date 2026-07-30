<?php
namespace OmekaTheme\Helper;

use Laminas\View\Helper\AbstractHelper;

/**
 * Is the current request the site's home page?
 *
 * This detection used to live inline in view/layout/layout.phtml, which meant
 * only the layout could ask the question. It now has two callers that must
 * agree, or the page grows a second <h1>:
 *
 *   • common/banner.phtml — the home masthead carries the page <h1>.
 *   • common/block-layout/page-title.phtml — which therefore has to stand down
 *     on the home page. It cannot read the layout's local $isHome (Omeka
 *     renders the content before the layout), so it asks this helper instead.
 *
 * Detected from the request path — the home page is served at the site root
 * (e.g. /s/amira) or at its own slug (/s/amira/page/<homepage-slug>). This
 * avoids the MVC route match (the `status` view helper does not expose
 * getRouteMatch()) and is wrapped so a detection hiccup can never take a page
 * down: it just answers "not home", i.e. the pre-masthead layout.
 *
 * The answer is memoised per request: the layout and every page-title block ask
 * the same question, and parse_url() on each is pointless work.
 */
class IsHomePage extends AbstractHelper
{
    private ?bool $isHome = null;

    public function __invoke(): bool
    {
        if (null !== $this->isHome) {
            return $this->isHome;
        }

        $this->isHome = false;

        try {
            $view = $this->getView();
            $site = $view->currentSite();
            if (!$site) {
                return $this->isHome;
            }

            $currentPath = rtrim((string) parse_url((string) $view->serverUrl(true), PHP_URL_PATH), '/');
            $sitePath    = rtrim((string) parse_url((string) $site->url(), PHP_URL_PATH), '/');
            if ($currentPath === '' || $sitePath === '') {
                return $this->isHome;
            }

            if ($currentPath === $sitePath) {
                $this->isHome = true; // site root
            } elseif (method_exists($site, 'homepage') && ($homepage = $site->homepage())) {
                $this->isHome = ($currentPath === $sitePath . '/page/' . $homepage->slug());
            }
        } catch (\Throwable $e) {
            $this->isHome = false;
        }

        return $this->isHome;
    }
}
