/**
 * DRE token bridge — read the design tokens from JavaScript.
 *
 * WHY THIS IS IN THE THEME. The token layer is a public API (DESIGN.md §9), but
 * it is a CSS API: the moment a module paints to a canvas, a WebGL map or an
 * SVG attribute, `var(--primary)` stops being available and the colour has to
 * be resolved to something a non-CSS renderer can parse. Every module hits this,
 * and until now exactly one of them had solved it — DRE-Visualizations carried a
 * probe-and-canvas bridge in dashboard-core.js while DRE Search painted its map
 * with raw brand hexes, which is why that map was the one surface on the site
 * that ignored both the theme toggle and the admin brand colour.
 *
 * A capability one module has and the other lacks belongs in the theme. This is
 * that bridge, published as `window.DRETokens`.
 *
 * HOW IT WORKS. Two tricks, neither of them clever:
 *   • A hidden probe element parented to <body> inherits the live
 *     body[data-theme] cascade, so `getComputedStyle` on it returns the ACTIVE
 *     mode's value for any token — including one an admin overrode in theme
 *     settings, which no build-time table can know.
 *   • A 1×1 canvas rasterises whatever the browser computed. That is what turns
 *     `oklch(…)` and `color-mix(in oklab, …)` — which MapLibre, ECharts and
 *     zrender cannot parse — into a plain `rgb()` / `rgba()` string.
 *
 * Fallbacks are optional and should usually be omitted: when the theme is
 * loaded the token always resolves. Where a caller does need one, take it from
 * asset/css/dre-tokens-fallback.json rather than typing a hex.
 *
 * No dependencies, no build step, safe to load in <head> — the probe is created
 * lazily on first use.
 */
(function (window, document) {
    'use strict';

    var ns = {};
    var probe = null;
    var ctx = null;
    var listeners = [];
    var observer = null;

    /**
     * The hidden probe. Parented to <body> so it sits inside the
     * body[data-theme] cascade; re-parented if something replaced <body>.
     */
    function getProbe() {
        if (!probe) {
            probe = document.createElement('span');
            probe.setAttribute('aria-hidden', 'true');
            probe.style.cssText =
                'position:absolute;left:-9999px;top:-9999px;width:0;height:0;pointer-events:none';
        }
        var host = document.body || document.documentElement;
        if (host && probe.parentNode !== host) host.appendChild(probe);
        return probe;
    }

    /**
     * Rasterise any browser-parseable CSS colour — including oklch(), oklab()
     * and color-mix() — to a plain rgb()/rgba() string.
     */
    ns.toRGB = function (color) {
        if (!ctx) {
            var canvas = document.createElement('canvas');
            canvas.width = canvas.height = 1;
            ctx = canvas.getContext('2d', { willReadFrequently: true });
        }
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = '#000';
        ctx.fillStyle = color; // the browser parses oklch / color-mix here
        ctx.fillRect(0, 0, 1, 1);
        var d = ctx.getImageData(0, 0, 1, 1).data;
        if (d[3] === 0) return 'rgba(0,0,0,0)';
        if (d[3] === 255) return 'rgb(' + d[0] + ',' + d[1] + ',' + d[2] + ')';
        return 'rgba(' + d[0] + ',' + d[1] + ',' + d[2] + ',' + (d[3] / 255).toFixed(3) + ')';
    };

    /**
     * Resolve a custom property to a plain rgb()/rgba() colour.
     * @param {string} name      e.g. '--primary'
     * @param {string} [fallback] only for non-DRE hosts; omit under the theme
     */
    ns.cssColor = function (name, fallback) {
        fallback = fallback || '#000';
        try {
            var el = getProbe();
            el.style.color = '';
            el.style.color = 'var(' + name + ', ' + fallback + ')';
            return ns.toRGB(window.getComputedStyle(el).color || fallback) || fallback;
        } catch (e) {
            return fallback;
        }
    };

    /**
     * Resolve a custom property holding a font stack. Unlike colours this needs
     * no rasterising — canvas font shorthand accepts a stack directly.
     */
    ns.cssFont = function (name, fallback) {
        fallback = fallback || 'system-ui, sans-serif';
        try {
            var el = getProbe();
            el.style.fontFamily = '';
            el.style.fontFamily = 'var(' + name + ', ' + fallback + ')';
            return window.getComputedStyle(el).fontFamily || fallback;
        } catch (e) {
            return fallback;
        }
    };

    /** Resolve a custom property to its raw computed string (lengths, numbers). */
    ns.cssValue = function (name, fallback) {
        try {
            var el = getProbe();
            var value = window.getComputedStyle(el).getPropertyValue(name);
            return (value && value.trim()) || fallback || '';
        } catch (e) {
            return fallback || '';
        }
    };

    /**
     * Whether the active theme is dark.
     *
     * [data-theme] is the answer, not the OS: the theme's head script resolves
     * the mode (stored choice, else OS preference) and writes it to <html> and
     * <body> before first paint. Asking the OS directly is the bug this bridge
     * exists to stop — it inverts for any visitor who overrode their system
     * setting. The matchMedia branch is reached only on a non-DRE host, where
     * no attribute is written at all.
     */
    ns.isDark = function () {
        var el = document.body || document.documentElement;
        var attr = el && el.getAttribute('data-theme');
        if (attr === 'dark') return true;
        if (attr === 'light') return false;
        var root = document.documentElement.getAttribute('data-theme');
        if (root === 'dark') return true;
        if (root === 'light') return false;
        return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    };

    /**
     * Call `handler` whenever the theme mode changes, so a canvas can re-read
     * its colours instead of freezing the mode it was first painted in.
     * Returns an unsubscribe function.
     */
    ns.onThemeChange = function (handler) {
        if (typeof handler !== 'function') return function () {};
        listeners.push(handler);
        if (!observer && window.MutationObserver) {
            observer = new window.MutationObserver(function () {
                for (var i = 0; i < listeners.length; i++) {
                    try {
                        listeners[i](ns.isDark());
                    } catch (e) {
                        /* one bad listener must not stop the others */
                    }
                }
            });
            var options = { attributes: true, attributeFilter: ['data-theme'] };
            observer.observe(document.documentElement, options);
            if (document.body) observer.observe(document.body, options);
        }
        return function () {
            var at = listeners.indexOf(handler);
            if (at !== -1) listeners.splice(at, 1);
        };
    };

    window.DRETokens = ns;
})(window, document);
