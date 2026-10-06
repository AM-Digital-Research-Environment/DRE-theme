import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const source = file => readFileSync(new URL('../../asset/js/' + file, import.meta.url), 'utf8');
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
    w.eval(source('utils.js'));
    w.eval(source('script.js'));
    w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
    const scrollTo = async position => {
        y = position;
        w.document.dispatchEvent(new w.Event('scroll'));
        await frame(w);
    };
    return { w, scrollTo, mainHeader: w.document.querySelector('.main-header') };
}

test('anchor scroll padding is zeroed while focus is in the header and restored after', () => {
    const { w } = header();
    const root = w.document.documentElement;
    assert.equal(root.style.scrollPaddingTop, '20px', 'header height (0 in jsdom) + 20px');
    w.document.querySelector('input').focus();
    assert.equal(root.style.scrollPaddingTop, '0px', 'typing in the header search never nudges the page');
    w.document.getElementById('page-link').focus();
    assert.equal(root.style.scrollPaddingTop, '20px');
    w.close();
});

test('the inline header hides on a deep scroll down, but never while the drawer is open or it has focus', async () => {
    const { w, scrollTo, mainHeader } = header();
    await scrollTo(500);
    assert.match(mainHeader.style.top, /^-/, 'scrolling down past the threshold hides it');
    await scrollTo(300);
    assert.equal(mainHeader.style.top, '0px', 'any scroll up brings it back');

    w.document.querySelector('.main-navigation__toggle').setAttribute('aria-expanded', 'true');
    await scrollTo(900);
    assert.equal(mainHeader.style.top, '0px', 'an open drawer pins the header');
    w.document.querySelector('.main-navigation__toggle').setAttribute('aria-expanded', 'false');

    w.document.querySelector('input').focus();
    await scrollTo(1500);
    assert.equal(mainHeader.style.top, '0px', 'focus in the header pins it');

    mainHeader.setAttribute('data-nav', 'drawer');
    w.document.getElementById('page-link').focus();
    await scrollTo(2500);
    assert.equal(mainHeader.style.top, '0px', 'drawer (mobile) mode keeps the hamburger reachable');
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

test('reveal leaves on-screen cards alone and animates only what is below the fold', async () => {
    const { w, doc, observed, enter } = revealFixture();
    assert.equal(doc.getElementById('above').hasAttribute('data-reveal'), false, 'painted cards are never hidden');
    assert.equal(doc.getElementById('below').getAttribute('data-reveal'), 'hidden');
    assert.deepEqual(observed.map(el => el.id), ['below']);
    enter(doc.getElementById('below'));
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal(doc.getElementById('below').getAttribute('data-reveal'), 'shown', 'the stagger delay is honoured');
    assert.equal(observed.length, 0, 'one-shot: the element is unobserved');
    w.close();
});

test('reduced motion or no IntersectionObserver hides nothing', () => {
    for (const options of [{ reduced: true }, { observer: false }]) {
        const { w, doc } = revealFixture(options);
        assert.equal(doc.querySelectorAll('[data-reveal]').length, 0, JSON.stringify(options));
        w.close();
    }
});
