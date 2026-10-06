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

    var reduced = window.matchMedia
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function init() {
        // Leave everything visible if we can't (or shouldn't) animate.
        if (reduced || !('IntersectionObserver' in window)) return;

        var els = document.querySelectorAll('[data-rv-reveal]');
        if (!els.length) return;

        var obs = new IntersectionObserver(function (entries, o) {
            entries.forEach(function (e) {
                if (!e.isIntersecting) return;
                var el = e.target;
                var delay = +(el.getAttribute('data-rv-reveal') || 0);
                if (delay > 0) {
                    setTimeout(function () { el.setAttribute('data-reveal', 'shown'); }, delay);
                } else {
                    el.setAttribute('data-reveal', 'shown');
                }
                o.unobserve(el);
            });
        }, { rootMargin: '0px 0px -8% 0px' });

        // Only what is still below the fold waits to arrive. Cards already on
        // screen have been painted by now; hiding them would flash them out and
        // back in and delay the largest paint. All reads before any write.
        var fold = window.innerHeight * 0.92;
        var pending = Array.prototype.filter.call(els, function (el) {
            return el.getBoundingClientRect().top >= fold;
        });
        pending.forEach(function (el) {
            el.setAttribute('data-reveal', 'hidden');
            obs.observe(el);
        });
    }

    window.DREUtils.onReady(init);
})();
