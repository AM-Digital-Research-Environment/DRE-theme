/**
 * Theme Toggle
 * Dark / light switching with localStorage persistence, defaulting to the
 * visitor's system preference. The synchronous head-script in layout.phtml
 * applies the stored theme before first paint; this module wires the toggle
 * button and keeps the <html> and <body> data-theme attributes in sync.
 */
(function () {
    'use strict';

    const STORAGE_KEY = 'dre-theme-preference';
    const THEME_ATTRIBUTE = 'data-theme';

    /** The visitor's explicit choice, if storage holds one. */
    function storedTheme() {
        try {
            const stored = window.localStorage.getItem(STORAGE_KEY);
            return stored === 'light' || stored === 'dark' ? stored : null;
        } catch {
            return null;
        }
    }

    function rememberTheme(theme) {
        try {
            window.localStorage.setItem(STORAGE_KEY, theme);
        } catch {
            // Storage can be unavailable in private/sandboxed contexts. The
            // current-page toggle must continue to work without persistence.
        }
    }

    /**
     * The mode in force. The head script in layout.phtml has already resolved
     * it (stored choice, else system preference) onto data-theme, and
     * window.DRETokens (dre-token-bridge.js, in <head>) reads it the way every
     * module does, falling back to the system preference where the head script
     * could not run. The attribute alone answers should the bridge be missing.
     */
    function currentTheme() {
        const dark = window.DRETokens
            ? window.DRETokens.isDark()
            : document.body.getAttribute(THEME_ATTRIBUTE) === 'dark';
        return dark ? 'dark' : 'light';
    }

    function applyTheme(theme) {
        // <html> drives the root color-scheme (scrollbars / native UI); <body>
        // drives subtree theming and is what chart modules observe.
        document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
        document.body.setAttribute(THEME_ATTRIBUTE, theme);
        updateThemeColor(theme);
        updateToggleButton(theme);
    }

    /**
     * The address-bar tint. The two theme-color metas carry OS media queries,
     * so a visitor who picked dark on a light OS got a light bar over a dark
     * page. Once a theme is applied, the meta for it matches everything and
     * the other matches nothing.
     */
    function updateThemeColor(theme) {
        document.querySelectorAll('meta[name="theme-color"][data-theme-color]').forEach((meta) => {
            meta.setAttribute('media', meta.getAttribute('data-theme-color') === theme ? 'all' : 'not all');
        });
    }

    function updateToggleButton(theme) {
        const toggle = document.querySelector('[data-theme-toggle]');
        if (!toggle) return;

        // The label names the action ("Switch to light mode"). It carries no
        // aria-pressed: "Switch to light mode, pressed" contradicts itself.
        const label = theme === 'dark' ? toggle.dataset.labelLight : toggle.dataset.labelDark;
        if (label) {
            toggle.setAttribute('aria-label', label);
        }
    }

    function toggleTheme() {
        const newTheme = currentTheme() === 'dark' ? 'light' : 'dark';
        rememberTheme(newTheme);
        applyTheme(newTheme);
    }

    function init() {
        // The head-script already set data-theme; sync the button state.
        applyTheme(currentTheme());

        document.addEventListener('click', (event) => {
            const toggle = event.target.closest?.('[data-theme-toggle]');
            if (toggle) {
                event.preventDefault();
                toggleTheme();
            }
        });

        // Follow system changes only while the visitor hasn't chosen manually.
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {

                if (!storedTheme()) {
                    applyTheme(event.matches ? 'dark' : 'light');
                }
            });
        }
    }

    window.DREUtils.onReady(init);
})();
