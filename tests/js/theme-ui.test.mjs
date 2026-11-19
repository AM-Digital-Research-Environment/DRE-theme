import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { themeScript } from '../support/theme-script.mjs';

// The sources, or with DRE_SCRIPTS=dist the minified builds the templates load.
const source = (name) => readFileSync(new URL('../../' + themeScript(name), import.meta.url), 'utf8');

function ready(dom) {
    dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
}

function matchMedia(matches = false) {
    return {
        matches,
        addEventListener() {},
        removeEventListener() {},
    };
}

/** The page order: the token bridge in <head>, then utils.js, then the toggle. */
function loadToggle(dom) {
    dom.window.eval(source('dre-token-bridge'));
    dom.window.eval(source('utils'));
    dom.window.eval(source('theme-toggle'));
    ready(dom);
}

test('theme toggle uses translated labels and persists a valid preference', () => {
    const dom = new JSDOM(`<!doctype html><html><body>
        <button data-theme-toggle data-label-light="Mode clair" data-label-dark="Mode sombre"
            aria-label="Basculer"></button>
    </body></html>`, { url: 'https://example.test/', runScripts: 'outside-only' });
    dom.window.matchMedia = () => matchMedia(false);
    loadToggle(dom);

    const button = dom.window.document.querySelector('[data-theme-toggle]');
    assert.equal(button.getAttribute('aria-label'), 'Mode sombre');
    button.click();
    assert.equal(dom.window.document.body.dataset.theme, 'dark');
    assert.equal(button.getAttribute('aria-label'), 'Mode clair');
    assert.equal(button.hasAttribute('aria-pressed'), false, 'an action label is not also a pressed toggle');
    assert.equal(dom.window.localStorage.getItem('dre-theme-preference'), 'dark');

    dom.window.close();
});

test('the toggle reads the applied mode through DRETokens, not its own copy', () => {
    const dom = new JSDOM(`<!doctype html><html data-theme="dark"><body data-theme="dark">
        <button data-theme-toggle data-label-light="Light" data-label-dark="Dark"></button>
    </body></html>`, { url: 'https://example.test/', runScripts: 'outside-only' });
    // A light OS: only the attribute the head script wrote says dark.
    dom.window.matchMedia = () => matchMedia(false);
    loadToggle(dom);

    const button = dom.window.document.querySelector('[data-theme-toggle]');
    assert.equal(button.getAttribute('aria-label'), 'Light', 'the head script’s dark choice stands');
    button.click();
    assert.equal(dom.window.document.body.dataset.theme, 'light');
    assert.equal(dom.window.DRETokens.isDark(), false);
    dom.window.close();
});

test('the address-bar tint follows the applied theme, not only the OS', () => {
    const dom = new JSDOM(`<!doctype html><html><head>
        <meta name="theme-color" content="#fdfcf9" media="(prefers-color-scheme: light)" data-theme-color="light">
        <meta name="theme-color" content="#0e1612" media="(prefers-color-scheme: dark)" data-theme-color="dark">
    </head><body data-theme="light">
        <button data-theme-toggle data-label-light="Light" data-label-dark="Dark"></button>
    </body></html>`, { url: 'https://example.test/', runScripts: 'outside-only' });
    dom.window.matchMedia = () => matchMedia(false);
    loadToggle(dom);

    const media = () => [...dom.window.document.querySelectorAll('meta[name="theme-color"]')].map(m => m.getAttribute('media'));
    assert.deepEqual(media(), ['all', 'not all']);
    dom.window.document.querySelector('[data-theme-toggle]').click();
    assert.deepEqual(media(), ['not all', 'all'], 'an explicit dark choice tints the bar dark on a light OS');
    dom.window.close();
});

test('theme toggle still works when storage is blocked', () => {
    const dom = new JSDOM(`<!doctype html><html><body>
        <button data-theme-toggle data-label-light="Light" data-label-dark="Dark"></button>
    </body></html>`, { url: 'https://example.test/', runScripts: 'outside-only' });
    dom.window.matchMedia = () => matchMedia(false);
    Object.defineProperty(dom.window, 'localStorage', {
        configurable: true,
        get() { throw new dom.window.DOMException('Blocked', 'SecurityError'); },
    });
    loadToggle(dom);

    const button = dom.window.document.querySelector('[data-theme-toggle]');
    assert.doesNotThrow(() => button.click());
    assert.equal(dom.window.document.body.dataset.theme, 'dark');
    dom.window.close();
});

