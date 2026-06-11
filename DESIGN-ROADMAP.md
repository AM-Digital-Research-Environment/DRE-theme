# DRE Design Roadmap

A design-philosophy audit and phased workplan covering the three repos that
together render the Digital Research Environment:

| Repo | Role |
|---|---|
| **DRE-theme** | The Omeka S theme — owns the design system (tokens, type, components) |
| **DRE-Search** | Typesense faceted search (Svelte 5) — consumes the tokens |
| **DREVisualizations** | ECharts/MapLibre dashboards & knowledge graphs — consumes the tokens via a runtime bridge |

Audited 2026-06-11 against the philosophy codified in `.impeccable.md` and
`DESIGN.md` §1–9. This file is the working plan; `DESIGN.md` stays the system
reference. When an item here lands, update its status box and (if it changes
the system) fold the result into `DESIGN.md`.

---

## 0. Verdict

**The philosophy exists, is written down, and is genuinely applied.** That is
rare. "Scholarly Modernism" is not a slogan in this codebase: the single-seed
OKLCH engine, the warm-stone/forest palettes, the Spectral + Hanken Grotesk
pairing, the token contract the two modules consume, and the explicit
anti-pattern list are all real and enforced. The audit found **no gradient
text, no accent side-stripes, no glassmorphism-as-chrome, no cold-grey
neutrals, no px type, and no off-brand fallbacks** anywhere in the three repos.
DRE-Search in particular is a model token consumer (zero violations) and
DREVisualizations' `cssColor()`/`readTheme()` bridge is the correct
architecture for canvas/WebGL libraries that cannot parse `oklch()`.

What remains is the gap between *compliant* and *impeccable*:

1. **One true brand violation** — the knowledge-graph community halos are a
   hard-coded Material Design 2 palette (cold pink/indigo/lime), the only
   surface in the ecosystem that ignores both the brand and the theme toggle.
2. **Cohesion seams** — charts render in the library's default font rather
   than the site's; the theme highlights `<mark>` in grey while DRE-Search
   highlights matches in the brand accent; empty states are bare.
3. **Legacy pockets** — a handful of pre-token components (resource grid,
   metadata list, sitewide search results) still speak raw px instead of the
   spacing scale.
4. **Unclaimed scholarly ground** — no print stylesheet, OpenType features
   barely used, and the motion tokens power hovers but no considered arrival
   moment. These are the opportunities that would make the DRE feel not just
   consistent but *designed*.

---

## 1. Findings register

Severity: **P0** breaks the brand · **P1** visible cohesion seam · **P2**
internal drift, invisible to users but a maintenance tax · **P3** elevation
opportunity, not a defect.

### DRE-theme

