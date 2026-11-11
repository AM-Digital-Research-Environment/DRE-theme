<?php
// The theme's one implementation of each value rule (helper/ValueReader.php),
// the project predicate (ProjectCollections) and the number formatter
// (FormatNumber), and the helpers that used to carry their own copies.
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/support/ThemeView.php';
require_once __DIR__ . '/../helper/ValueReader.php';
require_once __DIR__ . '/../helper/FormatNumber.php';
require_once __DIR__ . '/../helper/ProjectCollections.php';
require_once __DIR__ . '/../helper/RecordAccess.php';
require_once __DIR__ . '/../helper/RecordLinkedData.php';

use OmekaTheme\Helper\FormatNumber;
use OmekaTheme\Helper\ProjectCollections;
use OmekaTheme\Helper\RecordAccess;
use OmekaTheme\Helper\RecordLinkedData;
use OmekaTheme\Helper\ValueReader;

$failures = []; $checks = 0;

/** A value as Omeka's ValueRepresentation behaves: casting a linked value yields the linked record's URL. */
class ReaderTestValue
{
    public function __construct(public string $text, public string $kind = 'literal', public $linked = null, public string $uriValue = '') {}
    public function type(): string { return $this->kind; }
    public function valueResource() { return $this->linked; }
    public function uri(): string { return $this->uriValue; }
    public function __toString(): string { return $this->linked ? $this->linked->url() : $this->text; }
}
class ReaderTestClass
{
    public function __construct(private string $term) {}
    public function term(): string { return $this->term; }
}
class ReaderTestResource extends ThemeTestResource
{
    public ?string $classTerm = null;
    public function resourceClass() { return $this->classTerm ? new ReaderTestClass($this->classTerm) : null; }
    public function value(string $term, array $options = [])
    {
        $values = $this->values[$term] ?? [];
        if (isset($options['type'])) {
            $values = array_values(array_filter($values, fn($v) => in_array($v->type(), (array) $options['type'], true)));
        }
        return ($options['all'] ?? false) ? $values : ($values[0] ?? null);
    }
}

$licence = new ReaderTestResource('CC-BY-NC-SA-4.0', 10297);

// --- entry(): the one value-to-label rule -------------------------------------
$linked = ValueReader::entry(new ReaderTestValue('', 'resource', $licence));
dre_check($failures, $checks, 'a linked value reads as its record title and links to it, never as the URL its cast yields',
    $linked['label'] === 'CC-BY-NC-SA-4.0' && $linked['href'] === '/s/a/item/10297' && $linked['resource'] === $licence);
// A Custom Vocab item value is linked too, whatever its type says.
$custom = ValueReader::entry(new ReaderTestValue('', 'customvocab:3', $licence));
dre_check($failures, $checks, 'a linked value of another data type is still read through its record', $custom['label'] === 'CC-BY-NC-SA-4.0');
dre_check($failures, $checks, 'a labelled URI shows its label and links to the URI',
    ValueReader::entry(new ReaderTestValue('ORCID', 'uri', null, 'https://orcid.org/1'))['label'] === 'ORCID');
dre_check($failures, $checks, 'an unlabelled URI shows the URI itself',
    ValueReader::entry(new ReaderTestValue('', 'uri', null, 'https://example.org/x'))['label'] === 'https://example.org/x');
dre_check($failures, $checks, 'a literal shows its trimmed text without a link',
    ValueReader::entry(new ReaderTestValue('  Open access ')) === ['label' => 'Open access', 'href' => '', 'resource' => null]);
dre_check($failures, $checks, 'an empty literal is nothing to show', ValueReader::entry(new ReaderTestValue('   ')) === null);
dre_check($failures, $checks, 'links only: a literal is skipped, a linked record kept',
    ValueReader::entry(new ReaderTestValue('Bayreuth'), true) === null
    && ValueReader::entry(new ReaderTestValue('', 'resource', $licence), true) !== null);
$broken = new class { public function valueResource() { throw new RuntimeException('gone'); } };
dre_check($failures, $checks, 'a value that throws is skipped, not fatal', ValueReader::entry($broken) === null);

$record = new ReaderTestResource('Record', 1);
$record->values['dcterms:license'] = [new ReaderTestValue('', 'resource', $licence), new ReaderTestValue('Additional terms'), new ReaderTestValue('')];
dre_check($failures, $checks, 'entries() reads every value, not only the first',
    ValueReader::entries($record, 'dcterms:license') === [['label' => 'CC-BY-NC-SA-4.0', 'href' => '/s/a/item/10297'], ['label' => 'Additional terms', 'href' => '']]);
dre_check($failures, $checks, 'a property that cannot be read gives no values',
    ValueReader::values(new class { public function value() { throw new RuntimeException('private'); } }, 'dcterms:title') === []);
$record->values['dcterms:temporal'] = [new ReaderTestValue(' 2020-01-01/2023-12-31 ')];
dre_check($failures, $checks, 'firstLiteral() is the first value, trimmed', ValueReader::firstLiteral($record, 'dcterms:temporal') === '2020-01-01/2023-12-31');
dre_check($failures, $checks, 'firstLiteral() of a missing property is empty', ValueReader::firstLiteral($record, 'dcterms:nope') === '');

// --- URLs and DOIs -----------------------------------------------------------------
dre_check($failures, $checks, 'a URI value gives its URI', ValueReader::url(new ReaderTestValue('label', 'uri', null, 'https://rdspace.uni-bayreuth.de/handle/1')) === 'https://rdspace.uni-bayreuth.de/handle/1');
dre_check($failures, $checks, 'a literal URL gives itself', ValueReader::url(new ReaderTestValue(' http://example.org/a ')) === 'http://example.org/a');
dre_check($failures, $checks, 'text that is not an http(s) URL gives nothing',
    ValueReader::url(new ReaderTestValue('ftp://x')) === '' && ValueReader::url(new ReaderTestValue('see http://x')) === '');
