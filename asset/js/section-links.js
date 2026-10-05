(function () {
    'use strict';
    if (!navigator.clipboard?.writeText) return;
    document.querySelectorAll('[data-section-copy]').forEach(button => {
        button.hidden = false;
        button.addEventListener('click', async () => {
            const url = new URL(location.href);
            url.hash = button.dataset.sectionCopy;
            const label = button.textContent;
            try {
                await navigator.clipboard.writeText(url.href);
                button.textContent = button.dataset.copied;
            } catch (_) {
                button.textContent = button.dataset.failed;
            }
            button.setAttribute('aria-live', 'polite');
            setTimeout(() => { button.textContent = label; button.removeAttribute('aria-live'); }, 3000);
        });
    });
})();
