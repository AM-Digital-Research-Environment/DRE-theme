<?php
namespace OmekaTheme\Helper;

use Laminas\View\Helper\AbstractHelper;

/** Accessible custom-brand fills. The authored default palette remains unchanged. */
class BrandPalette extends AbstractHelper
{
    public function __invoke(string $seed): array
    {
        if (!preg_match('/^#[0-9a-f]{6}$/iD', $seed) || strtolower($seed) === '#009260') {
            return [];
        }
        $rgb = array_map('hexdec', str_split(substr($seed, 1), 2));
        $palettes = [];
        foreach (['light', 'dark'] as $mode) {
            $dark = $mode === 'dark';
            $base = $rgb;
            // Light fills contrast with white AND the darkest light surface;
            // dark fills contrast with black AND the lightest dark surface.
            while ($dark ? self::luminance($base) < 0.4 : self::luminance($base) > 0.12) {
                $base = self::mix($base, $dark ? 255 : 0, 0.04);
            }
            $palettes[$mode] = [
                'primary' => self::hex($base),
                'primary-hover' => self::hex(self::mix($base, $dark ? 255 : 0, 0.12)),
                'primary-active' => self::hex(self::mix($base, $dark ? 255 : 0, 0.24)),
                'primary-text' => self::hex(self::mix($base, $dark ? 255 : 0, 0.12)),
                'primary-contrast' => $dark ? '#000000' : '#ffffff',
            ];
        }
        return $palettes;
    }

    private static function mix(array $rgb, int $target, float $amount): array
    {
        return array_map(static fn($channel) => (int) round($channel * (1 - $amount) + $target * $amount), $rgb);
    }

    private static function hex(array $rgb): string
    {
        return sprintf('#%02x%02x%02x', ...$rgb);
    }

    private static function luminance(array $rgb): float
    {
        $linear = array_map(static function ($channel) {
            $channel /= 255;
            return $channel <= 0.04045 ? $channel / 12.92 : (($channel + 0.055) / 1.055) ** 2.4;
        }, $rgb);
        return $linear[0] * 0.2126 + $linear[1] * 0.7152 + $linear[2] * 0.0722;
    }
}
