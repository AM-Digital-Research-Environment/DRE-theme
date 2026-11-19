import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { themeScript } from '../support/theme-script.mjs';

// The sources, or with DRE_SCRIPTS=dist the minified build header.phtml inlines.
const source = (name) => readFileSync(new URL('../../' + themeScript(name), import.meta.url), 'utf8');

/**
 * The header's navigation markup, the classifier run as the parser reaches it
 * (header.phtml inlines it after the nav), a viewport width, and the widths
 * jsdom cannot lay out: the row's available width and the menu's natural one.
 */
function fixture({ width = 1280, available = 1000, natural = 600 } = {}) {
    const dom = new JSDOM(`<!doctype html><html class="js"><body>
        <header class="main-header"><div class="main-header__nav-row"><nav class="main-navigation">
            <div class="main-navigation__container"><ul class="navigation"><li><a href="/a">A</a></li></ul></div>
        </nav></div></header>
    </body></html>`, { url: 'https://example.test/', runScripts: 'outside-only' });
    const w = dom.window;
    w.matchMedia = (query) => ({ matches: query === '(min-width: 1200px)' && width >= 1200 });
    const frames = [];
    w.requestAnimationFrame = (callback) => frames.push(callback);
    const doc = w.document;
    const container = doc.querySelector('.main-navigation__container');
    const menu = container.querySelector('ul');
    Object.defineProperty(container, 'clientWidth', { configurable: true, get: () => available });
    // Measured only under the off-screen, no-wrap probe styles.
    menu.getBoundingClientRect = () => ({ width: menu.style.flexWrap === 'nowrap' ? natural : 0 });
    w.eval(source('nav-mode'));
    const header = doc.querySelector('.main-header');
    return {
        w, header, container, menu,
        flush: () => frames.splice(0).forEach((callback) => callback()),
        load: () => w.dispatchEvent(new w.Event('load')),
        mode: () => header.getAttribute('data-nav'),
    };
}

test('below the desktop breakpoint the drawer is chosen at once, with no measuring', () => {
    const f = fixture({ width: 390 });
    assert.equal(f.mode(), 'drawer');
    f.flush();
    assert.equal(f.mode(), 'drawer');
    f.w.close();
});

test('on desktop the menu is measured in the next frame, not while the page is parsed', () => {
    const f = fixture();
    assert.equal(f.mode(), null, 'no mode yet: the stylesheet keeps the row invisible until the frame');
    f.flush();
    assert.equal(f.mode(), 'inline');
    assert.equal(f.header.classList.contains('nav-ready'), false, 'the measuring gate is put back');
    assert.equal(f.container.style.cssText, '', 'the probe styles are removed');
    assert.equal(f.menu.style.cssText, '');
    f.w.close();
});

test('a menu wider than its row collapses to the drawer', () => {
    const f = fixture({ available: 600, natural: 900 });
    f.flush();
    assert.equal(f.mode(), 'drawer');
    // navigation.js re-runs the same classifier, and a wider row brings the inline menu back.
    Object.defineProperty(f.container, 'clientWidth', { configurable: true, get: () => 1200 });
    f.w.__dreClassifyNav();
    assert.equal(f.mode(), 'inline');
    f.w.close();
});

test('an earlier answer stands, and without navigation.js the expanded list takes over at load', () => {
    const f = fixture();
    f.w.__dreClassifyNav(); // navigation.js at DOMContentLoaded, before the frame
    f.header.setAttribute('data-nav', 'drawer');
    f.flush();
    assert.equal(f.mode(), 'drawer', 'the frame does not overrule a mode already set');
    f.load();
    assert.equal(f.header.classList.contains('nav-failed'), true);
    f.w.close();
});

test('a hidden tab, which runs no frames, is still classified by load', () => {
    const f = fixture();
    f.header.classList.add('nav-ready'); // navigation.js ran, but had nothing to call
    f.load();
    assert.equal(f.mode(), 'inline');
    assert.equal(f.header.classList.contains('nav-failed'), false);
    f.w.close();
});

test('a header without the navigation markup is left alone', () => {
    const dom = new JSDOM('<!doctype html><html><body><header class="main-header"></header></body></html>', { runScripts: 'outside-only' });
    assert.doesNotThrow(() => dom.window.eval(source('nav-mode')));
    assert.equal(dom.window.__dreClassifyNav, undefined);
    dom.window.close();
});
