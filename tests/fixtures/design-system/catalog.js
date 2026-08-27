(() => {
    const body = document.body;
    const root = document.documentElement;
    const select = document.querySelector('[data-fixture-theme]');
    const toggle = document.querySelector('[data-theme-toggle]');

    function applyTheme(theme) {
        body.setAttribute('data-theme', theme);
        root.setAttribute('data-theme', theme);
        select.value = theme;
        toggle.setAttribute('aria-pressed', String(theme === 'dark'));
    }

    select.addEventListener('change', () => applyTheme(select.value));
    toggle.addEventListener('click', () => {
        applyTheme(body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });

    for (const form of document.querySelectorAll('form')) {
        form.addEventListener('submit', (event) => event.preventDefault());
    }
})();
