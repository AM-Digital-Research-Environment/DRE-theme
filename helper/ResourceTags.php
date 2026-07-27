<?php
namespace OmekaTheme\Helper;

use Laminas\View\Helper\AbstractHelper;

/**
 * Renders the small "resource type" / "resource class" chips shown on cards and
 * resource pages, controlled by the "Resource Tags" theme setting.
 *
 * Each chip carries a colour swatch whose HUE is derived from the resource's id
 * so a given class always looks the same. Only the hue is emitted, as a
 * `--tag-hue` custom property; lightness and chroma live in
 * base/elements/_resource-tag.scss so the swatch adapts to light and dark mode.
 * (It previously emitted a complete `hsl(<crc32 of id>, 100%, 75.5%)` inline —
 * a fixed light-mode pastel that stayed pale-on-pale in dark mode, sat outside
 * the token system, and fed CSS an unbounded integer as a hue angle.)
 */
class ResourceTags extends AbstractHelper
{
    /**
     * Stable pseudo-ids for the three resource types, so their hues never
     * collide with a resource class's.
     */
    private const RESOURCE_TYPES = [
        'items' => ['id' => 0, 'label' => 'Item'],           // @translate
        'item_sets' => ['id' => 7, 'label' => 'Item set'],   // @translate
        'media' => ['id' => 3, 'label' => 'Media'],          // @translate
    ];

    /** Offset applied to resource-class ids so they never map onto a type hue. */
    private const CLASS_ID_OFFSET = 10;

    public function __invoke($resource): string
    {
        if (!$resource) {
            return '';
        }

        $view = $this->getView();
        $enabled = $view->themeSetting('resource_tags');
        if (!is_array($enabled)) {
            return '';
        }

        $showType = in_array('resource_type', $enabled, true);
        $showClass = in_array('resource_class', $enabled, true);
        if (!$showType && !$showClass) {
            return '';
        }

        $tags = '';

        if ($showType) {
            $resourceName = $resource->resourceName();
            if ($resourceName && isset(self::RESOURCE_TYPES[$resourceName])) {
                $type = self::RESOURCE_TYPES[$resourceName];
                $tags .= $this->tag($type['id'], $view->translate($type['label']));
            }
        }

        if ($showClass) {
            $resourceClass = $resource->resourceClass();
            if ($resourceClass && $resourceClass->id()) {
                $tags .= $this->tag(
                    (int) $resourceClass->id() + self::CLASS_ID_OFFSET,
                    $view->translate($resource->displayResourceClassLabel())
                );
            }
        }

        if ('' === $tags) {
            return '';
        }

        return '<div class="resource-tags">' . $tags . '</div>';
    }

    /** One chip: a hue-only swatch plus its escaped label. */
    private function tag(int $id, string $label): string
    {
        $view = $this->getView();

        return sprintf(
            '<div class="resource-tag"><span class="resource-tag-color" style="--tag-hue: %ddeg;"></span>%s</div>',
            $this->hueFromId($id),
            $view->escapeHtml($label)
        );
    }

    /**
     * A stable hue angle (0-359) for an id.
     *
     * crc32() spreads adjacent ids well, so neighbouring resource classes do not
     * come out as neighbouring colours. The modulo is the important part: the
     * old code handed CSS the raw crc32 value (up to ~4.3 billion) and relied on
     * browsers wrapping it.
     */
    private function hueFromId(int $id): int
    {
        return crc32((string) $id) % 360;
    }
}
