/** Grid/list state, history and one Masonry lifecycle per resource container. */
(function () {
    'use strict';
    function init() {
        const nativeMasonry = window.CSS && CSS.supports('grid-template-rows', 'masonry');
        const states = Array.from(document.querySelectorAll('.resources')).map(root => ({
            root,
            initial: root.classList.contains('resource-grid') ? 'grid' : 'list',
            masonry: null,
            toggles: root.parentElement.querySelectorAll('.layout-toggle button'),
        }));
        function layout(state, view) {
            const grid = view === 'grid';
            const root = state.root;
            if (!grid && state.masonry) {
                state.masonry.destroy();
                state.masonry = null;
                root.classList.remove('is-masonry');
            }
            root.classList.toggle('resource-grid', grid);
            root.classList.toggle('resource-list', !grid);
            root.querySelectorAll('.resource').forEach(card => {
                card.classList.toggle('media-object', !grid);
                card.querySelector('.resource__meta')?.classList.toggle('media-object-section', !grid);
                const thumb = card.querySelector('.resource__thumbnail.decoration');
                thumb?.classList.toggle('decoration--thumbnail', !grid);
            });
            state.toggles.forEach(button => { button.disabled = button.classList.contains(view); });
            if (grid && !nativeMasonry && !state.masonry && typeof window.Masonry === 'function') {
                root.classList.add('is-masonry');
                try {
                    state.masonry = new window.Masonry(root, {
                        itemSelector: '.resource', columnWidth: '.grid-sizer',
                        gutter: '.gutter-sizer', percentPosition: true,
                        transitionDuration: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : '0.4s',
                    });
                } catch (_) {
                    // A failed engine must leave the visible CSS grid usable.
                    window.Masonry.data?.(root)?.destroy();
                    root.classList.remove('is-masonry');
                }
            }
        }
        function apply(view) {
            states.forEach(state => layout(state, view || state.initial));
            document.querySelectorAll('.pager-wrapper a.previous, .pager-wrapper a.next').forEach(link => {
                const url = new URL(link.href);
                if (view) url.searchParams.set('view', view);
                else url.searchParams.delete('view');
                link.href = url.href;
            });
            document.querySelectorAll('.pager').forEach(form => {
                let field = form.querySelector('input[name="view"]');
                if (!view) { field?.remove(); return; }
                if (!field) {
                    field = document.createElement('input');
                    field.type = 'hidden'; field.name = 'view'; form.appendChild(field);
                }
                field.value = view;
            });
        }
        function fromUrl() {
            const view = new URL(location.href).searchParams.get('view');
            apply(view === 'grid' || view === 'list' ? view : null);
        }
        const buttons = new Set(states.flatMap(state => Array.from(state.toggles)));
        buttons.forEach(button => button.addEventListener('click', () => {
            const view = button.classList.contains('list') ? 'list' : 'grid';
            const url = new URL(location.href);
            url.searchParams.set('view', view);
            window.history.pushState({}, '', url);
            apply(view);
        }));
        states.forEach(state => state.root.querySelectorAll('img').forEach(img => {
            const relayout = () => state.masonry?.layout();
            img.addEventListener('load', relayout);
            img.addEventListener('error', relayout);
        }));
        document.fonts?.ready.then(() => states.forEach(state => state.masonry?.layout()));
        window.addEventListener('popstate', fromUrl);
        fromUrl();
    }
    if (window.DREUtils) window.DREUtils.onReady(init);
    else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
    else init();
})();
