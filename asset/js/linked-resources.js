/**
 * File linked-resources.js.
 *
 * Progressive enhancement for the consolidated "Linked resources" block:
 *  - relationship facet pills filter the list (aria-pressed, live count),
 *  - the sort control reorders it (relationship / title A–Z / Z–A).
 *
 * Operates on the server-rendered DOM, so the list is fully usable without
 * JS (every record and its relationship is already on the page). Facets and
 * sorting act on the records loaded into the current page.
 */
(function () {
    'use strict';

    function init(root) {
        var list = root.querySelector('[data-lr-list]');
        if (!list) {
            return;
        }

        var items = Array.prototype.slice.call(list.querySelectorAll('.connection'));
        var facets = Array.prototype.slice.call(root.querySelectorAll('[data-lr-facet]'));
        var sortSelect = root.querySelector('[data-lr-sort]');
        var countEl = root.querySelector('[data-lr-count]');
        var emptyEl = root.querySelector('[data-lr-empty]');
        var active = 'all';

        function applyFilter() {
            var visible = 0;
            items.forEach(function (li) {
                var props = (li.getAttribute('data-props') || '').split(' ');
                var show = active === 'all' || props.indexOf(active) !== -1;
                li.hidden = !show;
                if (show) {
                    visible++;
                }
            });
            if (countEl) {
                countEl.textContent = visible;
            }
            if (emptyEl) {
                emptyEl.hidden = visible !== 0;
            }
        }

        function sortItems(mode) {
            var sorted = items.slice().sort(function (a, b) {
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
            sorted.forEach(function (li) {
                list.appendChild(li);
            });
        }

        facets.forEach(function (btn) {
            btn.addEventListener('click', function () {
                active = btn.getAttribute('data-lr-facet');
                facets.forEach(function (other) {
                    var on = other === btn;
                    other.classList.toggle('is-active', on);
                    other.setAttribute('aria-pressed', on ? 'true' : 'false');
                });
                applyFilter();
            });
        });

        if (sortSelect) {
            sortSelect.addEventListener('change', function () {
                sortItems(sortSelect.value);
            });
            sortItems(sortSelect.value);
        }

        applyFilter();
    }

    function boot() {
        document.querySelectorAll('.resources-linked').forEach(init);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }
})();
