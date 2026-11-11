<?php
namespace OmekaTheme\Helper;

use Laminas\View\Helper\AbstractHelper;

/**
 * A count as the site's locale writes it: `$this->FormatNumber(12345)` is
 * "12,345" on an English site and "12.345" on a German one.
 *
 * docs/DESIGN-INTEGRATION.md asks for `NumberFormatter` with the site locale,
 * which Omeka makes PHP's default locale (`\Locale::setDefault()`, when intl is
 * loaded). number_format() is locale-blind and is only the fallback for a PHP
 * without intl, or a locale ICU does not know ("C" under POSIX makes the
 * constructor throw). The banner, the full-text control and the project
 * statement each had their own copy of this; one of them used number_format()
 * alone.
 */
class FormatNumber extends AbstractHelper
{
    /** @param int|float|string|null $value */
    public function __invoke($value): string
    {
        return self::format((int) $value);
    }

    /** @param string|null $locale an ICU locale; the default is the site's */
    public static function format(int $value, ?string $locale = null): string
    {
        if (class_exists(\NumberFormatter::class)) {
            try {
                $formatted = (new \NumberFormatter(self::icuLocale($locale), \NumberFormatter::DECIMAL))->format($value);
                if (is_string($formatted)) {
                    return $formatted;
                }
            } catch (\Throwable $e) {
                // number_format() below.
            }
        }
        return number_format($value);
    }

    /**
     * The locale to format in: the given one, else PHP's default. A POSIX or
     * root default (`en_US_POSIX` under `LANG=C`, as on CI runners and CLI
     * jobs) formats without grouping, so it reads as English, which is what a
     * site with no locale shows anyway.
     */
    private static function icuLocale(?string $locale): string
    {
        $locale = $locale ?? \Locale::getDefault();
        $plain = strtolower($locale);
        if (in_array($plain, ['', 'c', 'posix', 'root'], true) || str_contains($plain, 'posix')) {
            return 'en';
        }
        return $locale;
    }
}
