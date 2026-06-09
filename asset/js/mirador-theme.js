/**
 * Theme-reactive Mirador.
 *
 * The Mirador module (Daniel-KM/Omeka-S-module-Mirador) initialises each viewer
 * with `miradors[id] = Mirador.viewer(miradors[id], plugins)`, leaving the live
 * viewer instance — including its Redux `store` — in the global `window.miradors`
 * map. Mirador 3 keeps its active Material-UI theme in that store
 * (`config.selectedTheme`), so we can flip it live by dispatching `updateConfig`,
 * letting the IIIF viewer follow the site's light/dark toggle exactly as the
 * chart modules do (they observe `body[data-theme]` — see DESIGN.md §4, §9).
 *
 * Branding (the forest-dark / warm-stone palettes that make `themes.light` and
 * `themes.dark` match the theme) lives in the Mirador module's site-settings
 * JSON — see DESIGN.md §8 "Mirador". This file only switches *which* of those
 * themes is active, so it stays brand-agnostic and needs no rebuild when the
 * palette is tuned.
 *
 * Fully defensive: every access is guarded, so if the module, the global, or the
 * action shape ever changes the script simply no-ops and Mirador keeps whatever
 * theme its pasted config selected — it never throws into the page.
 */
(function () {
    'use strict';

    function currentTheme() {
        return document.body.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    }

    function updateConfigAction() {
        return window.Mirador
            && window.Mirador.actions
            && typeof window.Mirador.actions.updateConfig === 'function'
            ? window.Mirador.actions.updateConfig
            : null;
    }

    // Push the active theme into one viewer instance via its Redux store.
    function applyToViewer(viewer, theme, updateConfig) {
        var store = viewer && viewer.store;
        if (!store || typeof store.dispatch !== 'function' || !updateConfig) {
            return;
        }
        try {
            store.dispatch(updateConfig({ selectedTheme: theme }));
        } catch (e) {
            /* leave Mirador's own theme in place */
        }
    }

    function applyToAll(theme) {
        var map = window.miradors;
        var updateConfig = updateConfigAction();
        if (!map || !updateConfig) {
            return;
        }
        Object.keys(map).forEach(function (id) {
            applyToViewer(map[id], theme, updateConfig);
        });
    }

    // A viewer is ready once the module has reassigned its config object to the
    // Mirador.viewer() return value, which exposes `.store`.
    function viewersReady() {
        var map = window.miradors;
        if (!map) {
            return false;
        }
        return Object.keys(map).some(function (id) {
            return map[id] && map[id].store;
        });
    }

    // Mirador mounts asynchronously and on its own schedule, so poll briefly for
    // the store rather than racing the module's init.
    var tries = 0;
    var MAX_TRIES = 100; // ~15s at 150ms
    function syncWhenReady() {
        if (viewersReady()) {
            applyToAll(currentTheme());
        } else if (tries++ < MAX_TRIES) {
            window.setTimeout(syncWhenReady, 150);
        }
    }

    // Follow later light/dark toggles — the same signal the chart modules watch.
    if (typeof MutationObserver === 'function') {
        new MutationObserver(function () {
            applyToAll(currentTheme());
        }).observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', syncWhenReady, { once: true });
    } else {
        syncWhenReady();
    }
})();
