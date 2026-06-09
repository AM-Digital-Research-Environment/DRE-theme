/**
 * Theme-reactive Mirador.
 *
 * The Mirador module (Daniel-KM/Omeka-S-module-Mirador, v3.4.x) ships Mirador 4
 * as an ES module and, on window 'load', initialises each viewer with
 * `window.miradors[id] = Mirador.viewer(config, plugins)` — leaving the live
 * viewer, including its Redux `store`, in `window.miradors`. Mirador keeps its
 * active Material-UI theme in that store (`config.selectedTheme`, choosing from
 * `config.themes.{light,dark}`), so we flip it to follow the site's light/dark
 * toggle — the same `body[data-theme]` signal the chart modules watch
 * (DESIGN.md §4, §9).
 *
 * How the flip is dispatched (verified against the live viewer): the module
 * binds Mirador as a *module-local* ESM import, so there is **no
 * `window.Mirador`**, and Mirador 4's package exports **no `actions`** namespace
 * — neither the global nor the action creator that Mirador 3 exposed exists. So
 * we dispatch the updateConfig action as a plain object directly on the store
 * (`{ type: 'mirador/UPDATE_CONFIG', config: { selectedTheme } }`); the type is
 * stable and the config reducer deep-merges it, re-rendering the MUI theme.
 *
 * Branding (the forest-dark / warm-stone palettes for `themes.light` /
 * `themes.dark`) lives in the Mirador module's site-settings JSON — see
 * DESIGN.md §8 "Mirador". This file only switches *which* theme is active, so it
 * stays brand-agnostic and needs no rebuild when the palette is tuned.
 *
 * Fully defensive: every access is guarded, so if the module/global shape ever
 * changes the script simply no-ops and Mirador keeps its configured theme — it
 * never throws into the page.
 */
(function () {
    'use strict';

    // Mirador's updateConfig action type (stable across Mirador 3 and 4).
    var UPDATE_CONFIG = 'mirador/UPDATE_CONFIG';

    function currentTheme() {
        return document.body.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    }

    // Push the active theme into one viewer instance via its Redux store.
    function applyToViewer(viewer, theme) {
        var store = viewer && viewer.store;
        if (!store || typeof store.dispatch !== 'function') {
            return;
        }
        try {
            store.dispatch({ type: UPDATE_CONFIG, config: { selectedTheme: theme } });
        } catch (e) {
            /* leave Mirador's own theme in place */
        }
    }

    function applyToAll(theme) {
        var map = window.miradors;
        if (!map) {
            return;
        }
        Object.keys(map).forEach(function (id) {
            applyToViewer(map[id], theme);
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

    // The loader instantiates viewers on window 'load' and Mirador mounts
    // asynchronously, so poll briefly for the store rather than racing it.
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

    if (document.readyState === 'complete') {
        syncWhenReady();
    } else {
        window.addEventListener('load', syncWhenReady, { once: true });
    }
})();
