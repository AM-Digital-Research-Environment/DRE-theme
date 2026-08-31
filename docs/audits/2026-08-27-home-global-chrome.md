# AMIRA Home and Global Chrome Technical Audit

Date: 2026-08-27  
Live target: <https://data.africamultiple.uni-bayreuth.de/s/amira/page/home>  
Related critique: `.impeccable/critique/2026-08-27T14-14-01Z__a-africamultiple-uni-bayreuth-de-s-amira-page-home.md`

## Evidence boundary

This is the first Phase 2 technical baseline. It combines a source audit of the
current DRE-theme checkout with anonymous, read-only browser evidence from the
deployed site. Production served Omeka S 4.2.1, DRE-theme 2.29.0, DRESearch
1.20.0, DRE Visualizations 2.28.0, and Mirador 3.4.17. Current repository
locations identify ownership but are not assumed to be byte-for-byte mappings
to the older deployed theme.

The Impeccable detector scanned the sanitized component catalogue exactly once
and returned no findings. It used the degraded regex fallback because its HTML
and CSS parser dependencies were unavailable, so it could not evaluate applied
selectors, custom properties, or computed contrast. The available browser
evaluation surface was read-only: mutable overlay injection and pixel-level
screenshots were unavailable. No contrast pass/fail claim is made from this
run.

The additional routes supplied during the audit were also inspected:

- DRESearch: `/s/amira/dre-search` mounted `.dre-search`, a labelled filters
  aside, and hydrated result cards with DRESearch 1.20.0.
- Mirador record: `/s/amira/item/32328` mounted a live Mirador workspace and
  digitized canvas with Mirador 3.4.17, plus DRE Visualizations 2.28.0.
- Research gateway: `/s/amira/page/research` exposed stable links to research
  sections, projects, and items.

## Post-deployment validation — 2026-08-31

Production served DRE-theme 2.30.1, DRESearch 1.20.1, DRE Visualizations
2.28.1, and Mirador 3.4.17. The published DRE-theme ZIP hash was
`73c3329fed1c32074847475e9eb67eb68afb3b721789ffe8b415f5ed460b32a1` and its
Mirador template contains the expected named application boundary.

| Contract | Result | Evidence |
| --- | --- | --- |
| Functional read-only smoke | Partial: 16/17 | Search, Mirador canvas, research links, and visualization routes pass; the Mirador boundary alone is absent. |
| Mirador semantic boundary | Fail | Production serves 2.30.1 assets but emits the pre-2.30.1 wrapper. The deployment image disables OPcache timestamp validation, so an in-place template update requires a PHP-container restart. |
| Visualization semantics | Pass | Headings contain no toolbar buttons; named toolbars and the persistent polite atomic status are present; `aria-busy` reaches `false`. |
| Theme mobile chrome | Pass | Four 44px controls remain on one row without horizontal overflow at 320 and 390px. |
| MapLibre touch controls | Pass | Navigation and popup close controls measure at least 44px; popup content clears the enlarged close control. |
| DRESearch touch controls | Partial | All measured controls pass except list/gallery toggles, whose width is 36.19px despite a 44px height. |

All browser checks were anonymous and mutation-blocked. The touch acceptance
pass used only deployed assets; no local CSS was injected.

Server acceptance action: verify
`themes/DRE-theme/view/common/resource-page-block-layout/mirador.phtml` against
the release ZIP, run `docker compose restart php`, and rerun the live workflow.

## Audit Health Score

| # | Dimension | Score | Key finding |
|---|---|---:|---|
| 1 | Accessibility | 2/4 | Small controls, nested Mirador landmarks, mixed visualization headings, and an unannounced loading transition. |
| 2 | Performance | 2/4 | The homepage initializes a broad visualization stack for nine views without a recorded route budget. |
| 3 | Responsive Design | 2/4 | No horizontal overflow was found, but the 7,786px mobile path and sub-44px controls need adaptation. |
| 4 | Theming | 3/4 | A strong semantic token system and synchronized mode signal; bounded fixed-colour widget exceptions remain. |
| 5 | Implementation Integrity | 3/4 | The product system is coherent, but module-owned semantics and control sizing drift at integration boundaries. |
| **Total** |  | **12/20** | **Acceptable — significant cross-repository hardening remains.** |

## Implementation Integrity Verdict

**Pass, with integration debt.** The theme expresses a coherent,
product-specific system through semantic OKLCH tokens, self-hosted typography,
shared rhythm, deliberate light/dark surfaces, and a strong scholarly masthead.
The deterministic fixture scan found no regex-detectable shortcut patterns.
However, the live composition exposes repeated boundary defects: DRE
Visualizations toolbars alter heading names, Mirador nests its own `main` and
`h1` inside the page's `main`, and interactive sizing does not consistently use
the theme's explicit 44px control token.