foreach (['10.1234/abc', 'doi:10.1234/abc', 'DOI: 10.1234/abc'] as $doi) {
    dre_check($failures, $checks, "a bare DOI ($doi) becomes its doi.org link",
        ValueReader::doiUrl($doi) === 'https://doi.org/10.1234/abc' && ValueReader::url(new ReaderTestValue($doi), true) === 'https://doi.org/10.1234/abc');
}
dre_check($failures, $checks, 'a DOI is only read where a DOI is expected', ValueReader::url(new ReaderTestValue('10.1234/abc')) === '');
dre_check($failures, $checks, 'not a DOI', ValueReader::doiUrl('11.1234/abc') === '' && ValueReader::doiUrl('10.12/abc') === '');
dre_check($failures, $checks, 'scheme, case, www., dx. and a trailing slash do not make two links different',
    ValueReader::comparableUrl('http://dx.doi.org/10.1/X/') === ValueReader::comparableUrl('https://doi.org/10.1/x')
    && ValueReader::comparableUrl('https://www.wikidata.org/entity/Q42') === ValueReader::comparableUrl('http://wikidata.org/entity/Q42'));
$hosts = ['geonames.org' => 1, 'doi.org' => 2];
dre_check($failures, $checks, 'a host matches itself, its subdomains and its www. form',
    ValueReader::matchHost('https://sws.geonames.org/1/', $hosts) === 'geonames.org'
    && ValueReader::matchHost('https://www.doi.org/10.1/x', $hosts) === 'doi.org'
    && ValueReader::matchHost('https://notdoi.org/x', $hosts) === null
    && ValueReader::matchHost('not a url', $hosts) === null);

// The two host maps now agree on www.: each names a www. URL as it names the bare host.
dre_check($failures, $checks, 'RecordAccess and RecordLinkedData read hosts the same way',
    RecordAccess::linkLabel('https://www.rdspace.uni-bayreuth.de/handle/1') === 'RDSpace, University of Bayreuth'
    && RecordLinkedData::register('https://www.wikidata.org/entity/Q42') === ['label' => 'Wikidata', 'id' => 'Q42']
    && RecordAccess::linkLabel('https://www.example.org/x') === 'example.org'
    && RecordLinkedData::register('https://www.example.org/x') === ['label' => 'example.org', 'id' => '']);

// --- The project predicate -------------------------------------------------------
$project = new ReaderTestResource('A project', 1797);
$project->classTerm = 'foaf:Project';
$section = new ReaderTestResource('A section', 5);
$section->classTerm = 'dcterms:Collection';
$item = new ReaderTestResource('An item', 9);
$item->values['dcterms:isPartOf'] = [
    new ReaderTestValue('', 'resource', $section),
    new ReaderTestValue('', 'resource:item', $project),
    new ReaderTestValue('', 'resource', $project),
    new ReaderTestValue('Project by name'),
];
dre_check($failures, $checks, 'a project is an item of class foaf:Project', ProjectCollections::isProject($project) && !ProjectCollections::isProject($section) && !ProjectCollections::isProject(null));
dre_check($failures, $checks, 'projectsOf() keeps linked projects once each and skips other links and literals',
    ProjectCollections::projectsOf($item) === [$project]);
$item->values['dcterms:isPartOf'] = [new ReaderTestValue('', 'resource:itemset', $project)];
dre_check($failures, $checks, 'a link to an item set names no project: projects are items', ProjectCollections::projectsOf($item) === []);

// RecordAccess asks the same predicate: a record under a project gets the
// record statement, the project itself the project statement.
$view = new ThemeTestView();
$view->helpers['ProjectCollections'] = new class {
    public function __invoke(): self { return $this; }
    public function recordCount($p): int { return 0; }
    public function recordsUrl($p): string { return ''; }
    public function collectionsOf($p): array { return []; }
};
$item->values['dcterms:isPartOf'] = [new ReaderTestValue('', 'resource', $project)];
$access = new RecordAccess();
$access->setView($view);
dre_check($failures, $checks, 'RecordAccess finds the record\'s project through projectsOf()',
    ($access($item)['kind'] ?? null) === 'record' && $access($item)['projects'] === [['label' => 'A project', 'href' => '/s/a/item/1797']]);
dre_check($failures, $checks, 'RecordAccess recognises the project through isProject()', ($access($project)['kind'] ?? null) === 'project');
dre_check($failures, $checks, 'a record outside every project gets no statement', $access($section) === []);

// --- One number formatter ----------------------------------------------------------
if (class_exists(\NumberFormatter::class)) {
    dre_check($failures, $checks, 'English groups with commas', FormatNumber::format(12345, 'en') === '12,345');
    dre_check($failures, $checks, 'German groups with full stops', FormatNumber::format(12345, 'de_DE') === '12.345');
    dre_check($failures, $checks, 'a POSIX locale (LANG=C) still groups', FormatNumber::format(12345, 'en_US_POSIX') === '12,345');
    $default = \Locale::getDefault();
    \Locale::setDefault('de_DE');
    dre_check($failures, $checks, 'the default locale is the site locale Omeka sets', FormatNumber::format(1234) === '1.234' && (new FormatNumber())('1234') === '1.234');
    \Locale::setDefault($default);
}
dre_check($failures, $checks, 'small numbers are left alone', FormatNumber::format(7, 'en') === '7');

dre_report('ValueReader', $failures, $checks);
