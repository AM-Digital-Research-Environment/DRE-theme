# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

AMIRA serves researchers, postgraduate students, research-data professionals,
and interested members of the public who need to discover and understand the
Africa Multiple Cluster of Excellence's collections and research metadata.
Visitors usually arrive with a question rather than an open-ended browsing
intent. They may work on institutional or mobile networks, use English or
French, encounter transliterated names, and remain on individual records for
long reading sessions.

## Product Purpose

The Africa Multiple Interactive Research Atlas (AMIRA) is the public
research-data platform of the Africa Multiple Cluster of Excellence at the
University of Bayreuth. It makes distributed collections findable through a
shared Omeka S metadata layer without requiring the underlying data to be
relocated.

Success means that a visitor can move from one search field across research
items, projects, publications, podcasts, videos, people, organisations,
locations, languages, genres, subjects, and tags; understand a record in its
scholarly context; and follow the people, projects, places, and concepts that
connect it to the wider corpus.

## Positioning

AMIRA combines collaboratively curated metadata from the Africa Multiple
Research Centres and partner institutions with a federated search experience
and record-level maps, timelines, dashboards, and knowledge graphs. The
platform keeps curation close to the institutions that know the material while
providing a connected discovery layer and a consistent public interface.

## Operating Context

- The public site is available at
  <https://data.africamultiple.uni-bayreuth.de/s/amira/> and requires no user
  account for exploration.
- The Omeka S theme owns global layout, typography, semantic tokens, navigation,
  record presentation, and shared browser utilities.
- DRE Search owns Typesense-backed federated and corpus-specific search.
- DRE Visualizations owns ECharts, MapLibre, and d3-force dashboards, maps, and
  networks rendered as Omeka S page and resource-page blocks.
- Content and page composition are managed in Omeka S. A single route may
  therefore combine core Omeka markup, theme partials, DRE Search components,
  and DRE Visualizations components.
- The repository has no local development instance containing the production
  data and page configuration. Deterministic source checks run locally and in
  CI; read-only browser tests exercise representative production routes.

## Capabilities and Constraints

- Omeka S 4.2.1 or later and PHP 8.1 or later are the supported runtime.
- The distributed theme contains compiled assets and must remain functional
  without a Node.js toolchain on the server.
- DRE Search and DRE Visualizations consume the theme's CSS custom properties as
  a public design API. Token renames require a compatibility alias, changelog
  entry, and coordinated validation across all three repositories.
- The active theme is selected per Omeka S site. Module blocks must remain
  usable when embedded in the theme and should degrade safely when an optional
  service such as Typesense is unavailable.
- The live production site is an observation and post-deployment validation
  target. Design experiments may be injected into an isolated browser page for
  screenshots or interaction checks, but must never persist, submit forms,
  write to the Omeka API, or alter production data.
- The active light or dark theme is expressed by `data-theme` on both `<html>`
  and `<body>`. Module code must follow that resolved choice rather than query
  the operating-system preference independently.
- The public browser baseline is modern evergreen browsers plus Safari and iOS
  16.2 or later, matching the theme's use of OKLCH and `color-mix()`.

## Brand Commitments

- Product name: Africa Multiple Interactive Research Atlas (AMIRA).
- Institutional context: Africa Multiple Cluster of Excellence, University of
  Bayreuth, and its Africa Multiple Research Centres and partner institutions.
- Voice: scholarly, warm, authoritative, precise, and unfussy; never corporate
  or promotional without evidence.
- Brand assets: the Africa Multiple lockup, University of Bayreuth and Cluster
  institutional marks, and the canonical Uni-Grün-led pigment family.
- The interface belongs to the same product family as the AMIRA research
  dashboard while remaining a reading-first Omeka S archive.
- Item media is scholarly content, not decorative imagery. The theme's chrome
  and mastheads remain photography-free unless that commitment is explicitly
  changed.

## Evidence on Hand

- The public AMIRA site provides real pages, records, media, search results,
  dashboards, maps, and networks for read-only integration testing.
- `tests/fixtures/research-items-template.json` captures the production Research
  Items template used by metadata-group contract tests.
- The grouped specs in `tests/browser/` and `.github/workflows/live-smoke.yml`
  provide a nightly production smoke-test baseline.
- `DESIGN.md` records the visual system; `docs/DESIGN-INTEGRATION.md` records the
  cross-repository contract; `docs/IMPECCABLE-ROADMAP.md` records the evaluation
  programme and representative routes.
- No testimonials, adoption metrics, performance claims, or accessibility
  conformance beyond the tested design-token pairings should be invented.

## Product Principles

1. **Discovery before database structure.** Lead with search, meaningful corpus
   entry points, and human-readable record groups rather than Omeka's internal
   ordering.
2. **Relationships are part of the record.** Make people, projects, places,
   subjects, and related resources understandable and navigable without
   obscuring the primary content.
3. **One interface across three repositories.** Theme, search, and visualization
   code may have different owners, but visitors should encounter one coherent
   product and one shared interaction language.
4. **Preserve provenance and multiplicity.** Support collaboratively curated,
   multilingual metadata and multiple knowledge systems without flattening them
   into a generic catalogue voice.
5. **Validate against reality safely.** Prefer deterministic contracts and
   reproducible fixtures; use the production site only for read-only observation
   and bounded post-deployment checks.

## Accessibility & Inclusion

The interface targets WCAG AA text contrast, visible keyboard focus, semantic
heading structure, keyboard-operable navigation and visualizations, reduced
motion, responsive layouts, and meaningful non-canvas alternatives where a
visualization carries information. Reviews must cover both light and dark modes,
English and French-length content, transliterated names, zoomed text, keyboard
navigation, touch input, and constrained mobile viewports.
