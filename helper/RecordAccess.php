<?php
namespace OmekaTheme\Helper;
use Laminas\View\Helper\AbstractHelper;

/**
 * Who to ask, and where the material is: access data for a record, no markup.
 *
 * AMIRA is a catalogue. Its research items describe recordings, photographs and
 * artworks that are kept elsewhere — and in October 2026 visitors who missed that
 * wrote to the institutions named under "Current location" asking for copies.
 * Nothing on the page told them otherwise, and the only field that looked like a
 * contact was the holding institution. (Issue #10.)
 *
 * This helper resolves, for the item page:
 *
 *  - a RESEARCH RECORD — an item whose `dcterms:isPartOf` links to a project: the
 *    project(s), who to contact about access, the online copies the record links
 *    to, and whether the holding institution should be named as *not* the contact;
 *  - a PROJECT — an item of class `foaf:Project`: the facts its standard statement
 *    is built from (section, years, contacts).
 *
 * Anything else — publications, podcasts, videos, people, subjects — gets []: they
 * are not research data, and a notice there would say something untrue.
 *
 * Both are detected by resource CLASS, never by template id: the theme pins no
 * Omeka ids, and every research item already links to its project.
 *
 * Contact resolution, per project:
 *
 *      dcterms:mediator  →  the project team (dcterms:creator PIs,
 *                           foaf:member researchers)  →  the DRE mailbox
 *
 * `dcterms:mediator` ("an entity that mediates access to the resource") is the
 * hand-set override for a project whose PI has left, or an external collection
 * whose holder IS the contact. MongoDB2OmekaS does not manage it on projects, so a
 * value set in Omeka survives every sync.
 */
class RecordAccess extends AbstractHelper
{
    public const DEFAULT_EMAIL = 'africamultiple-digital@uni-bayreuth.de';
    public const DEFAULT_PAGE_SLUG = 'access';

    private const PROJECT_CLASS = 'foaf:Project';
    private const LINK_TYPES = ['resource', 'resource:item', 'resource:itemset', 'resource:media'];

    /**
     * Where an online copy can be, in the order a reader should try them, with the
     * name of the system as a visitor would recognise it. A host match wins over the
     * property, so a DSpace permalink filed under `fabio:hasURL` is still named.
     */
    private const LINK_TERMS = ['dre:collectionUrl', 'dre:rdspaceHandle', 'bibo:doi', 'fabio:hasURL'];
    private const HOST_LABELS = [
        'collections.uni-bayreuth.de' => 'UB Digital Collections, University of Bayreuth', // @translate
        'rdspace.uni-bayreuth.de' => 'RDSpace, University of Bayreuth', // @translate
        'doi.org' => 'Publisher’s page (DOI)', // @translate
    ];

    public function __invoke($resource): array
    {
        $view = $this->getView();
        if (!($view->themeSetting('access_notices') ?? true)) {
            return [];
        }

        try {
            $class = $resource->resourceClass();
            $isProject = $class && $class->term() === self::PROJECT_CLASS;
            $projects = $isProject ? [] : $this->projectsOf($resource);
        } catch (\Throwable $e) {
            return [];
        }
        if (!$isProject && !$projects) {
            return [];
        }

        $email = trim((string) ($view->themeSetting('access_contact_email') ?? ''));
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $email = self::DEFAULT_EMAIL;
        }

        $common = [
            'email' => $email,
            'accessPageUrl' => $this->accessPageUrl(),
        ];

        if ($isProject) {
            $contact = $this->contactFor([$resource]);
            return $common + [
                'kind' => 'project',
                'id' => (int) $resource->id(),
                'title' => (string) $resource->displayTitle(),
                'sections' => $this->linkedTitles($resource, 'dcterms:isPartOf'),
                'years' => self::years($this->firstLiteral($resource, 'dcterms:temporal')),
                'contactSource' => $contact['source'],
                'contacts' => $contact['contacts'],
                'pis' => $contact['pis'],
                'researchers' => $contact['researchers'],
            ];
        }

