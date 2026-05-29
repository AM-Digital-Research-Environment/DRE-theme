/**
 * Theme Toggle
 * Dark / light switching with localStorage persistence, defaulting to the
 * visitor's system preference. The synchronous head-script in layout.phtml
 * applies the stored theme before first paint; this module wires the toggle
 * button and keeps the <body> data-theme attribute in sync.
 */
(function () {
    'use strict';

    const STORAGE_KEY = 'dre-theme-preference';
    const THEME_ATTRIBUTE = 'data-theme';

    /**
     * Preferred theme: localStorage > system preference > light.
     */
    function getPreferredTheme() {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === 'light' || stored === 'dark') {
            return stored;
        }
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        return 'light';
    }

    function applyTheme(theme) {
        document.body.setAttribute(THEME_ATTRIBUTE, theme);
        updateToggleButton(theme);
    }

    function updateToggleButton(theme) {
        const toggle = document.querySelector('[data-theme-toggle]');
        if (!toggle) return;

        const isDark = theme === 'dark';
        toggle.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
        toggle.setAttribute('aria-pressed', isDark.toString());
    }

    function toggleTheme() {
        const currentTheme = document.body.getAttribute(THEME_ATTRIBUTE) || getPreferredTheme();
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        localStorage.setItem(STORAGE_KEY, newTheme);
        applyTheme(newTheme);
    }

    function init() {
        // The head-script already set data-theme; sync the button state.
        applyTheme(document.body.getAttribute(THEME_ATTRIBUTE) || getPreferredTheme());

        document.addEventListener('click', function (event) {
            const toggle = event.target.closest('[data-theme-toggle]');
            if (toggle) {
                event.preventDefault();
                toggleTheme();
            }
        });

        // Follow system changes only while the visitor hasn't chosen manually.
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (event) {
                if (!localStorage.getItem(STORAGE_KEY)) {
                    applyTheme(event.matches ? 'dark' : 'light');
                }
            });
        }
    }

    if (window.DREUtils && typeof window.DREUtils.onReady === 'function') {
        window.DREUtils.onReady(init);
    } else if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }

    window.DRETheme = {
        toggle: toggleTheme,
        get: getPreferredTheme,
        set: function (theme) {
            localStorage.setItem(STORAGE_KEY, theme);
            applyTheme(theme);
        }
    };
})();
