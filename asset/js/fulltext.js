/**
 * Record full text on demand (issue #14).
 *
 * A long `bibo:content` renders only its opening (helper/FullTextPreview.php);
 * "Read the full text" is a link to the record's API representation, which
 * carries the whole text. Here the link fetches it and puts the text in place
 * of the opening, so a reader who never asks for it never downloads it.
 * Without JavaScript the link still leads to the text, as JSON.
 */
(function () {
    'use strict';

    const normalise = (text) => text.replace(/\s+/g, ' ').trim();

    // The value at the template's index, if it is the text the opening was cut
    // from; otherwise whichever value starts the same way. The index can drift
    // when the API and the page see different values (a private value shown to
    // a signed-in curator, a locale filter), so it is never trusted on its own.
    function pick(values, index, opening) {
        if (!Array.isArray(values)) return null;
        const prefix = normalise(opening).slice(0, 200);
        const matches = (value) => typeof value?.['@value'] === 'string'
            && normalise(value['@value'].slice(0, 400)).startsWith(prefix);
        if (matches(values[index])) return values[index]['@value'];
        const found = values.find(matches);
        return found ? found['@value'] : null;
    }

    async function load(link, text) {
        if (link.getAttribute('aria-busy') === 'true') return;
        link.setAttribute('aria-busy', 'true');
        link.textContent = link.dataset.loading;
        try {
            const response = await fetch(link.href, {
                headers: { Accept: 'application/json' },
                credentials: 'same-origin',
            });
            if (!response.ok) throw new Error('HTTP ' + response.status);
            const record = await response.json();
            const opening = text.textContent.replace(/…$/, '');
            const full = pick(record[text.dataset.term], Number(text.dataset.index), opening);
            if (full === null) throw new Error('Full text not found');

            text.textContent = full;
            text.classList.add('is-complete');
            link.closest('.record-fulltext__more')?.remove();
            // Focus moves to the text the reader asked for; the status region
            // says it arrived, since a focus move alone may not.
            text.focus({ preventScroll: true });
            window.DREUtils?.announce(link.dataset.loaded);
        } catch (_error) {
            link.textContent = link.dataset.error;
            window.DREUtils?.announce(link.dataset.error);
        } finally {
            link.removeAttribute('aria-busy');
        }
    }

    document.addEventListener('click', (event) => {
        const link = event.target.closest?.('[data-fulltext-load]');
        if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const text = document.getElementById(link.getAttribute('aria-controls'));
        if (!text) return;
        event.preventDefault();
        load(link, text);
    });
})();
