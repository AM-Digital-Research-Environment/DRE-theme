# Static design-system fixture

`index.html` is an editable, sanitized catalogue of representative DRE-theme
markup. It is intentionally a fixture rather than a second application: the
theme stylesheet remains the source of truth, and `catalog.css` only arranges
the examples and supplies neutral placeholders for server/module content.

The catalogue currently covers global chrome, the home masthead, controls,
resource cards, pagination, grouped record metadata, the citation apparatus,
disclosure, and loading/empty/error shells for search and visualizations.

## Open the fixture

From the repository root, start any static file server. With Python on Windows:

```powershell
C:/Users/frede/AppData/Local/Programs/Python/Python312/python.exe -m http.server 4173
```

Then open:

```text
http://localhost:4173/tests/fixtures/design-system/
```

This URL is a source-mapped target for an Impeccable `live` session. Use it for
editable comps; use the separate Playwright experiment only after selecting a
direction that must be checked against real production markup.

## Provenance and refresh policy

- Theme markup: `view/common/header.phtml`, `view/common/banner.phtml`,
  `view/common/resource-card.phtml`, `view/common/record-apparatus.phtml`, and
  `view/omeka/site/item/show.phtml`.
- Search and visualization states: neutral shells representing the integration
  contract in `docs/DESIGN-INTEGRATION.md`; module DOM must be checked in its
  owning repository before a proposal ships.
- Sanitized sample content: invented for this fixture; no production record or
  personal data is copied.
- Last structural review: 2026-08-27.

Refresh the smallest affected example when an owning template changes. Preserve
class names that JavaScript or CSS treats as a contract, and record a new review
date here. Do not paste a production page dump into this directory.
