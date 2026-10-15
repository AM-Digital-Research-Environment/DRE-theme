<?php
namespace OmekaTheme\Helper;

use Laminas\View\Helper\AbstractHelper;

/**
 * The opening of a long full text, for a record page that loads the rest on
 * request.
 *
 * A thesis's `bibo:content` can run to 900 KB: on item 41980 it was 940 KB of a
 * 1.1 MB page, downloaded and laid out before the record was usable, even by a
 * reader who only wanted the citation or the abstract (issue #14). The record
 * now carries the first PREVIEW_CHARS characters, and "Read the full text"
 * fetches the rest from the record's API representation (asset/js/fulltext.js).
 *
 * Returns:
 *   preview    the opening, cut back to the last whitespace so no word is split
 *   truncated  false when the text is short enough to render whole: a request
 *              is not worth making for less than MIN_HIDDEN_CHARS more
 *   words      the word count of the WHOLE text, locale-formatted, for the
 *              control's label ("about 140,320 words")
 */
class FullTextPreview extends AbstractHelper
{
    public const PREVIEW_CHARS = 2000;
    public const MIN_HIDDEN_CHARS = 1000;

    /** @return array{preview:string, truncated:bool, words:string} */
    public function __invoke(string $text, int $limit = self::PREVIEW_CHARS): array
    {
        $text = mb_scrub($text, 'UTF-8');
        $length = mb_strlen($text, 'UTF-8');
        if ($length <= $limit + self::MIN_HIDDEN_CHARS) {
            return ['preview' => $text, 'truncated' => false, 'words' => ''];
        }

        $preview = mb_substr($text, 0, $limit, 'UTF-8');
        // Back to the last whitespace, unless the opening is one unbroken run
        // (a URL, a table flattened by extraction), where any cut is a cut.
        if (preg_match('/^(.*\S)\s+\S*$/su', $preview, $match)) {
            $preview = $match[1];
        }

        return [
            'preview' => rtrim($preview),
            'truncated' => true,
            'words' => $this->formatCount((int) preg_match_all('/\S+/u', $text)),
        ];
    }

    private function formatCount(int $count): string
    {
        // number_format() is locale-blind; the banner counts do the same.
        if (class_exists(\NumberFormatter::class)) {
            $formatted = (new \NumberFormatter(\Locale::getDefault(), \NumberFormatter::DECIMAL))->format($count);
            if (is_string($formatted)) {
                return $formatted;
            }
        }
        return number_format($count);
    }
}
