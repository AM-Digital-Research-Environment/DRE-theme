/**
 * File back-to-top.js.
 *
 * Reveals a "back to top" control once the page is scrolled past a threshold
 * and returns the visitor to the top on click. Honours reduced-motion.
 */
(function () {
	const btn = document.querySelector('[data-back-to-top]');

	if (!btn) {
		return;
	}

	const SHOW_AFTER = 400; // px scrolled before the button appears
	let ticking = false;

	function update() {
		btn.classList.toggle('is-visible', window.scrollY > SHOW_AFTER);
		ticking = false;
	}

	function onScroll() {
		if (!ticking) {
			window.requestAnimationFrame(update);
			ticking = true;
		}
	}

	window.addEventListener('scroll', onScroll, { passive: true });
	update();

	btn.addEventListener('click', function () {
		const prefersReducedMotion =
			window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });

		// Move focus to the main content region for keyboard / screen-reader
		// users. NB: target #content (role="main", tabindex="-1") — never the
		// skip link, whose :focus style would flash a visible popup.
		const target = document.getElementById('content');
		if (target && typeof target.focus === 'function') {
			target.focus({ preventScroll: true });
		}
	});
})();