## Executive Summary

- Audit Health Score: **12/20 (Acceptable)**
- Issues: **0 P0, 1 P1, 5 P2, 0 P3**
- Preserve the current identity and token architecture.
- Fix semantic integration contracts before broad visual refinement.
- Add route-specific production assertions for DRESearch, Mirador, and the
  research gateway.
- Measure the homepage module payload before deciding whether to split or defer
  visualization code.

## Detailed Findings

### [P1] Mirador creates a nested main landmark and a second H1

- **Location:** live `/s/amira/item/32328`; theme integration wrapper
  `view/common/resource-page-block-layout/mirador.phtml`; generated Mirador
  workspace `.mirador-viewer[aria-label="Workspace"]`.
- **Category:** Accessibility / Implementation Integrity.
- **Evidence:** the page-level `main#content` contains the record H1 and a
  Mirador `main` containing an additional H1 named “Mirador viewer.”
- **Impact:** screen-reader landmark and heading navigation presents two nested
  document centres and two primary headings, obscuring the record hierarchy.
- **Standard:** HTML `main` conformance and WCAG 1.3.1 structural relationships.
- **Recommendation:** establish a Mirador embedding contract that renders the
  embedded workspace inside a named application boundary so Mirador's own main
  landmark and H1 belong to a nested semantic scope rather than the Omeka record
  document. Mirador hard-codes its workspace as `main` and tests that contract
  upstream, so the theme must not rewrite React-owned DOM after mount.
- **Suggested command:** `/impeccable harden`.

### [P2] Mobile theme and visualization controls miss the 44px project target

- **Location:** `asset/sass/components/navigation/_navigation.scss:43`,
  `asset/sass/components/header/_header.scss:205`, and live DRE Visualizations
  and MapLibre controls.
- **Category:** Accessibility / Responsive Design.
- **Evidence:** the theme hamburger is 35×28px, search/theme controls are
  40×40px, visualization tools are generally 32×32px, and MapLibre controls are
  29×29px. The system already defines `--size-control-lg: 2.75rem` as its 44px
  target in `asset/sass/abstracts/variables/_tokens.scss:85`.
- **Impact:** adjacent icon controls are harder to operate one-handed or with
  limited motor precision.
- **Standard:** the project accessibility floor; WCAG 2.2 target-size intent.
- **Recommendation:** expand hit boxes to the shared large-control token while
  preserving glyph size and compact visual weight. Apply the same contract in
  DRESearch and DRE Visualizations.
- **Suggested command:** `/impeccable adapt`.
- **Implementation status (2026-08-28):** implemented in DRE-theme `d2e7e7b`,
  DRESearch `1e2269d`, and DRE Visualizations `aec09b45`. The theme's injected
  320px and 390px checks pass without horizontal overflow. Injecting the local
  visualization CSS into the deployed spatial-exploration route also confirms
  the 44px MapLibre cascade under a coarse pointer. This is integration evidence,
  not deployed-release acceptance; keep the finding open until compatible
  releases are deployed and measured on the canonical routes.
- **Deployment status (2026-08-31):** the theme header and MapLibre acceptance
  checks pass against the released assets. DRESearch list/gallery view toggles
  remain 36.19px wide; their source needs `min-width: var(--size-control-lg,
  2.75rem)` in addition to the shipped minimum height.

### [P2] Visualization toolbar actions are part of heading names

- **Location:** live homepage DRE Visualizations headings and
  `.rv-toolbar-btn` / `.rv-embed-btn` controls.
- **Category:** Accessibility / Implementation Integrity.
- **Evidence:** all nine visualization H3 elements contain toolbar buttons; the
  accessibility tree announces names such as “Research sections Copy embed
  code.”
- **Impact:** heading navigation becomes verbose and unstable when toolbar
  actions change.
- **Standard:** WCAG 1.3.1 and 2.4.6.
- **Recommendation:** keep title text alone inside the heading and move actions
  to a labelled sibling toolbar.
- **Suggested command:** `/impeccable harden`.

### [P2] Dashboard loading and completion are not announced

- **Location:** live homepage collection-overview block, owned by DRE
  Visualizations and the Omeka page composition.
- **Category:** Accessibility.
- **Evidence:** “Loading the collection overview…” initially appears as generic
  text; no `role="status"` or `aria-live` node was present before nine
  visualizations replaced it.
- **Impact:** assistive-technology users cannot tell whether the large dashboard
  is waiting, failed, or ready.
