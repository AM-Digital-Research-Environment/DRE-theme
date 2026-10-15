<?php
namespace OmekaTheme\Helper;

use Laminas\View\Helper\AbstractHelper;

/**
 * Keep jQuery, Omeka's global.js and everything that depends on them off the
 * critical rendering path (issue #14).
 *
 * The layout used to put jQuery and global.js in <head> as blocking scripts:
 * about 90 KB that every page fetched and ran before first paint, though on the
 * live site nothing needs them before the document is parsed. They cannot
 * simply gain `defer`: a classic script that runs during parsing and calls `$`
 * — core's lightGallery set-up (lg-itemfiles-config.js), a module's script —
 * would then run before jQuery exists.
 *
 * So every EXTERNAL CLASSIC script in a container is deferred. Deferred scripts
 * (and module scripts) run after parsing, in document order, so every
 * dependency chain holds: jQuery, then global.js, then whatever a template or a
 * module appended after them, then the theme's own scripts at the end of the
 * body. Scripts that are already deferred, async or modules are left as they
 * are, and so are data blocks (JSON-LD, JSON islands) and inline scripts, which
 * cannot be deferred.
 *
 * One inline script needs global.js: core's jsTranslate() writes
 * `Omeka.jsTranslate = …` into <head>. asModules() turns the inline scripts
 * added after a mark into module scripts, which run in that same ordered list,
 * after global.js has defined `Omeka`.
 *
 * Both are best effort: they touch only Laminas's script items, and a container
 * they do not recognise is left as Omeka built it. A layout helper must never
 * 500 the page.
 */
class DeferScripts extends AbstractHelper
{
    private const CLASSIC_TYPES = ['', 'text/javascript', 'application/javascript'];

    /**
     * Defer every external classic script in a HeadScript/InlineScript
     * container. Without one, returns the helper, for asModules().
     */
    public function __invoke($scripts = null): self
    {
        foreach ($this->items($scripts) as $item) {
            $attributes = is_array($item->attributes ?? null) ? $item->attributes : [];
            if (!$this->isClassic($item) || empty($attributes['src'])
                || !empty($attributes['defer']) || !empty($attributes['async'])
            ) {
                continue;
            }
            $attributes['defer'] = 'defer';
            $item->attributes = $attributes;
        }
        return $this;
    }

    /** Run the inline classic scripts from item $from onwards as module scripts. */
    public function asModules($scripts, int $from): self
    {
        foreach ($this->items($scripts) as $index => $item) {
            $attributes = is_array($item->attributes ?? null) ? $item->attributes : [];
            if ($index >= $from && $this->isClassic($item) && empty($attributes['src'])
                && is_string($item->source ?? null) && $item->source !== ''
            ) {
                $item->type = 'module';
            }
        }
        return $this;
    }

    /** @return array<int, object> */
    private function items($scripts): array
    {
        try {
            $items = is_object($scripts) && method_exists($scripts, 'getContainer')
                ? $scripts->getContainer()->getArrayCopy()
                : [];
        } catch (\Throwable $e) {
            return [];
        }
        return array_values(array_filter($items, 'is_object'));
    }

    private function isClassic(object $item): bool
    {
        return in_array(strtolower(trim((string) ($item->type ?? ''))), self::CLASSIC_TYPES, true);
    }
}
