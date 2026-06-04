/**
 * File linked-resources.js.
 *
 * Progressive enhancement for the consolidated "Linked resources" block:
 *  - relationship facet pills filter the list (aria-pressed, live count),
 *  - the sort control reorders it (relationship / title A-Z / Z-A).
 *
 * Uses event delegation on `document` rather than binding on load. The item
 * page also loads heavy resource-visualizations scripts, and binding at
 * DOMContentLoaded proved unreliable there (the listeners could attach before
 * the block was matchable, or be lost if the subtree was re-rendered).
 * Delegating from `document` is immune to script order and DOM re-rendering,
 * and the DOM is re-queried on each interaction so state always reflects what
 * is actually on the page. The list is fully usable without JS.
 */
(function () {
    'use strict';

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
