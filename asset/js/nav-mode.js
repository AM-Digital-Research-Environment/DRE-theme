/**
 * nav-mode.js — choose the inline menu row or the drawer before first paint.
 *
 * Not loaded as a file: common/header.phtml inlines its minified build
 * (asset/js/dist/nav-mode.min.js) straight after the navigation markup. Every
 * external script is deferred (helper/DeferScripts.php) and so runs after the
 * first paint, which would paint the menu in one mode and snap it to the
 * other. It is a source file so that it is linted, minified and unit-tested
 * like the rest; it used to be a hand-written inline script.
 *
 * Until a mode is set, `html.js .main-header:not([data-nav])` keeps the nav
 * row invisible (components/header/_header.scss). Below the desktop
 * breakpoint the answer needs no layout and is set at once. Above it the
 * menu's natural width has to be measured, which forces a layout: that
 * happens in the next animation frame, which runs before the frame is
 * painted, not while the parser is still building the page.
 *
 * navigation.js re-runs the classifier on resize and once the webfonts are in,
 * through window.__dreClassifyNav.
 */
(function () {
    'use strict';

    // $xl in abstracts/variables/_breakpoints.scss, as the stylesheet tests it.
    const DESKTOP = '(min-width: 1200px)';
    // Breathing room so a menu that only just fits is not clipped by rounding.
    const SLACK = 8;

    const header = document.querySelector('.main-header');
    const container = header?.querySelector('.main-navigation__container');
    const menu = container?.querySelector('ul');
    if (!header || !container || !menu) return;

    const isDesktop = () => window.matchMedia?.(DESKTOP).matches ?? window.innerWidth >= 1200;

    /** The menu's width laid out on one line, off-screen, with no wrapping. */
    function naturalWidth() {
        const containerStyle = container.style.cssText;
        const menuStyle = menu.style.cssText;
        container.style.cssText = 'display:block;position:absolute;visibility:hidden;left:-9999px;top:0;width:max-content';
        menu.style.cssText = 'display:flex;flex-wrap:nowrap;width:max-content';
        const width = menu.getBoundingClientRect().width;
        container.style.cssText = containerStyle;
        menu.style.cssText = menuStyle;
        return width;
    }

    function classify() {
        if (!isDesktop()) {
            header.setAttribute('data-nav', 'drawer');
            return;
        }
        // Measure under the real inline rules, even when arriving from drawer
        // mode. The successful-init gate is restored within this same task.
        const ready = header.classList.contains('nav-ready');
        header.classList.add('nav-ready');
        header.setAttribute('data-nav', 'inline');
        const available = container.clientWidth || header.clientWidth;
        const needed = naturalWidth() + SLACK;
        if (!ready) header.classList.remove('nav-ready');
        header.setAttribute('data-nav', needed > available ? 'drawer' : 'inline');
    }

    window.__dreClassifyNav = classify;

    // navigation.js may classify first (at DOMContentLoaded), and a hidden tab
    // runs no animation frames at all; the first answer stands.
    const classifyOnce = () => {
        if (!header.hasAttribute('data-nav')) classify();
    };
    if (isDesktop()) {
        window.requestAnimationFrame(classifyOnce);
    } else {
        classify();
    }

    // navigation.js adds .nav-ready at DOMContentLoaded. Still missing at load
    // means it failed: fall back to the expanded list (_header.scss).
    window.addEventListener('load', () => {
        classifyOnce();
        if (!header.classList.contains('nav-ready')) header.classList.add('nav-failed');
    });
})();
