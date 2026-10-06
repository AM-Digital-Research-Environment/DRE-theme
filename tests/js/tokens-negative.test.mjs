/**
 * Negative tests for the design-token lint (scripts/check-design-tokens.mjs).
 *
 * A lint that has only ever been seen passing proves nothing: each case below
 * copies the theme's real token sources into a temporary tree, seeds exactly
 * one violation, and requires the lint to fail on it — next to a control run
 * that requires the untouched copy to pass.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename, join, resolve, sep} from 'node:path';

const REPO = resolve(import.meta.dirname, '..', '..');
const SCRIPT = join(REPO, 'scripts', 'check-design-tokens.mjs');

/** A throwaway copy of everything the lint reads, laid out like the repo. */
function fixture(t) {
    const root = mkdtempSync(join(tmpdir(), 'dre-tokens-test-'));
    t.after(() => {
        // Cleanup is restricted to the temporary directory this test created.
        assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep));
        assert.ok(basename(root).startsWith('dre-tokens-test-'));
        rmSync(root, {recursive: true, force: true});
    });
    cpSync(join(REPO, 'asset', 'sass'), join(root, 'asset', 'sass'), {recursive: true});
    mkdirSync(join(root, 'scripts'), {recursive: true});
    cpSync(join(REPO, 'asset', 'css', 'dre-tokens-fallback.json'), join(root, 'asset', 'css', 'dre-tokens-fallback.json'));
    cpSync(join(REPO, 'scripts', 'design-token-allowlist.txt'), join(root, 'scripts', 'design-token-allowlist.txt'));
    return root;
}

function lint(root) {
    const run = spawnSync(process.execPath, [SCRIPT, '--root', root], {encoding: 'utf8'});
    return {status: run.status, output: `${run.stdout}\n${run.stderr}`};
}

function edit(root, relative, change) {
    const file = join(root, relative);
    const before = readFileSync(file, 'utf8');
    const after = change(before);
    assert.notEqual(after, before, `the seed must actually change ${relative}`);
    writeFileSync(file, after);
}

const COLORS = 'asset/sass/abstracts/variables/_colors.scss';

test('an untouched copy of the token sources passes', (t) => {
    const {status, output} = lint(fixture(t));
    assert.equal(status, 0, output);
    assert.match(output, /clean\./);
});

test('a raw hex colour in a component partial fails', (t) => {
    const root = fixture(t);
    writeFileSync(
        join(root, 'asset/sass/components/_seeded-violation.scss'),
        '.seeded-violation {\n    color: #ff0000;\n}\n',
    );
    const {status, output} = lint(root);
    assert.equal(status, 1, output);
    assert.match(output, /_seeded-violation\.scss:2\s+\[hex\] raw hex outside fallback position: #ff0000/);
});

test('a field border below 3:1 non-text contrast fails', (t) => {
    const root = fixture(t);
    // The light-mode value only (the first declaration): the old --border-strong
    // lightness, 1.9:1 on --surface.
    edit(root, COLORS, (src) => src.replace(/(--field-border:\s*)oklch\([^)]*\)/, '$1oklch(79% 0.011 72)'));
    const {status, output} = lint(root);
    assert.equal(status, 1, output);
    assert.match(output, /light: --field-border on --surface is 1\.\d\d:1 — below WCAG 1\.4\.11 non-text contrast \(3:1\)/);
    assert.doesNotMatch(output, /dark: --field-border/);
});

test('a focus colour below 3:1 against the page fails', (t) => {
    const root = fixture(t);
    // Point the dark-mode focus outline at a near-ground tone.
    edit(root, COLORS, (src) => {
        const dark = src.indexOf('@mixin am-dark-theme');
        const head = src.slice(0, dark);
        const tail = src.slice(dark).replace(/--focus-color:\s*var\(--primary\);/, '--focus-color: oklch(24% 0.014 165);');
        return head + tail;
    });
    const {status, output} = lint(root);
    assert.equal(status, 1, output);
    assert.match(output, /dark: --focus-color on --background is \d\.\d\d:1 — below WCAG 1\.4\.11/);
});

test('removing the field-border token is reported, not silently skipped', (t) => {
    const root = fixture(t);
    edit(root, COLORS, (src) => src.replace(/^\s*--field-border:[^\n]*\n/m, ''));
    const {status, output} = lint(root);
    assert.equal(status, 1, output);
    assert.match(output, /light: --field-border is not declared/);
});
