#!/usr/bin/env node
/**
 * Metadata-grouping coverage lint.
 *
 *   node scripts/check-resource-groups.mjs      (also: npm run lint:groups)
 *
 * helper/ResourceGroups.php decides where every property of a record renders.
 * A property the map does not name still renders — it falls through to "Further
 * details" — so a gap in the map is INVISIBLE: the page looks fine, and the
 * Author quietly sits at the bottom under the administrative identifiers. That
 * is the exact failure the record redesign exists to fix, so it needs a check
 * rather than a careful reading.
 *
 * This asserts the map against tests/fixtures/research-items-template.json —
 * the real property list of the live "Research Items" template (99 properties)
 * and the terms on a real record. It is deliberately a NODE check, not a PHP
 * one: it has to run in the same `npm run lint` chain as everything else, on a
 * machine with no PHP binary. `npm run lint:php` and CI cover the PHP side.
 *
 * Two rules:
 *   1. Every property on the template lands in a named group, not the fallback.
 *   2. Terms that must lead — authorship, the abstract, subjects — land in the
 *      groups the design calls for, not merely *somewhere*.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const HELPER = join(ROOT, 'helper', 'ResourceGroups.php');
const FIXTURE = join(ROOT, 'tests', 'fixtures', 'research-items-template.json');

const findings = [];

// --- Extract the map out of the PHP const -------------------------------
//
// Regex, not a PHP parse: the const is a flat literal of quoted strings, and
// this check must run with no PHP toolchain. It asserts its own extraction
// below, so a change to the map's SHAPE fails loudly instead of silently
// matching nothing and declaring the map complete — the failure mode that made
// the old grep-based theme.ini lint useless on Windows.
const php = readFileSync(HELPER, 'utf8');

const groups = [];
const groupRe = /\[\s*(?:\/\/[^\n]*\n\s*)*'key'\s*=>\s*'([\w-]+)'[\s\S]*?'layout'\s*=>\s*self::LAYOUT_(\w+),([\s\S]*?)\n        \],/g;
for (const m of php.matchAll(groupRe)) {
  const [, key, layout, body] = m;
  const termsBlock = /'terms'\s*=>\s*\[([\s\S]*?)\]/.exec(body);
  const prefixBlock = /'prefixes'\s*=>\s*\[([\s\S]*?)\]/.exec(body);
  const pull = (block) => (block ? [...block[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : []);
  groups.push({
    key,
    layout: layout.toLowerCase(),
    terms: pull(termsBlock),
    prefixes: pull(prefixBlock),
  });
}

// Self-check the extraction before trusting it.
const EXPECTED_KEYS = ['abstract', 'description', 'subjects', 'people', 'origins', 'rights', 'identifiers'];
const foundKeys = groups.map((g) => g.key);
for (const key of EXPECTED_KEYS) {
  if (!foundKeys.includes(key)) {
    findings.push(`could not extract the "${key}" group from helper/ResourceGroups.php — the map's shape changed and this check needs updating (it is NOT reporting on the real map)`);
  }
}
const totalTerms = groups.reduce((n, g) => n + g.terms.length, 0);
if (totalTerms < 60) {
  findings.push(`only ${totalTerms} terms extracted from the map — expected 60+; the extraction is broken, not the map`);
}

if (findings.length) {
  report();
}

/** Group key for a term, or null for the "Further details" fallback. */
function groupKeyFor(term) {
  for (const g of groups) if (g.terms.includes(term)) return g.key;
  for (const g of groups) for (const p of g.prefixes) if (term.startsWith(p)) return g.key;
  return null;
}

// --- Rule 1: full coverage of the real template -------------------------
const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8'));

const uncovered = [];
for (const { term, label } of fixture.template.properties) {
  if (groupKeyFor(term) === null) uncovered.push(`${term}${label ? ` ("${label}")` : ''}`);
}
if (uncovered.length) {
  findings.push(
    `${uncovered.length} of ${fixture.template.propertyCount} properties on the "${fixture.template.label}" template fall through to "Further details":\n      ` +
      uncovered.join('\n      ') +
      `\n    Add them to helper/ResourceGroups.php, or accept the fallback deliberately by naming them there.`
  );
}

for (const term of fixture.sampleItem.terms) {
  if (groupKeyFor(term) === null) {
    findings.push(`item ${fixture.sampleItem.id} carries ${term}, which the map does not place`);
  }
}

// --- Rule 2: the placements the design actually depends on --------------
//
// Coverage alone is not correctness: every term could be "covered" by landing
// in one giant group. These are the placements AUDIT.md §A5 names.
const MUST_LAND_IN = {
  'marcrel:aut': 'people',       // the Author — the property the audit says must not read like an identifier
  'marcrel:cre': 'people',
  'dcterms:creator': 'people',
  'dcterms:abstract': 'abstract', // leads the record, at a reading measure
  'dcterms:subject': 'subjects',  // chips, not a wall of links
  'dcterms:license': 'rights',
  'dcterms:accessRights': 'rights',
  'dre:id': 'identifiers',        // administrative, and therefore last
  'dcterms:identifier': 'identifiers',
  'dre:wisskiUrl': 'identifiers',
  'fabio:hasURL': 'identifiers',
  'dcterms:format': 'rights',
  'frapo:isFundedBy': 'origins',  // "Funded by" in the redesign mockup
  'dcterms:isPartOf': 'origins',
  'dcterms:spatial': 'origins',
  'dcterms:language': 'origins',
};
for (const [term, expected] of Object.entries(MUST_LAND_IN)) {
  const actual = groupKeyFor(term);
  if (actual !== expected) {
    findings.push(`${term} groups as "${actual ?? 'Further details'}" — the record design puts it in "${expected}"`);
  }
}

// --- Rule 3: a layout hint the template understands ----------------------
const LAYOUTS = ['prose', 'chips', 'rows'];
for (const g of groups) {
  if (!LAYOUTS.includes(g.layout)) {
    findings.push(`group "${g.key}" declares layout "${g.layout}", which common/resource-values.phtml cannot render`);
  }
}

report();

function report() {
  if (findings.length) {
    console.error(`Metadata grouping: ${findings.length} finding(s)\n`);
    for (const f of findings) console.error('  ' + f);
    process.exit(1);
  }
  const covered = fixture.template.propertyCount;
  console.log(`Metadata grouping: clean (${covered}/${covered} template properties placed, ${groups.length} groups).`);
}
