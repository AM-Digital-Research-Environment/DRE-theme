<?php
namespace OmekaTheme\Helper;

use Laminas\View\Helper\AbstractHelper;

/**
 * Group a resource's property values into named, reading-order sets.
 *
 * Omeka hands templates one flat map of properties in DATABASE order, and the
 * theme used to render it as one flat <dl>. On a real record that meant the
 * Abstract — the only thing most readers want — sat below a twelve-link Subject
 * run and above "Description: pages 1-19", while `DRE ID`, `Identifier`,
 * `WissKI URL` and `Format` carried the same visual weight as `Author`.
 *
 * This helper partitions the same map into the sets the record actually has:
 *
 *      Abstract · Description · Subjects · People & roles
 *          · Origins & context · Rights & access · Identifiers & sources
 *          · Further details
 *
 * Intellectual content first at a reading measure; administrative identifiers
 * last. Each group carries a LAYOUT hint the template renders against — prose
 * for the abstract, chips for subjects, label/value rows for the rest.
 *
 * NOTHING IS EVER DROPPED. Any term not in the map below falls through to
 * "Further details" in its original database order, so a site with a different
 * vocabulary (or a new property added upstream) degrades to exactly the old
 * behaviour for the properties the theme has not been taught about, instead of
 * silently hiding them. Groups with no values are omitted.
 *
 * PREFIX RULES. A group may claim a whole vocabulary prefix as well as named
 * terms. This is not a convenience: the DRE's "Research Items" template carries
 * **54 `marcrel:*` contributor roles** (aut, cre, edt, pbl, pht, sng, trl, …),
 * and enumerating them would leave the map one upstream role behind forever —
 * with the missing role landing in "Further details". Since `marcrel:aut` IS the
 * Author, that failure mode is precisely the one this whole exercise exists to
 * fix, only worse. Named terms always win over a prefix rule, so a specific
 * placement can still override the sweep.
 *
 * The map is keyed on the vocabularies the DRE actually uses, verified against
 * resource template 10 ("Research Items", 99 properties: marcrel 54, dcterms 32,
 * dre 6, fabio 4, bibo 2, frapo 1) and the publication templates.
 */
class ResourceGroups extends AbstractHelper
{
    /** Layout hints understood by common/resource-values.phtml. */
    public const LAYOUT_PROSE = 'prose';
    public const LAYOUT_CHIPS = 'chips';
    public const LAYOUT_ROWS  = 'rows';

    /**
     * Ordered group definitions. First match wins, so a term may appear once.
     * `terms` are exact and always beat `prefixes`, which sweep a vocabulary.
     * Titles are translated at call time, not here.
     */
    private const GROUPS = [
        [
            'key' => 'abstract',
            'title' => 'Abstract', // @translate
            'layout' => self::LAYOUT_PROSE,
            'terms' => ['dcterms:abstract', 'bibo:abstract'],
        ],
        [
            'key' => 'description',
            'title' => 'Description', // @translate
            'layout' => self::LAYOUT_PROSE,
            'terms' => ['dcterms:description', 'dcterms:tableOfContents', 'bibo:content'],
        ],
        [
            'key' => 'subjects',
            'title' => 'Subjects', // @translate
            'layout' => self::LAYOUT_CHIPS,
            'terms' => ['dcterms:subject'],
        ],
        [
            // Creators and every other contributor role. Its own group because
            // the Research Items template can express 54 of them: folded into
            // "Origins & context" they would swamp the context rows, and left
            // unmapped the AUTHOR would render last, under "Further details".
            'key' => 'people',
            'title' => 'People & roles', // @translate
            'layout' => self::LAYOUT_ROWS,
            'terms' => [
                // Named first so authorship leads, whatever order the database
                // returns; the prefix sweep then picks up the other 50-odd
                // roles in their own order.
                'marcrel:aut', 'marcrel:cre', 'marcrel:edt', 'marcrel:ctb',
                'dcterms:creator', 'bibo:authorList',
                'dcterms:contributor', 'bibo:editor', 'bibo:editorList',
                'foaf:member',
            ],
            'prefixes' => ['marcrel:'],
        ],
        [
            'key' => 'origins',
            'title' => 'Origins & context', // @translate
            'layout' => self::LAYOUT_ROWS,
            'terms' => [
                'dcterms:title', 'dcterms:alternative',
                'fabio:hasSubtitle', 'fabio:hasTranslatedTitle',
                'dcterms:type', 'dcterms:language', 'dcterms:audience',
                'dcterms:isPartOf', 'frapo:isFundedBy', 'dcterms:publisher',
                'bibo:presentedAt', 'dre:series', 'dre:generatedBy',
                'dcterms:spatial', 'dcterms:provenance', 'dcterms:temporal',
                'dcterms:date', 'dcterms:created', 'dcterms:issued',
                'fabio:hasDateCollected', 'dcterms:dateAccepted',
                'dcterms:available', 'dcterms:valid', 'dcterms:modified',
                'bibo:volume', 'bibo:issue', 'bibo:pages', 'bibo:pageStart',
                'bibo:pageEnd', 'bibo:numPages', 'bibo:status',
                // Record-to-record relations ("Host item", "Constituent",
                // "Preceding item", "Original") describe where a record sits,
                // not how to cite it.
                'dcterms:relation', 'dcterms:hasPart',
                'dcterms:isVersionOf', 'dcterms:hasVersion',
                'dcterms:replaces', 'dcterms:isReplacedBy',
                'dcterms:hasFormat', 'dcterms:isReferencedBy',
            ],
        ],
        [
            'key' => 'rights',
            'title' => 'Rights & access', // @translate
            'layout' => self::LAYOUT_ROWS,
            'terms' => [
                'dcterms:license', 'dcterms:rights', 'dcterms:rightsHolder',
                'dcterms:accessRights', 'dcterms:dateCopyrighted',
                'dre:security', 'dcterms:format', 'dcterms:medium',
                'dcterms:extent',
            ],
        ],
        [
            'key' => 'identifiers',
            'title' => 'Identifiers & sources', // @translate
            'layout' => self::LAYOUT_ROWS,
            'terms' => [
                'dre:id', 'dcterms:identifier', 'bibo:doi',
                'bibo:issn', 'bibo:isbn', 'bibo:isbn10', 'bibo:isbn13',
                'bibo:uri', 'fabio:hasURL', 'dcterms:source',
                'dcterms:bibliographicCitation', 'dcterms:references',
                'dre:wisskiUrl', 'dre:collectionUrl', 'dre:rdspaceHandle',
                'dre:bitstream', 'dre:mongoId',
            ],
        ],
    ];

