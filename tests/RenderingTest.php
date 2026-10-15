<?php
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/support/ThemeView.php';
$failures = []; $checks = 0;
$view = new ThemeTestView();
$view->callbacks['ResourceTags'] = fn() => '';
$resource = new ThemeTestResource('<Record>');
$attachment = new class($resource) {
    public function __construct(public $record) {}
    public function item() { return $this->record; }
    public function media() { return null; }
    public function caption(): string { return '<p>Curated caption</p>'; }
};
foreach (['file', 'item-showcase'] as $block) {
    foreach (['file_name', 'item_title', 'none'] as $option) {
        $view->showTitleOption = $option;
        $html = $view->render('common/block-layout/' . $block, ['attachments' => [$attachment], 'showTitleOption' => $option]);
        $doc = new DOMDocument(); @$doc->loadHTML($html);
        $xpath = new DOMXPath($doc);
        dre_check($failures, $checks, "$block renders a no-media item ($option)", $xpath->query('//div[contains(@class,"caption")]')->length === 1);
        dre_check($failures, $checks, "$block balances its wrappers ($option)", substr_count($html, '<div') === substr_count($html, '</div>'));
    }
    $attachment->record = null;
    $html = $view->render('common/block-layout/' . $block, ['attachments' => [$attachment], 'showTitleOption' => 'file_name']);
    dre_check($failures, $checks, "$block skips removed attachments cleanly", !str_contains($html, 'Curated caption'));
    $attachment->record = $resource;
}

$resource->values = [
    'dcterms:bibliographicCitation' => [new ThemeTestValue('<script>citation</script>')],
    'dcterms:license' => [new ThemeTestValue('', 'resource', new ThemeTestResource('CC BY', 2)), new ThemeTestValue('Additional terms')],
    'bibo:doi' => [new ThemeTestValue('10.1234/example')],
];
$html = $view->render('common/record-apparatus', ['resource' => $resource]);
dre_check($failures, $checks, 'curated citation is escaped in actual output', str_contains($html, '&lt;script&gt;citation&lt;/script&gt;'));
dre_check($failures, $checks, 'all license values render with readable linked titles', str_contains($html, 'CC BY') && str_contains($html, 'Additional terms') && str_contains($html, '/item/2'));
dre_check($failures, $checks, 'DOI and canonical permalink are usable links', str_contains($html, 'href="https://doi.org/10.1234/example"') && str_contains($html, 'href="https://example.test/s/a/item/1"'));
$view->callbacks['dreCitation'] = fn() => ['styles' => ['apa' => ['label' => 'APA', 'html' => '<em>Generated</em>']], 'defaultStyle' => 'apa', 'citable' => false];
$html = $view->render('common/record-apparatus', ['resource' => $resource]);
dre_check($failures, $checks, 'authority uses honest labels', str_contains($html, 'This record') && str_contains($html, 'Copy link'));
dre_check($failures, $checks, 'one style has no tablist or dangling tab reference', !str_contains($html, 'role="tab') && !str_contains($html, 'aria-labelledby="record-cite-1-tab-'));
// DRE-SEO 0.11+: an authority record cited as a database entry is offered as a citation.
$view->callbacks['dreCitation'] = fn() => ['styles' => ['chicago' => ['label' => 'Chicago', 'html' => '“Aas, Norbert.” Person record. AMIRA.']], 'defaultStyle' => 'chicago', 'citable' => false, 'citeAs' => 'entry'];
$html = $view->render('common/record-apparatus', ['resource' => $resource]);
dre_check($failures, $checks, 'an entry citation is offered as a citation', str_contains($html, 'Cite this record') && str_contains($html, 'Copy citation') && !str_contains($html, 'Copy link'));
dre_check($failures, $checks, 'the entry copy fallback is the citation text', str_contains($html, 'data-copy-text="“Aas, Norbert.” Person record. AMIRA."') || str_contains(html_entity_decode($html, ENT_QUOTES | ENT_HTML5, 'UTF-8'), 'data-copy-text="“Aas, Norbert.” Person record. AMIRA."'));
$view->callbacks['dreCitation'] = fn() => ['styles' => ['apa' => ['label' => 'APA', 'html' => '<em>Generated</em>']], 'defaultStyle' => 'apa', 'citable' => false];
// "Save record" joins "Copy link" in the apparatus's one action row.
$save = $view->render('common/shortlist-button', ['resource' => $resource, 'detail' => true, 'placement' => 'rail']);
$doc = new DOMDocument(); @$doc->loadHTML($view->render('common/record-apparatus', ['resource' => $resource, 'saveButton' => $save]));
$actions = (new DOMXPath($doc))->query('//div[@class="record-apparatus__actions"]/button');
dre_check($failures, $checks, 'the apparatus action row holds Copy link and the rail Save button',
    $actions->length === 2 && str_contains($actions->item(0)->getAttribute('class'), 'record-apparatus__copy')
    && $actions->item(1)->getAttribute('class') === 'shortlist-save shortlist-save--rail');
