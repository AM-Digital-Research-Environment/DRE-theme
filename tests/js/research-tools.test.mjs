import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const source = file => readFileSync(new URL('../../asset/js/'+file,import.meta.url),'utf8');
const dom = html => new JSDOM(html,{url:'https://example.test/item/1?view=list',runScripts:'outside-only',pretendToBeVisual:true});
const tick = () => new Promise(resolve=>setTimeout(resolve,0));
const result = title => `<details class="resources-linked"><summary><span class="resources-linked__summary">${title}</span></summary><p>${title}</p></details>`;
function connectionFixture() {
    return dom(`<div data-connection-endpoint="/index/linked-resources/1" data-loading="Loading" data-failed="Failed">
        <p data-connection-status role="status"></p><div data-connection-recovery hidden><button data-connection-retry>Retry</button><a data-connection-continue>Full page</a></div>
        <details class="resources-linked"><summary>Connections</summary><form data-connection-form><select name="lr_property"><option value="media:7-0,234">Author</option></select><input name="lr_q"><button>Apply</button></form><a data-connection-page href="?lr_page=2&lr_property=media%3A7-0%2C234#linked-resources">Next</a></details></div>`);
}
test('connection requests preserve compound filters, ignore stale results, and retain unrelated URL state', async()=>{
    const d=connectionFixture(), w=d.window, pending=[];
    w.fetch=(url,options)=>new Promise(resolve=>pending.push({url:new URL(url),options,resolve}));
    w.eval(source('utils.js'));w.eval(source('linked-resources.js'));
    const form=w.document.querySelector('form');
    form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
    assert.equal(pending[0].url.searchParams.get('lr_property'),'media:7-0,234');
    w.document.querySelector('[data-connection-page]').click();
    assert.equal(pending[0].options.signal.aborted,true);
    pending[1].resolve({ok:true,text:async()=>result('Page two')}); await tick();
    pending[0].resolve({ok:true,text:async()=>result('Old result')}); await tick();
    assert.match(w.document.body.textContent,/Page two/); assert.doesNotMatch(w.document.body.textContent,/Old result/);
    assert.equal(new URL(w.location.href).searchParams.get('view'),'list');
    assert.equal(new URL(w.location.href).searchParams.get('lr_page'),'2');
    assert.equal(w.document.querySelector('[aria-busy]'),null);
    w.close();
});
test('failed connections preserve results, provide a real continuation and retry, then honor back navigation',async()=>{
    const d=connectionFixture(), w=d.window;
    let fail=true,calls=0;
    w.fetch=async()=>{calls++; if(fail) throw Error('Offline'); return {ok:true,text:async()=>result('Recovered')};};
    w.eval(source('utils.js'));w.eval(source('linked-resources.js'));
    w.document.querySelector('[data-connection-page]').click(); await tick();
    assert.equal(w.document.querySelector('[data-connection-recovery]').hidden,false);
    assert.ok(w.document.querySelector('form'));
    assert.match(w.document.querySelector('[data-connection-continue]').href,/lr_page=2/);
    assert.equal(w.location.search,'?view=list');
    fail=false;w.document.querySelector('[data-connection-retry]').click();await tick();
    assert.match(w.document.body.textContent,/Recovered/);
    w.history.replaceState(null,'','?lr_q=Beta');w.dispatchEvent(new w.PopStateEvent('popstate'));await tick();
    assert.equal(calls,3);w.close();
});
function shortlistFixture() {
    const d=dom(`<button data-shortlist-open hidden>Shortlist <span data-shortlist-count></span></button><button data-shortlist-save data-url="/item/2" data-title="Record &lt;two&gt;" hidden>Save</button>
    <dialog data-shortlist-dialog data-save="Save" data-saved="Saved" data-remove="Remove" data-empty="Empty" data-storage-error="Storage unavailable" data-limit="Full"><button>Close</button><p data-shortlist-status></p><ul data-shortlist-list></ul><select data-shortlist-format><option value="json">JSON</option></select><button data-shortlist-export>Export</button><button data-shortlist-clear>Clear</button><button data-shortlist-undo>Undo</button></dialog>`);
    d.window.document.querySelector('dialog').showModal=function(){this.open=true;};
    return d;
}
test('shortlist validates stored URLs, escapes titles and keeps working when storage fails',()=>{
    const d=shortlistFixture(), w=d.window;
    w.localStorage.setItem('dre-research-shortlist-v1',JSON.stringify({version:1,records:[{title:'<img src=x onerror=alert(1)>',url:'/item/3'},{title:'Bad',url:'javascript:alert(1)'},{title:'Foreign',url:'https://other.test/'}]}));
    w.eval(source('utils.js'));w.eval(source('shortlist.js'));
    assert.equal(w.document.querySelectorAll('[data-shortlist-list] li').length,1);
    assert.equal(w.document.querySelector('[data-shortlist-list] img'),null);
    Object.defineProperty(w,'localStorage',{get(){throw Error('Blocked');}});
    w.document.querySelector('[data-shortlist-save]').click();
    assert.equal(w.document.querySelector('[data-shortlist-save]').getAttribute('aria-pressed'),'true');
    assert.equal(w.document.querySelector('[data-shortlist-status]').textContent,'Storage unavailable');
    w.document.querySelector('[data-shortlist-clear]').click();assert.equal(w.document.querySelectorAll('[data-shortlist-list] li').length,0);
    w.document.querySelector('[data-shortlist-undo]').click();assert.equal(w.document.querySelectorAll('[data-shortlist-list] li').length,2);
    w.close();
});
test('history restores legacy connection filters and a new search resets legacy pagination', async () => {
    const d = connectionFixture(), w = d.window, requests = [];
    w.history.replaceState(null, '', '?view=list&resource_property=media%3A7-0%2C234&page=4');
    w.fetch = async url => {
        requests.push(new URL(url));
        return {ok: true, text: async () => w.document.querySelector('.resources-linked').outerHTML};
    };
    w.eval(source('utils.js'));w.eval(source('linked-resources.js'));
    w.dispatchEvent(new w.PopStateEvent('popstate'));
    await tick();
    assert.equal(requests[0].searchParams.get('lr_property'), 'media:7-0,234');
    assert.equal(requests[0].searchParams.get('lr_page'), '4');
    w.document.querySelector('form').dispatchEvent(new w.Event('submit', {bubbles: true, cancelable: true}));
    await tick();
    assert.equal(requests[1].searchParams.get('lr_page'), null);
    assert.equal(new URL(w.location.href).searchParams.get('page'), null);
    assert.equal(new URL(w.location.href).searchParams.get('resource_property'), null);
    assert.equal(new URL(w.location.href).searchParams.get('view'), 'list');
    w.close();
});

