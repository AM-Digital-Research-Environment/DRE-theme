/** Native annotation disclosures: edge positioning and Escape focus return. */
(function () {
    'use strict';
    function position(details) {
        const panel = details.querySelector('.annotation-tooltip');
        const content = details.querySelector('.annotation-tooltip__wrapper');
        if (!panel || !content || !details.open) return;
        panel.style.left = '0px';
        panel.style.bottom = '100%';
        const box = content.getBoundingClientRect();
        const margin = 16;
        if (box.right > window.innerWidth - margin) panel.style.left = (window.innerWidth - margin - box.right) + 'px';
        else if (box.left < margin) panel.style.left = (margin - box.left) + 'px';
        if (box.top < margin) panel.style.bottom = (-content.offsetHeight - margin) + 'px';
    }
    document.addEventListener('toggle', event => {
        if (event.target.matches?.('details.annotation-btn')) position(event.target);
    }, true);
    document.addEventListener('keydown', event => {
        const details = event.target.closest?.('details.annotation-btn[open]');
        if (event.key === 'Escape' && details) {
            event.preventDefault(); event.stopPropagation();
            details.open = false;
            details.querySelector('summary').focus();
        }
    });
    window.addEventListener('resize', () => document.querySelectorAll('details.annotation-btn[open]').forEach(position));
})();
