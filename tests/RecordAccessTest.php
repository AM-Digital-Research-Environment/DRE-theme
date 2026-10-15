<?php
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/support/ThemeView.php';
require_once __DIR__ . '/../helper/RecordAccess.php';

use OmekaTheme\Helper\RecordAccess;

$failures = []; $checks = 0;

/** A resource with a class, single-value reads and media, as the helper needs. */
class AccessTestResource extends ThemeTestResource
{
    public ?string $classTerm = null;
    public array $mediaList = [];
    public function resourceClass()
    {
        if ($this->classTerm === null) return null;
        $term = $this->classTerm;
        return new class($term) { public function __construct(private string $t) {} public function term(): string { return $this->t; } };
    }
    public function value(string $term, array $options = [])
    {
        $all = $this->values[$term] ?? [];
        return ($options['all'] ?? false) ? $all : ($all[0] ?? null);
    }
    public function media(): array { return $this->mediaList; }
}

function access_link(AccessTestResource $target): ThemeTestValue { return new ThemeTestValue('', 'resource:item', $target); }

$view = new ThemeTestView();
$helper = $view->helper('RecordAccess');

$pi = new AccessTestResource('Vierke, Ulf', 414);
$section = new AccessTestResource('Arts & Aesthetics', 1670);
$holder = new AccessTestResource('Iwalewahaus Bayreuth', 1100);
$project = new AccessTestResource('Of Art Worlds', 1790);
$project->classTerm = 'foaf:Project';
$project->values = [
    'dcterms:creator' => [access_link($pi)],
    // The PI is listed as a member too, as on the live projects; six others.
    'foaf:member' => array_merge([access_link($pi)], array_map(fn ($n) => access_link(new AccessTestResource('Researcher, ' . $n, 500 + $n)), range(1, 6))),
    'dcterms:isPartOf' => [access_link($section)],
    'dcterms:temporal' => [new ThemeTestValue('2020-01-01/2023-12-31', 'numeric:interval')],
];

$record = new AccessTestResource('Painting <untitled>', 8698);
$record->values = [
    'dcterms:isPartOf' => [access_link($project)],
    'dcterms:provenance' => [access_link($holder), new ThemeTestValue('Germany')],
    'dre:collectionUrl' => [new ThemeTestValue('https://collections.uni-bayreuth.de/de/item/1', 'uri')],
    'fabio:hasURL' => [
        new ThemeTestValue('https://www.example.org/archive', 'uri'),
        new ThemeTestValue('https://collections.uni-bayreuth.de/de/item/1', 'uri'),
    ],
    'bibo:doi' => [new ThemeTestValue('10.1234/abc')],
];
$record->mediaList = [new stdClass()];

// --- Scope -----------------------------------------------------------------
$publication = new AccessTestResource('An article', 5);
$journal = new AccessTestResource('A journal', 6);
$journal->classTerm = 'bibo:Journal';
$publication->values = ['dcterms:isPartOf' => [access_link($journal)]];
dre_check($failures, $checks, 'a record whose isPartOf is not a project gets nothing', $helper($publication) === []);
dre_check($failures, $checks, 'a record with no isPartOf gets nothing', $helper(new AccessTestResource()) === []);

$view->themeSettings['access_notices'] = '0';
dre_check($failures, $checks, 'the theme setting switches every notice off', $helper($record) === [] && $helper($project) === []);
unset($view->themeSettings['access_notices']);

// --- A research record -------------------------------------------------------
$access = $helper($record);
dre_check($failures, $checks, 'a record linked to a project is a research record', ($access['kind'] ?? null) === 'record');
dre_check($failures, $checks, 'the project is named and linked', $access['projects'] === [['label' => 'Of Art Worlds', 'href' => '/s/a/item/1790']]);
dre_check($failures, $checks, 'the contact is the project team: its PI', $access['contactSource'] === 'team' && $access['pis'][0]['label'] === 'Vierke, Ulf');
dre_check($failures, $checks, 'and its researchers, the PI not repeated among them',
    count($access['researchers']) === 6 && !in_array('Vierke, Ulf', array_column($access['researchers'], 'label'), true));
