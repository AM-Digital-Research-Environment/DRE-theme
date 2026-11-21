/**
 * File back-to-top.js.
 *
 * Reveals a "back to top" control once the page is scrolled past a threshold
 * and returns the visitor to the top on click. Honours reduced-motion.
 */
(function () {
	'use strict';

	const btn = document.querySelector('[data-back-to-top]');

	if (!btn) {
		return;
	}

	const SHOW_AFTER = 400; // px scrolled before the button appears

	// An invisible strip over the first SHOW_AFTER pixels of the page: the
	// button shows once the strip has scrolled out of the viewport. The
	// observer reports only those two crossings, where a scroll listener (a
	// second one, beside script.js's header listener) ran on every frame.
	if ('IntersectionObserver' in window) {
		const sentinel = document.createElement('div');
		sentinel.setAttribute('aria-hidden', 'true');
		sentinel.setAttribute('data-back-to-top-sentinel', '');
		sentinel.style.cssText = `position:absolute;top:0;left:0;width:1px;height:${SHOW_AFTER}px;pointer-events:none;visibility:hidden`;
		document.body.append(sentinel);
		new IntersectionObserver(([entry]) => {
			btn.classList.toggle('is-visible', !entry.isIntersecting);
		}).observe(sentinel);
	} else {
		// Nothing to tell the depth by: the control simply stays available.
		btn.classList.add('is-visible');
	}

	btn.addEventListener('click', () => {
		const smooth = !window.DREUtils.prefersReducedMotion();
		window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });

		// Move focus to the top of the main content for keyboard / screen-reader
		// users: <main id="site-main" tabindex="-1">, the skip link's target. Not
		// #content, the column after the masthead: from there the next Tab
		// skipped the home page's h1 and search. Never the skip link itself,
		// whose :focus style would flash a visible popup.
		const target = document.getElementById('site-main') || document.getElementById('content');
		if (target && typeof target.focus === 'function') {
			target.focus({ preventScroll: true });
		}
	});
})();
