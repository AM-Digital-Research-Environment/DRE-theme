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

        const isDark = theme === 'dark';
        const label = isDark ? toggle.dataset.labelLight : toggle.dataset.labelDark;
        if (label) {
            toggle.setAttribute('aria-label', label);
        }
        toggle.setAttribute('aria-pressed', isDark.toString());
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
            if (theme !== 'light' && theme !== 'dark') {
                return;
            }
            rememberTheme(theme);
            applyTheme(theme);
        }
    };
})();
