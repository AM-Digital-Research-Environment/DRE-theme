<?php
namespace OmekaTheme\Helper;
use Laminas\View\Helper\AbstractHelper;

/** Common locale, description and primary-thumbnail preparation for browse cards. */
class ResourceCardData extends AbstractHelper
{
    /**
     * @param \Omeka\Api\Representation\ItemRepresentation|\Omeka\Api\Representation\ItemSetRepresentation|\Omeka\Api\Representation\MediaRepresentation $resource
     * @param array{showBody?: bool, showThumbnail?: bool, thumbnailSize?: string} $options
     * @return array{resource: \Omeka\Api\Representation\ItemRepresentation|\Omeka\Api\Representation\ItemSetRepresentation|\Omeka\Api\Representation\MediaRepresentation, heading: \Omeka\Api\Representation\ValueRepresentation|string|null, body: \Omeka\Api\Representation\ValueRepresentation|string|null, thumbnail: string}
     */
    public function __invoke($resource, array $options = []): array
    {
        $view = $this->getView();
        $lang = $view->siteSetting('filter_locale_values') ? [$view->lang(), ''] : null;
        $headingTerm = $view->siteSetting('browse_heading_property_term');
        $bodyTerm = $view->siteSetting('browse_body_property_term');
        $title = $resource->displayTitle(null, $lang);
        $heading = $headingTerm ? $resource->value($headingTerm, ['default' => $title, 'lang' => $lang]) : $title;
        $body = null;
        if ($options['showBody'] ?? true) {
            $body = $bodyTerm ? $resource->value($bodyTerm, ['lang' => $lang]) : $resource->displayDescription(null, $lang);
        }
        $thumbnail = '';
        if ($options['showThumbnail'] ?? true) {
            $media = $resource->resourceName() === 'items' ? $resource->primaryMedia() : null;
            $thumbnail = $view->thumbnail($resource, $options['thumbnailSize'] ?? 'large', [
                'alt' => $media ? ($media->altText() ?: $title) : $title,
                'loading' => 'lazy', 'decoding' => 'async',
            ]);
        }
        return compact('resource', 'heading', 'body', 'thumbnail');
    }
}
