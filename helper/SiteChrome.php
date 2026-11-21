<?php
namespace OmekaTheme\Helper;

use Laminas\View\Helper\AbstractHelper;

/**
 * What the site's chrome needs to know, without markup: the masthead's
 * settings and heading, and the AMIRA page table the masthead and the main
 * menu both read.
 *
 * view/common/banner.phtml used to resolve a dozen theme settings and
 * `require` config/amira-pages.php inline, and view/common/nav-menu.phtml
 * required the same file again. The page-title block restated the banner's
 * heading rule to decide whether to stand down; two copies of that rule are
 * how a home page gets two <h1>s, or none. heading() and homeHeading() are
 * that rule, once.
 *
 *   $chrome = $this->plugin('SiteChrome');
 *   $chrome->pages()        config/amira-pages.php, read once per request
 *   $chrome->homeHeading()  the <h1> the home masthead renders, '' elsewhere
 *   $chrome->banner($site, $isHome)
 *   $chrome->slugOf($page) / navLink($page, …)   for the main menu
 */
final class SiteChrome extends AbstractHelper
{
    /** @var array<string, array<string, string>>|null */
    private static ?array $pages = null;

    public function __invoke(): self
    {
        return $this;
    }

    /**
     * The AMIRA page slugs and their copy: `intros` and `descriptions` for the
     * menu, `statPages` for the masthead's counts.
     *
     * @return array<string, array<string, string>>
     */
    public function pages(): array
    {
        return self::$pages ??= require dirname(__DIR__) . '/config/amira-pages.php';
    }

    /**
     * The masthead's heading: the "Banner heading" setting, else the site
     * title; '' when neither is set.
     *
     * @param \Omeka\Api\Representation\SiteRepresentation|null $site
     */
    public function heading($site = null): string
    {
        $view = $this->getView();
        $heading = (string) ($view->themeSetting('banner_heading') ?: '');
        if ($heading === '' && $site) {
            $heading = (string) $site->title();
        }
        return $heading;
    }

    /**
     * The <h1> the home masthead carries, '' on any other page or when the
     * masthead has no heading. The page-title block stands down exactly when
     * this is not '', so the home page has one <h1>, never two and never none.
     */
    public function homeHeading(): string
    {
        $view = $this->getView();
        if (!$view->IsHomePage()) {
            return '';
        }
        try {
            $site = $view->currentSite();
        } catch (\Throwable $e) {
            $site = null;
        }
        return $this->heading($site);
    }

