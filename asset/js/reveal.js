/**
 * Reveal-on-scroll — the theme half of the DRE's shared arrival grammar.
 *
 * Mirrors DRE Visualizations' `ns.revealOnScroll` (dashboard-core.js): one
 * one-shot IntersectionObserver that fades + rises `[data-rv-reveal]` elements as
 * they enter the viewport, so resource cards (theme) and dashboard charts (module)
 * animate with the SAME motion vocabulary (design-review F11). The CSS does the
 * transition (`[data-reveal=hidden|shown]`, utilities/_reveal.scss).
 *
 * Progressive enhancement: a target is only hidden once this runs, so with JS off
 * — or no IntersectionObserver, or prefers-reduced-motion — nothing is ever
 * hidden and the content renders normally. `data-rv-reveal` may carry a stagger
 * delay in ms.
 */
(function () {
    'use strict';

    function init() {
        // Leave everything visible if we can't (or shouldn't) animate. Reduced
        // motion is read now, not when the script loaded.
        if (window.DREUtils.prefersReducedMotion() || !('IntersectionObserver' in window)) return;

        const els = document.querySelectorAll('[data-rv-reveal]');
        if (!els.length) return;

        const obs = new IntersectionObserver((entries, o) => {
            entries.forEach((e) => {
                if (!e.isIntersecting) return;
                const el = e.target;
                const delay = Number(el.getAttribute('data-rv-reveal') || 0);
                if (delay > 0) {
                    setTimeout(() => el.setAttribute('data-reveal', 'shown'), delay);
                } else {
                    el.setAttribute('data-reveal', 'shown');
                }
                o.unobserve(el);
            });
        }, { rootMargin: '0px 0px -8% 0px' });

        // Only what is still below the fold waits to arrive. Cards already on
        // screen have been painted by now; hiding them would flash them out and
        // back in and delay the largest paint. All reads before any write.
        const fold = window.innerHeight * 0.92;
        const pending = Array.from(els).filter((el) => el.getBoundingClientRect().top >= fold);
        pending.forEach((el) => {
            el.setAttribute('data-reveal', 'hidden');
            obs.observe(el);
        });
    }

    window.DREUtils.onReady(init);
})();
