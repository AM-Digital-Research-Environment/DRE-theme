// CHANGELOG.md feeds the notes of any release the release workflow creates,
// and `npm version` (scripts/sync-version.mjs) promotes its [Unreleased] notes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {basename, join, resolve, sep} from 'node:path';
import {changelogSection, promoteUnreleased, REPOSITORY} from '../../scripts/changelog-section.mjs';

const SAMPLE = `# Changelog

## [Unreleased]

<!-- placeholder -->

### Fixed

- Something.

## [1.1.0] - 2026-01-02

### Added

- Feature.

## [1.0.0] - 2026-01-01

- First.

## Earlier releases

See GitHub.

[Unreleased]: ${REPOSITORY}/compare/v1.1.0...HEAD
[1.1.0]: ${REPOSITORY}/compare/v1.0.0...v1.1.0
[1.0.0]: ${REPOSITORY}/releases/tag/v1.0.0
`;

test('a version section stops at the next heading and drops editing placeholders', () => {
    assert.equal(changelogSection(SAMPLE, '1.1.0'), '### Added\n\n- Feature.');
    assert.equal(changelogSection(SAMPLE, '1.0.0'), '- First.');
    assert.equal(changelogSection(SAMPLE, 'Unreleased'), '### Fixed\n\n- Something.');
    assert.equal(changelogSection(SAMPLE, '1.0'), null);
    assert.equal(changelogSection(SAMPLE.replace(/\n/g, '\r\n'), '1.0.0'), '- First.');
});

test('promoting [Unreleased] dates the notes, keeps the placeholder and updates the links', () => {
    const out = promoteUnreleased(SAMPLE, '1.2.0', '2026-02-03');
    assert.match(out, /## \[Unreleased\]\n\n<!-- placeholder -->\n\n## \[1\.2\.0\] - 2026-02-03\n\n### Fixed\n\n- Something\.\n\n## \[1\.1\.0\]/);
    assert.equal(changelogSection(out, 'Unreleased'), '');
    assert.equal(changelogSection(out, '1.2.0'), '### Fixed\n\n- Something.');
    assert.match(out, new RegExp(`^\\[Unreleased\\]: ${REPOSITORY}/compare/v1\\.2\\.0\\.\\.\\.HEAD$`, 'm'));
    assert.match(out, new RegExp(`^\\[1\\.2\\.0\\]: ${REPOSITORY}/compare/v1\\.1\\.0\\.\\.\\.v1\\.2\\.0$`, 'm'));
    // Idempotent, and a no-op when there is nothing to release.
    assert.equal(promoteUnreleased(out, '1.2.0', '2026-02-04'), out);
    assert.equal(promoteUnreleased(out, '1.3.0', '2026-02-04'), out);
});

test('the repository changelog keeps an [Unreleased] section and its link references', async () => {
    const text = await readFile(resolve(import.meta.dirname, '../../CHANGELOG.md'), 'utf8');
    assert.match(text, /^## \[Unreleased\]$/m);
    assert.match(text, /^\[Unreleased\]: \S+\/compare\/v\d+\.\d+\.\d+\.\.\.HEAD$/m);
    for (const [, version] of text.matchAll(/^## \[(\d+\.\d+\.\d+)\] - \d{4}-\d{2}-\d{2}$/gm)) {
        assert.ok(changelogSection(text, version), `CHANGELOG.md ${version} has no notes`);
        assert.match(text, new RegExp(`^\\[${version.replace(/\./g, '\\.')}\\]: https://`, 'm'), `no link reference for ${version}`);
    }
});

// `npm version` runs scripts/sync-version.mjs as its `version` hook. With
// nothing under [Unreleased] the promotion is a no-op, and the release workflow
// would then publish generated notes instead of written ones: so under the hook
// an empty [Unreleased] fails, before any file is touched.
const SYNC = resolve(import.meta.dirname, '../../scripts/sync-version.mjs');
const INI = [
    '[info]',
    'name = "Fixture"',
    'version = "1.1.0"',
    'author = "Fixture Author"',
    'description = "Fixture."',
    'theme_link = "https://example.org/theme"',
    'author_link = "https://example.org/author"',
    'omeka_version_constraint = "^4.2.1"',
    '',
].join('\n');

async function versionFixture(t, changelog) {
    const root = await mkdtemp(join(tmpdir(), 'dre-version-test-'));
    t.after(async () => {
        // Cleanup is restricted to the temporary directory this test created.
        assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep));
        assert.ok(basename(root).startsWith('dre-version-test-'));
        await rm(root, {recursive: true, force: true});
    });
    await mkdir(join(root, 'config'));
    await mkdir(join(root, 'asset/sass'), {recursive: true});
    await writeFile(join(root, 'package.json'), JSON.stringify({version: '1.2.0', browserslist: ['last 2 versions']}));
    await writeFile(join(root, 'config/theme.ini'), INI);
    await writeFile(join(root, 'CITATION.cff'), 'cff-version: 1.2.0\nversion: 1.1.0\ndate-released: 2026-01-02\n');
    await writeFile(join(root, 'CHANGELOG.md'), changelog);
    await writeFile(join(root, 'asset/sass/style.scss'), '.a { color: red; }\n');
    return root;
}

function sync(root, lifecycle) {
    const env = {...process.env};
    delete env.npm_lifecycle_event;
    if (lifecycle) env.npm_lifecycle_event = lifecycle;
    const run = spawnSync(process.execPath, [SYNC, `--root=${root}`], {encoding: 'utf8', env});
    return {status: run.status, output: `${run.stdout}${run.stderr}`};
}

// SAMPLE after a release: an [Unreleased] heading with only its placeholder.
const RELEASED = promoteUnreleased(SAMPLE, '1.1.5', '2026-01-03');

test('npm version refuses a release with nothing under [Unreleased]', async t => {
    const root = await versionFixture(t, RELEASED);
    const {status, output} = sync(root, 'version');
    assert.equal(status, 1, output);
    assert.match(output, /CHANGELOG\.md has no notes for 1\.2\.0: ## \[Unreleased\] is empty/);
    // Refused before anything was written.
    assert.equal(await readFile(join(root, 'config/theme.ini'), 'utf8'), INI);
    assert.equal(await readFile(join(root, 'CHANGELOG.md'), 'utf8'), RELEASED);
});

test('run by hand, the sync still writes the version with an empty [Unreleased]', async t => {
    const root = await versionFixture(t, RELEASED);
    const {status, output} = sync(root, null);
    assert.equal(status, 0, output);
    assert.match(await readFile(join(root, 'config/theme.ini'), 'utf8'), /^version = "1\.2\.0"$/m);
});

test('npm version promotes the [Unreleased] notes and stages the synced files', async t => {
    const root = await versionFixture(t, SAMPLE);
    assert.equal(spawnSync('git', ['init', '-q'], {cwd: root}).status, 0);
    const {status, output} = sync(root, 'version');
    assert.equal(status, 0, output);
    assert.equal(changelogSection(await readFile(join(root, 'CHANGELOG.md'), 'utf8'), '1.2.0'), '### Fixed\n\n- Something.');
    const staged = spawnSync('git', ['diff', '--cached', '--name-only'], {cwd: root, encoding: 'utf8'}).stdout;
    for (const file of ['CHANGELOG.md', 'CITATION.cff', 'config/theme.ini', 'asset/css/style.css']) {
        assert.match(staged, new RegExp(`^${file.replace(/\./g, '\\.')}$`, 'm'), `${file} is staged`);
    }
});
