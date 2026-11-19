/**
 * script.js — assorted layout chrome: sticky-header auto-hide, the measured
 * header height, the collapsible core header search, and the checkbox-label
 * order in Omeka forms. Relies on window.DREUtils (utils.js).
 *
 * NOTE: this file used to also position a `.main-banner` image wrapper. That
 * banner component no longer exists — the masthead is the CSS-drawn
 * `.site-banner` (view/common/banner.phtml) — so ~25 lines of dead code and
 * three selectors that matched nothing have been removed.
 */
(function () {
    'use strict';

const dreScripts = () => {

    const mainHeader = document.querySelector('.main-header');
    const menuToggle = document.querySelector( '.main-navigation__toggle' );
    let mainHeaderSearch = null;

    // Scrolling Events
    //
    // The header is a single position:sticky surface (see _header.scss). On
    // desktop — where the inline menu shows — scrolling down slides the whole
    // masthead away to free reading room, and any scroll up brings it straight
    // back. On mobile it stays pinned so the hamburger is always reachable.
    // (The legacy logic slid only the top utility bar away and silently did
    // nothing once .main-header__top-bar stopped rendering by default — nothing
    // here may require that bar.)
    //
    // Per frame this only reads state that needs no layout and toggles one
    // class: the stylesheet slides the header out with a transform
    // (.is-scrolled-away in _header.scss), which the compositor animates. It
    // used to write `top`, read offsetHeight straight after (a forced layout on
    // every scrolled frame) and rewrite the drawer's top and height inline.

    const AUTO_HIDE_AFTER = 200;         // scroll depth before the header may hide
    const DIRECTION_JITTER = 4;          // px of trackpad wobble to ignore

    let lastKnownScrollPosition = 0;
    let ticking = false;
    let scrollDirection = 'up';

    function headerHasFocus() {
        return mainHeader !== null && mainHeader.contains(document.activeElement);
    }

    function onScroll(scrollPos) {
        if (!mainHeader) {
            return;
        }

        const drawerOpen = menuToggle && menuToggle.getAttribute('aria-expanded') === 'true';
        // navigation.js opens a panel by class for the pointer too.
        const megaMenuInUse = mainHeader.querySelector('.menu-item-has-children.open') !== null;
        const mayHide = mainHeader.getAttribute('data-nav') === 'inline'
            && scrollDirection === 'down'
            && scrollPos > AUTO_HIDE_AFTER
            && !drawerOpen
            && !megaMenuInUse
            && !headerHasFocus(); // never steal the search bar mid-typing or mid-keyboard-nav

        mainHeader.classList.toggle('is-scrolled-away', mayHide);
    }

    document.addEventListener('scroll', () => {
        const delta = window.scrollY - lastKnownScrollPosition;
        if (Math.abs(delta) > DIRECTION_JITTER) {
            scrollDirection = delta > 0 ? 'down' : 'up';
        }
        lastKnownScrollPosition = window.scrollY;

        if (!ticking) {
            window.requestAnimationFrame(() => {
                onScroll(lastKnownScrollPosition);
                ticking = false;
            });

            ticking = true;
        }
    });

    document.addEventListener('focusin', () => {
        if (headerHasFocus()) {
            mainHeader.classList.remove('is-scrolled-away'); // tabbing into a hidden header reveals it
        }
    });

    // The header's height, measured
    //
    // --header-height is the layout token the menu drawer parks below and the
    // anchor offset (--scroll-offset, so scroll-padding-top in _theme.scss) is
    // derived from. The stylesheet's 4.625rem is the fallback until this runs;
    // the real header is taller wherever the nav row, the user bar or enlarged
    // text add to it. A ResizeObserver reports after layout, so reading the
    // size costs nothing, and it fires only when the height actually changes.
    // The transform that slides the header away does not change its box.
    // Nothing inside the header may size itself from this token, or measuring
    // it would feed back into it (the main bar states its own minimum).

    if (mainHeader && typeof ResizeObserver === 'function') {
        let measured = 0;
        new ResizeObserver(([entry]) => {
            const height = Math.round(entry.borderBoxSize?.[0]?.blockSize ?? mainHeader.offsetHeight);
            if (height === measured) return;
            measured = height;
            document.documentElement.style.setProperty('--header-height', height + 'px');
        }).observe(mainHeader);
    }

    // Resize Events

    const RESIZE_DELAY = 150;

    function onResize() {
        onScroll(lastKnownScrollPosition);
    }

    onResize();

    window.addEventListener('resize', window.DREUtils.debounce(onResize, RESIZE_DELAY));

    // Enhance only successfully initialized core search disclosures.
    let searchToggle = null;
    function closeSearch(restoreFocus) {
        if (!mainHeaderSearch) return;
        mainHeaderSearch.classList.remove('visible');
        mainHeaderSearch.hidden = true;
        searchToggle.setAttribute('aria-expanded', 'false');
        if (restoreFocus) searchToggle.focus();
        mainHeaderSearch = null;
        searchToggle = null;
    }
    document.querySelectorAll('[data-core-search]').forEach(root => {
        const button = root.querySelector('.main-search-button');
        const panel = root.querySelector('.main-header-search');
        const input = panel?.querySelector('input[type="search"]');
        // Without its field the panel stays as rendered: opening it would set
        // aria-expanded and then have nowhere to put focus.
        if (!button || !panel || !input) return;
        panel.hidden = true;
        root.classList.add('search-ready');
        button.hidden = false;
        button.addEventListener('click', () => {
            const wasOpen = searchToggle === button;
            closeSearch(false);
            if (wasOpen) return;
            mainHeaderSearch = panel;
            searchToggle = button;
            panel.hidden = false;
            panel.classList.add('visible');
            button.setAttribute('aria-expanded', 'true');
            input.focus();

        });
    });
    document.addEventListener('click', e => {
        if (mainHeaderSearch && !mainHeaderSearch.contains(e.target) && !searchToggle.contains(e.target)) closeSearch(false);
    });
    document.addEventListener('focusin', e => {
        if (mainHeaderSearch && !mainHeaderSearch.contains(e.target) && !searchToggle.contains(e.target)) closeSearch(false);
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && mainHeaderSearch) {
            e.preventDefault();
            closeSearch(true);
        }
    });

    // Forms
    //
    // Omeka renders a checkbox field as `.field-meta` (the label) followed by
    // `.inputs` (the control). For checkboxes that reads backwards, so the label
    // is moved after the box. Only the DOM move happens here — the presentation
    // is a class the stylesheet owns (`.inputs--checkbox-inline` in
    // base/elements/_fields.scss); this used to set `float` and `marginRight` as
    // inline styles from JS.
    document.querySelectorAll('form').forEach(form => {
        form.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            const inputs = checkbox.parentElement;
            if (!inputs || !inputs.classList.contains('inputs')) {
                return;
            }
            const fieldMeta = inputs.previousElementSibling;
            if (fieldMeta && fieldMeta.classList.contains('field-meta')) {
                inputs.append(fieldMeta);
                inputs.classList.add('inputs--checkbox-inline');
            }
        });
    });
}

window.DREUtils.onReady(dreScripts);

})();
