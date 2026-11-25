import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, copyFileSync, cpSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { JSDOM } from 'jsdom';

const root = resolve(import.meta.dirname, '../..');
import {themeScript} from '../support/theme-script.mjs';
const source = file => readFileSync(join(root, themeScript(file.replace(/\.js$/, ''))), 'utf8');
const dom = html => new JSDOM(html, { url: 'https://example.test/?view=grid', runScripts: 'outside-only', pretendToBeVisual: true });
const start = (d, file) => { d.window.eval(source('utils.js')); d.window.eval(source(file)); d.window.document.dispatchEvent(new d.window.Event('DOMContentLoaded')); };

test('invalid Sass rejects compilation even when valid old CSS exists', () => {
    // Under the repository so the copied CLI resolves installed dependencies.
    mkdirSync(join(root, 'test-results'), {recursive:true});
    const folder = mkdtempSync(join(root, 'test-results', 'sass-'));
    try {
        for (const path of ['config', 'asset/sass', 'asset/css', 'scripts']) mkdirSync(join(folder, path), { recursive: true });
        copyFileSync(join(root, 'scripts/build-css.mjs'), join(folder, 'scripts/build-css.mjs'));
        cpSync(join(root, 'scripts/lib'), join(folder, 'scripts/lib'), { recursive: true });
        copyFileSync(join(root, 'package.json'), join(folder, 'package.json'));
        copyFileSync(join(root, 'config/theme.ini'), join(folder, 'config/theme.ini'));
        writeFileSync(join(folder, 'asset/css/style.css'), 'body{color:red}');
        writeFileSync(join(folder, 'asset/sass/style.scss'), '.broken { color: ;');
        const run = spawnSync(process.execPath, [join(folder, 'scripts/build-css.mjs')], { encoding: 'utf8', timeout: 60000 });
        assert.equal(run.error, undefined, String(run.error));
        assert.notEqual(run.status, 0, run.stdout + run.stderr);
        assert.match(run.stdout + run.stderr, /Expected expression/);
        assert.equal(readFileSync(join(folder, 'asset/css/style.css'), 'utf8'), 'body{color:red}');
    } finally { rmSync(folder, { recursive: true, force: true }); }
});

test('browse transitions retire layout engines and synchronize every pager and history state', () => {
    const d = dom(`<main><div class="layout-toggle"><button class="grid" aria-pressed="true">Grid</button><button class="list">List</button></div>
        <div class="resources resource-grid"><div class="resource"><div class="resource__meta"></div></div></div>
        <div class="pager-wrapper"><a class="next" href="/?page=2&view=grid">Next</a><form class="pager"><input name="view" value="grid"></form></div></main>`);
    let active = 0;
    d.window.matchMedia = () => ({ matches: false });
    d.window.CSS.supports = () => false;
    d.window.Masonry = class { constructor() { active++; } destroy() { active--; } layout() {} };
    start(d, 'browse.js');
    const doc = d.window.document;
    for (let i = 0; i < 5; i++) {
        doc.querySelector('.list').click(); assert.equal(active, 0);
        assert.equal(doc.querySelector('[name=view]').value, 'list');
        assert.match(doc.querySelector('.next').href, /view=list/);
        doc.querySelector('.grid').click(); assert.equal(active, 1);
    }
    d.window.history.replaceState({}, '', '?view=list');
    d.window.dispatchEvent(new d.window.PopStateEvent('popstate'));
    assert.equal(active, 0);
    assert.ok(doc.querySelector('.resource-list'));
    assert.equal(doc.querySelector('.list').getAttribute('aria-pressed'), 'true');
    d.window.close();
});

test('the sort form carries the chosen view, and drops a stale one', () => {
    // Core's sort-selector builds hidden inputs from the URL at load: here the
    // page was loaded with ?view=list, so the form starts with view=list.
    const d = dom(`<main><div class="layout-toggle"><button class="grid" aria-pressed="true">Grid</button><button class="list">List</button></div>
        <div class="browse-controls"><form class="sorting"><input type="hidden" name="filter" value="x"><input type="hidden" name="view" value="list"><select name="sort_by"></select></form></div>
        <div class="resources resource-grid"><div class="resource"><div class="resource__meta"></div></div></div></main>`);
    d.window.matchMedia = () => ({ matches: false });
    d.window.CSS.supports = () => true;
    start(d, 'browse.js');
    const form = d.window.document.querySelector('form.sorting');
    const views = () => Array.from(form.querySelectorAll('[name=view]'), input => input.value);
    assert.deepEqual(views(), ['grid'], 'the URL (?view=grid) wins over the stale input');
    d.window.document.querySelector('.list').click();
    assert.deepEqual(views(), ['list']);
    assert.equal(form.querySelector('[name=filter]').value, 'x', 'other hidden inputs are left alone');
    d.window.history.replaceState({}, '', '/');
    d.window.dispatchEvent(new d.window.PopStateEvent('popstate'));
    assert.deepEqual(views(), [], 'no view in the URL: none in the form');
    d.window.close();
});

test('multiple browse previews follow the page view without double toggling', () => {
    const block = `<section><div class="layout-toggle"><button class="grid">Grid</button><button class="list">List</button></div><div class="resources resource-grid"><div class="resource"></div></div></section>`;
    const d = dom(block + block);
    start(d, 'browse.js');
    d.window.document.querySelector('.list').click();
    assert.equal(d.window.document.querySelectorAll('.resource-list').length, 2);
    d.window.history.replaceState({}, '', '?view=grid');
    d.window.dispatchEvent(new d.window.PopStateEvent('popstate'));
    assert.equal(d.window.document.querySelectorAll('.resource-grid').length, 2);
    d.window.close();
});

