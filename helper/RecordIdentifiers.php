<?php
namespace OmekaTheme\Helper;
use Laminas\View\Helper\AbstractHelper;

/**
 * The records a resource is reconciled with in other registers — its ORCID,
 * Wikidata, GND and Library of Congress identifiers, and a publication's DOI —
 * without emitting markup, plus the register's logo for whoever renders them.
 *
 * MongoDB2OmekaS writes each reconciliation as a `dcterms:identifier` URI value
 * (https://orcid.org/…, http://www.wikidata.org/entity/Q…, https://d-nb.info/gnd/…,
 * http://id.loc.gov/authorities/subjects/…) and a DOI as `bibo:doi`. Literal
 * identifiers (an EPrints id, a shelf mark) are not links to another register
 * and are left to the grouped record; so is a URI on a host no reader would
 * recognise by name.
 *
 * Shape: [['label' => 'ORCID', 'id' => '0000-0002-1825-0097', 'href' => …], …],
 * DOI first (a publication's primary identifier), then ORCID, Wikidata, GND,
 * Library of Congress, then any other register RecordLinkedData names.
 */
class RecordIdentifiers extends AbstractHelper
{
    private const ORDER = ['DOI', 'ORCID', 'Wikidata', 'GND', 'Library of Congress'];

    /**
     * Each register's official mark, from its own published artwork (Wikimedia
     * Commons): the ORCID iD, the Wikidata barcode, the GND hexagon ("Wabe"),
     * the DOI disc and the Library of Congress favicon. Brand colours are part
     * of the mark, so they stay literal here; a modifier class widens the two
     * that are not square (_metadata.scss). The mark is decoration —
     * the register's name always travels as text beside it.
     */
    private const ICONS = [
        'ORCID' => '<svg class="identifier-icon" viewBox="0 0 256 256" aria-hidden="true" focusable="false"><path fill="#A6CE39" d="M256 128c0 70.7-57.3 128-128 128S0 198.7 0 128 57.3 0 128 0s128 57.3 128 128z"/><path fill="#fff" d="M86.3 186.2H70.9V79.1h15.4v107.1zM108.9 79.1h41.6c39.6 0 57 28.3 57 53.6 0 27.5-21.5 53.6-56.8 53.6h-41.8V79.1zm15.4 93.3h24.5c34.9 0 42.9-26.5 42.9-39.7 0-21.5-13.7-39.7-43.7-39.7h-23.7v79.4zM88.7 56.8c0 5.5-4.5 10.1-10.1 10.1s-10.1-4.6-10.1-10.1c0-5.6 4.5-10.1 10.1-10.1s10.1 4.6 10.1 10.1z"/></svg>',
        'Wikidata' => '<svg class="identifier-icon identifier-icon--wikidata" viewBox="120 45 810 500" aria-hidden="true" focusable="false"><path fill="#990000" d="M120 545h30V45h-30zm60 0h90V45h-90zM300 45v500h90V45z"/><path fill="#339966" d="M840 545h30V45h-30zM900 45v500h30V45zM420 545h30V45h-30zM480 45v500h30V45z"/><path fill="#006699" d="M540 545h90V45h-90zm120 0h30V45h-30zM720 45v500h90V45z"/></svg>',
        'GND' => '<svg class="identifier-icon identifier-icon--gnd" viewBox="0 0 120.29 138.9" aria-hidden="true" focusable="false"><path fill="#006ab3" d="M120.29 34.72v69.45L60.14 138.9 0 104.17V34.72L60.14 0Z"/><path fill="#fff" d="M45.33 50.41H54l7.65 14c.73 1.37 1.36 2.57 1.9 3.62l1.22 2.4c.29.56 1 2 2.13 4.29l0 .1-.4-24.43H75V88.49H66.32l-6.6-12c-.83-1.47-1.51-2.68-2-3.61s-1-1.78-1.35-2.54S55.58 68.79 55.2 68s-.94-1.93-1.68-3.48l.25 23.95H45.33Zm-6.74 7.71V50.41h-13a31.6 31.6 0 0 0-4 .35 14.65 14.65 0 0 0-4.32 1.43 12.92 12.92 0 0 0-4.33 3.64 17.44 17.44 0 0 0-3.1 6.61A29.19 29.19 0 0 0 9 69.77a26.89 26.89 0 0 0 1.15 8A15.39 15.39 0 0 0 13.69 84 12.19 12.19 0 0 0 17 86.5a15.7 15.7 0 0 0 3.71 1.32 23.92 23.92 0 0 0 3.49.51c1.08.07 2.35.12 3.82.16H38.59V67.88H30.25V80.45H26.92a15.52 15.52 0 0 1-4.65-.59A6.38 6.38 0 0 1 19 77.05a9.83 9.83 0 0 1-1.39-3.45 22.82 22.82 0 0 1-.35-4.2 16.58 16.58 0 0 1 1-6.21 7.53 7.53 0 0 1 2.49-3.4 7.72 7.72 0 0 1 3.16-1.37 24.69 24.69 0 0 1 3.89-.35h2.54ZM103.08 69.5a22.82 22.82 0 0 0-.35-4.2 9.88 9.88 0 0 0-1.39-3.46A6.42 6.42 0 0 0 98 59a15.38 15.38 0 0 0-4.64-.6H90V80.83h2.53a24.83 24.83 0 0 0 3.9-.35 7.88 7.88 0 0 0 3.16-1.38 7.5 7.5 0 0 0 2.49-3.39 16.58 16.58 0 0 0 1-6.21m8.25-.37a29.25 29.25 0 0 1-.84 7.33 17.44 17.44 0 0 1-3.1 6.61 12.92 12.92 0 0 1-4.33 3.64 15 15 0 0 1-4.32 1.43 31.6 31.6 0 0 1-4 .35h-13V50.41H92.25c1.47 0 2.74.09 3.82.16a23.92 23.92 0 0 1 3.49.51 15.7 15.7 0 0 1 3.71 1.32 12.51 12.51 0 0 1 3.33 2.48 15.49 15.49 0 0 1 3.58 6.26 26.84 26.84 0 0 1 1.15 8"/></svg>',
        'DOI' => '<svg class="identifier-icon" viewBox="0 0 130 130" aria-hidden="true" focusable="false"><circle fill="#fcb425" cx="65" cy="65" r="64"/><path fill="#231f20" d="M49.82 84.56H37.97v-4.83c-1.2 1.51-4.04 3.05-5.27 3.74-2.15 1.2-5.07 1.99-7.81 1.99-4.43 0-8.37-1.4-11.83-4.45-4.12-3.64-6.06-9.2-6.06-15.19 0-6.09 2.11-10.96 6.34-14.6 3.35-2.89 7.46-5.21 11.81-5.21 2.54 0 5.66.23 7.89 1.3 1.28.61 3.57 2.06 4.93 3.47V19.36h11.85zm-12.12-18.7c0-2.25-.62-4.95-2.21-6.51-1.59-1.59-4.47-3-6.73-3-2.51 0-4.83 1.83-6.45 3.72-1.31 1.54-1.96 3.91-1.96 5.88s.74 4.17 2.05 5.7c1.59 1.9 3.3 3.19 5.83 3.19 2.28 0 4.99-.96 6.55-2.52 1.59-1.56 2.91-4.19 2.91-6.46z"/><path fill="#fff" d="M105.43 25.62c-1.97 0-3.65.69-5.03 2.07-1.36 1.36-2.04 3.02-2.04 4.99s.68 3.65 2.04 5.03c1.38 1.38 3.06 2.07 5.03 2.07 2 0 3.67-.68 5.03-2.04 1.38-1.38 2.07-3.07 2.07-5.07 0-1.97-.69-3.64-2.07-4.99-1.38-1.38-3.06-2.07-5.03-2.07zM74.22 45.51c-7.32 0-12.97 2.28-16.94 6.85-3.28 3.78-4.92 8.12-4.92 13.01 0 5.43 1.63 10.01 4.88 13.74 3.94 4.54 9.48 6.81 16.59 6.81s12.61-2.27 16.56-6.81c3.25-3.73 4.88-8.2 4.88-13.41 0-5.16-1.64-9.6-4.92-13.33-4.02-4.57-9.4-6.85-16.13-6.85zm24.91 1.39v37.63h12.6V46.9zM73.84 56.98c2.3 0 4.26.85 5.88 2.55 1.64 1.68 2.46 3.73 2.46 6.16 0 2.46-.81 4.54-2.42 6.24-1.61 1.68-3.59 2.51-5.92 2.51-2.61 0-4.74-1.03-6.38-3.08-1.33-1.65-2-3.54-2-5.67 0-2.11.67-3.99 2-5.63 1.64-2.05 3.76-3.08 6.38-3.08z"/></svg>',
        'Library of Congress' => '<svg class="identifier-icon" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path fill="#f05129" d="M0 0h64v64H0z"/><path fill="#fff" d="M1.71 4.05q4.74.015 9.48 0c.03 15.68.04 31.36.07 47.04 2.01-.01 4.01.01 6.02 0-.03 2.95-.06 5.9-.07 8.85H1.71zM24.22 4.29c3.98-1.05 8.75-1.22 12.27 1.23 3.21 2.4 3.66 6.73 3.63 10.44-.06 11.36.04 22.72-.04 34.08.01 3.58-1.35 7.51-4.68 9.29-3.45 1.71-7.65 1.63-11.28.51-4.01-1.38-5.81-5.81-5.75-9.77-.02-12.06-.07-24.13.02-36.2-.03-3.92 1.8-8.33 5.83-9.58m4.14 8.35c-.51 11.41-.01 22.89-.24 34.32.18 2-.72 4.9 1.98 5.48.34-13.63.4-27.32-.03-40.95-.43.29-1.29.86-1.71 1.15M45.93 4.88c3.37-1.66 7.42-1.57 11.01-.72 3.07.76 5.24 3.71 5.42 6.82.39 5.51.03 11.03.15 16.54-3.09-.01-6.17 0-9.25 0-.14-5.24.28-10.51-.2-15.73-2.26-1.44-1.47 2.09-1.78 3.16.04 11.36.04 22.71-.01 34.07.03 1.46-.04 3.35 1.83 3.83.29-6.11.1-12.23.16-18.34 3.08.01 6.16 0 9.24.01-.08 5.82.18 11.65-.08 17.47-.03 3.79-2.64 7.55-6.48 8.26-3.39.62-7.14.62-10.25-1.02-3.23-1.82-4.11-5.79-4.08-9.22-.01-11.99-.02-23.98 0-35.97-.03-3.47 1.03-7.41 4.32-9.16"/></svg>',
    ];

