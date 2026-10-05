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