dre_check($failures, $checks, 'only a LINKED holding institution is named as not the contact', $access['holders'] === ['Iwalewahaus Bayreuth']);
dre_check($failures, $checks, 'the default mailbox is the DRE', $access['email'] === RecordAccess::DEFAULT_EMAIL);
dre_check($failures, $checks, 'a record with media is flagged', $access['hasMedia'] === true);
$labels = array_column($access['links'], 'label', 'href');
dre_check($failures, $checks, 'links are named by the system they lead to, duplicates collapsed',
    $labels === [
        'https://collections.uni-bayreuth.de/de/item/1' => 'Collections@UBT, University of Bayreuth',
        'https://doi.org/10.1234/abc' => 'Publisher’s page (DOI)',
        'https://www.example.org/archive' => 'example.org',
    ], json_encode($labels));
dre_check($failures, $checks, 'the report mailto carries the record id and permalink',
    str_starts_with($access['reportMailto'], 'mailto:' . RecordAccess::DEFAULT_EMAIL . '?subject=')
    && str_contains(rawurldecode($access['reportMailto']), 'record 8698: Painting <untitled>')
    && str_contains(rawurldecode($access['reportMailto']), 'https://example.test/s/a/item/8698'));

dre_check($failures, $checks, 'the access-request mailto carries the record id and permalink',
    str_starts_with($access['requestMailto'], 'mailto:' . RecordAccess::DEFAULT_EMAIL . '?subject=')
    && str_contains(rawurldecode($access['requestMailto']), 'Access request: record 8698: Painting <untitled>')
    && str_contains(rawurldecode($access['requestMailto']), 'https://example.test/s/a/item/8698'));
$panel = $view->render('common/record-access', ['resource' => $record, 'access' => $access]);
dre_check($failures, $checks, 'the DRE address in the panel opens the pre-filled access request',
    str_contains($panel, 'href="' . htmlspecialchars($access['requestMailto'], ENT_QUOTES) . '">' . RecordAccess::DEFAULT_EMAIL . '</a>'));
$view->themeSettings['access_contact_email'] = 'not an address';
dre_check($failures, $checks, 'an invalid mailbox setting falls back to the default', $helper($record)['email'] === RecordAccess::DEFAULT_EMAIL);
$view->themeSettings['access_contact_email'] = 'dre@example.test';
dre_check($failures, $checks, 'a configured mailbox is used', $helper($record)['email'] === 'dre@example.test');
unset($view->themeSettings['access_contact_email']);

// --- Staff pages ---------------------------------------------------------------
dre_check($failures, $checks, 'a PI without fabio:hasURL carries no staff page', !isset($helper($record)['pis'][0]['staffPage']));
$staffUrl = 'https://www.eimas.eu/en/members/academic_staff/ulf_vierke/index.html';
$pi->values['fabio:hasURL'] = [new ThemeTestValue('not a web address'), new ThemeTestValue($staffUrl, 'uri')];
$researcher = $project->values['foaf:member'][1]->linked;
$researcher->values['fabio:hasURL'] = [new ThemeTestValue('https://example.org/researcher', 'uri')];
$access = $helper($record);
dre_check($failures, $checks, 'a PI brings the first web address of their fabio:hasURL as the staff page',
    ($access['pis'][0]['staffPage'] ?? null) === $staffUrl && $access['pis'][0]['href'] === '/s/a/item/414');
dre_check($failures, $checks, 'researchers, who are not listed on records, carry no staff page',
    !in_array(true, array_map(fn ($r) => isset($r['staffPage']), $access['researchers']), true));
$panel = $view->render('common/record-access', ['resource' => $record, 'access' => $access]);
dre_check($failures, $checks, 'the panel links the staff page after the PI, named for whose page it is',
    str_contains($panel, '>Vierke, Ulf</a> (<a href="' . $staffUrl . '" aria-label="Staff page of Vierke, Ulf">staff page</a>)'));
