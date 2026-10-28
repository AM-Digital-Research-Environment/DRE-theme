# AGENTS.md

Instructions for coding agents (Codex reads this file; Claude Code reads it
through `CLAUDE.md`). Human contributors: [CONTRIBUTING.md](CONTRIBUTING.md)
and [docs/TESTING.md](docs/TESTING.md) say the same things at more length.

## What this is

The Omeka S 4.2.1 theme of AMIRA, the Africa Multiple research-data platform
(production: <https://data.africamultiple.uni-bayreuth.de/s/amira>, PHP 8.5).
PHP templates in `view/`, view helpers in `helper/`, Sass in `asset/sass/`
compiled to the committed `asset/css/style.css`, vanilla JavaScript in
`asset/js/`. It renders as one interface with two modules, DRE Search and DRE
Visualizations, which consume its design tokens by name: read
[DESIGN.md](DESIGN.md) before a visual change and
[docs/DESIGN-INTEGRATION.md](docs/DESIGN-INTEGRATION.md) before changing a
token, a shared widget or a string the modules also show.

## Commands

```bash
npm run verify        # the CI contract: lints, Sass build, i18n check, unit tests, audit, stale-CSS check
npm run test:browser  # Playwright on PHP-rendered partials, Chromium/Firefox/WebKit + axe
npm run i18n:extract  # after adding, changing or removing a translate() string
npm version minor -m "Release v%s"   # the only way to bump; see "Releasing"
```

`npm run verify` does **not** run PHPStan. CI does, on `helper/` against the
real Omeka S 4.2.1 classes, and a failure there blocks the release workflow.
Before committing a change to `helper/*.php`:

```bash
# once, outside the repository (a scratch directory)
curl -fsSL https://github.com/omeka/omeka-s/releases/download/v4.2.1/omeka-s-4.2.1.zip -o omeka.zip && unzip -q omeka.zip
curl -fsSL https://github.com/phpstan/phpstan/releases/download/2.3.3/phpstan.phar -o phpstan.phar
# from the theme root
OMEKA_PATH=/abs/path/omeka-s php /abs/path/phpstan.phar analyse --no-progress --memory-limit=1G
```

## Gotchas

- **Helper names are case-exact.** `config/theme.ini` `helpers[] = "BrowseLayout"`
  is the service name, the class name and the file name at once; call it as
  `$this->BrowseLayout()`. Laminas does not canonicalise, so `$this->browseLayout()`
  is a 500 on every page that renders it. `npm run lint:templates` checks
  call sites.
- **The layout runs on every page.** An undefined method in
  `view/layout/layout.phtml` or anything it includes is a site-wide 500.
  `$this->status()` has no `getRouteMatch()`; `helper/IsHomePage.php` detects
  the home page from the request path.
- **Scripts ship minified.** Templates load `asset/js/dist/<name>.min.js`,
  built from `asset/js/<name>.js` by `npm run build:js` (part of `build`).
  Edit the source, rebuild, commit both; a new script needs its template
  reference to point at `js/dist/`. The unit tests run on both builds and the
  local browser suite on the minified one (`tests/support/theme-script.mjs`).
- **Compiled CSS is committed.** A Sass edit without `npm run build` ships the
  old styles; CI fails a stale `asset/css/style.css`. The stylesheet header is
  prepended by `scripts/build-css.mjs`, not written in `style.scss`, and Sass's
  compressed output may emit a BOM, which the build strips: a BOM mid-file once
  killed 63 token declarations (`npm run lint:css` guards it).
- **Deleting a template takes three edits:** the template, any hard-coded
  reference to it in `scripts/check-templates.mjs` and
  `tests/TemplateContractsTest.php` (both read listed templates
  unconditionally, so a stale path is a crash, not a finding), then
  `npm run i18n:extract`. Grep the repository for the path, `.php` files
  included.
- **`.gitattributes` is the package manifest.** The release zip is
  `git archive --prefix=DRE-theme/`; whatever is `export-ignore`d is absent,
  and the release workflow fails on a new root file that is neither ignored
  nor listed in its `ROOT_ALLOWED`. A README link to an ignored file must be an
  absolute GitHub URL.
- **Tokens are a cross-repository contract.** The modules carry copies of
  `scripts/lib/token-rules.mjs` and `asset/css/dre-tokens-fallback.json`. After
  changing either: `npm run build:tokens`, then `npm run vendor:lint` with the
  module repositories checked out beside this one. Never hand-edit the
  generated fallback files.
- **`<details>` content box.** Chromium's `::details-content` defaults to
  `content-box`, which breaks `box-sizing: inherit` inside every `<details>`;
  `generic/_box-sizing.scss` resets it. Keep that reset when touching it.
- **Button anchors.** `a:link`/`:visited`/`:hover` (0,1,1) beat the button
  mixins' `:where()` colours, so `<a class="button">` and `<a class="btn--secondary">`
  are pinned in `base/elements/_buttons.scss`. Use those classes; don't restyle
  anchor buttons ad hoc.
- **No-JS navigation fallback.** The expanded menu shows only under
  `html:not(.js)` or `.nav-failed` (set at window load). Gating on
  `:not(.nav-ready)` alone flashes the menu open on every page load.
- **Item-page block scripts use delegation** on `document`, not
  `DOMContentLoaded` lookups: module blocks render after the theme's scripts run.
  The Linked resources block is AJAX-loaded from
  `view/omeka/site/index/linked-resources.phtml`; control paging there.
- **Mirador's chrome is light DOM.** Its MUI buttons inherit the global button
  styles unless insulated; the insulation is scoped under `.block-mirador`.
- **Scripts are deferred.** `helper/DeferScripts.php` defers every external
  classic script in the head and body containers, module scripts included, in
  document order, and runs the inline snippets that depend on them as module
  scripts. An inline script that calls `$` while the page is parsing runs
  before jQuery exists.

## Releasing

Fill `## [Unreleased]` in [CHANGELOG.md](CHANGELOG.md) as you work. Then, on a
clean, green `master`:

```bash
npm run verify
npm version minor -m "Release v%s"   # syncs theme.ini, CITATION.cff, CSS header, CHANGELOG
git push origin master vX.Y.Z
```

The tag runs `.github/workflows/release.yml`: CI again on the tagged commit,
the zip, its checks, Omeka's theme manager on the unpacked zip, then the
GitHub release with that version's CHANGELOG section as its notes. Never
build the archive by hand.

## Conventions

- British English in user-visible copy and documentation.
- Commit messages: an imperative or descriptive subject, a body explaining why.
- Comments explain why, at the density of the surrounding code.