test('undo clear merges with later saves', () => {
    const d = shortlistFixture(), w = d.window, key = 'dre-research-shortlist-v1';
    w.localStorage.setItem(key, JSON.stringify({version: 1, records: [{url: '/item/3', title: 'Original'}]}));
    w.eval(source('utils.js'));w.eval(source('shortlist.js'));
    w.document.querySelector('[data-shortlist-clear]').click();
    w.document.querySelector('[data-shortlist-save]').click();
    w.document.querySelector('[data-shortlist-undo]').click();
    const records = JSON.parse(w.localStorage.getItem(key)).records;
    assert.equal(records.length, 2);
    assert.ok(records.some(record => record.url.endsWith('/item/2')));
    assert.ok(records.some(record => record.url.endsWith('/item/3')));
    w.close();
});

test('quota errors preserve in-memory additions for export instead of rereading stale storage', () => {
    const d = shortlistFixture(), w = d.window;
    w.eval(source('utils.js'));w.eval(source('shortlist.js'));
    w.Storage.prototype.setItem = () => { throw Error('Quota exceeded'); };
    w.document.querySelector('[data-shortlist-save]').click();
    w.document.querySelector('[data-shortlist-open]').click();
    assert.equal(w.document.querySelectorAll('[data-shortlist-list] li').length, 1);
    w.document.querySelector('[data-shortlist-clear]').click();
    w.document.querySelector('[data-shortlist-undo]').click();
    assert.equal(w.document.querySelectorAll('[data-shortlist-list] li').length, 1);
    w.close();
});