$projectPanel = $view->render('common/record-access', ['resource' => $project, 'access' => $helper($project)]);
dre_check($failures, $checks, 'the project panel links the PI staff page too',
    str_contains($projectPanel, '>Vierke, Ulf</a> (<a href="' . $staffUrl . '"'));
unset($pi->values['fabio:hasURL'], $researcher->values['fabio:hasURL']);

// --- Overrides and fallbacks -------------------------------------------------
$archive = new AccessTestResource('International Library of African Music', 37701);
$project->values['dcterms:mediator'] = [access_link($archive)];
$access = $helper($record);
dre_check($failures, $checks, 'dcterms:mediator overrides the PIs', $access['contactSource'] === 'mediator' && $access['contacts'][0]['label'] === 'International Library of African Music');
dre_check($failures, $checks, 'with a mediator the holder is not called "not the contact"', $access['holders'] === []);
unset($project->values['dcterms:mediator']);

$creators = $project->values['dcterms:creator'];
$members = $project->values['foaf:member'];
unset($project->values['dcterms:creator']);
$access = $helper($record);
dre_check($failures, $checks, 'a project with researchers but no PI names its researchers',
    $access['contactSource'] === 'team' && $access['pis'] === [] && count($access['researchers']) === 7);
unset($project->values['foaf:member']);
$access = $helper($record);
dre_check($failures, $checks, 'a project with no team falls back to the DRE', $access['contactSource'] === 'dre' && $access['contacts'] === []);
dre_check($failures, $checks, 'with nobody known, the holder is not called "not the contact"', $access['holders'] === []);
$panel = $view->render('common/record-access', ['resource' => $record, 'access' => $access]);
dre_check($failures, $checks, 'with nobody known, the DRE is who to ask and no "No reply?" row repeats it',
    str_contains($panel, 'The Digital Research Environment (DRE)') && !str_contains($panel, 'No reply?'));
$project->values['dcterms:creator'] = $creators;
$project->values['foaf:member'] = $members;

// --- A project ---------------------------------------------------------------
$access = $helper($project);
dre_check($failures, $checks, 'a foaf:Project item gets the project statement', ($access['kind'] ?? null) === 'project');
dre_check($failures, $checks, 'the statement carries section and years', $access['sections'][0]['label'] === 'Arts & Aesthetics' && $access['years'] === '2020–2023');

// --- The access page is looked up once per request ----------------------------
$lookups = 0;
$view->callbacks['currentSite'] = fn() => new class { public function id() { return 1; } };
$view->callbacks['api'] = function () use (&$lookups) {
    return new class($lookups) {
        public function __construct(private int &$count) {}
        public function searchOne(string $resource, array $query) {
            $this->count++;
            return new class { public function getContent() { return new class { public function siteUrl() { return '/s/a/page/access'; } }; } };
        }
    };
};
$memo = new RecordAccess();
$memo->setView($view);
$first = $memo($record);
$memo($record);
$memo($project);
dre_check($failures, $checks, 'the access page is found and queried once, however many records ask',
    $first['accessPageUrl'] === '/s/a/page/access' && $lookups === 1, "lookups: {$lookups}");
unset($view->callbacks['currentSite'], $view->callbacks['api']);

