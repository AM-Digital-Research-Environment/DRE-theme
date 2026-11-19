<?php
namespace OmekaTheme\Helper;

use Laminas\View\Helper\AbstractHelper;

/**
 * sprintf() over a translated format string, without the 500.
 *
 * On PHP 8 a translation that asks for more arguments than the call passes
 * (`%2$s` where the msgid has one `%s`) throws ArgumentCountError, and one with
 * a stray `%` throws ValueError. A translator's slip would then take down every
 * page that renders the string, item pages among them. Here the untranslated
 * msgid is tried next, and if even that cannot be formatted the format itself
 * is returned as text.
 *
 *     $format = $this->TranslateFormat();
 *     $format->translate(<msgid>, $status)            plain text
 *     $format->html()->translate(<msgid>, $link)      escaped format, HTML arguments
 *
 * The method is called `translate` so that scripts/extract-translations.mjs,
 * which reads a literal passed to `->translate(`, puts the msgid in
 * language/template.pot. (The examples above name no literal for that reason.)
 */
final class TranslateFormat extends AbstractHelper
{
    /** Escape the format (not the arguments) as HTML: the arguments are markup. */
    private bool $html = false;

    public function __invoke(): self
    {
        return $this;
    }

    /** The same formatter, for a format that goes into HTML around markup arguments. */
    public function html(): self
    {
        $clone = clone $this;
        $clone->html = true;
        return $clone;
    }

    /**
     * The translated format with its arguments in place.
     *
     * @param string|int|float ...$args
     */
    public function translate(string $msgid, ...$args): string
    {
        $translated = (string) $this->getView()->translate($msgid);
        return $this->apply($translated, $msgid, $args);
    }

    /**
     * translatePlural() then format, for "%s record" / "%s records".
     *
     * @param string|int|float ...$args
     */
    public function translatePlural(string $one, string $many, int $count, ...$args): string
    {
        $translated = (string) $this->getView()->translatePlural($one, $many, $count);
        return $this->apply($translated, $count === 1 ? $one : $many, $args);
    }

    /**
     * Format $format, else $fallback, else return $fallback as it stands.
     *
     * @param list<mixed> $args
     */
    public static function format(string $format, string $fallback, array $args): string
    {
        foreach ([$format, $fallback] as $candidate) {
            try {
                return sprintf($candidate, ...$args);
            } catch (\Throwable $e) {
                // ArgumentCountError or ValueError: try the next candidate.
            }
        }
        return $fallback;
    }

    /** @param list<mixed> $args */
    private function apply(string $translated, string $msgid, array $args): string
    {
        if ($this->html) {
            $escape = $this->getView()->plugin('escapeHtml');
            $translated = (string) $escape($translated);
            $msgid = (string) $escape($msgid);
        }
        return self::format($translated, $msgid, $args);
    }
}
