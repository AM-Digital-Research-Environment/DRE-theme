<?php
namespace OmekaTheme\Helper;

use Laminas\View\Helper\AbstractHelper;

/**
 * Whether the "Image decoration" theme setting frames this kind of image:
 * `$this->ImageDecoration('media')`, `$this->ImageDecoration('asset')`.
 *
 * The setting is a multi-checkbox, saved as a list, absent until an admin
 * saves the form; seven templates each spelled out the array test.
 */
final class ImageDecoration extends AbstractHelper
{
    public function __invoke(string $kind): bool
    {
        $decoration = $this->getView()->themeSetting('image_decoration');
        return is_array($decoration) && in_array($kind, $decoration, true);
    }
}
