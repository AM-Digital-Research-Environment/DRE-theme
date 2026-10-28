# Cross-theme roadmap: what DRE-theme takes from IWAC-theme (2026-10)

The DRE and IWAC themes were developed in parallel by the same author and
diverged. A comparison on 2026-10-28 found DRE ahead on structure and
verification (thin templates over tested helpers, a real Omeka S release in CI,
local multi-browser tests, one `npm run verify`, self-hosted fonts, no gulp) and
IWAC ahead on delivery details. This file lists the IWAC practices DRE adopts.
Its counterpart, `docs/CROSS-THEME-ROADMAP-2026-10.md` in IWAC-theme, lists the
reverse.

Legend: `[x]` done · `[ ]` open · `[~]` dropped (rationale inline).

## D1 — Release workflow hardening

- [x] **Exclusions derived from `.gitattributes`, plus a root allowlist.**
  `release.yml` hard-coded a forbidden-path list that restated the
  `export-ignore` rules, so the two could drift, and a denylist can never catch
  a file nobody thought to exclude. IWAC parses the rules out of
  `.gitattributes` and separately allowlists the archive root, so a new root
  file fails the release until it is classified.
- [x] **The tag must be on master.** A tag pushed on a stray commit would
  otherwise ship.
- [x] **Least privilege.** Build and verify with `contents: read` and
  `persist-credentials: false`; only a final publish job, which handles no
  checkout, gets `contents: write`.

## D2 — Smaller hygiene items

- [x] **`npm audit` exceptions that retire themselves** (IWAC
  `scripts/check-audit.js`): a high/critical advisory fails unless a written
  exception explains why it is unreachable, and an exception that is no longer
  needed fails too, so the list cannot rot.
- [x] **Generated files marked `linguist-generated`** so `style.css`, the token
  fallbacks and minified scripts collapse in diffs.
- [ ] **PHPStan level 6** (IWAC's level) against the real Omeka classes.

## D3 — Theme-owned error pages

- [x] DRE fell back to Omeka core's bare `error/404` and `error/index` views.
  IWAC ships designed pages that keep the reader on the site: what happened,
  a search box, the way home. Port them in DRE's register.

## D4 — Agent and contributor instructions in the repository

- [x] `AGENTS.md` (read by Codex and, through `CLAUDE.md`, by Claude Code):
  the gotchas that so far lived only in private agent memory (helper-name
  casing, `::details-content` box-sizing, the nav fallback gating, Mirador's
  light-DOM button leak, the BOM in compressed Sass, the template-deletion
  triple edit, PHPStan not in `verify`…). IWAC's `CLAUDE.md` showed the value.

## D5 — Stylelint for CSS correctness

- [ ] DRE's custom lints guard tokens and touch targets, not generic
  correctness (duplicate properties, unknown properties or units, invalid
  selectors). Add Stylelint with correctness rules only, as IWAC does.

## D6 — Minified JavaScript

- [ ] DRE served ~93 KB of hand-written JavaScript unminified. IWAC builds
  `asset/js/dist/*.min.js` with esbuild, commits them with source maps, runs
  its unit tests against the minified files and fails CI when `dist/` is stale.
- [ ] **Masonry → MiniMasonry.** The lazy-loaded Masonry bundle is 24 KB; IWAC's
  MiniMasonry is 4 KB.
