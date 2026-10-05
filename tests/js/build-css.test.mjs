import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, rename, rm, writeFile} from 'node:fs/promises';
import {basename, join, resolve, sep} from 'node:path';
import {tmpdir} from 'node:os';
import {setTimeout as delay} from 'node:timers/promises';
import {buildCss, watchCss} from '../../scripts/build-css.mjs';

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
    await writeFile(metadata, '[info]\nversion = "2.32.0"\nomeka_version_constraint = "^4.2.1"\n[config]\nversion = "wrong"\n');
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
    assert.ok(css.startsWith('@charset "UTF-8";\n/*\nTheme Name:'));
    assert.equal((css.match(/Theme Name:/g) || []).length, 1);
    assert.match(css, /Version: 2\.32\.0\n/);
    assert.match(css, /Omeka Version Constraint: \^4\.2\.1\n/);
    assert.match(css, /\.sample\{color:red;-webkit-user-select:none;user-select:none\}/);
    assert.match(css, /content:"é"/);
    assert.ok(!css.includes('\uFEFF'));
    await assert.rejects(readFile(join(f.root, 'asset/css/_not-an-entry.css')), {code: 'ENOENT'});
    await writeFile(f.metadata, '[info]\nversion = "2.33.0"\nomeka_version_constraint = "^4.3.0"\n');
    await buildCss(f.root);
    const updated = await readFile(f.output, 'utf8');
    assert.match(updated, /Version: 2\.33\.0\n/);
    assert.match(updated, /Omeka Version Constraint: \^4\.3\.0\n/);
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
    await assert.rejects(buildCss(f.root), /missing \[info\] version/);
    assert.equal(await readFile(f.output, 'utf8'), before);
});

async function waitFor(predicate) {
    const deadline = Date.now() + 8000;
    while (!(await predicate())) {
        if (Date.now() > deadline) assert.fail('Timed out waiting for the filesystem watcher');
        await delay(25);
    }
}

test('watch mode rebuilds nested partials, survives errors and notices atomic saves and configuration changes', {timeout: 20000}, async t => {
    const f = await fixture(t);
    let builds = 0;
    const errors = [];
    const close = watchCss(f.root, {onBuild: () => { builds++; }, onError: error => errors.push(error)});
    try {
        await waitFor(() => builds > 0);
        const before = await readFile(f.output, 'utf8');
        await writeFile(f.partial, '$tone: ;');
        await waitFor(() => errors.length > 0);
        assert.equal(await readFile(f.output, 'utf8'), before);
        const previousBuilds = builds;
        const replacement = f.partial + '.new';
        await writeFile(replacement, '$tone: blue;');
        await rename(replacement, f.partial);
        await waitFor(async () => builds > previousBuilds && (await readFile(f.output, 'utf8')).includes('color:blue'));
        await writeFile(f.metadata, '[info]\nversion = "2.34.0"\nomeka_version_constraint = "^4.2.1"\n');
        await waitFor(async () => (await readFile(f.output, 'utf8')).includes('Version: 2.34.0'));
        await writeFile(join(f.root, 'package.json'), JSON.stringify({browserslist: ['Chrome 120']}));
        await waitFor(async () => !(await readFile(f.output, 'utf8')).includes('-webkit-user-select'));
    } finally { close(); }
});
