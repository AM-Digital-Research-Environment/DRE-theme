/** Connection pages progressively enhance ordinary GET forms and links. */
(function () {
    'use strict';

    const requests = new WeakMap();
    const stateKeys = ['lr_property', 'lr_q', 'lr_page'];

    function connectionState(url) {
        const params = new URLSearchParams(url.search);
        for (const [current, legacy] of [['lr_property', 'resource_property'], ['lr_page', 'page']]) {
            if (!params.has(current) && params.has(legacy)) params.set(current, params.get(legacy));
        }
        return params;
    }

    function clearState(url) {
        [...stateKeys, 'resource_property', 'page'].forEach(key => url.searchParams.delete(key));
    }

    async function loadPage(container, destination, push = true) {
        const previous = requests.get(container);
        if (previous) previous.controller.abort();
        const state = { controller: new AbortController(), destination, push, timedOut: false };
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
            document.dispatchEvent(new CustomEvent('dre:connections-loaded'));
            if (push) history.pushState(null, '', destination);
            status.textContent = replacement.querySelector('.resources-linked__summary').textContent.trim();
            if (hadFocus) {
                const heading = replacement.querySelector('summary');
                heading.focus();
            }
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
        document.querySelectorAll('[data-connection-endpoint]').forEach(container => loadPage(container, new URL(location.href), false));
    });

    function activeFacet(root) {
        var btn = root.querySelector('[data-lr-facet].is-active');
        return btn ? btn.getAttribute('data-lr-facet') : 'all';
    }

    function searchQuery(root) {
        var input = root.querySelector('[data-lr-search]');
        return input ? input.value.trim().toLowerCase() : '';
    }

    // A card shows when it passes BOTH the active relationship facet and the
    // search box (AND). Both are plain attribute reads — data-props for the
    // facet, the pre-lowercased data-search haystack for the query — so a full
    // pass over a few hundred cards is sub-millisecond.
    function applyFilter(root) {
        var active = activeFacet(root);
        var query = searchQuery(root);
        var items = root.querySelectorAll('[data-lr-list] .connection');
        var visible = 0;
        items.forEach(function (li) {
            var props = (li.getAttribute('data-props') || '').split(' ');
            var facetOk = active === 'all' || props.indexOf(active) !== -1;
            var searchOk = !query || (li.getAttribute('data-search') || '').indexOf(query) !== -1;
            var show = facetOk && searchOk;
            li.hidden = !show;
            if (show) {
                visible++;
            }
        });
        var countEl = root.querySelector('[data-lr-count]');
        if (countEl) {
            countEl.textContent = visible;
        }
        var emptyEl = root.querySelector('[data-lr-empty]');
        if (emptyEl) {
            emptyEl.hidden = visible !== 0;
        }
        // Pull the scroll panel back to the top so matches read from the first
        // row rather than wherever the user had scrolled to.
        var list = root.querySelector('[data-lr-list]');
        if (list) {
            list.scrollTop = 0;
        }
    }

    // Coalesce keystrokes to one filter pass per frame (kept per-root so two
    // blocks on a page never cancel each other).
    function scheduleFilter(root) {
        if (root._lrSearchRaf) {
            cancelAnimationFrame(root._lrSearchRaf);
        }
        root._lrSearchRaf = requestAnimationFrame(function () {
            root._lrSearchRaf = null;
            applyFilter(root);
        });
    }

    function sortItems(root, mode) {
        var list = root.querySelector('[data-lr-list]');
        if (!list) {
            return;
        }
        var items = Array.prototype.slice.call(list.querySelectorAll('.connection'));
        items.sort(function (a, b) {
            if (mode === 'title-asc' || mode === 'title-desc') {
                var byTitle = (a.dataset.title || '').localeCompare(b.dataset.title || '');
                return mode === 'title-desc' ? -byTitle : byTitle;
            }
            // "relationship": cluster by the record's primary relationship,
            // then alphabetically within each cluster.
            var ra = parseInt(a.dataset.relOrder || '0', 10);
            var rb = parseInt(b.dataset.relOrder || '0', 10);
            if (ra !== rb) {
                return ra - rb;
            }
            return (a.dataset.title || '').localeCompare(b.dataset.title || '');
        });
        // appendChild moves nodes, preserving each row's hidden state, so the
        // active filter survives a re-sort.
        items.forEach(function (li) {
            list.appendChild(li);
        });
    }

    document.addEventListener('click', function (e) {
        var btn = e.target && e.target.closest ? e.target.closest('[data-lr-facet]') : null;
        if (!btn) {
            return;
        }
        var root = btn.closest('.resources-linked');
        if (!root) {
            return;
        }
        root.querySelectorAll('[data-lr-facet]').forEach(function (other) {
            var on = other === btn;
            other.classList.toggle('is-active', on);
            other.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        applyFilter(root);
    });

    document.addEventListener('change', function (e) {
        var sel = e.target && e.target.closest ? e.target.closest('[data-lr-sort]') : null;
        if (!sel) {
            return;
        }
        var root = sel.closest('.resources-linked');
        if (!root) {
            return;
        }
        sortItems(root, sel.value);
    });

    // Live search. `input` also fires for the native search-field clear (×) and
    // for paste, so clearing the box restores the full set automatically.
    document.addEventListener('input', function (e) {
        var input = e.target && e.target.closest ? e.target.closest('[data-lr-search]') : null;
        if (!input) {
            return;
        }
        var root = input.closest('.resources-linked');
        if (root) {
            scheduleFilter(root);
        }
    });

    // Escape clears the search from within the field (in addition to the native
    // clear button), then re-filters.
    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape' && e.key !== 'Esc') {
            return;
        }
        var input = e.target && e.target.closest ? e.target.closest('[data-lr-search]') : null;
        if (!input || !input.value) {
            return;
        }
        input.value = '';
        var root = input.closest('.resources-linked');
        if (root) {
            applyFilter(root);
        }
    });
})();
