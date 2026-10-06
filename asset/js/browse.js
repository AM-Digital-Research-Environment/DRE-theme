/** Browse view state, one Masonry instance per grid, and a readable CSS fallback. */
(function () {
    'use strict';
    // Masonry (~24 KiB) is only fetched where the engine cannot lay the grid out
    // itself. It lives next to this file, so its URL (and ?v= cache-buster) is
    // derived from ours rather than appended to every browse page up front.
    const ownSrc = document.currentScript?.src || '';
    const masonrySrc = ownSrc ? ownSrc.replace(/browse\.js(?=\?|#|$)/, 'masonry.pkgd.min.js') : '';
    let masonryLoad = null;
    function loadMasonry() {
        if (typeof Masonry === 'function') return Promise.resolve(true);
        if (!masonrySrc || masonrySrc === ownSrc) return Promise.resolve(false);
        masonryLoad = masonryLoad || new Promise(resolve => {
            const script = document.createElement('script');
            script.src = masonrySrc;
            script.async = true;
            script.onload = () => resolve(typeof Masonry === 'function');
            script.onerror = () => resolve(false);
            document.head.append(script);
        });
        return masonryLoad;
    }

    function init() {
        const nativeLanes = typeof CSS !== 'undefined' && CSS.supports?.('display', 'grid-lanes');
        const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        const states = Array.from(document.querySelectorAll('.resources'), root => ({
            root, masonry: null, initial: root.classList.contains('resource-list') ? 'list' : 'grid', view: null, frame: null,
        }));
        function startMasonry(state) {
            if (state.view !== 'grid' || state.masonry || typeof Masonry !== 'function') return;
            try {
                state.root.classList.add('is-masonry');
                state.masonry = new Masonry(state.root, {
                    itemSelector: '.resource', columnWidth: '.grid-sizer', gutter: '.gutter-sizer',
                    percentPosition: true, transitionDuration: reduceMotion ? 0 : '0.4s',
                });
            } catch (_) {
                state.root.classList.remove('is-masonry');
            }
        }
        function apply(requested) {
            states.forEach(state => {
                const view = requested || state.initial;
                const grid = view === 'grid';
                state.view = view;
                if (!grid && state.masonry) {
                    state.masonry.destroy();
                    state.masonry = null;
                    state.root.classList.remove('is-masonry');
                }
                state.root.classList.toggle('resource-grid', grid);
                state.root.classList.toggle('resource-list', !grid);
                state.root.querySelectorAll('.resource').forEach(card => {
                    card.classList.toggle('media-object', !grid);
                    card.querySelector('.resource__meta')?.classList.toggle('media-object-section', !grid);
                    const thumb = card.querySelector('.resource__thumbnail');
                    if (thumb?.classList.contains('decoration')) thumb.classList.toggle('decoration--thumbnail', !grid);
                });
                // Both buttons stay operable: disabling the pressed one would drop
                // keyboard focus to <body> the moment it is activated.
                state.root.parentElement?.querySelectorAll('.layout-toggle button').forEach(button => {
                    button.setAttribute('aria-pressed', String(button.classList.contains(view)));
                });
                if (grid && !nativeLanes && !state.masonry) {
                    // A load that resolves after the reader switched to list must
                    // not start a stale instance; startMasonry re-checks the view.
                    if (typeof Masonry === 'function') startMasonry(state);
                    else loadMasonry().then(ok => { if (ok) startMasonry(state); });
                }
                state.masonry?.layout();
            });
            document.querySelectorAll('.pager-wrapper a.previous, .pager-wrapper a.next').forEach(link => {
                const url = new URL(link.href);
                if (requested) url.searchParams.set('view', requested);
                else url.searchParams.delete('view');
                link.href = url.href;
            });
            document.querySelectorAll('.pager-wrapper form.pager').forEach(form => {
                let input = form.querySelector('input[name="view"]');
                if (!requested) { input?.remove(); return; }
                if (!input) {
                    input = document.createElement('input');
                    input.type = 'hidden'; input.name = 'view'; form.append(input);
                }
                input.value = requested;
            });
        }
        function fromUrl() {
            const view = new URL(location.href).searchParams.get('view');
            apply(['grid', 'list'].includes(view) ? view : null);
        }
        document.querySelectorAll('.layout-toggle button').forEach(button => button.addEventListener('click', () => {
            const view = button.classList.contains('list') ? 'list' : 'grid';
            if (button.getAttribute('aria-pressed') === 'true') return;
            const url = new URL(location.href);
            url.searchParams.set('view', view);
            history.pushState(null, '', url);
            apply(view);
        }));
        states.forEach(state => {
            const relayout = event => {
                if (event.target.tagName !== 'IMG' || state.frame !== null) return;
                state.frame = requestAnimationFrame(() => { state.frame = null; state.masonry?.layout(); });
            };
            state.root.addEventListener('load', relayout, true);
            state.root.addEventListener('error', relayout, true);
        });
        document.fonts?.ready.then(() => states.forEach(state => state.masonry?.layout()));
        window.addEventListener('popstate', fromUrl);
        fromUrl();
    }
    window.DREUtils.onReady(init);
})();
