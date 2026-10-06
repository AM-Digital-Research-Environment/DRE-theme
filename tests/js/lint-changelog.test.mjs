// CHANGELOG.md feeds the notes of any release the release workflow creates,
// and `npm version` (scripts/sync-version.mjs) promotes its [Unreleased] notes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
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
