/** Browse view state, one Masonry instance per grid, and a readable CSS fallback. */
(function () {
    'use strict';
    function init() {
        const nativeMasonry = typeof CSS !== 'undefined' && CSS.supports?.('grid-template-rows', 'masonry');
        const states = Array.from(document.querySelectorAll('.resources'), root => ({
            root, masonry: null, initial: root.classList.contains('resource-list') ? 'list' : 'grid', frame: null,
        }));
        function apply(requested) {
            states.forEach(state => {
                const view = requested || state.initial;
                const grid = view === 'grid';
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
                state.root.parentElement?.querySelectorAll('.layout-toggle button').forEach(button => {
                    button.disabled = button.classList.contains(view);
                });
                if (grid && !nativeMasonry && !state.masonry && typeof Masonry === 'function') {
                    try {
                        state.root.classList.add('is-masonry');
                        state.masonry = new Masonry(state.root, {
                            itemSelector: '.resource', columnWidth: '.grid-sizer', gutter: '.gutter-sizer',
                            percentPosition: true,
                            transitionDuration: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : '0.4s',
                        });
                    } catch (_) {
                        state.root.classList.remove('is-masonry');
                    }
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
    if (window.DREUtils?.onReady) window.DREUtils.onReady(init);
    else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true});
    else init();
})();
