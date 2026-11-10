<?php
namespace OmekaTheme\Helper;
use Laminas\View\Helper\AbstractHelper;

require_once __DIR__ . '/ValueReader.php';
require_once __DIR__ . '/ProjectCollections.php';

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
 *
 * @phpstan-type Link array{label: string, href: string}
 * @phpstan-type Person array{label: string, href: string, staffPage?: string}
 * @phpstan-type Contact array{source: 'mediator'|'team'|'dre', contacts: list<Person>, pis: list<Person>, researchers: list<Person>}
 * @phpstan-type ProjectRecords array{href: string, count: int, collections: list<string>}|array{}
 * @phpstan-type ProjectAccess array{email: string, accessPageUrl: string, kind: 'project', id: int, title: string, permalink: string, sections: list<Person>, years: string, records: ProjectRecords, contactSource: 'mediator'|'team'|'dre', contacts: list<Person>, pis: list<Person>, researchers: list<Person>, reportMailto: string, requestMailto: string}
 * @phpstan-type RecordAccessData array{email: string, accessPageUrl: string, kind: 'record', id: int, title: string, permalink: string, projects: list<Link>, contactSource: 'mediator'|'team'|'dre', contacts: list<Person>, pis: list<Person>, researchers: list<Person>, holders: list<string>, links: list<Link>, hasMedia: bool, reportMailto: string, requestMailto: string}
 */
class RecordAccess extends AbstractHelper
{
    public const DEFAULT_EMAIL = 'africamultiple-digital@uni-bayreuth.de';
    /**
     * The "Access & contact" page of the menu's Access & reuse section
     * (view/common/nav-menu.phtml). The default used to be `access`, a slug no
     * AMIRA page has, so "More about access" never rendered; a site whose saved
     * settings still hold the old default falls through to this one.
     */
    public const DEFAULT_PAGE_SLUG = 'access-contact';
    private const LEGACY_PAGE_SLUG = 'access';

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

    /**
     * @param \Omeka\Api\Representation\AbstractResourceEntityRepresentation $resource
     * @return ProjectAccess|RecordAccessData|array{}
     */
    public function __invoke($resource): array
    {
        $view = $this->getView();
        if (!($view->themeSetting('access_notices') ?? true)) {
            return [];
        }

        $isProject = ProjectCollections::isProject($resource);
        $projects = $isProject ? [] : ProjectCollections::projectsOf($resource);
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
                'years' => self::years(ValueReader::firstLiteral($resource, 'dcterms:temporal')),
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
     *
     * @param array{id: int, title: string, email: string, permalink?: string} $access
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

    /**
     * The resource's canonical page, '' when it cannot be built.
     *
     * @param \Omeka\Api\Representation\AbstractResourceEntityRepresentation $resource
     */
    private function permalink($resource): string
    {
        try {
            return (string) $resource->url(null, true);
        } catch (\Throwable $e) {
            return '';
        }
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
     * @param list<\Omeka\Api\Representation\AbstractResourceEntityRepresentation> $projects
     * @return Contact
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
     *
     * @param \Omeka\Api\Representation\AbstractResourceEntityRepresentation $resource
     * @return list<Person>
     */
    private function linkedTitles($resource, string $term, bool $linksOnly = false, bool $staffPages = false): array
    {
        $out = [];
        foreach (ValueReader::values($resource, $term) as $value) {
            $entry = ValueReader::entry($value, $linksOnly);
            if ($entry === null) {
                continue;
            }
            $person = ['label' => $entry['label'], 'href' => $entry['href']];
            $staffPage = $staffPages && $entry['resource'] ? $this->staffPage($entry['resource']) : '';
            if ($staffPage !== '') {
                $person['staffPage'] = $staffPage;
            }
            $out[] = $person;
        }
        return $out;
    }

    /**
     * A person's staff page: the first web address under `fabio:hasURL`, which
     * MongoDB2OmekaS writes from `dev.persons.url`. '' when there is none.
     *
     * @param \Omeka\Api\Representation\AbstractResourceEntityRepresentation $person
     */
    private function staffPage($person): string
    {
        foreach (ValueReader::values($person, 'fabio:hasURL') as $value) {
            $href = ValueReader::url($value);
            if ($href !== '') {
                return $href;
            }
        }
        return '';
    }

    /**
     * Online copies, named by the system they lead to. Duplicate URLs collapse.
     *
     * @param \Omeka\Api\Representation\AbstractResourceEntityRepresentation $resource
     * @return list<Link>
     */
    private function links($resource): array
    {
        $translate = $this->getView()->plugin('translate');
        $out = [];
        foreach (self::LINK_TERMS as $term) {
            foreach (ValueReader::values($resource, $term) as $value) {
                $href = ValueReader::url($value, $term === 'bibo:doi');
                if ($href === '' || isset($out[$href])) {
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
        $known = ValueReader::matchHost($href, self::HOST_LABELS);
        if ($known !== null) {
            return self::HOST_LABELS[$known];
        }
        $host = ValueReader::host($href);
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

    /**
     * The project's own records: the items that link to it through
     * `dcterms:isPartOf`, explored in DRE Search with the project facet applied
     * (ProjectCollections). The item set the sync files them in holds the same
     * records and now redirects here, so it is never the link; its title is
     * kept as `collections` when it names the corpus differently from the
     * project (the U-Matic tapes of project 1797). [] when no visible record
     * links to the project: the statement then simply carries no link.
     *
     * @param \Omeka\Api\Representation\AbstractResourceEntityRepresentation $resource
     * @return ProjectRecords
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

    /** @param \Omeka\Api\Representation\AbstractResourceEntityRepresentation $resource */
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
        $slugs = $slug === self::LEGACY_PAGE_SLUG ? [$slug, self::DEFAULT_PAGE_SLUG] : [$slug];
        try {
            $site = $view->currentSite();
            if (!$site) {
                return '';
            }
            foreach ($slugs as $candidate) {
                $page = $view->api()->searchOne('site_pages', ['site_id' => $site->id(), 'slug' => $candidate])->getContent();
                if ($page) {
                    return (string) $page->siteUrl();
                }
            }
            return '';
        } catch (\Throwable $e) {
            return '';
        }
    }
}
