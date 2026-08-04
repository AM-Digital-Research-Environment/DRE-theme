import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';

const ROOT = join(import.meta.dirname, '..', '..');
const source = (file) => readFileSync(join(ROOT, 'asset', 'js', file), 'utf8');

/** The apparatus as record-apparatus.phtml renders it with three styles. */
function panelMarkup({ styles = ['curated', 'chicago', 'apa'], active = 'curated' } = {}) {
    const tabs = styles.map((style) => `
        <button type="button" class="record-apparatus__style" role="tab"
            id="record-cite-1-tab-${style}"
            aria-selected="${style === active ? 'true' : 'false'}"
            tabindex="${style === active ? '0' : '-1'}"
            data-citation-style="${style}">${style}</button>`).join('');
    const panels = styles.map((style) => `
        <p class="record-apparatus__citation" role="tabpanel"
            data-citation-panel="${style}"
            ${style === active ? '' : 'hidden'}>Citation in ${style} style.</p>`).join('');

    return `<!doctype html><html><body>
        <section class="record-apparatus">
            <div class="record-apparatus__cite" data-record-citation>
                <div role="tablist">${tabs}</div>
                ${panels}
            </div>
            <div class="record-apparatus__actions" data-record-copy hidden>
                <button type="button" class="record-apparatus__copy"
                    data-copy-text="Fallback text." data-copied-label="Copied">Copy citation</button>
            </div>
        </section>
    </body></html>`;
}

/** JSDOM has no clipboard API; install a recording stub in a secure context. */
function withClipboard(dom, { fail = false } = {}) {
    const writes = [];
    Object.defineProperty(dom.window, 'isSecureContext', { value: true, configurable: true });
    dom.window.navigator.clipboard = {
        writeText(text) {
            writes.push(text);
            return fail ? Promise.reject(new Error('denied')) : Promise.resolve();
        },
    };
    return writes;
}

const shown = (dom) => dom.window.document.querySelector('[data-citation-panel]:not([hidden])');
const tab = (dom, style) => dom.window.document.querySelector(`[data-citation-style="${style}"]`);

test('the style switcher shows one citation at a time', () => {
    const dom = new JSDOM(panelMarkup(), { url: 'https://example.test/', runScripts: 'outside-only' });
    withClipboard(dom);
    dom.window.eval(source('record.js'));

    assert.equal(shown(dom).dataset.citationPanel, 'curated', 'the default style is shown first');

    tab(dom, 'apa').click();
    assert.equal(shown(dom).dataset.citationPanel, 'apa');
    assert.equal(dom.window.document.querySelectorAll('[data-citation-panel]:not([hidden])').length, 1);
    assert.equal(tab(dom, 'apa').getAttribute('aria-selected'), 'true');
    assert.equal(tab(dom, 'curated').getAttribute('aria-selected'), 'false');
    dom.window.close();
});

test('the switcher is a roving tablist', () => {
    const dom = new JSDOM(panelMarkup(), { url: 'https://example.test/', runScripts: 'outside-only' });
    withClipboard(dom);
    dom.window.eval(source('record.js'));

    const press = (style, key) => tab(dom, style).dispatchEvent(
        new dom.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
    );

    // Exactly one tab is in the tab order at any time.
    const tabbable = () => [...dom.window.document.querySelectorAll('[data-citation-style]')]
        .filter((el) => el.tabIndex === 0).length;
    assert.equal(tabbable(), 1);

    press('curated', 'ArrowRight');
    assert.equal(shown(dom).dataset.citationPanel, 'chicago');
    assert.equal(tabbable(), 1);

    press('chicago', 'ArrowLeft');
    assert.equal(shown(dom).dataset.citationPanel, 'curated');

    // Wraps at the ends, and Home/End jump.
    press('curated', 'ArrowLeft');
    assert.equal(shown(dom).dataset.citationPanel, 'apa', 'arrow-left from the first wraps to the last');
    press('apa', 'Home');
    assert.equal(shown(dom).dataset.citationPanel, 'curated');
    press('curated', 'End');
    assert.equal(shown(dom).dataset.citationPanel, 'apa');
    dom.window.close();
});

test('copying takes the citation the reader is looking at', async () => {
    const dom = new JSDOM(panelMarkup(), { url: 'https://example.test/', runScripts: 'outside-only' });
    const writes = withClipboard(dom);
    dom.window.eval(source('record.js'));

    const button = dom.window.document.querySelector('.record-apparatus__copy');
    assert.equal(dom.window.document.querySelector('[data-record-copy]').hidden, false,
        'the copy control is revealed where the clipboard API exists');

    button.click();
    assert.deepEqual(writes, ['Citation in curated style.']);

    tab(dom, 'apa').click();
    button.click();
    assert.deepEqual(writes[1], 'Citation in apa style.', 'the visible style is what gets copied');

    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(button.textContent, 'Copied');
    assert.equal(button.getAttribute('aria-live'), 'polite', 'the change is announced');
    dom.window.close();
});

test('without a generated citation the copy button uses the server fallback', () => {
    const dom = new JSDOM(`<!doctype html><html><body>
        <section class="record-apparatus">
            <div class="record-apparatus__actions" data-record-copy hidden>
                <button type="button" class="record-apparatus__copy"
                    data-copy-text="A record. https://example.test/s/amira/item/1"
                    data-copied-label="Copied">Copy citation</button>
            </div>
        </section>
    </body></html>`, { url: 'https://example.test/', runScripts: 'outside-only' });
    const writes = withClipboard(dom);
    dom.window.eval(source('record.js'));

    dom.window.document.querySelector('.record-apparatus__copy').click();
    assert.deepEqual(writes, ['A record. https://example.test/s/amira/item/1']);
    dom.window.close();
});

test('the tabs work even where the clipboard API does not', () => {
    const dom = new JSDOM(panelMarkup(), { url: 'https://example.test/', runScripts: 'outside-only' });
    // No clipboard, insecure context — the copy half of the script bails early.
    Object.defineProperty(dom.window, 'isSecureContext', { value: false, configurable: true });
    dom.window.eval(source('record.js'));

    tab(dom, 'chicago').click();
    assert.equal(shown(dom).dataset.citationPanel, 'chicago', 'the switcher is not gated on copying');
    assert.equal(dom.window.document.querySelector('[data-record-copy]').hidden, true,
        'a control that cannot work stays hidden');
    dom.window.close();
});

test('a single style renders no tablist behaviour', () => {
    const dom = new JSDOM(panelMarkup({ styles: ['chicago'], active: 'chicago' }), {
        url: 'https://example.test/',
        runScripts: 'outside-only',
    });
    withClipboard(dom);
    dom.window.eval(source('record.js'));

    assert.equal(shown(dom).dataset.citationPanel, 'chicago');
    dom.window.close();
});
