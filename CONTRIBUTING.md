# Contributing

The theme is one of three repositories that render as one interface, with
[DRE Search](https://github.com/AM-Digital-Research-Environment/DRESearch) and
[DRE Visualizations](https://github.com/AM-Digital-Research-Environment/DRE-Visualizations).
Read [`DESIGN.md`](DESIGN.md) for the visual system and
[`docs/DESIGN-INTEGRATION.md`](docs/DESIGN-INTEGRATION.md) before changing a
token, a shared widget or a string the modules also show.

## Before you commit

```bash
npm ci
npx playwright install chromium firefox webkit   # once
npm run verify         # what CI's build job runs
npm run test:browser
```

[`docs/TESTING.md`](docs/TESTING.md) describes every layer, the PHP checks and
the production smoke suite.

## Changing a token or a shared lint rule

The modules carry copies of `scripts/lib/token-rules.mjs` and the generated
`asset/css/dre-tokens-fallback.json`. After changing either, with the three
repositories checked out side by side:

```bash
npm run build:tokens   # when a token changed
npm run vendor:lint    # copies both, plus a hash manifest, into ../DREVisualizations and ../DRE-Search
```

Commit the copies in each module. The `Contract drift` workflow reports a
module whose copy has fallen behind; each module's own `lint:tokens` refuses a
copy edited in place.

## Releasing

Add entries under `[Unreleased]` in `CHANGELOG.md` as you work. `npm version
<major|minor|patch>` then promotes them to the new heading and writes the
version into `theme.ini`, `CITATION.cff` and the compiled CSS
(`scripts/sync-version.mjs`); `npm run lint:ini` asserts the result.