- **Standard:** WCAG 4.1.3 Status Messages.
- **Recommendation:** retain a stable labelled region, expose a polite status,
  and announce completion without moving focus.
- **Suggested command:** `/impeccable harden`.

### [P2] Reduced-motion handling removes all transition feedback globally

- **Location:** `asset/sass/base/_theme.scss:51`.
- **Category:** Accessibility / Implementation Integrity.
- **Evidence:** the reduced-motion rule applies `0.01ms !important` animation
  and transition durations to every element and pseudo-element.
- **Impact:** vestibular motion is suppressed, but useful non-spatial state
  feedback is also erased and module components cannot provide intentional
  reduced-motion alternatives.
- **Standard:** WCAG 2.3.3 intent and the Impeccable motion audit criterion.
- **Recommendation:** replace the global kill switch with component-level
  reduced-motion treatments that remove translation, parallax, and looping
  motion while retaining immediate opacity, colour, and disclosure feedback.
- **Suggested command:** `/impeccable animate`.

### [P2] The homepage has no explicit visualization performance budget

- **Location:** live homepage and DRE Visualizations integration.
- **Category:** Performance.
- **Evidence:** the page exposes nine visualization sections and loads eleven
  DRE Visualizations scripts, including chart, graph, word-cloud, and map
  libraries. The current harness verifies eventual canvas rendering but records
  no transfer, interaction, or layout-stability budget.
- **Impact:** regressions can reach production unnoticed, especially on mobile
  or institutional networks, even though the present lazy-load smoke remains
  functional.
- **Recommendation:** record script transfer, LCP/INP proxies, long tasks, and
  layout movement for the homepage; then split or defer only the code proven to
  miss the budget.
- **Suggested command:** `/impeccable optimize`.

## Patterns and Systemic Issues

- The shared token contract is stronger than the shared semantic-component
  contract. Module markup can visually match while still drifting in headings,
  landmarks, statuses, and hit areas.
- The theme distinguishes 40px medium controls from a 44px accessibility target,
  but high-frequency chrome still uses the smaller token.
- Production checks prove that pages mount, but do not yet verify the defining
  component on each integration route.
- Dynamic module payload and state transitions lack explicit budgets and
  machine-readable accessibility expectations.

## Positive Findings

- No document-level horizontal overflow was detected at the inspected wide and
  mobile viewports.
- No browser console errors were observed on the audited homepage.
- All visible buttons inspected on mobile had a programmatic label.
- Chart fallbacks expose descriptive image alternatives with chart type and
  data excerpts.
- The theme has a visible global focus ring, skip link, page landmarks,
  synchronized `data-theme` signal, self-hosted fonts, and executable token
  contrast checks.
- The timeline's fixed warm-grey colours are a documented exception for a
  permanently light third-party surface, not accidental dark-mode drift.

## Recommended Actions

1. **[P1] `/impeccable harden`:** define and test the semantic embedding
   contract for Mirador, visualization headings, and async status regions.
2. **[P2] `/impeccable adapt`:** enforce the shared 44px hit-area contract in
   theme and module controls at mobile widths.
3. **[P2] `/impeccable animate`:** replace the global reduced-motion kill switch
   with intentional component alternatives.
4. **[P2] `/impeccable optimize`:** establish a homepage visualization budget
   before changing bundling or lazy-loading strategy.
5. **[P2] `/impeccable polish`:** repeat desktop/mobile, light/dark, keyboard,
   and reduced-motion checks after the selected fixes land.

## Tracking

- [DRE-theme #3 — shared 44px mobile control target](https://github.com/AM-Digital-Research-Environment/DRE-theme/issues/3)
- [DRE-theme #4 — Mirador heading and landmark hierarchy](https://github.com/AM-Digital-Research-Environment/DRE-theme/issues/4)
- [DRE-theme #5 — intentional reduced-motion alternatives](https://github.com/AM-Digital-Research-Environment/DRE-theme/issues/5)
- [DRE Visualizations #12 — visualization headings, toolbars, and async status](https://github.com/AM-Digital-Research-Environment/DRE-Visualizations/issues/12)
- [DRE Visualizations #13 — post-deployment MapLibre touch validation](https://github.com/AM-Digital-Research-Environment/DRE-Visualizations/issues/13)
- [DRESearch #21 — shared search surface and state audit](https://github.com/AM-Digital-Research-Environment/DRESearch/issues/21)

The next audit should use the canonical DRESearch, Mirador, and research-gateway
routes recorded in the surface manifest and should repeat production evidence
only against explicitly recorded deployed versions.
