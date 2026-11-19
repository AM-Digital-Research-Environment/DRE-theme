import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

import {themeScript} from '../support/theme-script.mjs';
const source = file => readFileSync(new URL('../../' + themeScript(file.replace(/\.js$/, '')), import.meta.url), 'utf8');
const frame = w => new Promise(resolve => w.requestAnimationFrame(() => resolve()));

function header() {
    const dom = new JSDOM(`<!doctype html><html><body>
        <header class="main-header" data-nav="inline"><div class="main-header__main-bar">
            <input type="search" aria-label="Search"><button class="main-navigation__toggle" aria-expanded="false">Menu</button>
        </div></header>
        <nav id="menu-drawer"></nav>
        <main><a href="#x" id="page-link">Content</a></main>
    </body></html>`, { url: 'https://example.test/', runScripts: 'outside-only', pretendToBeVisual: true });
    const w = dom.window;
    let y = 0;
    Object.defineProperty(w, 'scrollY', { configurable: true, get: () => y });
    // jsdom has no ResizeObserver: record what is observed, and report sizes by hand.
    const observers = [];
    w.ResizeObserver = class {
        constructor(callback) { this.callback = callback; observers.push(this); }
        observe(target) { this.target = target; }
        report(blockSize) { this.callback([{ target: this.target, borderBoxSize: [{ blockSize }] }], this); }
    };
    w.eval(source('utils.js'));
    w.eval(source('script.js'));
    w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
    const scrollTo = async position => {
        y = position;
        w.document.dispatchEvent(new w.Event('scroll'));
        await frame(w);
    };
    return { w, scrollTo, observers, mainHeader: w.document.querySelector('.main-header') };
}

test('the measured header height is the one owner of the anchor offset', () => {
    const { w, observers, mainHeader } = header();
    const root = w.document.documentElement;
    assert.equal(observers.length, 1);
    assert.equal(observers[0].target, mainHeader, 'the whole header is measured, nav row and user bar included');
    observers[0].report(121.6);
    assert.equal(root.style.getPropertyValue('--header-height'), '122px',
        'written as the token the drawer and --scroll-offset already read');
    // Focus in the header no longer writes an inline offset that would outrank
    // the stylesheet (base/_theme.scss zeroes it only while a header field has focus).
    w.document.querySelector('input').focus();
    w.document.getElementById('page-link').focus();
    assert.equal(root.style.scrollPaddingTop, '');
    w.close();
});

test('the inline header hides on a deep scroll down, but never while the drawer is open or it has focus', async () => {
    const { w, scrollTo, mainHeader } = header();
    const away = () => mainHeader.classList.contains('is-scrolled-away');
    await scrollTo(500);
    assert.equal(away(), true, 'scrolling down past the threshold hides it');
    assert.equal(mainHeader.style.top, '', 'by a class the stylesheet turns into a transform, not by `top`');
    await scrollTo(300);
    assert.equal(away(), false, 'any scroll up brings it back');

    w.document.querySelector('.main-navigation__toggle').setAttribute('aria-expanded', 'true');
    await scrollTo(900);
    assert.equal(away(), false, 'an open drawer pins the header');
    w.document.querySelector('.main-navigation__toggle').setAttribute('aria-expanded', 'false');

    w.document.querySelector('input').focus();
    await scrollTo(1500);
    assert.equal(away(), false, 'focus in the header pins it');

    w.document.getElementById('page-link').focus();
    await scrollTo(2000);
    assert.equal(away(), true);
    w.document.querySelector('input').focus();
    assert.equal(away(), false, 'tabbing into a hidden header brings it back at once');

    mainHeader.setAttribute('data-nav', 'drawer');
    w.document.getElementById('page-link').focus();
    await scrollTo(2500);
    assert.equal(away(), false, 'drawer (mobile) mode keeps the hamburger reachable');
    w.close();
});

test('the core search disclosure is left alone without its field', () => {
    const dom = new JSDOM(`<!doctype html><html><body>
        <div data-core-search><button class="main-search-button" hidden aria-expanded="false">Search</button>
            <div class="main-header-search"><p>No field here</p></div></div>
    </body></html>`, { url: 'https://example.test/', runScripts: 'outside-only', pretendToBeVisual: true });
    const w = dom.window;
    w.eval(source('utils.js'));
    w.eval(source('script.js'));
    w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
    const button = w.document.querySelector('.main-search-button');
    assert.equal(button.hidden, true, 'not enhanced, so nothing claims to expand');
    assert.equal(w.document.querySelector('.main-header-search').hidden, false, 'the panel stays as rendered');
    w.close();
});

function revealFixture({ reduced = false, observer = true } = {}) {
    const dom = new JSDOM(`<!doctype html><html><body>
        <article data-rv-reveal="0" id="above">On screen</article>
        <article data-rv-reveal="70" id="below">Below the fold</article>
    </body></html>`, { url: 'https://example.test/', runScripts: 'outside-only', pretendToBeVisual: true });
    const w = dom.window;
    Object.defineProperty(w, 'innerHeight', { configurable: true, value: 800 });
    w.matchMedia = query => ({ matches: reduced && query.includes('reduce'), addEventListener() {} });
    const tops = { above: 100, below: 1600 };
    w.HTMLElement.prototype.getBoundingClientRect = function () { return { top: tops[this.id] ?? 0 }; };
    const observed = [];
    let callback = null;
    if (observer) {
        w.IntersectionObserver = class {
            constructor(fn) { callback = fn; }
            observe(el) { observed.push(el); }
            unobserve(el) { observed.splice(observed.indexOf(el), 1); }
        };
    } else {
        delete w.IntersectionObserver;
    }
    w.eval(source('utils.js'));
    w.eval(source('reveal.js'));
    w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
    const doc = w.document;
    return { w, doc, observed, enter: el => callback([{ isIntersecting: true, target: el }], { unobserve: el2 => observed.splice(observed.indexOf(el2), 1) }) };
}

test('reveal leaves on-screen cards alone and animates only what is below the fold', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const { w, doc, observed, enter } = revealFixture();
    assert.equal(doc.getElementById('above').hasAttribute('data-reveal'), false, 'painted cards are never hidden');
    assert.equal(doc.getElementById('below').getAttribute('data-reveal'), 'hidden');
    assert.deepEqual(observed.map(el => el.id), ['below']);
    enter(doc.getElementById('below'));
    assert.equal(observed.length, 0, 'one-shot: the element is unobserved');
    t.mock.timers.tick(69);
    assert.equal(doc.getElementById('below').getAttribute('data-reveal'), 'hidden', 'not before its stagger delay');
    t.mock.timers.tick(1);
    assert.equal(doc.getElementById('below').getAttribute('data-reveal'), 'shown', 'the stagger delay is honoured');
    w.close();
});


test('reduced motion or no IntersectionObserver hides nothing', () => {
    for (const options of [{ reduced: true }, { observer: false }]) {
        const { w, doc } = revealFixture(options);
        assert.equal(doc.querySelectorAll('[data-reveal]').length, 0, JSON.stringify(options));
        w.close();
    }
});
