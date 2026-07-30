/**
 * Record apparatus — "Copy citation".
 *
 * Progressive enhancement, vanilla, no dependencies. The button ships hidden
 * and is revealed only where the async clipboard API actually exists, so a
 * browser that cannot copy never shows a control that does nothing. (The
 * clipboard API is also secure-context only, which is why feature detection —
 * not a user-agent guess — is the gate.)
 */
(function () {
    'use strict';

    var canCopy = !!(navigator.clipboard && navigator.clipboard.writeText
        && window.isSecureContext);
    if (!canCopy) {
        return;
    }

    document.querySelectorAll('[data-record-copy]').forEach(function (wrap) {
        wrap.hidden = false;
    });

    document.addEventListener('click', function (event) {
        // event.target can be a non-Element node (or the document) — guard
        // rather than let a stray click throw on `.closest`.
        var target = event.target;
        if (!target || typeof target.closest !== 'function') {
            return;
        }
        var button = target.closest('.record-apparatus__copy');
        if (!button) {
            return;
        }

        var text = button.getAttribute('data-copy-text') || '';
        if (!text) {
            return;
        }

        navigator.clipboard.writeText(text).then(function () {
            // Swap the label briefly, and announce it: a silent state change is
            // no confirmation at all for a screen-reader user.
            if (button.dataset.busy) {
                return;
            }
            var original = button.textContent;
            button.dataset.busy = '1';
            button.textContent = button.getAttribute('data-copied-label') || 'Copied';
            button.setAttribute('aria-live', 'polite');
            window.setTimeout(function () {
                button.textContent = original;
                button.removeAttribute('aria-live');
                delete button.dataset.busy;
            }, 2000);
        }).catch(function () {
            // A denied clipboard permission is not worth a console error.
        });
    });
})();
