import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { themeScript } from '../support/theme-script.mjs';

// The sources, or with DRE_SCRIPTS=dist the minified builds the templates load.
const source = (name) => readFileSync(new URL('../../' + themeScript(name), import.meta.url), 'utf8');

/** The control as layout.phtml renders it, with a stub IntersectionObserver. */
function fixture({ observer = true, reduced = false } = {}) {
    const dom = new JSDOM(`<!doctype html><html><body>
        <main id="content" tabindex="-1">Content</main>
        <button type="button" class="back-to-top" data-back-to-top aria-label="Back to top"></button>
    </body></html>`, { url: 'https://example.test/', runScripts: 'outside-only' });
    const w = dom.window;
    const observers = [];
    if (observer) {
        w.IntersectionObserver = class {
            constructor(callback) { this.callback = callback; this.targets = []; observers.push(this); }
            observe(target) { this.targets.push(target); }
            report(isIntersecting) { this.callback([{ target: this.targets[0], isIntersecting }], this); }
        };
    } else {
        delete w.IntersectionObserver;
    }
    const preference = { reduced };
    w.matchMedia = (query) => ({ matches: preference.reduced && query.includes('reduce') });
    const scrolls = [];
    w.scrollTo = (options) => scrolls.push({ ...options }); // copied out of the window’s realm
    let scrollListeners = 0;
    const add = w.addEventListener.bind(w);
    w.addEventListener = (type, ...rest) => {
        if (type === 'scroll') scrollListeners++;
        return add(type, ...rest);
    };
    w.eval(source('utils'));
    w.eval(source('back-to-top'));
    const button = w.document.querySelector('[data-back-to-top]');
    return { w, button, observers, scrolls, preference, scrollListeners: () => scrollListeners };
}

test('the control shows once the top of the page has scrolled out of view', () => {
    const { w, button, observers, scrollListeners } = fixture();
    assert.equal(scrollListeners(), 0, 'no scroll listener: the observer reports the crossings');
    assert.equal(observers.length, 1);
    const sentinel = observers[0].targets[0];
    assert.equal(sentinel.getAttribute('aria-hidden'), 'true');
    assert.equal(sentinel.style.height, '400px', 'the strip covers the first 400px of the page');
    assert.equal(sentinel.style.position, 'absolute');

    observers[0].report(true);
    assert.equal(button.classList.contains('is-visible'), false);
    observers[0].report(false);
    assert.equal(button.classList.contains('is-visible'), true);
    observers[0].report(true);
    assert.equal(button.classList.contains('is-visible'), false, 'scrolling back up hides it');
    w.close();
});

test('without IntersectionObserver the control simply stays available', () => {
    const { w, button } = fixture({ observer: false });
    assert.equal(button.classList.contains('is-visible'), true);
    w.close();
});

test('a click returns to the top and moves focus to the content, honouring reduced motion when clicked', () => {
    const { w, button, scrolls, preference } = fixture();
    button.click();
    assert.deepEqual(scrolls.at(-1), { top: 0, behavior: 'smooth' });
    assert.equal(w.document.activeElement, w.document.getElementById('content'));

    preference.reduced = true; // switched on while the page was open
    button.click();
    assert.deepEqual(scrolls.at(-1), { top: 0, behavior: 'auto' });
    w.close();
});

test('a page without the control is left alone', () => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { runScripts: 'outside-only' });
    dom.window.eval(source('utils'));
    assert.doesNotThrow(() => dom.window.eval(source('back-to-top')));
    assert.equal(dom.window.document.body.children.length, 0, 'no sentinel is added');
    dom.window.close();
});
