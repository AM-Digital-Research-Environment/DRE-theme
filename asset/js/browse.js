/**
 * Browse layout — masonry grid and the grid/list toggle.
 *
 * The card markup this drives is emitted by common/resource-card.phtml, so the
 * class names below must stay in step with that partial. (They previously did
 * not: this file queried `.resource-meta` and `.resource-image`, neither of
 * which any template has ever rendered — the real names are `.resource__meta`
 * and `.resource__thumbnail` — so two branches of the toggle silently did
 * nothing.)
 */
(function () {
    'use strict';

    const browseScripts = () => {
        const resources = document.querySelectorAll('.resources');

        // Where the browser lays out masonry natively (grid-template-rows: masonry,
        // matched by the @supports block in _resource-grid.scss), skip the JS engine
        // entirely — the grid reveals and positions the cards itself, so we never
        // load-fight masonry.pkgd over CSS. Falls back to the JS masonry below.
        const nativeMasonry = typeof CSS !== 'undefined'
            && typeof CSS.supports === 'function'
            && CSS.supports('grid-template-rows', 'masonry');

        resources.forEach((resourcesSet) => {
            const resourceItems = resourcesSet.querySelectorAll('.resource');
            const toggleContainer = resourcesSet.parentElement;
            const layoutToggles = toggleContainer
                ? toggleContainer.querySelectorAll('.layout-toggle button')
                : [];

            const initMasonryGrid = () => {
                if (nativeMasonry) {
                    return; // CSS handles grid layout + reveal; see _resource-grid.scss
                }
                if (!resourcesSet.classList.contains('resource-grid')) {
                    return;
                }
                // masonry.pkgd is loaded alongside this file by the browse
                // templates; guard anyway so a load failure degrades to a plain
                // grid instead of throwing.
                if (typeof Masonry !== 'function') {
                    resourcesSet.style.opacity = 1;
                    return;
                }

                const createMasonryInstance = () => {
                    new Masonry(resourcesSet, {
                        itemSelector: '.resource',
                        columnWidth: '.grid-sizer',
                        gutter: '.gutter-sizer',
                        percentPosition: true,
                    });
                    resourcesSet.style.opacity = 1;
                };

                if (document.readyState === 'complete') {
                    createMasonryInstance();
                } else {
                    window.addEventListener('load', createMasonryInstance, { once: true });
                }
            };

            initMasonryGrid();

            layoutToggles.forEach((layoutToggle) => {
                layoutToggle.addEventListener('click', (e) => {
                    const button = e.currentTarget;
                    // Read the target view from the button's own identity. This
                    // used to pass `button.classList` (a DOMTokenList) straight
                    // into searchParams.set(), which stringifies to the WHOLE
                    // class list — it only produced "grid"/"list" because these
                    // buttons happened to carry exactly one class.
                    const view = button.classList.contains('list') ? 'list' : 'grid';

                    const currentlyDisabled = toggleContainer
                        && toggleContainer.querySelector('.layout-toggle button:disabled');
                    if (currentlyDisabled) {
                        currentlyDisabled.removeAttribute('disabled');
                    }

                    const url = new URL(window.location.href);
                    url.searchParams.set('view', view);
                    window.history.pushState({}, '', url);

                    document
                        .querySelectorAll('.pager-wrapper a.previous, .pager-wrapper a.next')
                        .forEach((navLink) => {
                            const navLinkUrl = new URL(navLink.href);
                            navLinkUrl.searchParams.set('view', view);
                            navLink.href = navLinkUrl.toString();
                        });

                    button.setAttribute('disabled', 'disabled');
                    resourcesSet.classList.toggle('resource-list');
                    resourcesSet.classList.toggle('resource-grid');

                    resourceItems.forEach((resource) => {
                        resource.classList.toggle('media-object');

                        const thumbnail = resource.querySelector('.resource__thumbnail');
                        if (thumbnail && thumbnail.classList.contains('decoration')) {
                            thumbnail.classList.toggle('decoration--thumbnail');
                        }

                        // Mirrors the server-side `$isGrid ? '' : 'media-object-section'`
                        // in common/resource-card.phtml.
                        const resourceMeta = resource.querySelector('.resource__meta');
                        if (resourceMeta) {
                            resourceMeta.classList.toggle('media-object-section');
                        }
                    });

                    initMasonryGrid();
                });
            });
        });
    };

    if (window.DREUtils && typeof window.DREUtils.onReady === 'function') {
        window.DREUtils.onReady(browseScripts);
    } else if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', browseScripts, { once: true });
    } else {
        browseScripts();
    }
})();
