/**
 * navigation.js — primary navigation.
 *
 * Two behaviours share this file:
 *   • Desktop  — the mega-dropdown panels emitted by common/nav-menu.phtml
 *     (hover-intent open, focus/Escape handling, a caret <button> per parent).
 *   • Mobile   — the sliding menu drawer: the menu is cloned into
 *     #menu-clones, and each level slides in with a focus trap.
 *
 * Everything is scoped inside this IIFE. It previously declared eleven bare
 * `let` bindings and eight top-level `function`s, putting names as generic as
 * `closeMenuDrawer` and `trapFocus` on the global object where any module could
 * collide with them.
 *
 * Cross-file contract (all optional — each is feature-detected):
 *   • `window.__dreClassifyNav`  — set by the inline script in common/header.phtml,
 *     which classifies inline-vs-drawer synchronously before first paint.
 *   • `closeText` / `previousText` — declared by the inline script in
 *     common/menu-drawer.phtml; the translated labels for the drawer's back control.
 *   • `data-label-open` / `data-label-close` on `.main-navigation__toggle` and
 *     `data-submenu-label` on `.main-navigation` — translated strings from the
 *     server (these used to be hardcoded English here).
 */
(function () {
    'use strict';

    const SUBMENU_CLOSE_DELAY = 180; // hover-intent grace period, ms
    const NAV_MODE_DEBOUNCE = 80;    // resize settle, ms

    // Drawer state, shared by the functions below.
    let header = null;
    let navigationInDrawer = null;
    let toggle = null;
    let toggleSrText = null;
    let drawer = null;
    let backer = null;
    let clones = null;
    let expandedTargets = [];
    let cleanupTrap = null;

    // Translated labels resolved from the DOM at init (see contract above).
    const labels = {
        open: 'Open menu',
        close: 'Close menu',
        submenu: 'Show submenu for “%s”',
        backerClose: '',
        backerPrevious: '',
    };

    // ---------------------------------------------------------------- focus

    function getFocusableElements(container) {
        return container.querySelectorAll(
            '.main-navigation__toggle, #menu-backer, .in-viewport > li > a'
        );
    }

    function trapFocus(container) {
        function handleKey(e) {
            const focusable = getFocusableElements(container); // recalculate dynamically
            if (!focusable.length) {
                return;
            }
            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (e.key === 'Tab') {
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }

            if (e.key === 'Escape') {
                e.preventDefault();
                closeMenuDrawer();
            }
        }

        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }

    function releaseTrap() {
        if (typeof cleanupTrap === 'function') {
            cleanupTrap();
            cleanupTrap = null;
        }
    }

    // ---------------------------------------------------------------- drawer

    function setFocusableToElementsInViewPort() {
        if (!navigationInDrawer || !drawer) {
            return;
        }

        navigationInDrawer.querySelectorAll('a').forEach((item) => {
            item.tabIndex = -1;
            item.inert = true;
            item.setAttribute('aria-hidden', 'true');
        });

        drawer.querySelectorAll('.in-viewport > li > a').forEach((item) => {
            item.tabIndex = 0;
            item.inert = false;
            item.removeAttribute('aria-hidden');
        });

        // Guarded: an empty panel would previously throw here and abort the
        // whole open/expand sequence mid-way.
        const firstLink = drawer.querySelector('.in-viewport > li:first-child > a');
        if (firstLink) {
            firstLink.focus();
        }
    }

    function backerContext() {
        if (!backer) {
            return;
        }
        const atRoot = expandedTargets.length === 0;
        const text = atRoot ? labels.backerClose : labels.backerPrevious;

        backer.textContent = text;
        backer.setAttribute('title', text);

        if (atRoot) {
            backer.removeAttribute('aria-label');
            backer.setAttribute('aria-hidden', 'true');
            backer.tabIndex = -1;
        } else {
            backer.setAttribute('aria-label', text);
            backer.removeAttribute('aria-hidden');
            backer.tabIndex = 0;
        }
    }

    function slideMenus(target) {
        backerContext();
        target.classList.add('expanded');
        clones.style.transform = 'translateX( -' + (100 * expandedTargets.length) + '% )';
    }

    function scrollMenuToTop() {
        if (drawer) {
            drawer.scrollTo(0, 0);
        }
    }

    function openMenuDrawer() {
        backerContext();
        drawer.querySelectorAll('a:not(#menu-backer)').forEach((item) => {
            item.tabIndex = 0;
        });
        document.body.classList.add('menu-drawer-toggled');
        drawer.classList.add('toggled');
        drawer.removeAttribute('aria-hidden');
        drawer.removeAttribute('inert');
        toggle.classList.add('open');

        const focusable = getFocusableElements(drawer);
        if (focusable.length) {
            focusable[0].focus();
        }

        navigationInDrawer = drawer.querySelector('.navigation');
        if (navigationInDrawer) {
            navigationInDrawer.classList.add('in-viewport');
            setFocusableToElementsInViewPort();
        }

        releaseTrap();
        cleanupTrap = trapFocus(header);
    }

    function closeMenuDrawer() {
        expandedTargets = [];

        drawer.querySelectorAll('.expanded').forEach((item) => item.classList.remove('expanded'));
        drawer.querySelectorAll('.in-viewport').forEach((item) => item.classList.remove('in-viewport'));
        drawer.querySelectorAll('a').forEach((item) => {
            item.tabIndex = -1;
        });

        clones.style.transform = 'none';

        document.body.classList.remove('menu-drawer-toggled');
        drawer.classList.remove('toggled');
        drawer.setAttribute('aria-hidden', 'true');
        drawer.setAttribute('inert', '');
        toggle.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        if (toggleSrText) {
            toggleSrText.textContent = labels.open;
        }
        toggle.focus();

        releaseTrap();
    }

    function toggleMenu() {
        const expanded = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', String(!expanded));

        if (toggleSrText) {
            toggleSrText.textContent = expanded ? labels.open : labels.close;
        }

        if (expanded) {
            closeMenuDrawer();
        } else {
            openMenuDrawer();
        }
    }

    // ------------------------------------------------------------ desktop

    function wireDesktopSubmenu(item, itemLink, itemButton) {
        let closeTimer = null;

        const openSubmenu = () => {
            clearTimeout(closeTimer);
            item.classList.add('open');
            itemLink.setAttribute('aria-expanded', 'true');
            itemButton.setAttribute('aria-expanded', 'true');
        };

        const closeSubmenu = () => {
            clearTimeout(closeTimer);
            item.classList.remove('open');
            itemLink.setAttribute('aria-expanded', 'false');
            itemButton.setAttribute('aria-expanded', 'false');
        };

        // Hover-intent: open immediately on enter, but defer closing so the
        // pointer can travel from the label into the panel without it snapping
        // shut. mouseenter/mouseleave (unlike mouseover/mouseout) don't fire on
        // inner-element transitions, so there's no flicker.
        item.addEventListener('mouseenter', openSubmenu);
        item.addEventListener('mouseleave', () => {
            clearTimeout(closeTimer);
            closeTimer = setTimeout(closeSubmenu, SUBMENU_CLOSE_DELAY);
        });

        item.addEventListener('focusin', openSubmenu);
        item.addEventListener('focusout', () => {
            // Wait a tick to let focus settle before deciding to close.
            requestAnimationFrame(() => {
                if (!item.contains(document.activeElement)) {
                    closeSubmenu();
                }
            });
        });

        item.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' || e.key === 'Esc') {
                closeSubmenu();
                itemButton.focus();
            }
        });

        itemButton.addEventListener('click', (event) => {
            event.preventDefault();
            if (item.classList.contains('open')) {
                closeSubmenu();
            } else {
                openSubmenu();
            }
        });
    }

    /** Build the caret toggle as DOM, not an HTML string. */
    function buildSubmenuButton(parentLabel) {
        const button = document.createElement('button');
        button.className = 'submenu-btn';
        button.type = 'button';

        const outer = document.createElement('span');
        const srText = document.createElement('span');
        srText.className = 'screen-reader-text';
        // textContent, not innerHTML — the label comes from site nav config and
        // was previously concatenated into an insertAdjacentHTML string.
        srText.textContent = labels.submenu.replace('%s', parentLabel);

        outer.appendChild(srText);
        button.appendChild(outer);
        return button;
    }

    // ---------------------------------------------------------------- init

    function init() {
        const collection = document.querySelectorAll('.main-navigation');
        toggle = document.querySelector('.main-navigation__toggle');

        // Bail BEFORE touching anything. The original read
        // `toggle.querySelector('.sr-only')` three lines above this guard, so a
        // missing toggle threw and killed the whole handler.
        if (!collection.length || !toggle) {
            return;
        }

        header = document.querySelector('.main-header__main-bar');
        drawer = document.getElementById('menu-drawer');
        backer = document.getElementById('menu-backer');
        clones = document.getElementById('menu-clones');

        if (!header || !drawer || !backer || !clones) {
            return;
        }

        toggleSrText = toggle.querySelector('.sr-only');

        // Resolve translated labels from the server-rendered DOM.
        labels.open = toggle.dataset.labelOpen || labels.open;
        labels.close = toggle.dataset.labelClose || labels.close;
        const navEl = collection[0];
        labels.submenu = navEl.dataset.submenuLabel || labels.submenu;
        // Declared by the inline script in common/menu-drawer.phtml.
        labels.backerClose = typeof closeText === 'string' ? closeText : 'Close';
        labels.backerPrevious = typeof previousText === 'string' ? previousText : 'All sections';

        // <button> already activates on Enter/Space and fires click, so no
        // keydown handler is needed (the old one duplicated native behaviour).
        toggle.addEventListener('click', toggleMenu);

        // Reverse so .main-navigation renders first in the drawer.
        Array.prototype.slice.call(collection).reverse().forEach((container) => {
            const menu = container.querySelector('ul');
            if (!menu) {
                return;
            }

            menu.querySelectorAll('li').forEach((item) => {
                for (const child of item.children) {
                    if (child.tagName === 'UL') {
                        item.classList.add('menu-item-has-children');
                    }
                }
            });

            clones.appendChild(menu.cloneNode(true));

            if (menu.className.indexOf('nav-menu') === -1) {
                menu.className += ' nav-menu';
            }
        });

        document
            .querySelectorAll('.main-navigation .nav-menu > li.menu-item-has-children')
            .forEach((item) => {
                const itemLink = item.querySelector('a');
                const itemSubmenu = item.querySelector('ul');
                if (!itemLink || !itemSubmenu) {
                    return;
                }

                const itemButton = buildSubmenuButton(itemLink.textContent.trim());
                itemLink.insertAdjacentElement('afterend', itemButton);

                itemLink.setAttribute('aria-expanded', 'false');
                itemButton.setAttribute('aria-expanded', 'false');

                if (item.closest('.main-navigation')) { // desktop only
                    wireDesktopSubmenu(item, itemLink, itemButton);
                }
            });

        clones.querySelectorAll('*').forEach((item) => {
            if (item.id) {
                item.id = item.id + '-drawer';
            }
        });

        drawer.querySelectorAll('.menu-item-has-children').forEach((item) => {
            const ul = item.querySelector('ul');
            if (ul) {
                const submenuHeader = document.createElement('li');
                submenuHeader.setAttribute('class', 'menu-header');
                submenuHeader.innerHTML = item.innerHTML;
                ul.prepend(submenuHeader);
            }

            item.addEventListener('click', function (event) {
                item.querySelectorAll('li:not(.menu-item-has-children)').forEach((child) => {
                    child.addEventListener('click', (e) => e.stopPropagation());
                });

                item.classList.add('expanded');

                drawer.querySelectorAll('.in-viewport').forEach((el) => el.classList.remove('in-viewport'));
                const panel = item.querySelector('ul');
                if (panel) {
                    panel.classList.add('in-viewport');
                }
                setFocusableToElementsInViewPort();

                if (navigationInDrawer) {
                    navigationInDrawer.querySelectorAll('a').forEach((a) => a.setAttribute('aria-hidden', 'true'));
                }
                item.querySelectorAll('ul a').forEach((a) => a.removeAttribute('aria-hidden'));

                releaseTrap();
                cleanupTrap = trapFocus(header);

                expandedTargets.push(this);
                slideMenus(this);
                scrollMenuToTop();

                event.stopPropagation();
                event.preventDefault();
            });
        });

        backer.addEventListener('click', function (event) {
            event.preventDefault();
            drawer.querySelectorAll('.in-viewport').forEach((el) => el.classList.remove('in-viewport'));

            if (expandedTargets.length > 0) {
                const parentList = expandedTargets[expandedTargets.length - 1].closest('ul');
                if (parentList) {
                    parentList.classList.add('in-viewport');
                }
                setFocusableToElementsInViewPort();

                const collapse = expandedTargets.pop();
                collapse.classList.remove('expanded');
                slideMenus(this);
                scrollMenuToTop();
            } else {
                closeMenuDrawer();
            }
        });

        // Anchors need an explicit Space activation (Enter is native for links,
        // Space is not). #menu-backer is deliberately NOT in this selector any
        // more: it is a <button>, which activates on both keys natively, so
        // including it would fire click twice.
        header.addEventListener('keydown', function (e) {
            if ((e.code === 'Enter' || e.code === 'Space') && e.target.matches('.navigation a')) {
                e.preventDefault();
                e.target.click();
            }
        });

        // ------------------------------------------------------------------
        // Collapse-on-overflow (menu-flash fix #06): the nav owns a full-width
        // row (tier 2), so it almost always fits inline at $xl+, but the safety
        // net stays. The INITIAL classification runs synchronously BEFORE first
        // paint in header.phtml (window.__dreClassifyNav), so the desktop menu
        // never paints then snaps to the drawer. Here we only re-run it on
        // resize and once webfonts settle (both change the menu width), and
        // retire an open drawer when the inline menu takes back over. Every
        // desktop-menu rule is gated on .main-header:not([data-nav="drawer"]);
        // with no JS the attribute is absent and the no-JS wrap is the fallback.
        // ------------------------------------------------------------------
        const navHeader = document.querySelector('.main-header');
        if (!navHeader) {
            return;
        }

        function refreshNavMode() {
            if (typeof window.__dreClassifyNav === 'function') {
                window.__dreClassifyNav();
            }
            // Widening past the threshold while the drawer is open: the inline
            // menu takes over, so retire the open drawer cleanly.
            if (navHeader.getAttribute('data-nav') !== 'drawer' && drawer.classList.contains('toggled')) {
                closeMenuDrawer();
            }
        }

        refreshNavMode();

        // Debounced with a timeout, not requestAnimationFrame — rAF stalls in
        // hidden/background tabs and the mode must track window changes there too.
        const debounce = (window.DREUtils && window.DREUtils.debounce)
            || ((fn, wait) => {
                let t = null;
                return (...args) => {
                    clearTimeout(t);
                    t = setTimeout(() => fn(...args), wait);
                };
            });
        window.addEventListener('resize', debounce(refreshNavMode, NAV_MODE_DEBOUNCE));

        // Webfonts change the menu's width — re-measure once they're in.
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(refreshNavMode);
        }
    }

    if (window.DREUtils && typeof window.DREUtils.onReady === 'function') {
        window.DREUtils.onReady(init);
    } else if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
