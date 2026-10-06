import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdtemp, mkdir, readFile, rename, rm, writeFile} from 'node:fs/promises';
import {basename, join, resolve, sep} from 'node:path';
import {tmpdir} from 'node:os';
import {setTimeout as delay} from 'node:timers/promises';
import {buildCss, watchCss} from '../../scripts/build-css.mjs';

/** A theme.ini [info] block with every key the CSS header restates. */
function themeIni({version = '2.32.0', constraint = '^4.2.1', description = 'Fixture description.', extra = ''} = {}) {
    return [
        '[info]',
        'name = "Fixture Theme"',
        `version = "${version}"`,
        'author = "Fixture Author"',
        `description = "${description}"`,
        'theme_link = "https://example.org/theme"',
        'author_link = "https://example.org/author"',
        `omeka_version_constraint = "${constraint}"`,
        extra,
    ].join('\n');
}

async function fixture(t) {
    const root = await mkdtemp(join(tmpdir(), 'dre-css-test-'));
    t.after(async () => {
        // Cleanup is restricted to the temporary directory this test created.
        assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep));
        assert.ok(basename(root).startsWith('dre-css-test-'));
        await rm(root, {recursive: true, force: true});
    });
    await mkdir(join(root, 'asset/sass/nested'), {recursive: true});
    await mkdir(join(root, 'config'));
    const metadata = join(root, 'config/theme.ini');
    await writeFile(metadata, themeIni({extra: '[config]\nversion = "wrong"\n'}));
    await writeFile(join(root, 'package.json'), JSON.stringify({browserslist: ['Safari 9']}));
    const partial = join(root, 'asset/sass/nested/_palette.scss');
    await writeFile(partial, '$tone: red;');
    await writeFile(join(root, 'asset/sass/style.scss'), '@use "nested/palette"; .sample { color: palette.$tone; user-select: none; &::before { content: "é"; } }');
    return {root, metadata, partial, output: join(root, 'asset/css/style.css')};
}

test('CSS build preserves metadata, compression, prefixing and Unicode without compiling partials', async t => {
    const f = await fixture(t);
    await writeFile(join(f.root, 'asset/sass/_not-an-entry.scss'), '$value: 1;');
    assert.equal(await buildCss(f.root), 1);
    const css = await readFile(f.output, 'utf8');
    assert.ok(css.startsWith('@charset "UTF-8";\n/*\nTheme Name: Fixture Theme\n'));
    assert.equal((css.match(/Theme Name:/g) || []).length, 1);
    assert.match(css, /Theme URI: https:\/\/example\.org\/theme\n/);
    assert.match(css, /Author: Fixture Author\nAuthor URI: https:\/\/example\.org\/author\n/);
    assert.match(css, /Description: Fixture description\.\n/);
    assert.match(css, /Version: 2\.32\.0\n/);
    assert.match(css, /Omeka Version Constraint: \^4\.2\.1\n/);
    assert.match(css, /Requires PHP: 8\.1\n/);
    assert.match(css, /\.sample\{color:red;-webkit-user-select:none;user-select:none\}/);
    assert.match(css, /content:"é"/);
    assert.ok(!css.includes('﻿'));
    await assert.rejects(readFile(join(f.root, 'asset/css/_not-an-entry.css')), {code: 'ENOENT'});
    await writeFile(f.metadata, themeIni({version: '2.33.0', constraint: '^4.3.0', description: 'Updated description.'}));
    await buildCss(f.root);
    const updated = await readFile(f.output, 'utf8');
    assert.match(updated, /Version: 2\.33\.0\n/);
    assert.match(updated, /Omeka Version Constraint: \^4\.3\.0\n/);
    assert.match(updated, /Description: Updated description\.\n/);
});

test('invalid Sass or metadata fails the build without replacing any last-good output', async t => {
    const f = await fixture(t);
    await buildCss(f.root);
    const before = await readFile(f.output, 'utf8');
    await writeFile(f.partial, '$tone: blue;');
    const broken = join(f.root, 'asset/sass/z-broken.scss');
    await writeFile(broken, '.broken { color:');
    await assert.rejects(buildCss(f.root), /Expected expression/);
    assert.equal(await readFile(f.output, 'utf8'), before);
    await rm(broken);
    await writeFile(f.metadata, '[info]\nomeka_version_constraint = "^4.2.1"\n[config]\nversion = "wrong"\n');
    await assert.rejects(buildCss(f.root), /missing \[info\] name/);
    await writeFile(f.metadata, themeIni().replace(/^version = .*$/m, ''));
    await assert.rejects(buildCss(f.root), /missing \[info\] version/);
    await writeFile(f.metadata, themeIni({description: 'Closes */ the comment'}));
    await assert.rejects(buildCss(f.root), /description must not contain/);
    assert.equal(await readFile(f.output, 'utf8'), before);
});

// The watcher is exercised for real, so its latency is the OS's: a cold Windows
// run under parallel test files has been seen to take several seconds for a
// single event. The deadline is generous on purpose; a passing run still
// finishes in well under a second per step.
const WATCH_DEADLINE_MS = 20_000;

async function waitFor(predicate, what) {
    const deadline = Date.now() + WATCH_DEADLINE_MS;
    while (!predicate()) {
        if (Date.now() > deadline) assert.fail(`Timed out after ${WATCH_DEADLINE_MS / 1000}s waiting for the filesystem watcher: ${what}`);
        await delay(25);
    }
}

test('watch mode rebuilds nested partials, survives errors and notices atomic saves and configuration changes', {timeout: 60_000}, async t => {
    const f = await fixture(t);
    // The output is read synchronously INSIDE the callbacks, i.e. between
    // builds, never by polling. On Windows, polling reads racing the build's
    // replace-by-rename were seen to stall that rename indefinitely under
    // parallel load, which made this test hang rather than the watcher fail.
    let builds = 0;
    let css = '';
    const errors = [];
    const close = watchCss(f.root, {
        onBuild: () => { builds++; css = readFileSync(f.output, 'utf8'); },
        onError: error => { errors.push({error, css: readFileSync(f.output, 'utf8')}); },
    });
    try {
        await waitFor(() => builds > 0, 'initial build');
        const before = css;
        await writeFile(f.partial, '$tone: ;');
        await waitFor(() => errors.length > 0, 'error from a broken partial');
        assert.match(errors[0].error.message, /Expected expression/);
        assert.equal(errors[0].css, before, 'a failed build keeps the last good CSS');
        const previousBuilds = builds;
        const replacement = f.partial + '.new';
        await writeFile(replacement, '$tone: blue;');
        await rename(replacement, f.partial);
        await waitFor(() => builds > previousBuilds && css.includes('color:blue'), 'rebuild after an atomic save');
        await writeFile(f.metadata, themeIni({version: '2.34.0'}));
        await waitFor(() => css.includes('Version: 2.34.0'), 'rebuild after a theme.ini change');
        await writeFile(join(f.root, 'package.json'), JSON.stringify({browserslist: ['Chrome 120']}));
        await waitFor(() => !css.includes('-webkit-user-select'), 'rebuild after a browserslist change');
    } finally { close(); }
});
