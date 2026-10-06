/** A browser-local working bibliography. No accounts, requests or tracking. */
(function () {
    'use strict';
    const dialog = document.querySelector('[data-shortlist-dialog]');
    if (!dialog || typeof dialog.showModal !== 'function') return;
    const key = 'dre-research-shortlist-v1';
    const limit = 200;
    let records = [];
    let undo = null;
    let storageError = false;
    const status = dialog.querySelector('[data-shortlist-status]');
    const list = dialog.querySelector('[data-shortlist-list]');

    function safeUrl(value) {
        if (typeof value !== 'string' || !value.trim()) return null;
        try {
            const url = new URL(value, location.href);
            return url.origin === location.origin && /^https?:$/.test(url.protocol) ? url.href : null;
        } catch (_) { return null; }
    }
    function normalize(data) {
        if (data?.version !== 1 || !Array.isArray(data.records)) return [];
        const unique = new Map();
        data.records.slice(0, limit).forEach(record => {
            const url = safeUrl(record?.url);
            if (!url || typeof record?.title !== 'string') return;
            unique.set(url, { url, title: record.title.slice(0, 2000),
                citation: typeof record.citation === 'string' ? record.citation.slice(0, 20000) : '',
                downloads: Array.isArray(record.downloads) ? record.downloads.slice(0, 10)
                    .filter(link => safeUrl(link?.url) && typeof link?.label === 'string')
                    .map(link => ({url: safeUrl(link.url), label: link.label.slice(0, 100)})) : [],
            });
        });
        return Array.from(unique.values());
    }
    function read() {
        // Preserve unsaved in-memory changes after a storage write failure.
        if (storageError) return;
        try {
            const stored = localStorage.getItem(key);
            records = stored ? normalize(JSON.parse(stored)) : [];
            storageError = false;
        } catch (_) { storageError = true; }
    }
    function persist(notifyFailure = true) {
        try {
            localStorage.setItem(key, JSON.stringify({version: 1, records}));
            storageError = false;
        } catch (_) { storageError = true; }
        render();
        if (storageError && notifyFailure && !dialog.open) dialog.showModal();
    }

    function snapshot(button) {
        const url = safeUrl(button.dataset.url);
        const apparatus = button.hasAttribute('data-shortlist-detail')
            ? Array.from(document.querySelectorAll('[data-shortlist-record-url]'))
                .find(node => safeUrl(node.dataset.shortlistRecordUrl) === url)
            : null;
        const citation = apparatus?.querySelector('[data-citation-panel]:not([hidden]), .record-apparatus__citation:not([hidden])');
        return {url, title: (button.dataset.title || '').slice(0, 2000),
            citation: (citation?.textContent.trim() || '').slice(0, 20000),
            downloads: Array.from(apparatus?.querySelectorAll('.record-apparatus__downloads a') || [])
                .filter(link => safeUrl(link.href)).slice(0, 10)
                .map(link => ({url: link.href, label: link.textContent.trim().slice(0, 100)})),
        };
    }

    function enrichSavedRecord() {
        let changed = false;
        document.querySelectorAll('[data-shortlist-detail]').forEach(button => {
            const record = records.find(record => record.url === safeUrl(button.dataset.url));
            if (!record) return;
            const fresh = snapshot(button);
            // A missing optional citation service must not erase an earlier citation.
            const enriched = {...record, title: fresh.title || record.title,
                citation: fresh.citation || record.citation,
                downloads: fresh.downloads.length ? fresh.downloads : record.downloads};
            if (JSON.stringify(record) !== JSON.stringify(enriched)) {
                Object.assign(record, enriched);
                changed = true;
            }
        });
        if (changed) persist(false);
    }
    function syncButtons() {
        document.querySelectorAll('[data-shortlist-save]').forEach(button => {
            if (!safeUrl(button.dataset.url)) return;
            button.hidden = false;
            // A toggle keeps one name; only its pressed state changes.
            const saved = records.some(record => record.url === safeUrl(button.dataset.url));
            button.setAttribute('aria-pressed', String(saved));
        });
        document.querySelectorAll('[data-shortlist-count]').forEach(node => { node.textContent = records.length; });
    }
    function render() {
        list.replaceChildren();
        records.forEach((record, index) => {
            const row = document.createElement('li');
            const link = document.createElement('a');
            link.href = record.url;
            link.textContent = record.title;
            row.append(link);
            if (record.citation) {
                const citation = document.createElement('p');
                citation.textContent = record.citation;
                row.append(citation);
            }
            record.downloads.forEach(download => {
                const link = document.createElement('a');
                link.href = download.url;
                link.textContent = download.label;
                link.download = '';
                link.className = 'shortlist-download';
                row.append(link);
            });
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.textContent = dialog.dataset.remove;
            remove.setAttribute('aria-label', dialog.dataset.remove + ': ' + record.title);
            remove.addEventListener('click', () => {
                read();
                records = records.filter(saved => saved.url !== record.url);
                persist();
                const buttons = list.querySelectorAll('button');
                (buttons[Math.min(index, buttons.length - 1)] || dialog.querySelector('button')).focus();
            });
            row.append(remove);
            list.append(row);
        });
        status.textContent = storageError ? dialog.dataset.storageError : (records.length ? '' : dialog.dataset.empty);
        dialog.querySelector('[data-shortlist-export]').disabled = !records.length;
        dialog.querySelector('[data-shortlist-clear]').disabled = !records.length;
        dialog.querySelector('[data-shortlist-undo]').hidden = !undo;
        syncButtons();
    }
    read();
    enrichSavedRecord();
    render();
    document.querySelectorAll('[data-shortlist-open]').forEach(button => {
        button.hidden = false;
        button.addEventListener('click', () => { read(); enrichSavedRecord(); render(); dialog.showModal(); });
    });
    document.addEventListener('click', event => {
        const button = event.target.closest?.('[data-shortlist-save]');
        if (!button) return;
        const url = safeUrl(button.dataset.url);
        if (!url) return;
        read();
        const index = records.findIndex(record => record.url === url);
        if (index >= 0) records.splice(index, 1);
        else {
            if (records.length >= limit) {
                dialog.showModal(); status.textContent = dialog.dataset.limit; return;
            }
            records.push(snapshot(button));
        }
        persist();
    });
    dialog.querySelector('[data-shortlist-clear]').addEventListener('click', () => {
        read();
        undo = records.slice(); records = []; persist();
        dialog.querySelector('[data-shortlist-undo]').focus();
    });
    dialog.querySelector('[data-shortlist-undo]').addEventListener('click', () => {
        read();
        const missing = (undo || []).filter(record => !records.some(saved => saved.url === record.url));
        const space = Math.max(0, limit - records.length);
        records.push(...missing.slice(0, space));
        undo = missing.length > space ? missing.slice(space) : null;
        persist();
        if (undo) status.textContent = dialog.dataset.undoLimit;
        (undo ? dialog.querySelector('[data-shortlist-undo]') : dialog.querySelector('[data-shortlist-clear]')).focus();
    });
    dialog.querySelector('[data-shortlist-export]').addEventListener('click', () => {
        const format = dialog.querySelector('[data-shortlist-format]').value;
        const csv = value => '"' + String(value).replace(/^(?=[\s]*[=+@\-]|[\t\r\n])/, "'").replaceAll('"', '""') + '"';
        const md = value => value.replace(/[\\`*_{}\[\]<>]/g, '\\$&').replace(/\s+/g, ' ');
        const content = format === 'json' ? JSON.stringify({version: 1, records}, null, 2)
            // The BOM makes Excel read the CSV as UTF-8 rather than the legacy
            // code page, which would garble accented titles.
            : format === 'csv' ? '﻿' + ['Title,URL,Citation', ...records.map(r => [r.title, r.url, r.citation].map(csv).join(','))].join('\r\n')
                : records.map(r => '- ' + md(r.citation || r.title) + ' — ' + r.url).join('\n');
        const url = URL.createObjectURL(new Blob([content], {type: format === 'json' ? 'application/json' : 'text/plain;charset=utf-8'}));
        const link = document.createElement('a');
        link.href = url; link.download = 'research-shortlist.' + format;
        document.body.append(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    window.addEventListener('storage', event => { if (event.key === key || event.key === null) { read(); enrichSavedRecord(); render(); } });
    // record.js announces every style change, pointer or arrow key alike.
    document.addEventListener('dre:citation-style', () => enrichSavedRecord());
    // Connection pages replace their cards without reloading the document.
    document.addEventListener('dre:connections-loaded', syncButtons);
})();