| ID | Sev | Finding | Evidence | Status |
|---|---|---|---|---|
| T1 | P2 | Resource grid cards use raw px and pre-token geometry (`margin-bottom: 24px`, `margin: 10px 0 0 10px`, `padding: 15px`, `padding: 5px 10px`). The masonry `width: 49%` / `gutter 2%` are layout inputs read by masonry and may stay. | `components/resources/_resource-grid.scss` | ✅ done (v2.8.0) |
| T2 | P2 | Metadata `<dl>` is a float-based two-column layout with magic numbers (`width: 170px`, `margin-left: 170px`, `padding-right: 15px`, thumb sizes `60px`/`100px`). Works, but it's the core reading surface of the archive and deserves grid + tokens. | `components/metadata/_metadata.scss` | ✅ tokens done (v2.8.0); grid layout → Phase 2 |
| T3 | P2 | Sitewide search results hard-code `max-width: 1160px` (≙ `--measure-wide`) and `margin-bottom: 40px`. | `components/search-results/_search-results.scss` | ✅ done (v2.8.0) |
| T4 | P1 | `mark, ins` highlight is a grey wash (`$color__gray-87`) — a found-term highlight should carry the brand. DRE-Search already highlights matches with an accent tint (`--dre-hl-bg`: accent 30% over transparent); the theme and module currently speak two different highlight languages for the same concept. | `base/typography/_copy.scss:83` vs DRE-Search `Highlight.svelte` | ✅ done (v2.8.0) |
| T5 | P1 | Sitewide search empty state is a bare `<p>No result found</p>`. An empty state should keep the researcher moving: restate the query, suggest spelling/broader terms, offer Advanced Search and Browse-all as paths onward. | `view/omeka/site/index/search.phtml:15` | ✅ done (v2.8.0) |
| T6 | P3 | No `@media print` layer. Researchers print/save item records and search results; current output prints the sticky header, theme toggle, banner wash, footer band and back-to-top button. A scholarly print layer (chrome hidden, serif metadata, exposed item URL) is cheap and very on-audience. | no `print` rules anywhere in `asset/sass` | ✅ done (v2.8.0) |
| T7 | P3 | Motion tokens (`--transition-*`, `--ease-expo-out`) power hovers only; there is no arrival moment. One restrained, staggered entrance on the home hero (eyebrow → title → tagline → CTA) is the philosophy's "one well-orchestrated high-impact moment". Must be CSS-only and fully suppressed under `prefers-reduced-motion`. | `components/banner/_banner.scss` | ✅ done (v2.8.0) |
| T8 | P3 | OpenType is under-used: global `kern/liga/calt` plus two `tabular-nums` call-sites. Numbers in metadata values, pagination, counts and year facets should be tabular; Spectral's display tier could take `case`-sensitive punctuation. Small, quiet wins. | `base/typography/_typography.scss:13` | ◻ Phase 3 |
| T9 | P2 | The `container` mixin pads with raw `15px`/`30px` and the masonry vertical rhythm is a literal `24px`. | `abstracts/mixins/_mixins.scss:14` | ◻ Phase 2 |
| T10 | P2 | The global `button, .button, input[type=…]` element selector applies the full primary-button treatment to *every* `<button>` on the page. Both modules already pay for this: DRE-Search ships `!important` shields and the Mirador block needs an insulation layer. Wrapping the element-level default in `:where()` (specificity 0) would end the arms race while keeping the styling for theme-authored buttons. Needs a careful regression pass (any rule that previously *lost* to it will start winning). | `base/elements/_buttons.scss:1` · DESIGN.md §8 "Chrome insulation" | ◻ Phase 5 |
| T11 | P2 | Sass partials still use `@import` (deprecated, non-breaking). Mechanical migration to `@use`/`@forward` already sketched in DESIGN.md §10. | all partials | ◻ Phase 5 |

False positives worth recording (so nobody "fixes" them): the two
`border-right: 2px` hits are CSS chevron carets, not accent stripes
(`_linked-resources.scss:73`, `_navigation.scss:195`); the hard-coded warm
greys in `_timeline.scss` are deliberate — TimelineJS renders on its own
permanently-light widget surface, so theme inks would go light-on-light in
dark mode.

### DRE-Search

| ID | Sev | Finding | Evidence | Status |
|---|---|---|---|---|
| S1 | — | **Zero violations.** Every colour, radius, shadow, size and motion value is `var(--token, on-brand-fallback)`; focus rings, reduced motion and ARIA (combobox, tabs, pagination) are all in place. Treat this module as the reference implementation of the token contract. | whole repo | reference |
| S2 | P3 | Fallback literals drifted slightly from the theme's current values in places (e.g. `--ink` fallback `#33291f` vs theme's computed warm ink). Inert under the theme; tidy opportunistically when files are touched anyway. | various `<style>` blocks | ◻ opportunistic |

### DREVisualizations

