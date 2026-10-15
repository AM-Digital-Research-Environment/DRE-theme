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
 *
 * A PI or mediator whose Person item carries a `fabio:hasURL` (the institutional
 * staff page, synced from MongoDB) brings it along as `staffPage`, so a visitor
 * can reach a current address without first opening the Person record.
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
        // The site's own name ("Collections@UBT"), not "UB Digital Collections".
        'collections.uni-bayreuth.de' => 'Collections@UBT, University of Bayreuth', // @translate
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
            $project = $common + [
                'kind' => 'project',
                'id' => (int) $resource->id(),
                'title' => (string) $resource->displayTitle(),
                'permalink' => $this->permalink($resource),
                'sections' => $this->linkedTitles($resource, 'dcterms:isPartOf'),
                'years' => self::years($this->firstLiteral($resource, 'dcterms:temporal')),
                'records' => $this->projectRecords($resource),
                'contactSource' => $contact['source'],
                'contacts' => $contact['contacts'],
                'pis' => $contact['pis'],
                'researchers' => $contact['researchers'],
            ];
            $translate = $this->getView()->plugin('translate');
            $project['reportMailto'] = $this->mailto(
                $project,
                $translate('[AMIRA] Correction to project %1$s: %2$s'),
                $translate('What should be corrected or improved?')
            );
            $project['requestMailto'] = $this->mailto(
                $project,
                $translate('[AMIRA] Access request: project %1$s: %2$s'),
                $translate('What would you like to access, and for what purpose?')
            );
            return $project;
        }

        $contact = $this->contactFor($projects);

        // Name the holding institution as NOT the contact only when the project
        // team is: with no team and no override the theme does not know who
        // answers, and for an external collection the holder may well be the
        // right address.
        $holders = $contact['source'] === 'team'
            ? array_merge($this->linkedTitles($resource, 'dcterms:provenance', true), $this->linkedTitles($resource, 'marcrel:rps', true))
            : [];

        $record = $common + [
            'kind' => 'record',
            'id' => (int) $resource->id(),
            'title' => (string) $resource->displayTitle(),
            'permalink' => $this->permalink($resource),
            'projects' => array_map(fn ($p) => ['label' => (string) $p->displayTitle(), 'href' => (string) $p->url()], $projects),
            'contactSource' => $contact['source'],
            'contacts' => $contact['contacts'],
            'pis' => $contact['pis'],
            'researchers' => $contact['researchers'],
            'holders' => array_values(array_unique(array_column($holders, 'label'))),
            'links' => $this->links($resource),
            'hasMedia' => $this->hasMedia($resource),
        ];
        $translate = $this->getView()->plugin('translate');
        $record['reportMailto'] = $this->mailto(
            $record,
            $translate('[AMIRA] Correction to record %1$s: %2$s'),
            $translate('What should be corrected or improved?')
        );
        $record['requestMailto'] = $this->mailto(
            $record,
            $translate('[AMIRA] Access request: record %1$s: %2$s'),
            $translate('What would you like to access, and for what purpose?')
        );

        return $record;
    }

    /**
     * A mailto to the DRE mailbox that carries the record's id, title and
     * permalink, so the DRE never has to ask which record was meant: one for an
     * error report (when no form module is active), one for an access request.
     */
    private function mailto(array $access, string $subjectFormat, string $prompt): string
    {
        $translate = $this->getView()->plugin('translate');
        $subject = sprintf($subjectFormat, $access['id'], $access['title']);
        $body = sprintf($translate('Record: %s'), $access['permalink'] ?? '') . "\n\n" . $prompt . "\n\n";

        return 'mailto:' . $access['email']
            . '?subject=' . rawurlencode($subject)
            . '&body=' . rawurlencode($body);
    }

    /** The resource's canonical page, '' when it cannot be built. */
    private function permalink($resource): string
    {
        try {
            return (string) $resource->url(null, true);
        } catch (\Throwable $e) {
            return '';
        }
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
     *
     * Contacts and PIs carry their staff page, when they have one; the
     * researchers, who are not listed on records, do not.
     *  - 'dre': nobody is known, so the DRE mailbox answers.
     *
     * @return array{source:string,contacts:array,pis:array,researchers:array}
     */
    private function contactFor(array $projects): array
    {
        $collect = function (string $term, bool $staffPages = false) use ($projects): array {
            $out = [];
            foreach ($projects as $project) {
                foreach ($this->linkedTitles($project, $term, false, $staffPages) as $person) {
                    $out[$person['label']] = $person;
                }
            }
            return $out;
        };

        $mediators = $collect('dcterms:mediator', true);
        if ($mediators) {
            return ['source' => 'mediator', 'contacts' => array_values($mediators), 'pis' => [], 'researchers' => []];
        }

        $pis = $collect('dcterms:creator', true);
        $researchers = array_diff_key($collect('foaf:member'), $pis);
        if ($pis || $researchers) {
            return ['source' => 'team', 'contacts' => [], 'pis' => array_values($pis), 'researchers' => array_values($researchers)];
        }

        return ['source' => 'dre', 'contacts' => [], 'pis' => [], 'researchers' => []];
    }

    /**
     * Labels (and record links) of a property's values. A linked value shows its
     * title, a URI its label or itself, a literal its text — the rail's rule.
     * With $staffPages, a linked item's staff page rides along as `staffPage`.
     */
    private function linkedTitles($resource, string $term, bool $linksOnly = false, bool $staffPages = false): array
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
                    $entry = ['label' => $label, 'href' => $href];
                    $staffPage = $staffPages && $linked ? $this->staffPage($linked) : '';
                    if ($staffPage !== '') {
                        $entry['staffPage'] = $staffPage;
                    }
                    $out[] = $entry;
                }
            } catch (\Throwable $e) {
                continue;
            }
        }
        return $out;
    }

    /**
     * A person's staff page: the first web address under `fabio:hasURL`, which
     * MongoDB2OmekaS writes from `dev.persons.url`. '' when there is none.
     */
    private function staffPage($person): string
    {
        try {
            $values = $person->value('fabio:hasURL', ['all' => true]) ?: [];
        } catch (\Throwable $e) {
            return '';
        }
        foreach ($values as $value) {
            try {
                $href = 'uri' === (string) $value->type() ? (string) $value->uri() : trim((string) $value);
            } catch (\Throwable $e) {
                continue;
            }
            if (preg_match('~^https?://~i', $href)) {
                return $href;
            }
        }
        return '';
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

    /**
     * Whether a collection's title only restates its project's: most item sets
     * carry the project title, sometimes longer or recased ("Humanities for
     * Humanitarians. An Experiment …"). Compared on the opening 25 letters and
     * digits, so only a corpus with a name of its own ("U-Matic Tapes of the
     * Liberia Broadcasting System") is worth naming.
     */
    public static function sameName(string $a, string $b): bool
    {
        $norm = fn (string $s): string => trim((string) preg_replace('~[^\p{L}\p{N}]+~u', ' ', mb_strtolower($s)));
        $a = $norm($a);
        $b = $norm($b);
        $k = min(25, mb_strlen($a), mb_strlen($b));
        return $k === 0 || mb_substr($a, 0, $k) === mb_substr($b, 0, $k);
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

    /**
     * The project's own records: the items that link to it through
     * `dcterms:isPartOf`, explored in DRE Search with the project facet applied
     * (ProjectCollections). The item set the sync files them in holds the same
     * records and now redirects here, so it is never the link; its title is
     * kept as `collections` when it names the corpus differently from the
     * project (the U-Matic tapes of project 1797). [] when no visible record
     * links to the project: the statement then simply carries no link.
     *
     * @return array{href:string,count:int,collections:list<string>}|array{}
     */
    private function projectRecords($resource): array
    {
        $projects = $this->getView()->plugin('ProjectCollections');
        $count = $projects->recordCount($resource);
        $href = $count > 0 ? $projects->recordsUrl($resource) : '';
        if ($href === '') {
            return [];
        }
        $title = (string) $resource->displayTitle();
        $collections = [];
        foreach ($projects->collectionsOf($resource) as $set) {
            $name = trim((string) $set->displayTitle());
            if ($name !== '' && !self::sameName($name, $title)) {
                $collections[] = $name;
            }
        }
        return ['href' => $href, 'count' => $count, 'collections' => array_values(array_unique($collections))];
    }

    private function hasMedia($resource): bool
    {
        try {
            return method_exists($resource, 'media') && (bool) $resource->media();
        } catch (\Throwable $e) {
            return false;
        }
    }

    /** The access page URL, once looked up: one API query per request, not per call. */
    private ?string $accessPageUrl = null;

    /** The site's "Access & contact" page, when one is published under the slug. */
    private function accessPageUrl(): string
    {
        return $this->accessPageUrl ??= $this->findAccessPageUrl();
    }

    private function findAccessPageUrl(): string
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