// --- A project links to its records ------------------------------------------
// Its records are the items whose dcterms:isPartOf names it, searched in DRE
// Search with the project facet; the item set holding them is never the link
// (it redirects to the project), only named when it calls the corpus otherwise.
$queries = [];
$recordCount = 487;
$setTitles = ['U-Matic Tapes of the Liberia Broadcasting System', 'Of Art Worlds – Collecting and Archiving'];
$view->callbacks['currentSite'] = fn() => new class {
    public function id() { return 1; }
    public function url() { return '/s/a'; }
};
$view->callbacks['dreSearchBar'] = fn() => '';
$view->callbacks['api'] = function () use (&$queries, &$recordCount, &$setTitles) {
    return new class($queries, $recordCount, $setTitles) {
        public function __construct(private array &$queries, private int &$count, private array &$titles) {}
        public function searchOne(string $resource, array $query) {
            return new class { public function getContent() { return null; } };
        }
        public function search(string $resource, array $query) {
            $this->queries[] = [$resource, $query];
            $content = [];
            if ($resource === 'item_sets' && ($query['property'][0]['type'] ?? '') === 'res') {
                foreach ($this->titles as $i => $title) {
                    $content[] = new class(6263 + $i, $title) {
                        public function __construct(private int $i, private string $t) {}
                        public function id() { return $this->i; }
                        public function displayTitle() { return $this->t; }
                    };
                }
            }
            $total = $resource === 'items' ? $this->count : count($content);
            return new class($content, $total) {
                public function __construct(private array $c, private int $t) {}
                public function getContent() { return $this->c; }
                public function getTotalResults() { return $this->t; }
            };
        }
    };
};
$project->values['dre:id'] = [new ThemeTestValue('UBT_ELTVTapes2021')];
$recordsHelper = new RecordAccess();
$recordsHelper->setView($view);
$access = $recordsHelper($project);
$countQuery = array_values(array_filter($queries, fn ($q) => $q[0] === 'items'))[0][1] ?? [];
dre_check($failures, $checks, 'a project counts the records that link to it through dcterms:isPartOf, not an item set',
    ($countQuery['property'][0]['property'] ?? null) === 'dcterms:isPartOf' && ($countQuery['property'][0]['type'] ?? null) === 'res'
    && ($countQuery['property'][0]['text'] ?? null) === '1790' && ($access['records']['count'] ?? null) === 487);
dre_check($failures, $checks, 'the records link opens DRE Search on the project facet',
    ($access['records']['href'] ?? '') === '/s/a/dre-search?profile=research_items&f.project_s=Of%20Art%20Worlds');
dre_check($failures, $checks, 'only a collection named differently from its project is named',
    ($access['records']['collections'] ?? null) === ['U-Matic Tapes of the Liberia Broadcasting System']);
$panel = $view->render('common/record-access', ['resource' => $project, 'access' => $access]);
dre_check($failures, $checks, 'the project panel links to its records with their number and names the corpus',
    str_contains($panel, 'href="/s/a/dre-search?profile=research_items&amp;f.project_s=Of%20Art%20Worlds"')
    && str_contains($panel, 'Search its 487 records')
    && str_contains($panel, 'The collection U-Matic Tapes of the Liberia Broadcasting System')
    && !str_contains($panel, 'item-set'));
dre_check($failures, $checks, 'a project page carries no notice under its title',
    $view->render('common/record-notice', ['access' => $access]) === '');
$recordCount = 0;
$access = $recordsHelper($project);
dre_check($failures, $checks, 'a project with no visible record gives no records row', $access['records'] === []
    && !str_contains($view->render('common/record-access', ['resource' => $project, 'access' => $access]), 'Search its'));
unset($project->values['dre:id'], $view->callbacks['currentSite'], $view->callbacks['api'], $view->callbacks['dreSearchBar']);
dre_check($failures, $checks, 'a corpus restating its project is the same name',
    RecordAccess::sameName('Humanities for Humanitarians. An Experiment in the Public Impact', 'Humanities for Humanitarians')
    && RecordAccess::sameName('Mobilities and Socialities: Covid-19 in the Drylands', 'Mobilities and Socialities: COVID-19 in the Drylands of Africa and Beyond')
    && !RecordAccess::sameName('Youth and Informal Labour Migration in West Africa Urban Corridors', 'Mobilities and Flows Across West African Urban Corridors'));

// --- Pure helpers ------------------------------------------------------------
dre_check($failures, $checks, 'an interval reads as a year range', RecordAccess::years('2020-01-01/2023-12-31') === '2020–2023');
dre_check($failures, $checks, 'one year stays one year', RecordAccess::years('2021') === '2021' && RecordAccess::years('2021-03/2021-09') === '2021');
dre_check($failures, $checks, 'no year gives nothing', RecordAccess::years('') === '' && RecordAccess::years('n.d.') === '');
dre_check($failures, $checks, 'an RDSpace handle is named', RecordAccess::linkLabel('https://rdspace.uni-bayreuth.de/handle/1') === 'RDSpace, University of Bayreuth');

