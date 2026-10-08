/**
 * The shared token rules (scripts/lib/token-rules.mjs) as the modules use them:
 * JavaScript that resolves tokens through the bridge, `cssColor('--x', fallback)`.
 *
 * The theme's own lint scans Sass only, so tokens-negative.test.mjs never
 * exercises these rules; DRE-Visualizations' chart chrome is where they bite.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename, join, resolve, sep} from 'node:path';

import {runRules} from '../../scripts/lib/token-rules.mjs';

const REPO = resolve(import.meta.dirname, '..', '..');
const table = JSON.parse(readFileSync(join(REPO, 'asset', 'css', 'dre-tokens-fallback.json'), 'utf8'));

/** Lint one seeded JavaScript file the way a module's config would. */
function lintJs(t, source) {
    const root = mkdtempSync(join(tmpdir(), 'dre-bridge-test-'));
    t.after(() => {
        assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep));
        assert.ok(basename(root).startsWith('dre-bridge-test-'));
        rmSync(root, {recursive: true, force: true});
    });
    mkdirSync(join(root, 'js'));
    writeFileSync(join(root, 'js', 'seed.js'), source);
    return runRules({root, dirs: ['js'], extensions: ['.js'], table, rules: {hex: false}})
        .map((f) => `${f.rule} ${f.line} ${f.message}`);
}

const ink = {light: table.light['--ink'], dark: table.dark['--ink']};

test('a bridge fallback that matches the generated table passes', (t) => {
    assert.deepEqual(lintJs(t, `ns.cssColor('--ink', '${ink.light}');\n`), []);
});

test('a stale bridge fallback fails', (t) => {
    const findings = lintJs(t, `ns.cssColor('--ink', '#333333');\n`);
    assert.equal(findings.length, 1, findings.join('\n'));
    assert.match(findings[0], /^fallback 1 var\(--ink, #333333\) — fallback should be /);
});

test('both branches of a mode-dependent fallback are checked', (t) => {
    assert.deepEqual(lintJs(t, `cssColor('--ink', dark ? '${ink.dark}' : '${ink.light}');\n`), []);
    const findings = lintJs(t, `cssColor('--ink', dark ? '#e0e0e0' : '${ink.light}');\n`);
    assert.equal(findings.length, 1, findings.join('\n'));
    assert.match(findings[0], /var\(--ink, #e0e0e0\)/);
});

test('binding the bridge to another name fails', (t) => {
    const findings = lintJs(t, `var c = ns.cssColor;\nc('--ink', '#333333');\n`);
    assert.equal(findings.length, 1, findings.join('\n'));
    assert.match(findings[0], /^bridgeAlias 1 ns\.cssColor bound to another name/);
});

test('reading the bridge off window.DRETokens is not an alias', (t) => {
    assert.deepEqual(lintJs(t, `const bridge = window.DRETokens?.cssColor;\nconst api = {cssColor: cssColor};\n`), []);
});