    /** A register RecordLinkedData names but has no mark here: a plain link glyph. */
    private const GENERIC_ICON = '<svg class="identifier-icon identifier-icon--generic" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';

    /**
     * Without a resource the helper itself, so a template can reach icon():
     * `$this->plugin('RecordIdentifiers')->icon('ORCID')`.
     *
     * @return array<int, array{label: string, id: string, href: string}>|self
     */
    public function __invoke($resource = null)
    {
        if ($resource === null) {
            return $this;
        }

        $found = [];
        foreach (['bibo:doi', 'dcterms:identifier'] as $term) {
            try {
                $values = $resource->value($term, ['all' => true]) ?: [];
            } catch (\Throwable $e) {
                continue;
            }
            foreach ($values as $value) {
                try {
                    $href = self::href($value, $term === 'bibo:doi');
                } catch (\Throwable $e) {
                    continue;
                }
                if ($href === '') {
                    continue;
                }
                $register = $this->register($href);
                // An unknown host comes back named by itself, with no id.
                if ($register['id'] === '') {
                    continue;
                }
                $key = strtolower((string) preg_replace('~^https?://(?:dx\.|www\.)?~i', '', rtrim($href, '/')));
                $found[$key] ??= $register + ['href' => $href];
            }
        }

        $rank = array_flip(self::ORDER);
        $found = array_values($found);
        usort($found, fn (array $a, array $b) => ($rank[$a['label']] ?? count($rank)) <=> ($rank[$b['label']] ?? count($rank)));

        return $found;
    }

