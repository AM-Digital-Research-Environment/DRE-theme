/**
 * PWA install — a quiet, browser-gated "Install app" affordance.
 *
 * There is NO auto-popup. The header install button ships hidden ([hidden]) and
 * is revealed only when the browser can actually install the site — i.e. when it
 * fires `beforeinstallprompt` (Chrome/Edge/Android), or when we detect iOS
 * Safari, which has no such event and installs via the Share sheet instead.
 *
 * This module also builds the site's manifest at runtime:
 *   - It reads a per-site manifest from a JSON island in <head>, rewrites its
 *     start_url / scope / id / icon URLs to ABSOLUTE, and attaches it as a
 *     same-origin `blob:` URL. A `data:` manifest has an opaque origin, so Chrome
 *     rejects its start_url/scope; a static .webmanifest can't carry per-site
 *     values and a theme can't register an Omeka route — so a runtime blob is the
 *     right tool. Relative URLs must be absolutised first: a blob: URL resolves
 *     relative references against its own opaque path, not against the site.
 *
 * Install flow:
 *   - `beforeinstallprompt` → preventDefault() (kills the browser's mini-infobar),
 *     stash the event, reveal the button. Click → prompt(). Re-arm on dismiss,
 *     hide on `appinstalled`, and stay hidden when already in standalone mode.
 *   - iOS Safari → reveal the same button; click toggles a dismissible
 *     "Share → Add to Home Screen" hint (Esc / outside-click / re-click closes).
 *
 * Vanilla, dependency-free, loaded deferred at body end. No service worker
 * (see docs/PWA.md for why the manifest alone is enough for installability).
 */
