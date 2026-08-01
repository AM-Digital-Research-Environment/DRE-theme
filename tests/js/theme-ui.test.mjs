import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';

const ROOT = join(import.meta.dirname, '..', '..');
const source = (file) => readFileSync(join(ROOT, 'asset', 'js', file), 'utf8');

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

test('theme toggle uses translated labels and persists a valid preference', () => {
    const dom = new JSDOM(`<!doctype html><html><body>
        <button data-theme-toggle data-label-light="Mode clair" data-label-dark="Mode sombre"
            aria-label="Basculer" aria-pressed="false"></button>
    </body></html>`, { url: 'https://example.test/', runScripts: 'outside-only' });
    dom.window.matchMedia = () => matchMedia(false);
    dom.window.eval(source('theme-toggle.js'));
    ready(dom);

    const button = dom.window.document.querySelector('[data-theme-toggle]');
    assert.equal(button.getAttribute('aria-label'), 'Mode sombre');
    button.click();
    assert.equal(dom.window.document.body.dataset.theme, 'dark');
    assert.equal(button.getAttribute('aria-label'), 'Mode clair');
    assert.equal(button.getAttribute('aria-pressed'), 'true');
    assert.equal(dom.window.localStorage.getItem('dre-theme-preference'), 'dark');

    dom.window.DRETheme.set('sepia');
    assert.equal(dom.window.document.body.dataset.theme, 'dark');
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
    dom.window.eval(source('theme-toggle.js'));
    ready(dom);

    const button = dom.window.document.querySelector('[data-theme-toggle]');
    assert.doesNotThrow(() => button.click());
    assert.equal(dom.window.document.body.dataset.theme, 'dark');
    dom.window.close();
});

test('mobile navigation opens and closes with synchronized ARIA state', () => {
    const dom = new JSDOM(`<!doctype html><html><body>
        <header class="main-header" data-nav="drawer">
            <div class="main-header__main-bar">
                <button class="main-navigation__toggle" aria-expanded="false"
                    data-label-open="Ouvrir" data-label-close="Fermer"><span class="sr-only">Ouvrir</span></button>
                <nav class="main-navigation" data-submenu-label="Sous-menu %s">
                    <ul class="navigation"><li><a href="/one">One</a></li></ul>
                </nav>
                <nav id="menu-drawer" aria-hidden="true" inert>
                    <button id="menu-backer" type="button">Close</button>
                    <div id="menu-clones"></div>
                </nav>
            </div>
        </header>
    </body></html>`, { url: 'https://example.test/', runScripts: 'outside-only', pretendToBeVisual: true });
    dom.window.HTMLElement.prototype.scrollTo = function () {};
    dom.window.eval(source('utils.js'));
    dom.window.eval(source('navigation.js'));
    ready(dom);

    const button = dom.window.document.querySelector('.main-navigation__toggle');
    const drawer = dom.window.document.getElementById('menu-drawer');
    button.click();
    assert.equal(button.getAttribute('aria-expanded'), 'true');
    assert.equal(button.querySelector('.sr-only').textContent, 'Fermer');
    assert.equal(drawer.hasAttribute('aria-hidden'), false);
    assert.equal(dom.window.document.body.classList.contains('menu-drawer-toggled'), true);

    button.click();
    assert.equal(button.getAttribute('aria-expanded'), 'false');
    assert.equal(button.querySelector('.sr-only').textContent, 'Ouvrir');
    assert.equal(drawer.getAttribute('aria-hidden'), 'true');
    dom.window.close();
});

test('PWA manifest is attached and install prompt controls button visibility', () => {
    const dom = new JSDOM(`<!doctype html><html><head>
        <script type="application/json" id="dre-pwa-manifest">{"id":"/s/a/","start_url":"/s/a/","scope":"/s/a/","icons":[]}</script>
    </head><body><button data-pwa-install hidden></button></body></html>`, {
        url: 'https://example.test/s/a/', runScripts: 'outside-only',
    });
    dom.window.matchMedia = () => matchMedia(false);
    dom.window.URL.createObjectURL = () => 'blob:https://example.test/manifest';
    dom.window.eval(source('pwa-install.js'));
    ready(dom);

    assert.equal(dom.window.document.querySelector('link[rel="manifest"]').href,
        'blob:https://example.test/manifest');
    const prompt = new dom.window.Event('beforeinstallprompt', { cancelable: true });
    prompt.prompt = () => Promise.resolve();
    prompt.userChoice = Promise.resolve({ outcome: 'dismissed' });
    dom.window.dispatchEvent(prompt);
    assert.equal(dom.window.document.querySelector('[data-pwa-install]').hidden, false);
    assert.equal(prompt.defaultPrevented, true);
    dom.window.close();
});
