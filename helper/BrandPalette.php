<?php
namespace OmekaTheme\Helper;

use Laminas\View\Helper\AbstractHelper;

/** Accessible custom-brand fills. The authored default palette remains unchanged. */
final class BrandPalette extends AbstractHelper
{
    /** Uni-Grün, the authored palette's seed (and config/theme.ini's default). */
    public const DEFAULT_SEED = '#009260';

    /**
     * The "Brand colour" setting as a seed: a #rrggbb colour, else the default.
     * The layout prints the result into a style block, so nothing else passes.
     */
    public static function seed(mixed $setting): string
    {
        return is_string($setting) && self::isHex($setting) ? $setting : self::DEFAULT_SEED;
    }

    private static function isHex(string $value): bool
    {
        return (bool) preg_match('/^#[0-9a-f]{6}$/iD', $value);
    }

    /** @return array<'light'|'dark', array{primary: string, 'primary-hover': string, 'primary-active': string, 'primary-text': string, 'primary-contrast': string}> */
    public function __invoke(string $seed): array
    {
        if (!self::isHex($seed) || strtolower($seed) === self::DEFAULT_SEED) {
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

    /**
     * @param list<int|float> $rgb
     * @return list<int>
     */
    private static function mix(array $rgb, int $target, float $amount): array
    {
        return array_map(static fn($channel) => (int) round($channel * (1 - $amount) + $target * $amount), $rgb);
    }

    /** @param list<int|float> $rgb */
    private static function hex(array $rgb): string
    {
        return sprintf('#%02x%02x%02x', ...$rgb);
    }

    /** @param list<int|float> $rgb */
    private static function luminance(array $rgb): float
    {
        $linear = array_map(static function ($channel) {
            $channel /= 255;
            return $channel <= 0.04045 ? $channel / 12.92 : (($channel + 0.055) / 1.055) ** 2.4;
        }, $rgb);
        return $linear[0] * 0.2126 + $linear[1] * 0.7152 + $linear[2] * 0.0722;
    }
}
