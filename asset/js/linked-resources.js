/**
 * Connection pages progressively enhance ordinary GET forms and links: the
 * filters, search, sort and paging all act on the whole linked set on the
 * server, and this swaps the block in place instead of reloading the page.
 */
(function () {
    'use strict';

    const requests = new WeakMap();
    // The connection state each block currently displays. History traversal
    // reloads a block only when this changes: fragment jumps (the skip link,
    // Record contents, section anchors) fire popstate too, and must not refetch
    // the block.
    const shown = new WeakMap();
    const stateKeys = ['lr_property', 'lr_class', 'lr_q', 'lr_sort', 'lr_page'];

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
        // The status line and the recovery link come from the block template
        // (common/resource-page-block-layout/linked-resources.phtml). A theme
        // override may drop either; the load must not die over a message it
        // has nowhere to show.
        const status = container.querySelector('[data-connection-status]');
        const recovery = container.querySelector('[data-connection-recovery]');
        const say = (message) => {
            if (status) status.textContent = message;
        };
        say(container.dataset.loading);
        if (recovery) recovery.hidden = true;
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
            const current = container.querySelector('.resources-linked');
            if (!current) throw new Error('Connection block missing');
            // Focus returns to the same control in the new block: the field by
            // its id, a filter or page link by its address (a filter just
            // chosen is the current one, at the same URL); else the toggle.
            const active = container.contains(document.activeElement) ? document.activeElement : null;
            const same = (selector, attribute) => active.getAttribute(attribute)
                && [...replacement.querySelectorAll(selector)].find(node => node.getAttribute(attribute) === active.getAttribute(attribute));
            const sameControl = active && (same('[id]', 'id') || same('a[href]', 'href'));
            current.replaceWith(replacement);
            shown.set(container, state.key);
            document.dispatchEvent(new CustomEvent('dre:connections-loaded'));
            // Re-applying the filters already shown is not a new place in history.
            if (push && stateKey(new URL(location.href)) !== state.key) history.pushState(null, '', destination);
            // The content is in place from here on: nothing below may fall
            // through to the "failed" message over a block that loaded.
            const result = replacement.querySelector('[data-lr-status]') || replacement.querySelector('.resources-linked__summary');
            say(result ? window.DREUtils.normaliseSpace(result.textContent) : '');
            if (active) (sameControl || replacement.querySelector('summary'))?.focus();
        } catch (error) {
            if ((error.name === 'AbortError' && !state.timedOut) || requests.get(container) !== state) return;
            say(container.dataset.failed);
            if (recovery) {
                recovery.hidden = false;
                const resume = recovery.querySelector('[data-connection-continue]');
                if (resume) resume.href = destination.href;
            }
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
        // Empty fields stay out of the address, as the server's own links do.
        // The default order (ConnectionQuery::SORTS[0]) is left out too.
        new FormData(form).forEach((value, key) => {
            if (value !== '' && !(key === 'lr_sort' && value === 'title')) destination.searchParams.set(key, value);
        });
        destination.hash = 'linked-resources';
        loadPage(container, destination);
    });
    document.addEventListener('click', event => {
        const control = event.target.closest?.('[data-connection-page], [data-connection-link], [data-connection-retry]');
        const container = control?.closest('[data-connection-endpoint]');
        if (!container || typeof fetch !== 'function') return;
        if (!control.hasAttribute('data-connection-retry')) {
            if (!window.DREUtils.isPlainClick(event)) return;
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
})();