dre_check($failures, $checks, 'each apparatus action starts hidden for its own script to reveal',
    $actions->item(0)->hasAttribute('hidden') && $actions->item(1)->hasAttribute('hidden'));
dre_check($failures, $checks, 'an unknown Save placement adds no modifier class',
    str_contains($view->render('common/shortlist-button', ['resource' => $resource, 'placement' => 'x" onclick="y']), 'class="shortlist-save" hidden'));
$view->callbacks['dreCitation'] = function () { throw new RuntimeException('module unavailable'); };
dre_check($failures, $checks, 'module failures retain curated citation', str_contains($view->render('common/record-apparatus', ['resource' => $resource]), '&lt;script&gt;citation'));
unset($view->callbacks['dreCitation']);

// --- DRE Linked Data (issue #11) ---------------------------------------------
// The module is optional: absent, older (0.2.0: uri + downloads), current
// (0.3.0: + page, sameAs), empty for a non-public record, or failing.
$rdfRow = fn(DOMXPath $xp, string $label) => $xp->query('//div[contains(@class,"record-apparatus__row")][dt[normalize-space(.)="' . $label . '"]]/dd')->item(0);
$apparatusDom = function () use ($view, $resource): array {
    $html = $view->render('common/record-apparatus', ['resource' => $resource]);
    $doc = new DOMDocument(); @$doc->loadHTML('<?xml encoding="utf-8"?>' . $html);
    return [$html, new DOMXPath($doc)];
};

[$html, $xp] = $apparatusDom();
dre_check($failures, $checks, 'without the module the permanent link is the page URL',
    ($rdfRow($xp, 'Permanent link')?->getElementsByTagName('a')->item(0)?->getAttribute('href')) === 'https://example.test/s/a/item/1');
dre_check($failures, $checks, 'without the module there is no linked-data or same-as row',
    !$rdfRow($xp, 'Linked data') && !$rdfRow($xp, 'Same as') && !str_contains($html, 'type="text/turtle"'));
dre_check($failures, $checks, 'the permanent link has its own copy button, hidden until record.js reveals it',
    $xp->query('//button[@data-copy-exact][@data-copy-text="https://example.test/s/a/item/1"][@hidden]')->length === 1);

$base = 'https://data.example.test/resource/1';
$downloads020 = [
    ['label' => 'Turtle', 'type' => 'text/turtle', 'url' => $base . '.ttl'],
    ['label' => 'N-Triples', 'type' => 'application/n-triples', 'url' => $base . '.nt'],
    ['label' => 'JSON-LD', 'type' => 'application/ld+json', 'url' => $base . '.jsonld'],
];
$view->callbacks['dreLinkedData'] = fn() => ['uri' => $base, 'downloads' => $downloads020];
[$html, $xp] = $apparatusDom();
$permanent = $rdfRow($xp, 'Permanent link');
dre_check($failures, $checks, 'with the module (0.2.0) the permanent link is the persistent URI',
    $permanent?->getElementsByTagName('a')->item(0)?->getAttribute('href') === $base
    && !str_contains($permanent?->textContent ?? '', '/s/a/item/1'));
