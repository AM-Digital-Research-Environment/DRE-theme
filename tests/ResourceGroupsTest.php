<?php
/**
 * ResourceGroups — behaviour test, run by a real PHP binary.
 *
 *   php tests/ResourceGroupsTest.php        (also: npm run lint:php)
 *
 * Deliberately dependency-free: plain asserts, no PHPUnit, no composer install.
 * The theme has no PHP dependencies and should not grow one just to be testable
 * — `php tests/*.php` is the whole toolchain.
 *
 * This is the PHP counterpart to scripts/check-resource-groups.mjs. The Node
 * check reads the map as DATA (it must run where there is no PHP); this one
 * executes the real class, so it also covers the matching LOGIC — exact-beats-
 * prefix, ordering, the fallback bucket — which a regex over the source cannot
 * see.
 *
 * The shared test bootstrap supplies the minimal AbstractHelper stand-in used
 * by dependency-free suites and turns PHP warnings/deprecations into failures.
 */

namespace {

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../helper/ResourceGroups.php';

use OmekaTheme\Helper\ResourceGroups;

$failures = [];
$checks = 0;

function check(string $what, bool $ok, string $detail = ''): void
{
    global $failures, $checks;
    $checks++;
    if (!$ok) {
        $failures[] = $what . ($detail !== '' ? "\n      {$detail}" : '');
    }
}

// ---------------------------------------------------------------- fixture
$fixturePath = __DIR__ . '/fixtures/research-items-template.json';
$fixture = json_decode((string) file_get_contents($fixturePath), true);
if (!is_array($fixture)) {
    fwrite(STDERR, "Cannot read {$fixturePath} — run `npm run fixtures:refresh`.\n");
    exit(1);
}

// ------------------------------------------------- 1. coverage & placement
$uncovered = [];
foreach ($fixture['template']['properties'] as $property) {
    if (null === ResourceGroups::groupKeyFor($property['term'])) {
        $uncovered[] = $property['term'] . ' ("' . $property['label'] . '")';
    }
}
check(
    'every property on the live "Research Items" template is placed in a named group',
    $uncovered === [],
    $uncovered ? count($uncovered) . ' fall through to "Further details": ' . implode(', ', array_slice($uncovered, 0, 8)) . (count($uncovered) > 8 ? ' …' : '') : ''
);

// The placements AUDIT.md §A5 actually depends on.
$mustLandIn = [
    'marcrel:aut' => 'people',
    'dcterms:creator' => 'people',
    'dcterms:abstract' => 'abstract',
    'dcterms:subject' => 'subjects',
    'frapo:isFundedBy' => 'origins',
    'dcterms:license' => 'rights',
    'dre:id' => 'identifiers',
    'fabio:hasURL' => 'identifiers',
];
foreach ($mustLandIn as $term => $expected) {
    $actual = ResourceGroups::groupKeyFor($term);
    check(
        "{$term} groups as \"{$expected}\"",
        $actual === $expected,
        'got "' . ($actual ?? 'Further details') . '"'
    );
}

// A role the map does not name must still be swept up by the marcrel prefix —
// that is the whole point of the prefix rule.
check(
    'an unnamed marcrel role is still swept into "People & roles"',
    ResourceGroups::groupKeyFor('marcrel:vdg') === 'people',
    'got "' . (ResourceGroups::groupKeyFor('marcrel:vdg') ?? 'Further details') . '"'
);

// A term from no known vocabulary must fall through, not be swallowed.
check(
    'an unknown term falls through to the fallback rather than being hidden',
    ResourceGroups::groupKeyFor('acme:somethingNew') === null
);

// ------------------------------------------------------- 2. grouping logic
//
// Exercise __invoke() with a stand-in for Omeka's value map. Only the array
// shape matters: the helper partitions the map and never touches the values.
$view = new class {
    public function plugin($name)
    {
        // The only plugin ResourceGroups asks for is `translate`.
        return static fn($string) => $string;
    }
};

$helper = new ResourceGroups();
$helper->setView($view);

// Deliberately in a hostile order: identifiers first, author last — the
// database order that produced the "Omeka data dump" the redesign replaces.
$values = [];
foreach (['dre:id', 'dcterms:identifier', 'dcterms:format', 'dcterms:subject',
          'acme:unknown', 'dcterms:abstract', 'marcrel:sng', 'marcrel:aut'] as $term) {
    $values[$term] = ['property' => null, 'alternate_label' => null, 'values' => ['x']];
}

$result = $helper($values);
$keys = array_column($result, 'key');

check(
    'the abstract leads the record, whatever order the database returned',
    ($keys[0] ?? null) === 'abstract',
    'group order was: ' . implode(' → ', $keys)
);
check(
    'identifiers come after subjects and people',
    array_search('identifiers', $keys, true) > array_search('people', $keys, true)
        && array_search('identifiers', $keys, true) > array_search('subjects', $keys, true),
    'group order was: ' . implode(' → ', $keys)
);
check(
    'the unknown term is kept, in the "Further details" bucket',
    ($keys[count($keys) - 1] ?? null) === 'other'
        && isset($result[count($result) - 1]['values']['acme:unknown'])
);

$people = null;
foreach ($result as $group) {
    if ($group['key'] === 'people') { $people = $group; }
}
check(
    'a named role outranks a prefix-swept one inside its group',
    $people !== null && array_key_first($people['values']) === 'marcrel:aut',
    $people ? 'order was: ' . implode(', ', array_keys($people['values'])) : 'no people group'
);

// No property may be silently lost between input and output.
$emitted = [];
foreach ($result as $group) {
    $emitted = array_merge($emitted, array_keys($group['values']));
}
sort($emitted);
$expected = array_keys($values);
sort($expected);
check(
    'grouping is lossless — every input property is emitted exactly once',
    $emitted === $expected,
    'in: ' . implode(',', $expected) . ' / out: ' . implode(',', $emitted)
);

// ------------------------------------------------------------------ report
if ($failures) {
    fwrite(STDERR, 'ResourceGroups: ' . count($failures) . " failure(s) of {$checks} checks\n\n");
    foreach ($failures as $failure) {
        fwrite(STDERR, '  ✗ ' . $failure . "\n");
    }
    exit(1);
}

echo "ResourceGroups: {$checks} checks passed.\n";

}
