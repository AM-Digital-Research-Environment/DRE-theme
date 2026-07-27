/**
 * script.js — assorted layout chrome: sticky-header auto-hide, anchor
 * scroll-padding, annotation tooltips, the collapsible header search, and the
 * generic tooltip component.
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
    const mainHeaderMainBar = document.querySelector('.main-header__main-bar');
    const menuDrawer = document.getElementById('menu-drawer');
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

    const DESKTOP_MENU_MIN_WIDTH = 1200; // keep in sync with $xl in _breakpoints.scss
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
        const megaMenuInUse = mainHeader.querySelector('.menu-item-has-children.open, .menu-item-has-children:hover') !== null;
        const mayHide = window.innerWidth >= DESKTOP_MENU_MIN_WIDTH
            && scrollDirection === 'down'
            && scrollPos > AUTO_HIDE_AFTER
            && !drawerOpen
            && !megaMenuInUse
            && !headerHasFocus(); // never steal the search bar mid-typing or mid-keyboard-nav

        if (mayHide) {
            // A little past its own height so the border + shadow leave with it.
            mainHeader.style.top = -(mainHeader.offsetHeight + 16) + 'px';
        } else {
            mainHeader.style.top = '0px';
        }

        if (menuDrawer) {
            menuDrawer.style.top = mainHeader.offsetHeight + 'px';
            menuDrawer.style.height = 'calc(100% - ' + mainHeader.offsetHeight + 'px)';
        }
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

    // Scroll padding — anchor jumps vs. typing in the header search
    //
    // Anchor navigation needs scroll-padding-top so targets don't land beneath
    // the sticky header. But Chromium also honours that padding when scrolling
    // the caret into view on every keystroke, and the header search lives
    // *inside* the sticky header — permanently above the padding line — so with
    // the offset active each keystroke nudged the whole page upward. While focus
    // is anywhere in the header the offset is zeroed (anchor jumps never
    // coincide with typing up there) and it comes back on blur. NB: this inline
    // style outranks the stylesheet, so it must stay in agreement with the
    // html:has(.main-header input:focus) rule in _theme.scss.

    function refreshScrollPadding() {
        if (!mainHeaderMainBar) {
            return;
        }
        document.documentElement.style.scrollPaddingTop = headerHasFocus()
            ? '0px'
            : (mainHeaderMainBar.offsetHeight + 20) + 'px';
    }

    document.addEventListener('focusin', () => {
        refreshScrollPadding();
        if (headerHasFocus()) {
            mainHeader.style.top = '0px'; // tabbing into a hidden header reveals it
        }
    });

    document.addEventListener('focusout', () => {
        // No focusin fires when focus dissolves to <body> (a click on the page).
        // By focusout time the old element has already blurred, so activeElement
        // reads as the settled state; when focus moves to another control instead,
        // its focusin re-runs this within the same task — no deferral needed.
        refreshScrollPadding();
    });

    // Resize Events

    const RESIZE_DELAY = 150;

    function onResize() {
        refreshScrollPadding();
        onScroll(lastKnownScrollPosition);

        if (menuToggle && window.innerWidth >= DESKTOP_MENU_MIN_WIDTH && menuToggle.getAttribute('aria-expanded') === 'true') {
            menuToggle.click();
        }
    }

    onResize();

    const debounce = (window.DREUtils && window.DREUtils.debounce)
        || ((fn, wait) => {
            let t = null;
            return (...args) => {
                clearTimeout(t);
                t = setTimeout(() => fn(...args), wait);
            };
        });
    window.addEventListener('resize', debounce(onResize, RESIZE_DELAY));

    // Annotations tooltip position

    const annotationBtns = document.querySelectorAll('.annotation-btn');

    annotationBtns.forEach((annotationBtn) => {
        const annotationTooltip = annotationBtn.querySelector('.annotation-tooltip');
        // Guarded: an .annotation-btn without its tooltip markup used to throw
        // here, and because everything in this file shares one function scope,
        // that took out the header search, the form fixes and the tooltips below.
        if (!annotationTooltip) {
            return;
        }
        const annotationTooltipWrapper = annotationTooltip.querySelector('.annotation-tooltip__wrapper');
        if (!annotationTooltipWrapper || !mainHeader) {
            return;
        }

        const eventList = ['click', 'mouseover'];
        eventList.forEach((event) => {
            annotationBtn.addEventListener(event, setAnnotationTooltipPos);
        });

        function setAnnotationTooltipPos() {
            const annotationBtnOffset = annotationBtn.getBoundingClientRect();
            const { top, left } = annotationBtnOffset;
            const distanceToRightEdge = window.innerWidth - (left + annotationBtn.offsetWidth);

            if (distanceToRightEdge < (annotationTooltipWrapper.offsetWidth + 15)) {
                annotationTooltip.style.left = (distanceToRightEdge - annotationTooltipWrapper.offsetWidth - 15) + 'px';
            } else {
                annotationTooltip.style.left = '0px';
            }

            if ((top - mainHeader.offsetHeight - mainHeader.offsetTop) < (annotationTooltipWrapper.offsetHeight + 15)) {
                annotationTooltip.style.bottom = (- annotationTooltipWrapper.offsetHeight - 20) + 'px';
                annotationTooltipWrapper.classList.add('below-button');
            } else {
                annotationTooltip.style.bottom = '10px';
                annotationTooltipWrapper.classList.remove('below-button');

                if (annotationTooltip.style.left == '0px') {
                    annotationTooltip.style.bottom = '5px';
                }
            }
        }
    });

    // Main Header Search
    document.addEventListener('click', onDocumentClick, true);

    function onDocumentClick(e) {
        if (e.target.classList.contains('main-search-button')) {
            const nextSibling = e.target.nextElementSibling;
            if (nextSibling && nextSibling.classList.contains('main-header-search')) {
                mainHeaderSearch = nextSibling;
                mainHeaderSearch.classList.toggle('visible');
                if (mainHeaderSearch.classList.contains('visible')) {
                    const mainSearchInput = mainHeaderSearch.querySelector('input[name="fulltext_search"]');
                    if (mainSearchInput) {
                        mainSearchInput.focus();
                    }
                    document.addEventListener('focusin', onFocusInOutside, true);
                } else {
                    document.removeEventListener('focusin', onFocusInOutside, true);
                }
            }
        } else if (mainHeaderSearch && !mainHeaderSearch.contains(e.target)) {
            mainHeaderSearch.classList.remove('visible');
            document.removeEventListener('focusin', onFocusInOutside, true);
        }
    }

    function onFocusInOutside(e) {
        if (mainHeaderSearch && !mainHeaderSearch.contains(e.target)) {
            mainHeaderSearch.classList.remove('visible');
            document.removeEventListener('focusin', onFocusInOutside, true);
        }
    }

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

    // Tooltips
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' || e.key === 'Esc') {
            document
                .querySelectorAll('.tooltip.is-visible')
                .forEach(el => el.classList.remove('is-visible'));
        }
    });

    document.querySelectorAll('.tooltip').forEach(tooltip => {
        const button = tooltip.querySelector('.tooltip-button');

        if (!button) {
            return;
        }

        button.addEventListener('mouseenter', () =>
            tooltip.classList.add('is-visible')
        );
        button.addEventListener('focus', () =>
            tooltip.classList.add('is-visible')
        );

        button.addEventListener('mouseleave', () =>
            tooltip.classList.remove('is-visible')
        );
        button.addEventListener('blur', () =>
            tooltip.classList.remove('is-visible')
        );
    });
}

if (window.DREUtils && typeof window.DREUtils.onReady === 'function') {
    window.DREUtils.onReady(dreScripts);
} else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', dreScripts, { once: true });
} else {
    dreScripts();
}

})();