    /** The register's mark as inline SVG, decorative; '' for no register. */
    public function icon(string $label): string
    {
        if ($label === '') {
            return '';
        }
        return self::ICONS[$label] ?? self::GENERIC_ICON;
    }

    /** The mark for an identifier's URI; '' when no known register issues it. */
    public function markFor(string $href): string
    {
        $register = $this->register($href);
        return $register['id'] !== '' ? $this->icon($register['label']) : '';
    }

    /**
     * RecordLinkedData::register(), loaded first. Omeka builds a theme helper
     * through a factory that require_once's its file on first use; theme helper
     * classes are not autoloaded, so the class exists only once something has
     * asked for the plugin.
     */
    private function register(string $href): array
    {
        $this->getView()->plugin('RecordLinkedData');
        return RecordLinkedData::register($href);
    }

    /** True when the register has its own mark rather than the generic glyph. */
    public static function hasMark(string $label): bool
    {
        return isset(self::ICONS[$label]);
    }

    /**
     * The http(s) link a value points at: a URI value's URI, a literal that is
     * itself a URL, or — for bibo:doi only — a bare `10.x/…` DOI.
     */
    private static function href($value, bool $isDoi): string
    {
        $text = 'uri' === (string) $value->type() ? (string) $value->uri() : trim((string) $value);
        $text = trim($text);
        if (preg_match('~^https?://\S+$~i', $text)) {
            return $text;
        }
        if ($isDoi) {
            $doi = (string) preg_replace('/^doi:\s*/i', '', $text);
            if (preg_match('~^10\.\d{4,9}/\S+$~', $doi)) {
                return 'https://doi.org/' . $doi;
            }
        }
        return '';
    }
}
