/**
 * Shared utilities for the DRE theme scripts.
 * Exposes window.DREUtils.
 */
(function () {
    'use strict';

    /**
     * Run a callback when the DOM is ready.
     * If the DOM is already parsed, the callback runs immediately.
     */
    function onReady(callback) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', callback, { once: true });
        } else {
            callback();
        }
    }

    /**
     * Trailing-edge debounce. Returns a wrapped function that only fires
     * `wait` ms after the last call.
     */
    function debounce(fn, wait) {
        let timeout = null;
        return function debounced(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                timeout = null;
                fn.apply(this, args);
            }, wait);
        };
    }

    window.DREUtils = {
        onReady: onReady,
        debounce: debounce
    };
})();
