<?php
namespace OmekaTheme\Helper;

use Laminas\View\Helper\AbstractHelper;

/**
 * How the theme reads a value, written once.
 *
 * The record helpers (RecordAccess, RecordApparatus, RecordIdentifiers,
 * RecordLinkedData, ProjectCollections) each used to carry their own copy of
 * these rules, and the copies had drifted: only one bare-DOI reader accepted a
 * `doi:` prefix, two URL normalisers disagreed on `www.`, and a linked value
 * was recognised by its type in one place and by its linked resource in
 * another. Casting a linked value to string yields the linked item's URL,
 * which is how the rail once printed `https://…/item/10297` where the licence
 * should read "CC-BY-NC-SA-4.0"; entry() is the one place that knows.
 *
 * Every method is static and degrades to '' / [] / null rather than throwing:
 * one malformed value must not cost the reader the page. The other helpers
 * require this file directly, so it is loaded whether or not anything has
 * asked for the plugin; as a plugin (`$this->ValueReader()`) it returns itself.
 */
class ValueReader extends AbstractHelper
{
    public function __invoke(): self
    {
        return $this;
    }

    /**
     * Every value of a property, [] when there is none or it cannot be read.
     *
     * @param \Omeka\Api\Representation\AbstractResourceEntityRepresentation $resource
     * @param array<string, mixed> $options passed to value(), with `all` set
     * @return list<\Omeka\Api\Representation\ValueRepresentation>
     */
    public static function values($resource, string $term, array $options = []): array
    {
        try {
            $values = $resource->value($term, ['all' => true] + $options) ?: [];
        } catch (\Throwable $e) {
            return [];
        }
        return is_array($values) ? array_values($values) : [];
    }

    /**
     * What a reader sees of a value: a linked value shows its record's title
     * and links to it, a URI its label or else the URI itself, a literal its
     * text. null when there is nothing to show, or, with $linksOnly, when the
     * value links to no record.
     *
     * @param \Omeka\Api\Representation\ValueRepresentation $value
     * @return array{label: string, href: string, resource: \Omeka\Api\Representation\AbstractResourceEntityRepresentation|null}|null
     */
    public static function entry($value, bool $linksOnly = false): ?array
    {
        try {
            $linked = $value->valueResource();
            if ($linked) {
                $label = trim((string) $linked->displayTitle());
                $href = (string) $linked->url();
            } elseif ($linksOnly) {
                return null;
            } elseif ('uri' === (string) $value->type()) {
                $href = (string) $value->uri();
                $label = trim((string) $value) ?: $href;
            } else {
                $label = trim((string) $value);
                $href = '';
            }
        } catch (\Throwable $e) {
            return null;
        }
        return $label === '' ? null : ['label' => $label, 'href' => $href, 'resource' => $linked ?: null];
    }

    /**
     * entry() for every value of a property, without the linked resource.
     *
     * @param \Omeka\Api\Representation\AbstractResourceEntityRepresentation $resource
     * @return list<array{label: string, href: string}>
     */
    public static function entries($resource, string $term, bool $linksOnly = false): array
    {
        $out = [];
        foreach (self::values($resource, $term) as $value) {
            $entry = self::entry($value, $linksOnly);
            if ($entry !== null) {
                $out[] = ['label' => $entry['label'], 'href' => $entry['href']];
            }
        }
        return $out;
    }

    /**
     * The first value of a property as trimmed text, '' when there is none.
     *
     * @param \Omeka\Api\Representation\AbstractResourceEntityRepresentation $resource
     */
    public static function firstLiteral($resource, string $term): string
    {
        try {
            $value = $resource->value($term);
            return $value ? trim((string) $value) : '';
        } catch (\Throwable $e) {
            return '';
        }
    }

    /**
     * The web address a value holds: a URI value's URI, or a literal that is
     * itself an http(s) URL. With $doi, a bare DOI (`10.x/…`, `doi:10.x/…`)
     * becomes its doi.org link. '' otherwise.
     *
     * @param \Omeka\Api\Representation\ValueRepresentation $value
     */
    public static function url($value, bool $doi = false): string
    {
        try {
            $text = trim('uri' === (string) $value->type() ? (string) $value->uri() : (string) $value);
        } catch (\Throwable $e) {
            return '';
        }
        if (self::isHttpUrl($text)) {
            return $text;
        }
        return $doi ? self::doiUrl($text) : '';
    }

    public static function isHttpUrl(string $text): bool
    {
        return (bool) preg_match('~^https?://\S+$~i', $text);
    }

    /** `10.1234/x` or `doi:10.1234/x` → `https://doi.org/10.1234/x`; anything else ''. */
    public static function doiUrl(string $text): string
    {
        $doi = (string) preg_replace('/^doi:\s*/i', '', trim($text));
        return preg_match('~^10\.\d{4,9}/\S+$~', $doi) ? 'https://doi.org/' . $doi : '';
    }

    /**
     * One key per identifier: scheme, case, `www.`, `dx.` and a trailing slash
     * do not make two links different (http://dx.doi.org/10.1/X and
     * https://doi.org/10.1/x are one DOI).
     */
    public static function comparableUrl(string $href): string
    {
        return strtolower((string) preg_replace('~^https?://(?:dx\.|www\.)?~i', '', rtrim(trim($href), '/')));
    }

    /**
     * The key of $hosts that a URL's host is, or is a subdomain of
     * (sws.geonames.org matches geonames.org); `www.` is ignored. null for
     * none.
     *
     * @param array<string, mixed> $hosts keyed by host
     */
    public static function matchHost(string $href, array $hosts): ?string
    {
        $host = self::host($href);
        if ($host === '') {
            return null;
        }
        foreach (array_keys($hosts) as $known) {
            if ($host === $known || str_ends_with($host, '.' . $known)) {
                return (string) $known;
            }
        }
        return null;
    }

    /** A URL's host without `www.`, '' when it has none. */
    public static function host(string $href): string
    {
        return (string) preg_replace('~^www\.~', '', strtolower((string) parse_url($href, PHP_URL_HOST)));
    }
}