// --- Rendering ---------------------------------------------------------------
$access = $helper($record);
$notice = $view->render('common/record-notice', ['access' => $access]);
dre_check($failures, $checks, 'the record notice says plainly what the page is',
    str_contains($notice, 'This page is a catalogue record.') && str_contains($notice, 'copies for reference and may show only part of it')
    && !str_contains($notice, 'holds only this description'));
dre_check($failures, $checks, 'the notice names the project and carries no other link',
    str_contains($notice, '>Of Art Worlds</a>') && substr_count($notice, '<a ') === 1);

$panel = $view->render('common/record-access', ['resource' => $record, 'access' => $access]);
dre_check($failures, $checks, 'the panel names the PI and the holder that is not the contact',
    str_contains($panel, '>Vierke, Ulf</a>') && str_contains($panel, 'Not Iwalewahaus Bayreuth: it keeps the material'));
dre_check($failures, $checks, 'the team is a link to the project page, never a list of names',
    str_contains($panel, 'or the research team of <a href="/s/a/item/1790">Of Art Worlds</a>') && !str_contains($panel, 'Researcher, 1'));
dre_check($failures, $checks, 'without a form module the report is a mailto', str_contains($panel, 'class="record-access__report-link" href="mailto:'));
dre_check($failures, $checks, 'the panel titles are escaped', !str_contains($panel . $notice, '<untitled>'));

$view->callbacks['contactUs'] = fn(array $options) => '<button class="contact-us-button" data-id="' . $options['resource']->id() . '">Send a message</button>';
$panel = $view->render('common/record-access', ['resource' => $record, 'access' => $access]);
dre_check($failures, $checks, 'with ContactUs active the report is its form, for this record',
    str_contains($panel, 'data-id="8698"') && !str_contains($panel, 'record-access__report-link'));
$view->callbacks['contactUs'] = function () { throw new RuntimeException('mail transport missing'); };
$view->callbacks['IntegrationWarning'] = fn() => null;
$panel = $view->render('common/record-access', ['resource' => $record, 'access' => $access]);
dre_check($failures, $checks, 'a failing form module falls back to the mailto', str_contains($panel, 'record-access__report-link'));
unset($view->callbacks['contactUs']);

unset($record->values['dre:collectionUrl'], $record->values['fabio:hasURL'], $record->values['bibo:doi']);
$panel = $view->render('common/record-access', ['resource' => $record, 'access' => $helper($record)]);
dre_check($failures, $checks, 'a record with media but no link points to this page',
    str_contains($panel, 'On this page, possibly in part') && !str_contains($panel, 'None linked') && !str_contains($panel, 'may be restricted'));
$record->mediaList = [];
$access = $helper($record);
$panel = $view->render('common/record-access', ['resource' => $record, 'access' => $access]);
dre_check($failures, $checks, 'a record with neither media nor link says so', str_contains($panel, 'None linked to this record.') && !str_contains($panel, 'On this page'));
dre_check($failures, $checks, 'without media the notice says AMIRA holds only the description',
    str_contains($view->render('common/record-notice', ['access' => $access]), 'AMIRA holds only this description and cannot supply the material itself'));
$record->mediaList = [new stdClass()];

$projectAccess = $helper($project);
$statement = $view->render('common/record-access', ['resource' => $project, 'access' => $projectAccess]);
dre_check($failures, $checks, 'the project panel says whose descriptions these are, who to ask and where to write',
    str_contains($statement, 'Access and contact')
    && str_contains($statement, 'answers for the descriptions')
    && str_contains($statement, '>Vierke, Ulf</a>')
    && str_contains($statement, 'the project’s researchers, listed on this page')
    && str_contains($statement, 'mailto:' . RecordAccess::DEFAULT_EMAIL)
    && str_contains(rawurldecode($projectAccess['requestMailto']), 'Access request: project 1790: Of Art Worlds'));
dre_check($failures, $checks, 'nothing renders for a non-research record', $view->render('common/record-notice', ['access' => []]) === '' && $view->render('common/record-access', ['resource' => $publication, 'access' => []]) === '');

dre_report('RecordAccess', $failures, $checks);
