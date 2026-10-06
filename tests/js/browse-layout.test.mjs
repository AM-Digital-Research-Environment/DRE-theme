import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const source = readFileSync(new URL('../../asset/js/browse.js', import.meta.url), 'utf8');

test('browse toggles own one Masonry instance and restore state through history', async () => {
    const dom = new JSDOM(`<div><div class="layout-toggle"><button class="grid">Grid</button><button class="list">List</button></div>
        <div class="resources resource-grid"><div class="resource"><div class="resource__meta"></div></div></div></div>`,
        {url: 'https://theme.test/?filter=retained', runScripts: 'outside-only', pretendToBeVisual: true});
    const w = dom.window;
    let created = 0, destroyed = 0, layouts = 0;
    w.Masonry = class { constructor() { created++; } destroy() { destroyed++; } layout() { layouts++; } };
    w.DREUtils = {onReady: callback => callback()};
    // An engine without grid-lanes: the Masonry path. (jsdom's CSS.supports
    // accepts any value for a known property.)
    w.CSS.supports = () => false;
    w.eval(source);
    assert.equal(created, 1);
    w.document.querySelector('button.list').click();
    assert.equal(destroyed, 1);
    assert.equal(w.document.querySelector('.resource').classList.contains('media-object'), true);
    w.document.querySelector('button.grid').click();
    assert.equal(created, 2);
    const before = layouts;
    const image = w.document.createElement('img');
    w.document.querySelector('.resource').append(image);
    image.dispatchEvent(new w.Event('load'));
    image.dispatchEvent(new w.Event('error'));
    await new Promise(resolve => setTimeout(resolve, 40));
    assert.equal(layouts, before + 1);
    w.history.replaceState(null, '', '?view=list&filter=retained');
    w.dispatchEvent(new w.PopStateEvent('popstate'));
    assert.equal(destroyed, 2);
    assert.ok(w.document.querySelector('.resource-list'));
    assert.equal(new URL(w.location).searchParams.get('filter'), 'retained');
    w.close();
});

test('engines with display: grid-lanes never start or fetch Masonry', () => {
    const dom = new JSDOM(`<div><div class="layout-toggle"><button class="grid">Grid</button><button class="list">List</button></div>
        <div class="resources resource-grid"><div class="resource"><div class="resource__meta"></div></div></div></div>`,
        {url: 'https://theme.test/', runScripts: 'outside-only', pretendToBeVisual: true});
    const w = dom.window;
    let created = 0;
    w.Masonry = class { constructor() { created++; } destroy() {} layout() {} };
    w.DREUtils = {onReady: callback => callback()};
    w.CSS.supports = (property, value) => property === 'display' && value === 'grid-lanes';
    w.eval(source);
    assert.equal(created, 0);
    assert.equal(w.document.querySelectorAll('script').length, 0, 'no Masonry script is injected');
    w.close();
});

test('the toggle marks the active view as pressed and keeps keyboard focus', () => {
    const dom = new JSDOM(`<div><div class="layout-toggle"><button class="grid" aria-pressed="true">Grid</button><button class="list" aria-pressed="false">List</button></div>
        <div class="resources resource-grid"><div class="resource"></div></div></div>`,
        {url: 'https://theme.test/', runScripts: 'outside-only', pretendToBeVisual: true});
    const w = dom.window;
    w.DREUtils = {onReady: callback => callback()};
    w.eval(source);
    const list = w.document.querySelector('button.list');
    list.focus();
    list.click();
    assert.equal(list.getAttribute('aria-pressed'), 'true');
    assert.equal(w.document.querySelector('button.grid').getAttribute('aria-pressed'), 'false');
    assert.equal(list.disabled, false, 'the pressed button is not disabled');
    assert.equal(w.document.activeElement, list, 'focus stays on the control the reader used');
    const entries = w.history.length;
    list.click();
    assert.equal(w.history.length, entries, 're-pressing the current view adds no history entry');
    w.close();
});
