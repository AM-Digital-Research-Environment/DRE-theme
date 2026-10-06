/** Connection pages progressively enhance ordinary GET forms and links. */
(function () {
    'use strict';

    const requests = new WeakMap();
    // The connection state each block currently displays. History traversal
    // reloads a block only when this changes: fragment jumps (the skip link,
    // Record contents, section anchors) fire popstate too, and must not refetch
    // the page or throw away the reader's facet and sort.
    const shown = new WeakMap();
    const stateKeys = ['lr_property', 'lr_q', 'lr_page'];

    function connectionState(url) {
        const params = new URLSearchParams(url.search);
        for (const [current, legacy] of [['lr_property', 'resource_property'], ['lr_page', 'page']]) {
            if (!params.has(current) && params.has(legacy)) params.set(current, params.get(legacy));
        }
        return params;
    }

    function stateKey(url) {
        const params = connectionState(url);
        return JSON.stringify(stateKeys.map(key => params.get(key) || ''));
    }

    function clearState(url) {
        [...stateKeys, 'resource_property', 'page'].forEach(key => url.searchParams.delete(key));
    }

    async function loadPage(container, destination, push = true) {
        const previous = requests.get(container);
        if (previous) previous.controller.abort();
        const state = { controller: new AbortController(), destination, push, key: stateKey(destination), timedOut: false };
        const timeout = setTimeout(() => { state.timedOut = true; state.controller.abort(); }, 30000);
        requests.set(container, state);
        const status = container.querySelector('[data-connection-status]');
        const recovery = container.querySelector('[data-connection-recovery]');
        status.textContent = container.dataset.loading;
        recovery.hidden = true;
        container.setAttribute('aria-busy', 'true');
        const endpoint = new URL(container.dataset.connectionEndpoint, location.href);
        const params = connectionState(destination);
        stateKeys.forEach(key => {
            if (params.has(key)) endpoint.searchParams.set(key, params.get(key));
        });
        try {
            const response = await fetch(endpoint, { signal: state.controller.signal, headers: { Accept: 'text/html' } });
            if (!response.ok) throw new Error('Connection request failed');
            const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
            const replacement = doc.querySelector('.resources-linked');
            if (!replacement) throw new Error('Connection response missing');
            if (requests.get(container) !== state) return;
            const hadFocus = container.contains(document.activeElement);
            container.querySelector('.resources-linked').replaceWith(replacement);
            shown.set(container, state.key);
            document.dispatchEvent(new CustomEvent('dre:connections-loaded'));
            // Re-applying the filters already shown is not a new place in history.
            if (push && stateKey(new URL(location.href)) !== state.key) history.pushState(null, '', destination);
            status.textContent = replacement.querySelector('.resources-linked__summary').textContent.replace(/\s+/g, ' ').trim();
            if (hadFocus) replacement.querySelector('summary').focus();
        } catch (error) {
            if ((error.name === 'AbortError' && !state.timedOut) || requests.get(container) !== state) return;
            status.textContent = container.dataset.failed;
            recovery.hidden = false;
            recovery.querySelector('[data-connection-continue]').href = destination.href;
        } finally {
            clearTimeout(timeout);
            if (requests.get(container) === state) container.removeAttribute('aria-busy');
        }
    }

    window.DREUtils.onReady(() => {
        const key = stateKey(new URL(location.href));
        document.querySelectorAll('[data-connection-endpoint]').forEach(container => {
            if (!shown.has(container)) shown.set(container, key);
        });
    });

    document.addEventListener('submit', event => {
        const form = event.target.closest?.('[data-connection-form]');
        const container = form?.closest('[data-connection-endpoint]');
        if (!container || typeof fetch !== 'function') return;
        event.preventDefault();
        const destination = new URL(location.href);
        clearState(destination);
        new FormData(form).forEach((value, key) => destination.searchParams.set(key, value));
        destination.hash = 'linked-resources';
        loadPage(container, destination);
    });
    document.addEventListener('click', event => {
        const control = event.target.closest?.('[data-connection-page], [data-connection-retry]');
        const container = control?.closest('[data-connection-endpoint]');
        if (!container || typeof fetch !== 'function') return;
        if (control.hasAttribute('data-connection-page')) {
            if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            const link = new URL(control.href);
            const destination = new URL(location.href);
            clearState(destination);
            stateKeys.forEach(key => {
                if (link.searchParams.has(key)) destination.searchParams.set(key, link.searchParams.get(key));
            });
            destination.hash = 'linked-resources';
            loadPage(container, destination);
        } else {
            const state = requests.get(container);
            if (state) loadPage(container, state.destination, state.push);
        }
    });
    window.addEventListener('popstate', () => {
        const destination = new URL(location.href);
        const key = stateKey(destination);
        document.querySelectorAll('[data-connection-endpoint]').forEach(container => {
            const pending = container.hasAttribute('aria-busy') ? requests.get(container) : null;
            if ((pending ? pending.key : shown.get(container)) === key) return;
            loadPage(container, new URL(destination), false);
        });
    });

    // --- Facets and sorting refine the rendered page only. ---------------------

    function applyFacet(root) {
        const active = root.querySelector('[data-lr-facet].is-active')?.getAttribute('data-lr-facet') || 'all';
        let visible = 0;
        root.querySelectorAll('[data-lr-list] .connection').forEach(li => {
            const show = active === 'all' || (li.getAttribute('data-props') || '').split(' ').includes(active);
            li.hidden = !show;
            if (show) visible++;
        });
        const count = root.querySelector('[data-lr-count]');
        if (count) count.textContent = visible;
        const label = root.querySelector('[data-lr-label]');
        if (label) label.textContent = visible === 1 ? label.dataset.one : label.dataset.many;
        const empty = root.querySelector('[data-lr-empty]');
        if (empty) empty.hidden = visible !== 0;
        // Matches read from the first row, not wherever the panel was scrolled.
        const list = root.querySelector('[data-lr-list]');
        if (list) list.scrollTop = 0;
    }

    function sortItems(root, mode) {
        const list = root.querySelector('[data-lr-list]');
        if (!list) return;
        const byTitle = (a, b) => (a.dataset.title || '').localeCompare(b.dataset.title || '');
        const items = Array.from(list.querySelectorAll('.connection')).sort((a, b) => {
            if (mode === 'title-asc') return byTitle(a, b);
            if (mode === 'title-desc') return -byTitle(a, b);
            // "relationship": cluster by the primary relationship, then by title.
            const order = parseInt(a.dataset.relOrder || '0', 10) - parseInt(b.dataset.relOrder || '0', 10);
            return order || byTitle(a, b);
        });
        // append() moves nodes, preserving each row's hidden state, so the
        // active facet survives a re-sort.
        items.forEach(li => list.append(li));
    }

    document.addEventListener('click', event => {
        const button = event.target.closest?.('[data-lr-facet]');
        const root = button?.closest('.resources-linked');
        if (!root) return;
        root.querySelectorAll('[data-lr-facet]').forEach(other => {
            const on = other === button;
            other.classList.toggle('is-active', on);
            other.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        applyFacet(root);
    });

    document.addEventListener('change', event => {
        const select = event.target.closest?.('[data-lr-sort]');
        const root = select?.closest('.resources-linked');
        if (root) sortItems(root, select.value);
    });
})();