        $contact = $this->contactFor($projects);

        // Name the holding institution as NOT the contact only when the project
        // team is: with no team and no override the theme does not know who
        // answers, and for an external collection the holder may well be the
        // right address.
        $holders = $contact['source'] === 'team'
            ? array_merge($this->linkedTitles($resource, 'dcterms:provenance', true), $this->linkedTitles($resource, 'marcrel:rps', true))
            : [];

        try {
            $permalink = (string) $resource->url(null, true);
        } catch (\Throwable $e) {
            $permalink = '';
        }

        $record = $common + [
            'kind' => 'record',
            'id' => (int) $resource->id(),
            'title' => (string) $resource->displayTitle(),
            'permalink' => $permalink,
            'projects' => array_map(fn ($p) => ['label' => (string) $p->displayTitle(), 'href' => (string) $p->url()], $projects),
            'contactSource' => $contact['source'],
            'contacts' => $contact['contacts'],
            'pis' => $contact['pis'],
            'researchers' => $contact['researchers'],
            'holders' => array_values(array_unique(array_column($holders, 'label'))),
            'links' => $this->links($resource),
            'hasMedia' => $this->hasMedia($resource),
        ];
        $record['reportMailto'] = $this->reportMailto($record);

        return $record;
    }

    /**
     * The mailto that carries an error report when no form module is active: the
     * record's id and permalink travel in the message, so the DRE never has to ask
     * which record was meant.
     */
    private function reportMailto(array $access): string
    {
        $translate = $this->getView()->plugin('translate');
        $subject = sprintf($translate('[AMIRA] Correction to record %1$s: %2$s'), $access['id'], $access['title']);
        $body = sprintf($translate('Record: %s'), $access['permalink'] ?? '') . "\n\n"
            . $translate('What should be corrected or improved?') . "\n\n";

        return 'mailto:' . $access['email']
            . '?subject=' . rawurlencode($subject)
            . '&body=' . rawurlencode($body);
    }

    /** Projects an item belongs to: `dcterms:isPartOf` links of class foaf:Project. */
    private function projectsOf($resource): array
    {
        $projects = [];
        foreach ($resource->value('dcterms:isPartOf', ['all' => true, 'type' => self::LINK_TYPES]) ?: [] as $value) {
            $linked = $value->valueResource();
            $class = $linked ? $linked->resourceClass() : null;
            if ($class && $class->term() === self::PROJECT_CLASS) {
                $projects[(int) $linked->id()] = $linked;
            }
        }
        return array_values($projects);
    }

    /**
     * Who answers access requests for these projects.
     *
     *  - 'mediator': the hand-set `dcterms:mediator` override, in `contacts`;
     *  - 'team': the project team — its PIs (`dcterms:creator`) in `pis` and its
     *    other researchers (`foaf:member`, PIs removed) in `researchers`;
     *  - 'dre': nobody is known, so the DRE mailbox answers.
     *
     * @return array{source:string,contacts:array,pis:array,researchers:array}
     */
    private function contactFor(array $projects): array
    {
        $collect = function (string $term) use ($projects): array {
            $out = [];
            foreach ($projects as $project) {
                foreach ($this->linkedTitles($project, $term) as $person) {
                    $out[$person['label']] = $person;
                }
            }
            return $out;
        };

        $mediators = $collect('dcterms:mediator');
        if ($mediators) {
            return ['source' => 'mediator', 'contacts' => array_values($mediators), 'pis' => [], 'researchers' => []];
        }

        $pis = $collect('dcterms:creator');
        $researchers = array_diff_key($collect('foaf:member'), $pis);
        if ($pis || $researchers) {
            return ['source' => 'team', 'contacts' => [], 'pis' => array_values($pis), 'researchers' => array_values($researchers)];
        }

        return ['source' => 'dre', 'contacts' => [], 'pis' => [], 'researchers' => []];
    }

    /**
     * Labels (and record links) of a property's values. A linked value shows its
     * title, a URI its label or itself, a literal its text — the rail's rule.
     */
    private function linkedTitles($resource, string $term, bool $linksOnly = false): array
    {
        $out = [];
        try {
            $values = $resource->value($term, ['all' => true]) ?: [];
        } catch (\Throwable $e) {
            return [];
        }
        foreach ($values as $value) {
            try {
                $linked = $value->valueResource();
                if ($linked) {
                    $label = trim((string) $linked->displayTitle());
                    $href = (string) $linked->url();
                } elseif ($linksOnly) {
                    continue;
                } elseif ('uri' === (string) $value->type()) {
                    $href = (string) $value->uri();
                    $label = trim((string) $value) ?: $href;
                } else {
                    $label = trim((string) $value);
                    $href = '';
                }
                if ($label !== '') {
                    $out[] = ['label' => $label, 'href' => $href];
                }
            } catch (\Throwable $e) {
                continue;
            }
        }
        return $out;
    }

    /** Online copies, named by the system they lead to. Duplicate URLs collapse. */
    private function links($resource): array
    {
        $translate = $this->getView()->plugin('translate');
        $out = [];
        foreach (self::LINK_TERMS as $term) {
            try {
                $values = $resource->value($term, ['all' => true]) ?: [];
            } catch (\Throwable $e) {
                continue;
            }
            foreach ($values as $value) {
                try {
                    $href = 'uri' === (string) $value->type() ? (string) $value->uri() : trim((string) $value);
                } catch (\Throwable $e) {
                    continue;
                }
                if ($term === 'bibo:doi' && preg_match('~^10\.\d{4,9}/\S+$~', $href)) {
                    $href = 'https://doi.org/' . $href;
                }
                if (!preg_match('~^https?://~i', $href) || isset($out[$href])) {
                    continue;
                }
                $out[$href] = ['label' => $translate(self::linkLabel($href)), 'href' => $href];
            }
        }
        return array_values($out);
    }

    /** The visitor-facing name for a link: a known system, else its host. */
    public static function linkLabel(string $href): string
    {
        $host = strtolower((string) parse_url($href, PHP_URL_HOST));
        $host = preg_replace('~^www\.~', '', $host);
        foreach (self::HOST_LABELS as $known => $label) {
            if ($host === $known || str_ends_with($host, '.' . $known)) {
                return $label;
            }
        }
        return $host !== '' ? $host : $href;
    }

    /** "2020-01-01/2023-12-31" → "2020–2023"; one year → "2020"; else "". */
    public static function years(string $temporal): string
    {
        if (!preg_match_all('~(?<!\d)(\d{4})(?:-\d{2}){0,2}(?!\d)~', $temporal, $m)) {
            return '';
        }
        $first = $m[1][0];
        $last = end($m[1]);
        return $first === $last ? $first : $first . '–' . $last;
    }

    private function firstLiteral($resource, string $term): string
    {
        try {
            $value = $resource->value($term);
            return $value ? trim((string) $value) : '';
        } catch (\Throwable $e) {
            return '';
        }
    }

    private function hasMedia($resource): bool
    {
        try {
            return method_exists($resource, 'media') && (bool) $resource->media();
        } catch (\Throwable $e) {
            return false;
        }
    }

    /** The site's "Access & contact" page, when one is published under the slug. */
    private function accessPageUrl(): string
    {
        $view = $this->getView();
        $slug = trim((string) ($view->themeSetting('access_page_slug') ?? self::DEFAULT_PAGE_SLUG));
        if ($slug === '') {
            return '';
        }
        try {
            $site = $view->currentSite();
            $page = $site ? $view->api()->searchOne('site_pages', ['site_id' => $site->id(), 'slug' => $slug])->getContent() : null;
            return $page ? (string) $page->siteUrl() : '';
        } catch (\Throwable $e) {
            return '';
        }
    }
}
