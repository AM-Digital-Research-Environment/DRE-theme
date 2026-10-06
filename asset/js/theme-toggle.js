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

    /**
     * Preferred theme: localStorage > system preference > light.
     */
    function storedTheme() {
        try {
            const stored = window.localStorage.getItem(STORAGE_KEY);
            return stored === 'light' || stored === 'dark' ? stored : null;
        } catch (error) {
            return null;
        }
    }

    function rememberTheme(theme) {
        try {
            window.localStorage.setItem(STORAGE_KEY, theme);
        } catch (error) {
            // Storage can be unavailable in private/sandboxed contexts. The
            // current-page toggle must continue to work without persistence.
        }
    }

    function getPreferredTheme() {
        const stored = storedTheme();
        if (stored) {
            return stored;
        }
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        return 'light';
    }

    function applyTheme(theme) {
        // <html> drives the root color-scheme (scrollbars / native UI); <body>
        // drives subtree theming and is what chart modules observe.
        document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
        document.body.setAttribute(THEME_ATTRIBUTE, theme);
        updateToggleButton(theme);
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
        const currentTheme = document.body.getAttribute(THEME_ATTRIBUTE) || getPreferredTheme();
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        rememberTheme(newTheme);
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
                if (!storedTheme()) {
                    applyTheme(event.matches ? 'dark' : 'light');
                }
            });
        }
    }

    window.DREUtils.onReady(init);
})();