/** The header as common/header.phtml renders it, in the mode given. */
function navigationFixture(mode = 'drawer') {
    const dom = new JSDOM(`<!doctype html><html><body>
        <header class="main-header" data-nav="${mode}">
            <div class="main-header__main-bar">
                <button class="main-navigation__toggle" aria-expanded="false"
                    data-label-open="Ouvrir" data-label-close="Fermer"><span class="sr-only">Ouvrir</span></button>
                <nav id="menu-drawer" aria-hidden="true" inert>
                    <button id="menu-backer" type="button">Close</button>
                    <div id="menu-clones"></div>
                </nav>
            </div>
            <nav class="main-navigation" data-submenu-label="Sous-menu %s">
                <div class="main-navigation__container">
                    <ul class="navigation">
                        <li><a href="/research">Research</a>
                            <ul><li><a href="/projects">Projects</a></li><li><a href="/people">People</a></li></ul>
                        </li>
                        <li><a href="/about">About</a></li>
                    </ul>
                </div>
            </nav>
        </header>
        <main><a href="#top" id="page-link">Content</a></main>
    </body></html>`, { url: 'https://example.test/', runScripts: 'outside-only', pretendToBeVisual: true });
    dom.window.HTMLElement.prototype.scrollTo = function () {};
    dom.window.eval(source('utils'));
    dom.window.eval(source('navigation'));
    ready(dom);
    const doc = dom.window.document;
    const key = (target, name) => target.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: name, bubbles: true }));
    return { dom, doc, key };
}

test('mobile navigation opens and closes with synchronized ARIA state', () => {
    const { dom, doc } = navigationFixture();
    const button = doc.querySelector('.main-navigation__toggle');
    const drawer = doc.getElementById('menu-drawer');
    button.click();
    assert.equal(button.getAttribute('aria-expanded'), 'true');
    assert.equal(button.querySelector('.sr-only').textContent, 'Fermer');
    assert.equal(drawer.hasAttribute('aria-hidden'), false);
    assert.equal(doc.body.classList.contains('menu-drawer-toggled'), true);

    button.click();
    assert.equal(button.getAttribute('aria-expanded'), 'false');
    assert.equal(button.querySelector('.sr-only').textContent, 'Ouvrir');
    assert.equal(drawer.getAttribute('aria-hidden'), 'true');
    dom.window.close();
});

test('desktop panels open from the caret or the pointer, never from focus alone', () => {
    const { dom, doc, key } = navigationFixture('inline');
    const item = doc.querySelector('.main-navigation .navigation > li');
    const link = item.querySelector(':scope > a');
    const caret = item.querySelector('.submenu-btn');

    assert.equal(link.hasAttribute('aria-expanded'), false, 'the navigating link is not the disclosure');
    assert.equal(caret.getAttribute('aria-expanded'), 'false');
    assert.equal(doc.getElementById(caret.getAttribute('aria-controls')), item.querySelector('ul'));

    link.focus();
    assert.equal(item.classList.contains('open'), false, 'Tab onto a parent link leaves its panel shut');

    caret.click();
    assert.equal(item.classList.contains('open'), true);
    assert.equal(caret.getAttribute('aria-expanded'), 'true');
    item.querySelector('ul a').focus();
    key(doc.activeElement, 'Escape');
    assert.equal(item.classList.contains('open'), false);
    assert.equal(caret.getAttribute('aria-expanded'), 'false');
    assert.equal(doc.activeElement, caret, 'Escape inside the panel returns focus to its caret');

    // Hover opens by class; Escape dismisses it with the pointer still there
    // and keyboard focus elsewhere on the page (WCAG 1.4.13).
    doc.getElementById('page-link').focus();
    item.dispatchEvent(new dom.window.MouseEvent('mouseenter'));
    assert.equal(item.classList.contains('open'), true);
    key(doc.activeElement, 'Escape');
    assert.equal(item.classList.contains('open'), false);
    assert.equal(doc.activeElement, doc.getElementById('page-link'), 'focus is not pulled into the menu');
    dom.window.close();
});