    /**
     * Everything common/banner.phtml prints, resolved from the theme settings;
     * null when the masthead does not render (an interior page with the strip
     * switched off, or no heading at all).
     *
     * @param \Omeka\Api\Representation\SiteRepresentation|null $site
     * @return array{variant: string, heading: string, eyebrow: string, tagline: string, showWash: bool, searchAction: string, searchParam: string, heroLinks: list<array{href: string, label: string}>, asideTitle: string, asideText: string, stats: array<array<string, mixed>>, statsTitle: string, statLinks: array<string, string>, siteBase: string, hasColumn: bool}|null
     */
    public function banner($site, bool $isHome): ?array
    {
        $view = $this->getView();
        $translate = $view->plugin('translate');
        // A checkbox saved as '0' (or emptied) is off; unsaved, the default stands.
        $isOff = fn ($value): bool => in_array((string) $value, ['0', ''], true);

        // Interior pages can opt out of the masthead (default on for fresh installs).
        if (!$isHome && $isOff($view->themeSetting('banner_show_interior', '1'))) {
            return null;
        }
        $heading = $this->heading($site);
        if ($heading === '') {
            return null; // nothing to show, no point rendering an empty band
        }

        $eyebrow = $view->themeSetting('banner_eyebrow');
        if ($eyebrow === null) {
            $eyebrow = $translate('Digital Research Environment');
        }

        // The header owns the primary search field from $xl up, where it fills
        // the centre of tier 1. Below that breakpoint it collapses to a
        // magnifier button, so the home masthead still renders a real field and
        // CSS hides it at $xl+: the first screen always offers somewhere to
        // type, and never two fields at once. DreSearchUrl owns the module
        // probe and the fallback (core site search).
        $searchUrl = $view->plugin('DreSearchUrl');

        // Two optional text links under the lede. Link 1 keeps its pre-2.24
        // label fallback so existing installs are unchanged; link 2 only
        // renders when an admin sets both fields.
        $heroLinks = [];
        $buttonLink = trim((string) $view->themeSetting('banner_button_link', ''));
        if ($buttonLink !== '') {
            $heroLinks[] = [
                'href' => $buttonLink,
                'label' => (string) ($view->themeSetting('banner_button_label') ?: $translate('Explore the collection')),
            ];
        }
        $buttonLink2 = trim((string) $view->themeSetting('banner_button2_link', ''));
        $buttonLabel2 = trim((string) $view->themeSetting('banner_button2_label', ''));
        if ($buttonLink2 !== '' && $buttonLabel2 !== '') {
            $heroLinks[] = ['href' => $buttonLink2, 'label' => $buttonLabel2];
        }

        // Optional standing note ("Open access", how to cite), under the catalogue.
        $asideTitle = trim((string) $view->themeSetting('banner_aside_title', ''));
        $asideText = trim((string) $view->themeSetting('banner_aside_text', ''));

        // Home-only corpus counts. Their sourcing and its error handling live in
        // CollectionStats, which returns [] on any hiccup: the masthead renders.
        $stats = [];
        if ($isHome && !$isOff($view->themeSetting('banner_show_stats', '1'))) {
            $stats = $view->CollectionStats($site ? $site->id() : null);
        }
        $statsTitle = trim((string) $view->themeSetting('banner_stats_title', ''));
        if ($statsTitle === '') {
            $statsTitle = $translate('In the collection');
        }

        return [
            'variant' => $isHome ? 'home' : 'page',
            'heading' => $heading,
            'eyebrow' => (string) $eyebrow,
            'tagline' => (string) $view->themeSetting('banner_description'),
            // The optional pre-2.22 wash. Off by default: the masthead is a plate now.
            'showWash' => (string) $view->themeSetting('banner_wash', '0') === '1',
            'searchAction' => $isHome ? (string) $searchUrl() : '',
            'searchParam' => (string) $searchUrl->queryParam(),
            'heroLinks' => $heroLinks,
            'asideTitle' => $asideTitle,
            'asideText' => $asideText,
            'stats' => $stats,
            'statsTitle' => (string) $statsTitle,
            'statLinks' => $this->pages()['statPages'] ?? [],
            'siteBase' => $site ? rtrim((string) $site->url(), '/') : '',
            'hasColumn' => $isHome && ($stats || $asideTitle || $asideText),
        ];
    }

    /**
     * A menu page's slug: the last segment of its link (…/page/<slug>), the
     * key of the menu copy in pages(). One rule for every level of the menu.
     *
     * @param \Laminas\Navigation\Page\AbstractPage $page
     */
    public function slugOf($page): string
    {
        return basename(rtrim((string) parse_url((string) $page->getHref(), PHP_URL_PATH), '/'));
    }

    /**
     * One menu link. The menu renders dozens of these per page: one method
     * call each, not one partial (a template lookup and a renderer scope) each.
     *
     * @param \Laminas\Navigation\Page\AbstractPage $page
     * @param string $labelClass wraps the label in a span of that class (a
     *        panel cell's `nav-panel__cell-title`, which sets it above its
     *        description); a plain link writes the label bare
     */
    public function navLink($page, string $class = '', string $description = '', string $labelClass = ''): string
    {
        $view = $this->getView();
        $escape = $view->plugin('escapeHtml');
        $escapeAttr = $view->plugin('escapeHtmlAttr');
        $html = '<a' . ($class === '' ? '' : ' class="' . $escapeAttr($class) . '"')
            . ' href="' . $escapeAttr($page->getHref()) . '"';
        if ($page->getTarget()) {
            $html .= ' target="' . $escapeAttr($page->getTarget()) . '"';
            if ($page->getTarget() === '_blank') {
                $html .= ' rel="noopener"';
            }
        }
        if ($page->getTitle()) {
            $html .= ' title="' . $escapeAttr($page->getTitle()) . '"';
        }
        if ($page->isActive(false)) {
            $html .= ' aria-current="page"';
        }
        $label = $escape($page->getLabel());
        $html .= '>' . ($labelClass === '' ? $label : '<span class="' . $escapeAttr($labelClass) . '">' . $label . '</span>');
        if ($description !== '') {
            $html .= '<span class="nav-panel__cell-desc">' . $escape($description) . '</span>';
        }
        return $html . '</a>';
    }
}