    /** Group that catches every term the map does not name. */
    private const FALLBACK = [
        'key' => 'other',
        'title' => 'Further details', // @translate
        'layout' => self::LAYOUT_ROWS,
    ];

    /**
     * @param array $values Omeka's `[term => ['property' => …, 'values' => […]]]`.
     * @return array<int, array{key:string,title:string,layout:string,values:array}>
     */
    public function __invoke(array $values): array
    {
        $translate = $this->getView()->plugin('translate');

        // term → group index, built once per call. Exact terms are indexed
        // first, so a named placement always beats a prefix sweep.
        $groupOf = [];
        foreach (self::GROUPS as $i => $group) {
            foreach ($group['terms'] as $term) {
                // First definition wins, so a term listed twice by mistake does
                // not move between releases depending on array order.
                if (!isset($groupOf[$term])) {
                    $groupOf[$term] = $i;
                }
            }
        }

        $buckets = [];
        $fallback = [];

        foreach ($values as $term => $propertyData) {
            $index = $groupOf[$term] ?? $this->groupByPrefix($term);
            if (null !== $index) {
                $buckets[$index][$term] = $propertyData;
            } else {
                $fallback[$term] = $propertyData;
            }
        }

        $out = [];
        foreach (self::GROUPS as $i => $group) {
            if (empty($buckets[$i])) {
                continue;
            }
            // Render the group's NAMED terms in the order the map declares, not
            // the order the database happened to return them in — that ordering
            // is the whole point of grouping. Prefix-matched terms follow, in
            // their original order, since the map says nothing about them.
            $ordered = [];
            foreach ($group['terms'] as $term) {
                if (isset($buckets[$i][$term])) {
                    $ordered[$term] = $buckets[$i][$term];
                }
            }
            foreach ($buckets[$i] as $term => $propertyData) {
                if (!isset($ordered[$term])) {
                    $ordered[$term] = $propertyData;
                }
            }
            $out[] = [
                'key' => $group['key'],
                'title' => $translate($group['title']),
                'layout' => $group['layout'],
                'values' => $ordered,
            ];
        }

        if ($fallback) {
            $out[] = [
                'key' => self::FALLBACK['key'],
                'title' => $translate(self::FALLBACK['title']),
                'layout' => self::FALLBACK['layout'],
                'values' => $fallback,
            ];
        }

        return $out;
    }

    /** Index of the first group claiming this term's vocabulary prefix, or null. */
    private function groupByPrefix(string $term): ?int
    {
        foreach (self::GROUPS as $i => $group) {
            foreach ($group['prefixes'] ?? [] as $prefix) {
                if (0 === strncmp($term, $prefix, strlen($prefix))) {
                    return $i;
                }
            }
        }
        return null;
    }

    /**
     * The group definitions, for the coverage test in `tests/`.
     *
     * Exposed so the test can assert the map against the property list of a
     * REAL resource template rather than re-declaring it — a copy of the map in
     * the test would pass happily while the map itself was wrong.
     */
    public static function groups(): array
    {
        return self::GROUPS;
    }

    /**
     * Which group key a term lands in — `null` meaning the "Further details"
     * fallback. The pure decision, with no view or translator needed, so the
     * coverage test can call it directly.
     */
    public static function groupKeyFor(string $term): ?string
    {
        foreach (self::GROUPS as $group) {
            if (in_array($term, $group['terms'], true)) {
                return $group['key'];
            }
        }
        foreach (self::GROUPS as $group) {
            foreach ($group['prefixes'] ?? [] as $prefix) {
                if (0 === strncmp($term, $prefix, strlen($prefix))) {
                    return $group['key'];
                }
            }
        }
        return null;
    }
}