test('visiting a saved detail page enriches only that record with its displayed citation', () => {
    const d = shortlistFixture(), w = d.window, key = 'dre-research-shortlist-v1';
    w.localStorage.setItem(key, JSON.stringify({version: 1, records: [{url: '/item/2', title: 'Browse title'}]}));
    w.document.querySelector('[data-shortlist-save]').setAttribute('data-shortlist-detail', '');
    w.document.body.insertAdjacentHTML('beforeend', `<section class="record-apparatus" data-shortlist-record-url="/item/2">
        <p data-citation-panel="chicago">Displayed citation</p><p data-citation-panel="apa" hidden>Other citation</p>
        <div class="record-apparatus__downloads"><a href="/citation/2.ris">RIS</a></div></section>`);
    w.eval(source('utils.js'));w.eval(source('shortlist.js'));
    const [saved] = JSON.parse(w.localStorage.getItem(key)).records;
    assert.equal(saved.citation, 'Displayed citation');
    assert.equal(saved.downloads[0].label, 'RIS');
    assert.equal(w.document.querySelector('[data-shortlist-save]').getAttribute('aria-pressed'), 'true');
    w.close();
});

test('undo respects the limit and retains unrestored records for a later undo', () => {
    const d = shortlistFixture(), w = d.window, key = 'dre-research-shortlist-v1';
    w.localStorage.setItem(key, JSON.stringify({version: 1, records: Array.from({length: 200}, (_, i) => ({url: '/item/' + (i + 3), title: 'Record ' + i}))}));
    w.eval(source('utils.js'));w.eval(source('shortlist.js'));
    w.document.querySelector('[data-shortlist-clear]').click();
    w.document.querySelector('[data-shortlist-save]').click();
    w.document.querySelector('[data-shortlist-undo]').click();
    assert.equal(JSON.parse(w.localStorage.getItem(key)).records.length, 200);
    assert.equal(w.document.querySelector('[data-shortlist-undo]').hidden, false);
    w.document.querySelector('[data-shortlist-list] button').click();
    w.document.querySelector('[data-shortlist-undo]').click();
    assert.equal(JSON.parse(w.localStorage.getItem(key)).records.length, 200);
    assert.equal(w.document.querySelector('[data-shortlist-undo]').hidden, true);
    w.close();
});

test('invalid stored entries are ignored and a cross-tab clear updates the list', () => {
    const d = shortlistFixture(), w = d.window, key = 'dre-research-shortlist-v1';
    w.localStorage.setItem(key, JSON.stringify({version: 1, records: [null, {}, {url: '/item/3', title: 'Valid', downloads: [null, {}, {url: '/cite.ris', label: 'RIS'}]}]}));
    w.eval(source('utils.js'));w.eval(source('shortlist.js'));
    assert.equal(w.document.querySelectorAll('[data-shortlist-list] li').length, 1);
    w.localStorage.clear();
    w.dispatchEvent(new w.StorageEvent('storage', {key: null}));
    assert.equal(w.document.querySelectorAll('[data-shortlist-list] li').length, 0);
    w.close();
});

test('CSV exports escape quotes and neutralize formula prefixes without altering stored titles', () => {
    const d = shortlistFixture(), w = d.window, key = 'dre-research-shortlist-v1';
    const title = '  =HYPERLINK("https://example.test")';
    w.localStorage.setItem(key, JSON.stringify({version: 1, records: [{url: '/item/3', title, citation: 'A "quoted" citation'}]}));
    w.document.querySelector('[data-shortlist-format]').innerHTML = '<option value="csv">CSV</option>';
    let content, filename;
    w.Blob = class { constructor(parts) { content = parts.join(''); } };
    w.URL.createObjectURL = () => 'blob:fixture';
    w.URL.revokeObjectURL = () => {};
    w.HTMLAnchorElement.prototype.click = function () { filename = this.download; };
    w.eval(source('utils.js'));w.eval(source('shortlist.js'));
    w.document.querySelector('[data-shortlist-export]').click();
    assert.equal(filename, 'research-shortlist.csv');
    assert.match(content, /"' {2}=HYPERLINK\(""https:\/\/example.test""\)"/);
    assert.match(content, /"A ""quoted"" citation"/);
    assert.equal(JSON.parse(w.localStorage.getItem(key)).records[0].title, title);
    w.close();
});

