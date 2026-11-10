// config/amira-pages.php is the one list of AMIRA page slugs and menu copy.
// The templates include it; Node reads it as text (scripts/lib/amira-pages.mjs)
// for the production smoke inventory. These tests keep the two readings equal.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {amiraPagePath, amiraSlugs, parseAmiraPages, statPage} from '../../scripts/lib/amira-pages.mjs';
import {surfaces} from '../browser/surfaces.mjs';

const FILE = resolve(import.meta.dirname, '../../config/amira-pages.php');

test('the Node reading matches what PHP returns, when a PHP is available', (t) => {
    const php = spawnSync('php', ['-r', `echo json_encode(require ${JSON.stringify(FILE)});`], {encoding: 'utf8'});
    if (php.error || php.status !== 0) {
        t.skip('no PHP on PATH');
        return;
    }
    assert.deepEqual(parseAmiraPages(), JSON.parse(php.stdout));
});

test('the data file is read whole', () => {
    const pages = parseAmiraPages();
    assert.equal(pages.intros['access-reuse'], 'How to reach the material, and how to reuse what AMIRA publishes.');
    assert.equal(pages.descriptions['international-library-of-african-music-ilam'], "Africa's foremost music archive");
    assert.equal(statPage('researchItems'), 'research-items');
    // Every `=>` pair in the file was read: a line the reader skipped would be
    // a slug that only PHP knows.
    const source = readFileSync(FILE, 'utf8');
    const pairs = (source.match(/^\s*['"][^'"]+['"]\s*=>\s*['"]/gm) ?? []).length;
    const read = Object.values(pages).reduce((n, list) => n + Object.keys(list).length, 0);
    assert.equal(read, pairs);
});

test('a list the reader cannot find is an error, not an empty menu', () => {
    assert.throws(() => parseAmiraPages("<?php\nreturn [\n    'intros' => [\n        'a' => 'b',\n    ],\n];\n"), /no 'descriptions' list/);
});

test('paths are built only for pages the theme names', () => {
    assert.equal(amiraPagePath('research-items'), '/s/amira/page/research-items');
    assert.throws(() => amiraPagePath('no-such-page'), /no page no-such-page/);
    assert.throws(() => statPage('resourceTypes'), /resourceTypes/);
});

test('every AMIRA page in the smoke inventory is one the theme names', () => {
    const slugs = amiraSlugs();
    for (const {id, path} of surfaces) {
        const slug = path.match(/^\/s\/amira\/page\/([^/]+)$/)?.[1];
        if (slug && slug !== 'home') assert.ok(slugs.has(slug), `${id}: ${path}`);
    }
});