dre_check($failures, $checks, 'the copy fallback and the row button carry the URI, not the page URL',
    str_contains($html, 'data-copy-text="&lt;script&gt;citation&lt;/script&gt;"')
    && $xp->query('//button[@data-copy-exact][@data-copy-text="' . $base . '"]')->length === 1);
dre_check($failures, $checks, 'the shortlist still stores the page URL',
    $xp->query('//section[@data-shortlist-record-url="https://example.test/s/a/item/1"]')->length === 1);
$links = $rdfRow($xp, 'Linked data')?->getElementsByTagName('a');
dre_check($failures, $checks, 'the RDF documents are listed in order, followable, typed and without download',
    $links && $links->length === 3
    && $links->item(0)->textContent === 'Turtle' && $links->item(0)->getAttribute('type') === 'text/turtle'
    && $links->item(2)->getAttribute('href') === $base . '.jsonld'
    && !$links->item(0)->hasAttribute('download') && !$links->item(1)->hasAttribute('download') && !$links->item(2)->hasAttribute('download'));
dre_check($failures, $checks, '0.2.0 sends no sameAs, and no same-as row renders', !$rdfRow($xp, 'Same as'));

// 0.3.0: page and sameAs; a later release may append formats.
$view->callbacks['dreLinkedData'] = fn() => [
    'uri' => $base,
    'page' => 'https://data.example.test/s/a/item/1',
    'sameAs' => ['http://www.wikidata.org/entity/Q42', 'https://d-nb.info/gnd/118540238', 'https://doi.org/10.1234/example', 'https://sws.geonames.org/2950159/', 'https://unknown.example.org/x/1', 'not a url', 42],
    'downloads' => array_merge($downloads020, [['label' => 'RDF/XML', 'type' => 'application/rdf+xml', 'url' => $base . '.rdf'], ['label' => 'Broken', 'url' => 'javascript:alert(1)']]),
];
[$html, $xp] = $apparatusDom();
$links = $rdfRow($xp, 'Linked data')?->getElementsByTagName('a');
dre_check($failures, $checks, 'formats a later release appends render too; unusable entries do not',
    $links?->length === 4 && $links->item(3)->textContent === 'RDF/XML' && !str_contains($html, 'javascript:'));
$same = $rdfRow($xp, 'Same as');
$sameText = preg_replace('/\s+/', ' ', trim($same?->textContent ?? ''));
dre_check($failures, $checks, 'sameAs renders as external links labelled by register, with their identifiers',
    $same && $same->getElementsByTagName('a')->item(0)?->getAttribute('href') === 'http://www.wikidata.org/entity/Q42'
    && str_contains($sameText, 'Wikidata Q42') && str_contains($sameText, 'GND 118540238')
    && str_contains($sameText, 'GeoNames 2950159') && str_contains($sameText, 'unknown.example.org'), $sameText);
dre_check($failures, $checks, 'a DOI already in its own row is not repeated under Same as, and junk IRIs are dropped',
    !str_contains($sameText, 'DOI') && $same->getElementsByTagName('a')->length === 4);
dre_check($failures, $checks, 'the identifiers sit next to the permanent link',
    strpos($html, '>Permanent link<') < strpos($html, '>Linked data<') && strpos($html, '>Same as<') < strpos($html, '>Licence<'));

// An authority record: "Copy link" copies the URI, so the row needs no second button.
$view->callbacks['dreCitation'] = fn() => ['styles' => ['apa' => ['label' => 'APA', 'html' => '<em>Generated</em>']], 'defaultStyle' => 'apa', 'citable' => false];
[$html, $xp] = $apparatusDom();
dre_check($failures, $checks, 'an authority record copies the persistent URI and shows it once',
    $xp->query('//button[contains(@class,"record-apparatus__copy")][@data-copy-text="' . $base . '"]')->length === 1
    && $xp->query('//button[@data-copy-exact]')->length === 0);
unset($view->callbacks['dreCitation']);

