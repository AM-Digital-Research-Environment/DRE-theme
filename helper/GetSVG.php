<?php 
namespace OmekaTheme\Helper;

use Laminas\View\Helper\AbstractHelper;

class GetSVG extends AbstractHelper
{

    /**
     * Get SVG Markup.
     *
     * @param string $name The SVG name.
     * @return string
     */
    public function __invoke($name)
    {
        if (!$name) {
            return '';
        }

        // Read the SVG straight from disk (the theme's asset/img). Reading the
        // file directly avoids an HTTP round-trip via file_get_contents() to the
        // server's own asset URL, which fails wherever PHP can't reach its own
        // public URL (e.g. behind Docker/proxies). __DIR__ is <theme>/helper,
        // so its parent is the theme root. basename() guards against traversal.
        $file = dirname(__DIR__) . '/asset/img/' . basename((string) $name) . '.svg';
        if (is_readable($file)) {
            return file_get_contents($file);
        }

        return '';
    }
}
