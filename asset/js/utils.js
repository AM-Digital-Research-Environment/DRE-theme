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

    /**
     * Announce a short message through one persistent, visually hidden status
     * region. A live region must already be in the document when its text
     * changes, and toggling aria-live on the control itself is announced
     * unreliably, so every script shares this one.
     */
    let region = null;
    function announce(message) {
        if (!region) {
            region = document.createElement('div');
            region.className = 'sr-only';
            region.setAttribute('role', 'status');
            document.body.append(region);
        }
        region.textContent = '';
        // Set after a tick, so a repeated message is a change and re-announces.
        setTimeout(() => { region.textContent = message; }, 50);
    }

    /**
     * Swap a button's label for brief feedback ("Copied"), then restore it.
     * The original label is captured once, so a second click inside the
     * feedback window cannot make "Copied" the button's permanent name.
     */
    const flashTimers = new WeakMap();
    function flashLabel(button, message, duration = 2000) {
        if (!('label' in button.dataset)) button.dataset.label = button.textContent;
        clearTimeout(flashTimers.get(button));
        button.textContent = message;
        announce(message);
        flashTimers.set(button, setTimeout(() => {
            button.textContent = button.dataset.label;
            flashTimers.delete(button);
        }, duration));
    }

    window.DREUtils = {
        onReady: onReady,
        debounce: debounce,
        announce: announce,
        flashLabel: flashLabel
    };
})();