$view->callbacks['dreLinkedData'] = fn() => [];
[$html, $xp] = $apparatusDom();
dre_check($failures, $checks, 'a record the module does not publish keeps the page URL and gains nothing',
    $xp->query('//button[@data-copy-exact][@data-copy-text="https://example.test/s/a/item/1"]')->length === 1 && !$rdfRow($xp, 'Linked data'));
$view->callbacks['dreLinkedData'] = function () { throw new RuntimeException('module unavailable'); };
[$html, $xp] = $apparatusDom();
dre_check($failures, $checks, 'a failing module degrades to the page URL',
    str_contains($html, 'href="https://example.test/s/a/item/1"') && !$rdfRow($xp, 'Linked data'));
$view->callbacks['dreLinkedData'] = fn() => ['uri' => 'ftp://nope', 'downloads' => $downloads020];
dre_check($failures, $checks, 'a malformed URI is ignored entirely', $view->RecordLinkedData($resource) === []);

// Item-set and media pages: the compact block.
$view->callbacks['dreLinkedData'] = fn() => ['uri' => $base, 'downloads' => $downloads020, 'sameAs' => ['https://orcid.org/0000-0002-1825-0097']];
$html = $view->render('common/record-linked-data', ['resource' => $resource]);
$doc = new DOMDocument(); @$doc->loadHTML($html); $xp = new DOMXPath($doc);
dre_check($failures, $checks, 'the compact block shows the URI with a copy button, the formats and sameAs',
    $xp->query('//section[@class="record-linked-data"]/h2[.="Linked data"]')->length === 1
    && $xp->query('//button[@data-copy-exact][@data-copy-text="' . $base . '"]')->length === 1
    && $rdfRow($xp, 'Formats')?->getElementsByTagName('a')->length === 3
    && str_contains($rdfRow($xp, 'Same as')?->textContent ?? '', 'ORCID'));
unset($view->callbacks['dreLinkedData']);
dre_check($failures, $checks, 'without the module the compact block renders nothing',
    trim($view->render('common/record-linked-data', ['resource' => $resource])) === '');
$view->callbacks['dreLinkedData'] = fn() => [];
dre_check($failures, $checks, 'for an unpublished record the compact block renders nothing',
    trim($view->render('common/record-linked-data', ['resource' => $resource])) === '');
unset($view->callbacks['dreLinkedData']);

dre_check($failures, $checks, 'registers are named, with the identifier they hold',
    OmekaTheme\Helper\RecordLinkedData::register('https://viaf.org/viaf/12345/') === ['label' => 'VIAF', 'id' => '12345']
    && OmekaTheme\Helper\RecordLinkedData::register('http://id.loc.gov/authorities/subjects/sh85001531') === ['label' => 'Library of Congress', 'id' => 'sh85001531']
    && OmekaTheme\Helper\RecordLinkedData::register('https://doi.org/10.5281/zenodo.1') === ['label' => 'DOI', 'id' => '10.5281/zenodo.1']
    && OmekaTheme\Helper\RecordLinkedData::register('https://ror.org/0234wmv40') === ['label' => 'ROR', 'id' => '0234wmv40']);

// --- Access-rights gloss (issue #10, work package 1d) ------------------------
class GlossValue extends ThemeTestValue
{
    public function __construct(string $text, public bool $public = true, public string $language = '') { parent::__construct($text); }
    public function isPublic(): bool { return $this->public; }
    public function lang(): string { return $this->language; }
}
$publicRight = new ThemeTestResource('Public', 5837);
$publicRight->values['dcterms:description'] = [
    new GlossValue('Curators: check with legal first.', false),
    new GlossValue('The description is public; the material may still be restricted.'),
];
$groupRight = new ThemeTestResource('Group', 5838);
$resource->values['dcterms:accessRights'] = [new ThemeTestValue('', 'resource:item', $publicRight)];
[$html, $xp] = $apparatusDom();
$rights = $rdfRow($xp, 'Access rights');
dre_check($failures, $checks, 'the rail glosses an access-rights term with its public description',
    $rights && str_contains($rights->textContent, 'Public')
    && $xp->query('//span[@class="record-apparatus__gloss"][.="The description is public; the material may still be restricted."]')->length === 1
    && !str_contains($html, 'Curators'));