| ID | Sev | Finding | Evidence | Status |
|---|---|---|---|---|
| V1 | **P0** | Knowledge-graph community halos are a hard-coded **Material Design 2** palette (`#d81b60`, `#1e88e5`, `#fb8c00`, …) — cold pink/indigo/lime that ignores the brand, the warm surfaces, and the light/dark toggle. The one place the ecosystem's colour discipline visibly breaks. | `asset/js/knowledge-graph.js:23` | ✅ done |
| V2 | P1 | Charts never set a `fontFamily`, so every axis label, legend, tooltip and title renders in the canvas default (system sans) instead of Hanken Grotesk — the only text on the page outside the type system. Resolve `--font-body` (and `--font-display` for chart titles) in `readTheme()` and apply through `buildEchartsTheme()`. | `asset/js/dashboard-core.js` (THEME, buildEchartsTheme) | ✅ done |
| V3 | — | Photo-lightbox controls use `backdrop-filter` blur. **Sanctioned exception**: frosted controls *over user imagery* are functional (legibility on unknown grounds), not decorative glassmorphism. Keep, and keep it confined to the lightbox. | `asset/css/dre-visualizations.css:1859` | sanctioned |
| V4 | — | Map labels hard-code white text + dark halo. **Sanctioned**: CartoDB basemaps are outside the theme's control; the halo is a legibility device. | `asset/js/dashboard-charts-map.js:113,177` | sanctioned |
| V5 | P3 | `THEME.fontSize: 11` is below the theme's smallest step (13px `--text-xs`). Dense chart interiors justify smaller type than UI chrome, but 11px axis text is at the floor of comfortable; consider 12 after V2 lands (Hanken renders larger than the default canvas font). | `asset/js/dashboard-core.js:73` | ◻ Phase 3 |

---

## 2. The phases

### Phase 0 — Restore the brand line *(P0 · done)*

Replace the Material halo palette with a **brand-anchored halo family** in
`dashboard-core.js`, exposed as `ns.HALO` and rebuilt in place by
`readTheme()` exactly like `ns.COLORS`, so the knowledge graph's existing
`_rvRebuild` re-colours halos on every theme flip.

Design intent: halos must stay *distinct from node fills* (a ring encodes
community; a fill encodes entity type), so the family is built as **deep
"pigment-pot" tones for light mode** (inkier than every fill — rings read as
drawn outlines) and **luminous lifted tones for dark mode**, at hue stations
offset from the six lead brand pigments. No pink-indigo Material residue.

*Acceptance:* halos legible on warm-stone and forest surfaces; toggling theme
re-colours rings without reload; no hard-coded colour left in
`knowledge-graph.js` apart from `rgba(0,0,0,…)` canvas shadows.

### Phase 1 — Cross-product cohesion *(P1 · done)*

One brand, one voice, across theme and modules:

- **V2 — chart typography.** Charts speak Hanken Grotesk (body) with
  Spectral available for title use; resolved at runtime from `--font-body` /
  `--font-display`, with the theme's own fallback stacks.
- **T4 — highlight colour.** `mark`/`ins` become the same accent-tinted wash
  DRE-Search uses (`color-mix(in oklab, var(--accent) 28%, transparent)` on
  light ink), unifying "found term" across core search, faceted browse and
  the Svelte client.
- **T5 — empty states with a path onward.** The sitewide search no-results
  view restates the query in quotes, offers concrete next moves (check
  spelling, fewer/broader terms), and links Advanced Search + Browse items.
  Styled as a quiet centred panel, not an alert.

*Acceptance:* a search for gibberish lands on a designed page, not a
one-line shrug; chart axis text matches site UI text; `<mark>` matches the
Svelte highlight tint in both modes.

### Phase 2 — Token completeness *(P2 · mostly done)*

Finish the job DESIGN.md describes: every component speaks the scales.

- **T1 ✅ / T3 ✅ / T2 ✅(first half)** — resource grid, search results and
  metadata now use `--space-*`, `--measure-wide`, `--text-*` (masonry %
  inputs intentionally retained).
- **T2 (second half) ◻** — rebuild the metadata `<dl>` on CSS grid
  (`grid-template-columns: minmax(10rem, 12rem) 1fr`), eyebrow-style `dt`
  labels (`--text-xs`, `--tracking-wide`, uppercase, `--ink-subtle`), and
  `tabular-nums` on value text. This is the item page — the single most-read
  surface in the archive; treat it as a typographic project, not a cleanup.
- **T9 ◻** — `container` mixin paddings → `--space-4`/`--space-8`
  (compiled output is identical; pure vocabulary).

