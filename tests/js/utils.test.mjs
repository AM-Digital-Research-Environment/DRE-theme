import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { themeScript } from '../support/theme-script.mjs';

// The sources, or with DRE_SCRIPTS=dist the minified builds the templates load.
const source = (name) => readFileSync(new URL('../../' + themeScript(name), import.meta.url), 'utf8');

function utils() {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { runScripts: 'outside-only' });
    dom.window.eval(source('utils'));
    return dom.window;
}

test('DREUtils publishes the module-facing members and the shared helpers', () => {
    const w = utils();
    assert.deepEqual(Object.keys(w.DREUtils).sort(), [
        'announce', 'debounce', 'flashLabel', 'isPlainClick', 'normaliseSpace', 'onReady', 'prefersReducedMotion',
    ]);
    w.close();
});

test('prefersReducedMotion reads the preference at the moment of use', () => {
    const w = utils();
    assert.equal(w.DREUtils.prefersReducedMotion(), false, 'no matchMedia: motion is allowed');
    let reduced = false;
    w.matchMedia = (query) => ({ matches: reduced && query === '(prefers-reduced-motion: reduce)' });
    assert.equal(w.DREUtils.prefersReducedMotion(), false);
    reduced = true;
    assert.equal(w.DREUtils.prefersReducedMotion(), true, 'a change while the page is open is seen');
    w.close();
});

test('isPlainClick accepts only an unmodified primary-button click', () => {
    const w = utils();
    const click = (init = {}) => w.DREUtils.isPlainClick(new w.MouseEvent('click', init));
    assert.equal(click(), true);
    assert.equal(click({ button: 0 }), true);
    for (const init of [{ button: 1 }, { button: 2 }, { ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }]) {
        assert.equal(click(init), false, JSON.stringify(init));
    }
    w.close();
});

test('normaliseSpace collapses whitespace runs and trims', () => {
    const w = utils();
    assert.equal(w.DREUtils.normaliseSpace('  A\n\tcited   record. '), 'A cited record.');
    assert.equal(w.DREUtils.normaliseSpace(null), '');
    w.close();
});