dre_check($failures, $checks, 'a glossed row is stacked, not right-aligned',
    str_contains($rights->parentNode->getAttribute('class'), 'record-apparatus__row--block'));
$resource->values['dcterms:accessRights'] = [new ThemeTestValue('', 'resource:item', $groupRight), new ThemeTestValue('Restricted to the project')];
[$html, $xp] = $apparatusDom();
dre_check($failures, $checks, 'no description, no gloss', !str_contains($html, 'record-apparatus__gloss'));
dre_check($failures, $checks, 'the gloss prefers the reader\'s language',
    (function () use ($view) {
        $right = new ThemeTestResource('Public', 9);
        $right->values['dcterms:description'] = [new GlossValue('Öffentlich: nur die Beschreibung.', true, 'de'), new GlossValue('Public: the description only.', true, 'en')];
        $value = new ThemeTestValue('', 'resource:item', $right);
        return $view->ValueGloss($value, 'en') === 'Public: the description only.' && $view->ValueGloss($value) === 'Öffentlich: nur die Beschreibung.'
            && $view->ValueGloss(new ThemeTestValue('Public')) === '';
    })());
unset($resource->values['dcterms:accessRights']);

// The metadata glosses the same value, and an untagged value inherits the page language.
class ValuesTestResource extends ThemeTestResource
{
    public function linkPretty(...$args): string { return '<a href="' . $this->url() . '">' . htmlspecialchars($this->displayTitle()) . '</a>'; }
}
class ValuesTestValue extends ThemeTestValue
{
    public function __construct(string $text, string $kind = 'literal', ?ThemeTestResource $linked = null, public string $language = '') { parent::__construct($text, $kind, $linked); }
    public function lang() { return $this->language; }
    public function valueAnnotation() { return null; }
    public function isPublic() { return true; }
    public function asHtml(...$args) { return htmlspecialchars($this->text); }
}
$glossedRight = new ValuesTestResource('Public', 5837);
$glossedRight->values['dcterms:description'] = [new GlossValue('The description is public; the material may still be restricted.')];
$property = new class { public function label() { return 'Property'; } };
$values = [
    'dcterms:description' => ['property' => $property, 'alternate_label' => '', 'values' => [new ValuesTestValue('Untagged text'), new ValuesTestValue('Tagged text', 'literal', null, 'en')]],
    'dcterms:accessRights' => ['property' => $property, 'alternate_label' => '', 'values' => [new ValuesTestValue('', 'resource:item', $glossedRight)]],
];
$html = $view->render('common/resource-values', ['resource' => new ThemeTestResource('Values', 8698), 'values' => $values]);
dre_check($failures, $checks, 'an untagged value carries no empty lang attribute', !str_contains($html, 'lang=""') && str_contains($html, 'Untagged text'));
dre_check($failures, $checks, 'a tagged value keeps its lang attribute', str_contains($html, 'lang="en"'));
dre_check($failures, $checks, 'the metadata glosses an access-rights term',
    str_contains($html, '<span class="value-gloss">The description is public; the material may still be restricted.</span>'), $html);

$view->settings = ['filter_locale_values' => true, 'browse_heading_property_term' => 'dcterms:title', 'browse_body_property_term' => 'dcterms:description'];
$view->callbacks['thumbnail'] = function () { throw new RuntimeException('thumbnail work was not requested'); };
$card = $view->ResourceCardData($resource, ['showThumbnail' => false, 'showBody' => false]);
dre_check($failures, $checks, 'disabled card components perform no thumbnail work', $card['thumbnail'] === '' && $card['body'] === null);
dre_check($failures, $checks, 'custom card heading respects the locale filter', end($resource->options)[1]['lang'] === ['fr', '']);
dre_report('Rendering', $failures, $checks);
