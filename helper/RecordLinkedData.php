<?php
namespace OmekaTheme\Helper;
use Laminas\View\Helper\AbstractHelper;

/**
 * A record's Linked Data identity — its permanent URI, its RDF documents and
 * the external records it is the same as — without emitting markup.
 *
 * DRE Linked Data provides `dreLinkedData($resource)`. The module is optional
 * and may lag the theme on a deploy, so this is a guarded lookup, exactly like
 * `dreCitation` in RecordApparatus: without the module (or when it fails, or
 * the record is not public) this returns [] and nothing about the page changes.
 *
 * Shape, every key always present when the result is not []:
 *
 *   uri        the persistent identifier, `{base}/resource/{id}`, which 303s to
 *              the page. The theme shows and copies this as the record's
 *              "Permanent link"; the page URL stays the canonical page.
 *   page       the HTML page on the default site (DRE-LinkedData 0.3.0+), else ''
 *   downloads  [['label', 'type', 'url'], …] in the module's order — Turtle,
 *              N-Triples, JSON-LD, and whatever a later release appends
 *   sameAs     [['label', 'id', 'href'], …] — the owl:sameAs / skos:exactMatch
 *              targets (0.3.0+), labelled by the register they belong to;
 *              [] with 0.2.0, which does not send the key
 */
class RecordLinkedData extends AbstractHelper
{
    /**
     * Registers a visitor recognises by name, keyed by host. A host match also
     * covers its subdomains (sws.geonames.org, www.wikidata.org).
     */
    private const REGISTERS = [
        'wikidata.org' => 'Wikidata',
        'd-nb.info' => 'GND',
        'orcid.org' => 'ORCID',
        'viaf.org' => 'VIAF',
        'id.loc.gov' => 'Library of Congress',
        'geonames.org' => 'GeoNames',
        'doi.org' => 'DOI',
        'ror.org' => 'ROR',
        'isni.org' => 'ISNI',
        'idref.fr' => 'IdRef',
        'openalex.org' => 'OpenAlex',
        'data.bnf.fr' => 'BnF',
        'catalogue.bnf.fr' => 'BnF',
    ];

    public function __invoke($resource): array
    {
        $view = $this->getView();
        try {
            if (!$view->getHelperPluginManager()->has('dreLinkedData')) {
                return [];
            }
            $data = $view->dreLinkedData($resource);
        } catch (\Throwable $e) {
            $view->IntegrationWarning($resource, 'linked data', $e);
            return [];
        }
        if (!is_array($data)) {
            return [];
        }

        $uri = self::httpUrl($data['uri'] ?? null);
        if ($uri === '') {
            return [];
        }

        $downloads = [];
        foreach (is_array($data['downloads'] ?? null) ? $data['downloads'] : [] as $download) {
            $url = self::httpUrl($download['url'] ?? null);
            $label = is_string($download['label'] ?? null) ? trim($download['label']) : '';
            if ($url === '' || $label === '') {
                continue;
            }
            $type = is_string($download['type'] ?? null) ? trim($download['type']) : '';
            $downloads[] = ['label' => $label, 'type' => $type, 'url' => $url];
        }

        $sameAs = [];
        foreach (is_array($data['sameAs'] ?? null) ? $data['sameAs'] : [] as $iri) {
            $href = self::httpUrl($iri);
            if ($href !== '' && !isset($sameAs[$href])) {
                $sameAs[$href] = self::register($href) + ['href' => $href];
            }
        }

        return [
            'uri' => $uri,
            'page' => self::httpUrl($data['page'] ?? null),
            'downloads' => $downloads,
            'sameAs' => array_values($sameAs),
        ];
    }

    /**
     * The apparatus rows for the RDF documents and the external identities, in
     * the shape common/record-apparatus-rows.phtml renders. The permanent link
     * row is the caller's, since its fallback differs by page.
     *
     * @param string[] $skip hrefs already shown elsewhere on the panel (a DOI row)
     * @param string|null $formatsLabel the label of the formats row, when the
     *   panel around it is already headed "Linked data"
     */
    public function rows(array $linked, array $skip = [], ?string $formatsLabel = null): array
    {
        if (!$linked) {
            return [];
        }
        $translate = $this->getView()->plugin('translate');
        $skip = array_map(fn ($href) => self::comparable((string) $href), $skip);

        $rows = [];
        if ($linked['downloads']) {
            $rows[] = [
                'label' => $formatsLabel ?? $translate('Linked data'),
                'layout' => 'inline',
                'values' => array_map(fn (array $d) => ['label' => $d['label'], 'href' => $d['url'], 'type' => $d['type']], $linked['downloads']),
            ];
        }
        $sameAs = array_values(array_filter($linked['sameAs'], fn (array $s) => !in_array(self::comparable($s['href']), $skip, true)));
        if ($sameAs) {
            $rows[] = [
                'label' => $translate('Same as'),
                'layout' => 'inline',
                'values' => array_map(fn (array $s) => ['label' => $s['label'], 'href' => $s['href'], 'detail' => $s['id'], 'icon' => $s['id'] !== '' ? $s['label'] : ''], $sameAs),
            ];
        }

        return $rows;
    }

    /**
     * The register an external IRI belongs to, and its identifier there:
     * `http://www.wikidata.org/entity/Q42` → ['label' => 'Wikidata', 'id' => 'Q42'].
     * An unknown host is named by itself, with no separate identifier.
     */
    public static function register(string $href): array
    {
        $host = strtolower((string) parse_url($href, PHP_URL_HOST));
        $host = (string) preg_replace('~^www\.~', '', $host);
        $path = trim((string) parse_url($href, PHP_URL_PATH), '/');

        foreach (self::REGISTERS as $known => $label) {
            if ($host === $known || str_ends_with($host, '.' . $known)) {
                // A DOI is its whole path; elsewhere the identifier is the last
                // segment (…/entity/Q42, …/gnd/118540238, …/2950159/).
                if ($known === 'doi.org') {
                    $id = rawurldecode($path);
                } else {
                    $segments = explode('/', $path);
                    $id = rawurldecode((string) end($segments));
                    // GeoNames' RDF IRI ends in about.rdf: the id is before it.
                    if (preg_match('~\.(?:rdf|html)$~', $id) && count($segments) > 1) {
                        $id = rawurldecode($segments[count($segments) - 2]);
                    }
                }
                return ['label' => $label, 'id' => $id];
            }
        }

        return ['label' => $host !== '' ? $host : $href, 'id' => ''];
    }

    private static function httpUrl($value): string
    {
        if (!is_string($value)) {
            return '';
        }
        $value = trim($value);
        return preg_match('~^https?://\S+$~i', $value) ? $value : '';
    }

    /** http/https and case do not make two identifiers different. */
    private static function comparable(string $href): string
    {
        return strtolower((string) preg_replace('~^https?://(?:dx\.)?~i', '', rtrim($href, '/')));
    }
}
