/**
 * Record apparatus — citation style switcher and "Copy citation".
 *
 * Two independent enhancements over view/common/record-apparatus.phtml, and
 * they must stay independent: the copy button is gated on the async clipboard
 * API, but the style tabs are not, so a browser that cannot copy still gets a
 * working switcher. (Server-side the default style is shown and the rest carry
 * `hidden`, so the panel is complete before any of this runs.)
 */
(function () {
    'use strict';

    // ─── Style switcher ─────────────────────────────────────────────────────
    // A roving-tabindex tablist: one tab in the tab order, arrows move between
    // them. Bound per panel so ids stay unambiguous when a page grows a second.
    document.querySelectorAll('[data-record-citation]').forEach(function (root) {
        var tabs = Array.prototype.slice.call(root.querySelectorAll('[data-citation-style]'));
        var panels = Array.prototype.slice.call(root.querySelectorAll('[data-citation-panel]'));
        if (tabs.length < 2) {
            return;
        }

        function activate(style, focusTab) {
            tabs.forEach(function (tab) {
                var on = tab.getAttribute('data-citation-style') === style;
                tab.setAttribute('aria-selected', on ? 'true' : 'false');
                tab.tabIndex = on ? 0 : -1;
                if (on && focusTab) {
                    tab.focus();
                }
            });
            panels.forEach(function (panel) {
                if (panel.getAttribute('data-citation-panel') === style) {
                    panel.removeAttribute('hidden');
                } else {
                    panel.setAttribute('hidden', '');
                }
            });
        }

        tabs.forEach(function (tab, index) {
            tab.addEventListener('click', function () {
                activate(tab.getAttribute('data-citation-style'), false);
            });
            tab.addEventListener('keydown', function (event) {
                var move = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1
                    : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1
                    : event.key === 'Home' ? 'first'
                    : event.key === 'End' ? 'last'
                    : 0;
                if (!move) {
                    return;
                }
                event.preventDefault();
                var next = move === 'first' ? 0
                    : move === 'last' ? tabs.length - 1
                    : (index + move + tabs.length) % tabs.length;
                activate(tabs[next].getAttribute('data-citation-style'), true);
            });
        });
    });

    // ─── Copy citation ──────────────────────────────────────────────────────
    // The button ships hidden and is revealed only where the async clipboard
    // API actually exists, so a browser that cannot copy never shows a control
    // that does nothing. (The clipboard API is also secure-context only, which
    // is why feature detection — not a user-agent guess — is the gate.)
    var canCopy = !!(navigator.clipboard && navigator.clipboard.writeText
        && window.isSecureContext);
    if (!canCopy) {
        return;
    }

    document.querySelectorAll('[data-record-copy]').forEach(function (wrap) {
        wrap.hidden = false;
    });

    /** The citation the reader is actually looking at, else the server fallback. */
    function textFor(button) {
        var root = button.closest('.record-apparatus');
        var panel = root && root.querySelector('[data-citation-panel]:not([hidden])');
        if (panel) {
            var shown = (panel.textContent || '').replace(/\s+/g, ' ').trim();
            if (shown) {
                return shown;
            }
        }
        return button.getAttribute('data-copy-text') || '';
    }

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

        var text = textFor(button);
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