*Acceptance:* `grep -E '\b\d+px' components/` returns only intentional
hairlines (1px borders), icon geometry, and documented exceptions.

### Phase 3 — The scholarly reading layer *(P3 · print done)*

What a research library does that a product dashboard doesn't:

- **T6 ✅ — print stylesheet.** Chrome (header, banner art, footer band,
  toggle, back-to-top, pagination controls) hidden; content linearised to
  the page; metadata in full; the item's canonical URL printed after the
  title via `content: attr/url`. Black-on-white with the serif voice kept.
- **T8 ◻ — OpenType pass.** `font-variant-numeric: tabular-nums` on
  pagination, counts, facet totals, metadata dates; `lining-nums` guarded in
  tables. Audit Spectral display sizes for `text-wrap: balance` coverage
  (banner already has it).
- **V5 ◻ — chart microtype.** After V2, re-evaluate `fontSize: 11 → 12` so
  Hanken at canvas DPI keeps the same optical size as the old default font.
- **◻ Reading-measure audit.** Verify every long-form surface (page blocks,
  item description, exhibit text) is capped at `--measure-narrow`; today the
  cap is applied per-component rather than guaranteed.

### Phase 4 — One memorable moment *(P3 · done, extendable)*

The philosophy's bet: one orchestrated arrival beats scattered
micro-interactions.

- **T7 ✅ — home hero choreography.** Eyebrow, title, tagline and CTA rise
  ~12px and fade in on a ~90ms stagger using `--ease-expo-out`; the wash
  itself does not move (colour blooms, type arrives). CSS-only, one-shot,
  fully disabled under `prefers-reduced-motion` and on interior mastheads.
- **◻ Candidate follow-ups** (pick at most one; restraint is the brand):
  staggered fade-up of the first row of resource cards on browse pages
  (IntersectionObserver, matching DREVisualizations' reveal-on-scroll so the
  whole DRE shares one arrival grammar); or a view-transition crossfade on
  theme toggle.

### Phase 5 — Architecture de-escalation *(P2 · open)*

Not visual, but it protects the visual system:

- **T10 ◻ — `:where()` the element defaults.** Wrap the global
  `button/.button/input[type=submit]` treatment in `:where()` so modules
  stop needing `!important` shields and Mirador-style insulation layers.
  Plan: land behind a full visual regression pass of every theme button
  surface (forms, advanced search, pagination, collecting, user bar), then
  delete DRE-Search's counter-shields in its next release.
- **T11 ◻ — `@use`/`@forward` migration.** Mechanical; per DESIGN.md §10
  (`loadPaths: ['asset/sass']`, one `@use "abstracts/abstracts" as *;` per
  leaf). Do it in one commit with a byte-diff of compiled CSS as proof.
- **◻ Token-contract lint.** A tiny CI grep (theme + both modules): fail on
  `#hex` outside `var(…, fallback)` position, `border-left/right` > 1px with
  a colour, `background-clip: text`, and `font-size:.*px`. Encodes the
  anti-patterns so they can't regress; the false-positive list above seeds
  the allowlist.

---

## 3. Guardrails — definition of done for any styling change

1. **Both modes, AA.** Check light and dark; body/surface pairs ≥ 4.5:1.
2. **Tokens only.** New colours via semantic tokens or `color-mix` on them;
   new literals only as `var()` fallbacks, and on-brand (DESIGN.md §9 r.3).
3. **Motion is optional.** Anything that moves is inside
   `prefers-reduced-motion: no-preference` or explicitly suppressed.
4. **The anti-pattern list is law.** No side-stripes, no gradient text, no
   decorative blur, no cold grey — match-and-refuse (DESIGN.md §8).
5. **Build is part of the change.** Theme: `npm run build` (stamps the CSS
   header from `theme.ini` — bump the version there). DRE-Search:
   `npm run lint && npm run check`, plus `npm run build` if `src/svelte`
   changed. DREVisualizations ships plain CSS/JS — keep its CSS header
   contract note intact.
6. **Modules never redefine a theme token** — alias into `--rv-*`-style
   namespaces on `body`, never overwrite `--primary` et al. (DESIGN.md §9).
