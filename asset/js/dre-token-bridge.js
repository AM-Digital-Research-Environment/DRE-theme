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
(function () {
    'use strict';

    const ns = {};
    let probe = null;
    let ctx = null;
    const listeners = [];
    let observer = null;
    // The mode the listeners last heard about: data-theme is rewritten with
    // its current value too (theme-toggle.js syncs it at load), and a
    // listener repainting a canvas should not run for a change that is none.
    let lastDark = null;

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
        const host = document.body || document.documentElement;
        if (host && probe.parentNode !== host) host.appendChild(probe);
        return probe;
    }

    /**
     * Rasterise any browser-parseable CSS colour — including oklch(), oklab()
     * and color-mix() — to a plain rgb()/rgba() string.
     */
    ns.toRGB = (color) => {
        if (!ctx) {
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = 1;
            ctx = canvas.getContext('2d', { willReadFrequently: true });
        }
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = '#000';
        ctx.fillStyle = color; // the browser parses oklch / color-mix here
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
        if (a === 0) return 'rgba(0,0,0,0)';
        if (a === 255) return `rgb(${r},${g},${b})`;
        return `rgba(${r},${g},${b},${(a / 255).toFixed(3)})`;
    };

    /**
     * Resolve a custom property to a plain rgb()/rgba() colour.
     * @param {string} name      e.g. '--primary'
     * @param {string} [fallback] only for non-DRE hosts; omit under the theme
     */
    ns.cssColor = (name, fallback) => {
        fallback = fallback || '#000';
        try {
            const el = getProbe();
            el.style.color = '';
            el.style.color = `var(${name}, ${fallback})`;
            return ns.toRGB(window.getComputedStyle(el).color || fallback) || fallback;
        } catch {
            return fallback;
        }
    };

    /**
     * Resolve a custom property holding a font stack. Unlike colours this needs
     * no rasterising — canvas font shorthand accepts a stack directly.
     */
    ns.cssFont = (name, fallback) => {
        fallback = fallback || 'system-ui, sans-serif';
        try {
            const el = getProbe();
            el.style.fontFamily = '';
            el.style.fontFamily = `var(${name}, ${fallback})`;
            return window.getComputedStyle(el).fontFamily || fallback;
        } catch {
            return fallback;
        }
    };

    /** Resolve a custom property to its raw computed string (lengths, numbers). */
    ns.cssValue = (name, fallback) => {
        try {
            const value = window.getComputedStyle(getProbe()).getPropertyValue(name);
            return (value && value.trim()) || fallback || '';
        } catch {
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
    ns.isDark = () => {
        for (const el of [document.body, document.documentElement]) {
            const attr = el?.getAttribute('data-theme');
            if (attr === 'dark') return true;
            if (attr === 'light') return false;
        }
        return window.matchMedia?.('(prefers-color-scheme: dark)').matches === true;
    };

    /**
     * Call `handler` whenever the theme mode changes, so a canvas can re-read
     * its colours instead of freezing the mode it was first painted in.
     * Returns an unsubscribe function.
     */
    ns.onThemeChange = (handler) => {
        if (typeof handler !== 'function') return () => {};
        listeners.push(handler);
        if (!observer && window.MutationObserver) {
            lastDark = ns.isDark();
            observer = new window.MutationObserver(() => {
                const dark = ns.isDark();
                if (dark === lastDark) return;
                lastDark = dark;
                // A copy: a listener that unsubscribes must not skip the next.
                for (const listener of listeners.slice()) {
                    try {
                        listener(dark);
                    } catch {
                        /* one bad listener must not stop the others */
                    }
                }
            });
            const options = { attributes: true, attributeFilter: ['data-theme'] };
            observer.observe(document.documentElement, options);
            if (document.body) observer.observe(document.body, options);
        }
        return () => {
            const at = listeners.indexOf(handler);
            if (at !== -1) listeners.splice(at, 1);
        };
    };

    window.DRETokens = ns;
})();