test('desktop Escape restores focus to the caret without reopening its submenu', () => {
    const d = dom(`<header class="main-header"><div class="main-header__main-bar"><button class="main-navigation__toggle"><span class="sr-only"></span></button>
        <nav id="menu-drawer"><button id="menu-backer"></button><div id="menu-clones"></div></nav></div>
        <nav class="main-navigation"><ul class="navigation"><li><a href="/parent">Parent</a><ul><li><a href="/child">Child</a></li></ul></li></ul></nav></header>`);
    d.window.HTMLElement.prototype.scrollTo = () => {};
    start(d, 'navigation.js');
    const item = d.window.document.querySelector('.main-navigation li');
    const caret = item.querySelector('button');
    for (const link of item.querySelectorAll('a')) {
        caret.click();
        link.focus();
        link.dispatchEvent(new d.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        assert.equal(item.classList.contains('open'), false);
        assert.equal(caret.getAttribute('aria-expanded'), 'false');
        assert.equal(d.window.document.activeElement, caret, 'focus on the caret does not reopen it');
    }
    d.window.close();
});

test('consumed or rejected PWA prompts stay hidden until a fresh event', async () => {
    const d = dom('<button data-pwa-install hidden>Install</button>');
    d.window.matchMedia = () => ({ matches: false });
    start(d, 'pwa-install.js');
    const button = d.window.document.querySelector('button');
    for (const outcome of ['dismissed', 'accepted', 'rejected']) {
        const event = new d.window.Event('beforeinstallprompt', { cancelable: true });
        let prompts = 0;
        event.prompt = () => { prompts++; return outcome === 'rejected' ? Promise.reject(new Error('denied')) : Promise.resolve(); };
        event.userChoice = Promise.resolve({ outcome });
        d.window.dispatchEvent(event); assert.equal(button.hidden, false);
        button.click(); button.click();
        await new Promise(resolve => setTimeout(resolve, 0));
        assert.equal(prompts, 1); assert.equal(button.hidden, true);
    }
    d.window.close();
});

test('every data-lr and in-block data-connection hook the connection script reads is rendered by the partial', () => {
    const script = source('linked-resources.js');
    const partial = readFileSync(join(root, 'view/common/linked-resources.phtml'), 'utf8');
    const hooks = new Set([...script.matchAll(/\[(data-(?:lr|connection)-[a-z-]+)/g)].map(match => match[1]))
        // The block wrapper and its status and recovery controls are the block template's.
        .difference(new Set(['data-connection-endpoint', 'data-connection-status', 'data-connection-recovery', 'data-connection-retry', 'data-connection-continue']));
    assert.ok(hooks.size >= 1, 'the scan found the script hooks');
    for (const hook of hooks) assert.ok(partial.includes(hook), `${hook} is used by the script but not rendered`);
});

test('Mirador themes early and late viewers once, then follows theme changes', async () => {
    const d = dom('<body data-theme="dark"></body>');
    const calls = [[], []]; const queue = [];
    d.window.setTimeout = callback => queue.push(callback);
    d.window.miradors = {a: {store: {dispatch: action => calls[0].push(action.config.selectedTheme)}}, b: {}};
    // In <head> the token bridge runs first; Mirador follows its onThemeChange.
    d.window.eval(source('dre-token-bridge.js'));
    d.window.eval(source('mirador-theme.js'));
    d.window.dispatchEvent(new d.window.Event('load'));
    assert.deepEqual(calls[0], ['dark']);
    d.window.miradors.b = {store: {dispatch: action => calls[1].push(action.config.selectedTheme)}};
    queue.shift()();
    assert.deepEqual(calls, [['dark'], ['dark']]);
    d.window.document.body.dataset.theme = 'light';
    await Promise.resolve();
    assert.deepEqual(calls, [['dark', 'light'], ['dark', 'light']]);
    d.window.close();
});
test('token bridge follows explicit preferences and supports unsubscribe', async () => {
    const d = dom('<body data-theme="light"></body>');
    d.window.matchMedia = () => ({matches:true});
    d.window.eval(source('dre-token-bridge.js'));
    assert.equal(d.window.DRETokens.isDark(), false);
    const values = []; const stop = d.window.DRETokens.onThemeChange(value => values.push(value));
    d.window.document.body.dataset.theme = 'dark'; await Promise.resolve();
    assert.equal(values.at(-1), true); stop();
    const count = values.length;
    d.window.document.body.dataset.theme = 'light'; await Promise.resolve();
    assert.equal(values.length, count);
    d.window.close();
});
test('token bridge listeners hear a mode change, not a rewrite of the same mode', async () => {
    const d = dom('<html data-theme="dark"><body data-theme="dark"></body></html>');
    d.window.eval(source('dre-token-bridge.js'));
    const values = []; d.window.DRETokens.onThemeChange(value => values.push(value));
    const doc = d.window.document;
    // theme-toggle.js's sync at load writes the value already there, on both elements.
    doc.documentElement.setAttribute('data-theme', 'dark'); doc.body.setAttribute('data-theme', 'dark');
    await Promise.resolve();
    assert.deepEqual(values, [], 'no change, no call');
    doc.documentElement.setAttribute('data-theme', 'light'); doc.body.setAttribute('data-theme', 'light');
    await Promise.resolve();
    doc.body.setAttribute('data-theme', 'light');
    await Promise.resolve();
    assert.deepEqual(values, [false], 'one call for the one change');
    d.window.close();
});