(function () {
    'use strict';

    var MANIFEST_ISLAND_ID = 'dre-pwa-manifest';
    var BUTTON_SELECTOR = '[data-pwa-install]';

    var deferredPrompt = null; // the captured beforeinstallprompt event
    var button = null;
    var hint = null;           // the iOS "Add to Home Screen" popover, when open

    // -- Display-mode: is the site already running as an installed app? --------
    function isStandalone() {
        return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
            || window.navigator.standalone === true; // iOS Safari's own flag
    }

    function absolutize(url) {
        try {
            return new URL(url, document.baseURI).href;
        } catch (e) {
            return url;
        }
    }

    // -- Runtime manifest: absolutise, then attach as a same-origin blob URL. ---
    function attachManifest() {
        var island = document.getElementById(MANIFEST_ISLAND_ID);
        if (!island) {
            return;
        }
        var manifest;
        try {
            manifest = JSON.parse(island.textContent);
        } catch (e) {
            return;
        }

        // Every URL-bearing field must be absolute BEFORE we blob-ify the JSON,
        // or the browser will resolve it against `blob:…/<uuid>` and reject it.
        ['start_url', 'scope', 'id'].forEach(function (key) {
            if (manifest[key]) {
                manifest[key] = absolutize(manifest[key]);
            }
        });
        if (Array.isArray(manifest.icons)) {
            manifest.icons.forEach(function (icon) {
                if (icon && icon.src) {
                    icon.src = absolutize(icon.src);
                }
            });
        }
        if (Array.isArray(manifest.shortcuts)) {
            manifest.shortcuts.forEach(function (shortcut) {
                if (shortcut && shortcut.url) {
                    shortcut.url = absolutize(shortcut.url);
                }
                if (Array.isArray(shortcut.icons)) {
                    shortcut.icons.forEach(function (icon) {
                        if (icon && icon.src) {
                            icon.src = absolutize(icon.src);
                        }
                    });
                }
            });
        }

        var blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });
        var href = URL.createObjectURL(blob);
        var link = document.querySelector('link[rel="manifest"]');
        if (!link) {
            link = document.createElement('link');
            link.rel = 'manifest';
            document.head.appendChild(link);
        }
        link.href = href;
    }

    // -- Button visibility -----------------------------------------------------
    function showButton() {
        if (!button || isStandalone()) {
            return;
        }
        button.hidden = false;
    }

    function hideButton() {
        if (button) {
            button.hidden = true;
        }
        closeHint();
    }

    // -- Native install (Chrome / Edge / Android) ------------------------------
    function onBeforeInstallPrompt(event) {
        event.preventDefault(); // suppress the browser's own install mini-infobar
        deferredPrompt = event;
        showButton();
    }

    function nativeInstall() {
        if (!deferredPrompt) {
            return;
        }
        var promptEvent = deferredPrompt;
        deferredPrompt = null; // a beforeinstallprompt event is single-use
        promptEvent.prompt();
        promptEvent.userChoice.then(function (choice) {
            if (choice && choice.outcome === 'accepted') {
                hideButton(); // `appinstalled` will also fire and hide it
            }
            // Dismissed: leave the button in place, re-armed. The browser re-fires
            // beforeinstallprompt on a later visit and we capture it again.
        }).catch(function () { /* userChoice can reject if the UA aborts; ignore */ });
    }

    // -- iOS detection ---------------------------------------------------------
    function isIOS() {
        var ua = window.navigator.userAgent;
        return /iP(hone|ad|od)/.test(ua)
            // iPadOS 13+ masquerades as desktop Safari; disambiguate by touch.
            || (/Macintosh/.test(ua) && 'ontouchend' in document);
    }

    function isIOSSafari() {
        var ua = window.navigator.userAgent;
        // Exclude the in-app browsers (Chrome/Firefox/Edge/Opera on iOS) — they
        // can't "Add to Home Screen", so the hint would mislead.
        return isIOS() && /Safari/.test(ua) && !/(CriOS|FxiOS|EdgiOS|OPiOS|GSA)/.test(ua);
    }

    // -- iOS "Add to Home Screen" hint popover ---------------------------------
    // The iOS share glyph (square with an upward arrow) so the copy is obvious.
    var SHARE_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" '
        + 'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" '
        + 'aria-hidden="true"><path d="M12 3v13"/><path d="m7 8 5-5 5 5"/>'
        + '<path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';

    function openHint() {
        if (!button) {
            return;
        }
        var anchor = button.closest('.main-header__utilities') || button.parentNode;
        hint = document.createElement('div');
        hint.className = 'pwa-install__hint';
        hint.setAttribute('role', 'dialog');
        hint.setAttribute('aria-label', button.getAttribute('aria-label') || 'Install app');

        var row = document.createElement('p');
        row.className = 'pwa-install__hint-text';
        // Message text comes from a template data-attribute (a translated string,
        // author-controlled). Use a share-icon prefix + a text node — never inject
        // the message as HTML.
        var iconSpan = document.createElement('span');
        iconSpan.className = 'pwa-install__hint-icon';
        iconSpan.innerHTML = SHARE_ICON; // static, trusted markup
        row.appendChild(iconSpan);
        row.appendChild(document.createTextNode(
            button.getAttribute('data-pwa-hint')
            || 'To install, tap the Share button, then “Add to Home Screen”.'
        ));

        var close = document.createElement('button');
        close.type = 'button';
        close.className = 'pwa-install__hint-close';
        close.setAttribute('aria-label', button.getAttribute('data-pwa-hint-dismiss') || 'Dismiss');
        close.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" '
            + 'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" '
            + 'aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
        close.addEventListener('click', function () {
            closeHint();
            button.focus();
        });

        hint.appendChild(close);
        hint.appendChild(row);
        anchor.appendChild(hint);
        button.setAttribute('aria-expanded', 'true');

        document.addEventListener('keydown', onHintKeydown, true);
        document.addEventListener('click', onDocumentClick, true);
    }

    function closeHint() {
        if (!hint) {
            return;
        }
        hint.remove();
        hint = null;
        if (button) {
            button.setAttribute('aria-expanded', 'false');
        }
        document.removeEventListener('keydown', onHintKeydown, true);
        document.removeEventListener('click', onDocumentClick, true);
    }

    function toggleHint() {
        if (hint) {
            closeHint();
        } else {
            openHint();
        }
    }

    function onHintKeydown(event) {
        if (event.key === 'Escape') {
            closeHint();
            if (button) {
                button.focus();
            }
        }
    }

    function onDocumentClick(event) {
        if (!hint) {
            return;
        }
        // Ignore clicks on the hint itself or the button (the button toggles it).
        if (event.target.closest('.pwa-install__hint') || event.target.closest(BUTTON_SELECTOR)) {
            return;
        }
        closeHint();
    }

    // -- Button click: native prompt when available, else the iOS hint ---------
    function onButtonClick(event) {
        event.preventDefault();
        if (deferredPrompt) {
            nativeInstall();
        } else if (isIOSSafari()) {
            toggleHint();
        }
        // Otherwise there's nothing to install right now — stay quiet.
    }

    function init() {
        button = document.querySelector(BUTTON_SELECTOR);

        // Attach the manifest even in standalone mode — harmless, and keeps the
        // installed app's metadata correct — but never show the install button.
        attachManifest();

        if (isStandalone()) {
            hideButton();
            return;
        }

        window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
        window.addEventListener('appinstalled', function () {
            deferredPrompt = null;
            hideButton();
        });

        if (button) {
            button.addEventListener('click', onButtonClick);
            // iOS Safari never fires beforeinstallprompt, so reveal the button up
            // front there; the click shows the Share-sheet hint.
            if (isIOSSafari()) {
                showButton();
            }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
