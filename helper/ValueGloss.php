<?php
namespace OmekaTheme\Helper;
use Laminas\View\Helper\AbstractHelper;

/**
 * The plain-language gloss of a linked vocabulary value, without markup.
 *
 * "Public", "Group" or "No Raw Data" under *Access rights* are terms of the
 * cluster's data policy, and "Public" in particular reads as "downloadable
 * here" — which is the misunderstanding issue #10 is about. Each Access Right
 * authority item carries a `dcterms:description` written for a lay reader
 * ("The description is public; the material may still be restricted."), and
 * the record rail and the metadata show it beside the value.
 *
 * Returns the first public, literal `dcterms:description` of the record the
 * value links to — preferring one in `$lang` when given — or '' when the value
 * is not a link or its record has no description.
 */
class ValueGloss extends AbstractHelper
{
    public function __invoke($value, ?string $lang = null): string
    {
        try {
            $linked = $value->valueResource();
            if (!$linked) {
                return '';
            }
            $descriptions = $linked->value('dcterms:description', ['all' => true]) ?: [];
        } catch (\Throwable $e) {
            return '';
        }

        $first = '';
        foreach ($descriptions as $description) {
            try {
                // A private description is curators' notes, not visitor copy —
                // and an admin viewing the public site would otherwise see it.
                if (method_exists($description, 'isPublic') && !$description->isPublic()) {
                    continue;
                }
                $type = (string) $description->type();
                if ($type === 'uri' || str_contains($type, 'resource')) {
                    continue;
                }
                $text = trim((string) $description);
                if ($text === '') {
                    continue;
                }
                $descriptionLang = method_exists($description, 'lang') ? (string) $description->lang() : '';
                if ($lang === null || $lang === '' || strcasecmp($descriptionLang, $lang) === 0) {
                    return $text;
                }
                if ($first === '') {
                    $first = $text;
                }
            } catch (\Throwable $e) {
                continue;
            }
        }

        return $first;
    }
}
