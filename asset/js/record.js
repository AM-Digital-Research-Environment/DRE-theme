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
    document.querySelectorAll('[data-record-citation]').forEach((root) => {
        const tabs = Array.from(root.querySelectorAll('[data-citation-style]'));
        const panels = Array.from(root.querySelectorAll('[data-citation-panel]'));
        if (tabs.length < 2) {
            return;
        }

        function activate(style, focusTab) {
            tabs.forEach((tab) => {
                const on = tab.getAttribute('data-citation-style') === style;
                tab.setAttribute('aria-selected', on ? 'true' : 'false');
                tab.tabIndex = on ? 0 : -1;
                if (on && focusTab) {
                    tab.focus();
                }
            });
            panels.forEach((panel) => {
                panel.hidden = panel.getAttribute('data-citation-panel') !== style;
            });
            // Pointer and arrow-key changes alike: the shortlist re-reads the
            // citation the reader is now looking at.
            root.dispatchEvent(new CustomEvent('dre:citation-style', { bubbles: true, detail: { style } }));
        }

        const moves = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1, Home: 'first', End: 'last' };

        tabs.forEach((tab, index) => {
            tab.addEventListener('click', () => {
                activate(tab.getAttribute('data-citation-style'), false);
            });
            tab.addEventListener('keydown', (event) => {
                const move = moves[event.key];
                if (!move) {
                    return;
                }
                event.preventDefault();
                const next = move === 'first' ? 0
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
    const canCopy = Boolean(navigator.clipboard?.writeText && window.isSecureContext);
    if (!canCopy) {
        return;
    }

    document.querySelectorAll('[data-record-copy]').forEach((wrap) => {
        wrap.hidden = false;
    });

    /**
     * The citation the reader is actually looking at, else the server fallback.
     * A value's own copy button (the permanent link) copies exactly its value.
     */
    function textFor(button) {
        if (button.hasAttribute('data-copy-exact')) {
            return button.getAttribute('data-copy-text') || '';
        }
        const panel = button.closest('.record-apparatus')?.querySelector('[data-citation-panel]:not([hidden])');
        const shown = panel ? window.DREUtils.normaliseSpace(panel.textContent) : '';
        return shown || button.getAttribute('data-copy-text') || '';
    }

    document.addEventListener('click', (event) => {
        // event.target can be a non-Element node (or the document): guard
        // rather than let a stray click throw on `.closest`.
        const button = event.target?.closest?.('.record-apparatus__copy, [data-copy-exact]');
        if (!button) {
            return;
        }

        const text = textFor(button);
        if (!text) {
            return;
        }

        navigator.clipboard.writeText(text).then(() => {
            // Swap the label briefly, and announce it: a silent state change is
            // no confirmation at all for a screen-reader user.
            window.DREUtils.flashLabel(button, button.getAttribute('data-copied-label') || 'Copied', 2000);
        }).catch(() => {
            // A denied clipboard permission is not worth a console error.
        });
    });
})();
