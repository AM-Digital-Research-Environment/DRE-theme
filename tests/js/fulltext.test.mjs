import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { themeScript } from '../support/theme-script.mjs';

// The sources, or with DRE_SCRIPTS=dist the minified builds the templates load.
const source = (name) => readFileSync(new URL('../../' + themeScript(name), import.meta.url), 'utf8');
const settle = () => new Promise((resolve) => setImmediate(resolve));

const WHOLE = 'The opening words of a long transcript,\nand then everything after them.';

/** A record value as common/resource-values.phtml renders a cut full text. */
function fixture({ fromPage = false, index = 0 } = {}) {
    const href = fromPage ? 'https://example.test/s/a/item/7?full-text=1#v-text-0' : 'https://example.test/api/items/7';
    const dom = new JSDOM(`<!doctype html><html><body><dl><dd>
        <span class="value-content record-fulltext" id="v-text-0" tabindex="-1" data-term="bibo:content" data-index="${index}">The opening words of a long transcript,
and then…</span>
        <span class="record-fulltext__more">
            <a class="record-fulltext__load" href="${href}" aria-controls="v-text-0" data-fulltext-load
                ${fromPage ? 'data-fulltext-source="page"' : ''}
                data-loading="Loading" data-loaded="Full text loaded" data-error="Could not load">Read the full text</a>
        </span>
    </dd></dl></body></html>`, { url: 'https://example.test/s/a/item/7', runScripts: 'outside-only' });
    const w = dom.window;
    const requests = [];
    let fetchResponse = () => ({ ok: true, json: async () => ({ 'bibo:content': [{ '@value': WHOLE }] }) });
    w.fetch = async (url, options) => {
        requests.push({ url: String(url), options });
        return fetchResponse(url);
    };
    w.eval(source('utils'));
    w.eval(source('fulltext'));
    const doc = w.document;
    return {
        w, doc, requests,
        link: () => doc.querySelector('[data-fulltext-load]'),
        text: doc.getElementById('v-text-0'),
        respond: (fn) => { fetchResponse = fn; },
        click: (init = {}) => doc.querySelector('[data-fulltext-load]').dispatchEvent(
            new w.MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init })),
    };
}

test('a plain click puts the whole text in place of the opening', async () => {
    const f = fixture();
    const notCancelled = f.click();
    assert.equal(notCancelled, false, 'the link is taken over');
    assert.equal(f.link().getAttribute('aria-busy'), 'true');
    assert.equal(f.link().textContent, 'Loading');
    await settle();
    assert.equal(f.requests.length, 1);
    assert.equal(f.requests[0].options.headers.Accept, 'application/json');
    assert.equal(f.text.textContent, WHOLE);
    assert.ok(f.text.classList.contains('is-complete'));
    assert.equal(f.doc.querySelector('.record-fulltext__more'), null, 'the control has done its job');
    assert.equal(f.doc.activeElement, f.text, 'focus moves to the text asked for');
    f.w.close();
});

test('modified and non-primary clicks stay the browser’s', () => {
    for (const init of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) {
        const f = fixture();
        assert.equal(f.click(init), true, JSON.stringify(init));
        assert.equal(f.requests.length, 0);
        f.w.close();
    }
});

test('the API value is matched by its opening, not trusted by index', async () => {
    const f = fixture({ index: 0 });
    // A private value ahead of it shifts the index the template saw.
    f.respond(() => ({ ok: true, json: async () => ({ 'bibo:content': [{ '@value': 'Another text entirely' }, { '@value': WHOLE }] }) }));
    f.click();
    await settle();
    assert.equal(f.text.textContent, WHOLE);
    f.w.close();
});

test('a private value is read from the record page itself', async () => {
    const f = fixture({ fromPage: true });
    f.respond(() => ({ ok: true, text: async () => `<span id="v-text-0">${WHOLE}</span>` }));
    f.click();
    await settle();
    assert.equal(f.requests[0].url, 'https://example.test/s/a/item/7?full-text=1', 'the fragment is not sent');
    assert.equal(f.text.textContent, WHOLE);
    f.w.close();
});

test('a failed load says so on the link and can be tried again', async () => {
    const f = fixture();
    f.respond(() => ({ ok: false, status: 503 }));
    f.click();
    await settle();
    assert.equal(f.link().textContent, 'Could not load');
    assert.equal(f.link().hasAttribute('aria-busy'), false);
    assert.match(f.text.textContent, /…$/, 'the opening stays');
    f.respond(() => ({ ok: true, json: async () => ({ 'bibo:content': [{ '@value': WHOLE }] }) }));
    f.click();
    await settle();
    assert.equal(f.text.textContent, WHOLE);
    f.w.close();
});

test('a text the response does not hold counts as a failure', async () => {
    const f = fixture();
    f.respond(() => ({ ok: true, json: async () => ({ 'bibo:content': [{ '@value': 'Unrelated' }] }) }));
    f.click();
    await settle();
    assert.equal(f.link().textContent, 'Could not load');
    f.w.close();
});

test('a stalled load gives up after a timeout and can be tried again', async () => {
    const f = fixture();
    // The script's own timer, fired by hand instead of waited for.
    const timers = [];
    f.w.setTimeout = (callback, ms) => timers.push({ callback, ms });
    f.w.clearTimeout = () => {};
    // A request that never answers, until its signal aborts it.
    f.respond(() => new Promise((_resolve, reject) => {
        const signal = f.requests.at(-1).options.signal;
        signal?.addEventListener('abort', () => reject(new f.w.DOMException('Aborted', 'AbortError')));
    }));
    f.click();
    await settle();
    assert.equal(f.link().getAttribute('aria-busy'), 'true');
    assert.equal(timers.length, 1, 'one timeout per load');
    assert.equal(timers[0].ms, 30000);
    timers[0].callback();
    await settle();
    assert.equal(f.link().textContent, 'Could not load');
    assert.equal(f.link().hasAttribute('aria-busy'), false, 'the busy guard lets go');
    f.respond(() => ({ ok: true, json: async () => ({ 'bibo:content': [{ '@value': WHOLE }] }) }));
    f.click();
    await settle();
    assert.equal(f.text.textContent, WHOLE, 'a second click loads the text');
    f.w.close();
});
