<?php
namespace OmekaTheme\Helper;
use Laminas\View\Helper\AbstractHelper;

/** Build the per-site manifest; encoding/routing failure disables installation. */
class PwaManifest extends AbstractHelper
{
    public function __invoke($site): array
    {
        $view = $this->getView();
        $pwaEnabled = (bool) $view->themeSetting('pwa_enable', true);
        $pwaShortName = '';
        $pwaManifestJson = '';
        if ($pwaEnabled) {
            try {
                $slug = $site->slug();
                // Absolute site base with a trailing slash — used verbatim for id /
                // start_url / scope (scope must be a prefix of start_url).
                $siteBase = rtrim((string) $view->url('site', ['site-slug' => $slug], ['force_canonical' => true]), '/') . '/';

                $pwaShortName = trim((string) $view->themeSetting('pwa_short_name', ''));
                if ($pwaShortName === '') {
                    $pwaShortName = $site->title();
                }

                // Locale → lang/dir. All shipped locales are LTR; derive dir defensively.
                $lang = $view->lang() ?: 'en';
                $rtl = ['ar', 'arc', 'dv', 'fa', 'ha', 'he', 'khw', 'ks', 'ku', 'ps', 'sd', 'ug', 'ur', 'yi'];
                $dir = in_array(strtolower(substr($lang, 0, 3)), $rtl, true)
                    || in_array(strtolower(substr($lang, 0, 2)), $rtl, true) ? 'rtl' : 'ltr';

                $pwaIcon = function ($file, $sizes, $purpose) use ($view) {
                    return [
                        'src' => $view->assetUrl('img/pwa/' . $file),
                        'sizes' => $sizes,
                        'type' => 'image/png',
                        'purpose' => $purpose,
                    ];
                };

                // Browse / Search launcher shortcuts (absolute). Nested try/catch so a
                // routing hiccup drops only the shortcuts, not the whole manifest.
                $pwaShortcuts = [];
                try {
                    $shortcutIcon = [[
                        'src' => $view->assetUrl('img/pwa/icon-192.png'),
                        'sizes' => '192x192',
                        'type' => 'image/png',
                    ]];
                    $pwaShortcuts = [
                        [
                            'name' => $view->translate('Browse the collection'),
                            'short_name' => $view->translate('Browse'),
                            'url' => $view->url('site/resource', ['site-slug' => $slug, 'controller' => 'item', 'action' => 'browse'], ['force_canonical' => true]),
                            'icons' => $shortcutIcon,
                        ],
                        [
                            'name' => $view->translate('Search'),
                            'short_name' => $view->translate('Search'),
                            'url' => $view->DreSearchUrl(),
                            'icons' => $shortcutIcon,
                        ],
                    ];
                } catch (\Throwable $e) {
                    $pwaShortcuts = [];
                }

                $pwaManifest = [
                    'id' => $siteBase,
                    'name' => $site->title(),
                    'short_name' => $pwaShortName,
                    'start_url' => $siteBase,
                    'scope' => $siteBase,
                    'display' => 'standalone',
                    'display_override' => ['standalone', 'minimal-ui'],
                    // theme_color / background_color from the light surface tokens
                    // (--surface #fdfcf9 / --background #f8f6f1); the splash reads as the
                    // page ground with a near-white toolbar.
                    'theme_color' => '#fdfcf9',
                    'background_color' => '#f8f6f1',
                    'lang' => $lang,
                    'dir' => $dir,
                    'categories' => ['education', 'reference', 'books'],
                    'icons' => [
                        $pwaIcon('icon-192.png', '192x192', 'any'),
                        $pwaIcon('icon-512.png', '512x512', 'any'),
                        $pwaIcon('maskable-192.png', '192x192', 'maskable'),
                        $pwaIcon('maskable-512.png', '512x512', 'maskable'),
                        $pwaIcon('monochrome-512.png', '512x512', 'monochrome'),
                    ],
                ];
                $summary = method_exists($site, 'summary') ? trim((string) $site->summary()) : '';
                if ($summary !== '') {
                    $pwaManifest['description'] = $summary;
                }
                if ($pwaShortcuts) {
                    $pwaManifest['shortcuts'] = $pwaShortcuts;
                }

                // JSON_HEX_TAG neutralises "<" (so a stray "</script>" can't break out of
                // the island); slashes/unicode stay literal for a compact, readable blob.
                $pwaManifestJson = json_encode($pwaManifest, JSON_HEX_TAG | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
                // Keep all three gates (head island, header button, body script)
                // consistent: if encoding somehow fails, disable the feature wholesale.
                if ($pwaManifestJson === false) {
                    $pwaEnabled = false;
                    $pwaManifestJson = '';
                }
            } catch (\Throwable $e) {
                $pwaEnabled = false;
                $pwaManifestJson = '';
            }
        }

        return ['enabled' => $pwaEnabled, 'shortName' => $pwaShortName, 'json' => $pwaManifestJson];
    }
}
