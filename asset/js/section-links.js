(function () {
    'use strict';
    if (!navigator.clipboard?.writeText) return;
    document.querySelectorAll('[data-section-copy]').forEach(button => {
        button.hidden = false;
        button.addEventListener('click', async () => {
            const url = new URL(location.href);
            url.hash = button.dataset.sectionCopy;
            let message = button.dataset.copied;
            try {
                await navigator.clipboard.writeText(url.href);
            } catch (_) {
                message = button.dataset.failed;
            }
            window.DREUtils.flashLabel(button, message, 3000);
        });
    });
})();