test('drawer parent links state whether their sub-level is showing', () => {
    const { dom, doc } = navigationFixture();
    const drawer = doc.getElementById('menu-drawer');
    doc.querySelector('.main-navigation__toggle').click();

    const parent = drawer.querySelector('.menu-item-has-children');
    const opener = parent.querySelector(':scope > a');
    assert.equal(opener.getAttribute('aria-expanded'), 'false');
    assert.equal(doc.getElementById(opener.getAttribute('aria-controls')), parent.querySelector('ul'));
    assert.equal(parent.querySelector('.menu-header a').hasAttribute('aria-expanded'), false,
        'the sub-level’s own copy of the link navigates, so it claims no state');

    opener.click();
    assert.equal(opener.getAttribute('aria-expanded'), 'true');
    doc.getElementById('menu-backer').click();
    assert.equal(opener.getAttribute('aria-expanded'), 'false', 'the back step collapses it');

    opener.click();
    doc.querySelector('.main-navigation__toggle').click();
    assert.equal(opener.getAttribute('aria-expanded'), 'false', 'closing the drawer resets every level');
    dom.window.close();
});

test('PWA manifest is attached and install prompt controls button visibility', () => {
    const dom = new JSDOM(`<!doctype html><html><head>
        <script type="application/json" id="dre-pwa-manifest">{"id":"/s/a/","start_url":"/s/a/","scope":"/s/a/","icons":[{"src":"icon.png"}],"shortcuts":[{"url":"search","icons":[{"src":"s.png"}]}]}</script>
    </head><body><button data-pwa-install hidden></button></body></html>`, {
        url: 'https://example.test/s/a/', runScripts: 'outside-only',
    });
    dom.window.matchMedia = () => matchMedia(false);
    let manifest = null;
    dom.window.URL.createObjectURL = (blob) => {
        manifest = blob;
        return 'blob:https://example.test/manifest';
    };
    dom.window.eval(source('utils'));
    dom.window.eval(source('pwa-install'));
    ready(dom);

    assert.equal(dom.window.document.querySelector('link[rel="manifest"]').href,
        'blob:https://example.test/manifest');
    assert.ok(manifest, 'the manifest is built as a blob');
    const prompt = new dom.window.Event('beforeinstallprompt', { cancelable: true });
    prompt.prompt = () => Promise.resolve();
    prompt.userChoice = Promise.resolve({ outcome: 'dismissed' });
    dom.window.dispatchEvent(prompt);
    assert.equal(dom.window.document.querySelector('[data-pwa-install]').hidden, false);
    assert.equal(prompt.defaultPrevented, true);
    dom.window.close();
});

test('the PWA manifest URLs are made absolute before the blob is built', () => {
    const dom = new JSDOM(`<!doctype html><html><head>
        <script type="application/json" id="dre-pwa-manifest">{"id":"/s/a/","start_url":"/s/a/","scope":"/s/a/","icons":[{"src":"icon.png"}],"shortcuts":[{"url":"search","icons":[{"src":"s.png"}]}]}</script>
    </head><body></body></html>`, { url: 'https://example.test/s/a/', runScripts: 'outside-only' });
    dom.window.matchMedia = () => matchMedia(false);
    let parts = null;
    dom.window.Blob = class { constructor(content) { parts = content; } };
    dom.window.URL.createObjectURL = () => 'blob:https://example.test/manifest';
    dom.window.eval(source('utils'));
    dom.window.eval(source('pwa-install'));
    ready(dom);

    const manifest = JSON.parse(parts.join(''));
    assert.equal(manifest.start_url, 'https://example.test/s/a/');
    assert.equal(manifest.icons[0].src, 'https://example.test/s/a/icon.png');
    assert.equal(manifest.shortcuts[0].url, 'https://example.test/s/a/search');
    assert.equal(manifest.shortcuts[0].icons[0].src, 'https://example.test/s/a/s.png');
    dom.window.close();
});