test('fragment jumps do not reload connections or reset their facet; real state changes still do', async () => {
    const d = connectionFixture(), w = d.window;
    let calls = 0;
    w.fetch = async () => { calls++; return {ok: true, text: async () => result('Loaded')}; };
    w.eval(source('utils.js'));w.eval(source('linked-resources.js'));
    w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
    // Skip link, Record contents, section anchors: only the URL's hash changes.
    w.history.pushState(null, '', '#content');
    w.dispatchEvent(new w.PopStateEvent('popstate'));
    w.history.pushState(null, '', '#record-1-description');
    w.dispatchEvent(new w.PopStateEvent('popstate'));
    await tick();
    assert.equal(calls, 0, 'no refetch for a fragment-only history change');
    w.history.pushState(null, '', '?view=list&lr_page=2#linked-resources');
    w.dispatchEvent(new w.PopStateEvent('popstate'));
    await tick();
    assert.equal(calls, 1, 'a different connection page still loads');
    w.history.pushState(null, '', '?view=list&lr_page=2#content');
    w.dispatchEvent(new w.PopStateEvent('popstate'));
    await tick();
    assert.equal(calls, 1, 'the page already shown is not fetched again');
    w.close();
});

test('re-applying the shown connection filters adds no history entry', async () => {
    const d = connectionFixture(), w = d.window;
    w.history.replaceState(null, '', '?view=list&lr_property=media%3A7-0%2C234');
    w.fetch = async () => ({ok: true, text: async () => result('Loaded')});
    w.eval(source('utils.js'));w.eval(source('linked-resources.js'));
    w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
    const entries = w.history.length;
    w.document.querySelector('form').dispatchEvent(new w.Event('submit', {bubbles: true, cancelable: true}));
    await tick(); await tick();
    assert.equal(w.history.length, entries);
    w.close();
});

test('CSV export starts with a UTF-8 byte-order mark and neutralises formulas', async () => {
    const d = shortlistFixture(), w = d.window;
    w.document.querySelector('[data-shortlist-format]').insertAdjacentHTML('beforeend', '<option value="csv">CSV</option>');
    w.document.querySelector('[data-shortlist-save]').dataset.title = '=Orixás — Fundação';
    let blob = null;
    w.URL.createObjectURL = value => { blob = value; return 'blob:test'; };
    w.URL.revokeObjectURL = () => {};
    w.HTMLAnchorElement.prototype.click = () => {};
    w.eval(source('utils.js'));w.eval(source('shortlist.js'));
    w.document.querySelector('[data-shortlist-save]').click();
    w.document.querySelector('[data-shortlist-format]').value = 'csv';
    w.document.querySelector('[data-shortlist-export]').click();
    // Blob.text() decodes as UTF-8, which strips a BOM: read the bytes.
    const bytes = new Uint8Array(await blob.arrayBuffer());
    assert.deepEqual([...bytes.slice(0, 3)], [0xEF, 0xBB, 0xBF]);
    const text = await blob.text();
    assert.match(text, /"'=Orixás — Fundação"/);
    w.close();
});

test('saving keeps one accessible name and changes only the pressed state', () => {
    const d = shortlistFixture(), w = d.window;
    const button = w.document.querySelector('[data-shortlist-save]');
    w.eval(source('utils.js'));w.eval(source('shortlist.js'));
    const name = button.textContent;
    button.click();
    assert.equal(button.getAttribute('aria-pressed'), 'true');
    assert.equal(button.textContent, name);
    w.close();
});

test('a keyboard citation-style switch updates the saved citation', () => {
    const d = shortlistFixture(), w = d.window, key = 'dre-research-shortlist-v1';
    w.localStorage.setItem(key, JSON.stringify({version: 1, records: [{url: '/item/2', title: 'Record'}]}));
    w.document.querySelector('[data-shortlist-save]').setAttribute('data-shortlist-detail', '');
    w.document.body.insertAdjacentHTML('beforeend', `<section class="record-apparatus" data-shortlist-record-url="/item/2" data-record-citation>
        <div role="tablist"><button data-citation-style="chicago" aria-selected="true">Chicago</button><button data-citation-style="apa" tabindex="-1">APA</button></div>
        <p data-citation-panel="chicago">Chicago citation</p><p data-citation-panel="apa" hidden>APA citation</p></section>`);
    w.eval(source('utils.js'));w.eval(source('record.js'));w.eval(source('shortlist.js'));
    const first = w.document.querySelector('[data-citation-style=chicago]');
    first.dispatchEvent(new w.KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true}));
    assert.equal(JSON.parse(w.localStorage.getItem(key)).records[0].citation, 'APA citation');
    w.close();
});
