---
name: Africa Multiple — DRE Theme
description: A warm, reading-first Scholarly Modernism design system for the AMIRA research-data platform.
colors:
  uni-green: "#009260"
  warm-brown: "#d57912"
  brand-yellow: "#f59c08"
  deep-blue: "#00268a"
  light-blue: "#44b8f2"
  archive-gold: "#cca352"
  cream-background: "oklch(97.4% 0.007 90)"
  paper-surface: "oklch(99.2% 0.004 95)"
  sunken-stone: "oklch(95.6% 0.008 88)"
  warm-ink: "oklch(33% 0.017 62)"
  strong-warm-ink: "oklch(24% 0.020 66)"
  forest-background: "oklch(16% 0.013 165)"
  forest-surface: "oklch(19% 0.013 165)"
  forest-raised: "oklch(22% 0.014 165)"
  light-ink: "oklch(91% 0.008 92)"
  primary-contrast: "oklch(99% 0.004 95)"
typography:
  display:
    fontFamily: "Spectral, Georgia, Times New Roman, serif"
    fontSize: "clamp(2.75rem, 2rem + 3.1vw, 4.25rem)"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Spectral, Georgia, Times New Roman, serif"
    fontSize: "clamp(2.25rem, 1.85rem + 1.7vw, 2.875rem)"
    fontWeight: 700
    lineHeight: 1.1
  title:
    fontFamily: "Spectral, Georgia, Times New Roman, serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.25
  body:
    fontFamily: "Hanken Grotesk, system-ui, Segoe UI, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Hanken Grotesk, system-ui, Segoe UI, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "0.04em"
rounded:
  sm: "0.375rem"
  md: "0.5rem"
  lg: "0.75rem"
  xl: "1rem"
  full: "9999px"
spacing:
  1: "0.25rem"
  2: "0.5rem"
  3: "0.75rem"
  4: "1rem"
  5: "1.25rem"
  6: "1.5rem"
  8: "2rem"
  10: "2.5rem"
  12: "3rem"
  16: "4rem"
  20: "5rem"
  24: "6rem"
components:
  button-primary:
    backgroundColor: "{colors.uni-green}"
    textColor: "{colors.primary-contrast}"
    rounded: "{rounded.md}"
    padding: "0.75rem 1.25rem"
    height: "2.75rem"
    typography: "{typography.label}"
  input:
    backgroundColor: "{colors.paper-surface}"
    textColor: "{colors.warm-ink}"
    rounded: "{rounded.md}"
    padding: "0.75rem 1rem"
    height: "2.75rem"
    typography: "{typography.body}"
  chip:
    backgroundColor: "{colors.sunken-stone}"
    textColor: "{colors.warm-ink}"
    rounded: "{rounded.full}"
    padding: "0.25rem 0.75rem"
    typography: "{typography.label}"
  resource-card:
    backgroundColor: "{colors.paper-surface}"
    textColor: "{colors.warm-ink}"
    rounded: "{rounded.lg}"
    padding: "1.5rem"
    typography: "{typography.body}"
---

# Design System: Africa Multiple — DRE Theme

## Overview

**Creative North Star: "Scholarly Modernism"**

The DRE interface should feel like a well-kept research library made legible by
contemporary information design. It is warm, calm, exact, and recognisably part
of the Africa Multiple family. Type, rule, ground, and meaningful data carry the
page; decorative effects remain subordinate to discovery and reading.

The system serves four kinds of surface. Landing and index pages help visitors
enter the corpus; search and filtering surfaces support focused operation;
records support sustained reading; maps, charts, and networks let the metadata
be experienced directly. Expression may change with the surface, but the token
contract, typographic voice, accessibility floor, and restraint remain stable.

The interface is photography-free by default. Item images, scans, audio,
video, and IIIF canvases are evidence and content rather than ornamental
backdrops. Light mode uses warm stone and paper; dark mode uses a green-tinted
forest rather than generic charcoal. Both modes are first-class and follow the
visitor's explicit selection when it differs from the operating system.

**Key Characteristics:**

- Spectral display typography paired with Hanken Grotesk for body and UI.
- One Uni-Grün seed from which interactive primary states are derived.
- Warm-stone light surfaces and forest-dark surfaces with measured contrast.
- A 4-point spacing grid, restrained radii, hairline borders, and quiet depth.
- Reading-first records, operational search, and data-rich visualizations that
  still read as one product.
- Gold used as a rare structural accent, not as ambient decoration.

**The Content-before-Apparatus Rule.** A record leads with title, authorship,
abstract, and meaningful groups. Citation controls, identifiers, and technical
apparatus support the reading rather than precede it.

**The One-product Rule.** DRE Search and DRE Visualizations may render from
separate repositories, but they consume the theme's tokens and interaction
language. A visitor must not be able to see the repository boundary.

## Colors

The palette joins exact Africa Multiple pigments to perceptually uniform OKLCH
surfaces. The frontmatter contains the portable primitives; the runtime source
of truth is `asset/sass/abstracts/variables/_colors.scss`, where semantic tokens
resolve per mode and from an administrator-overridable `--primary-base`.

### Primary

- **Uni-Grün** (`uni-green`) is the brand seed and the default interactive
  accent. Buttons, links, focus, selection, and primary-muted surfaces derive
  from it with `color-mix(in oklab, ...)`.
- `--primary`, `--primary-hover`, `--primary-active`, `--primary-text`, and
  `--primary-contrast` are the component-facing roles. Components consume these
  roles, not the raw pigment.

### Secondary

- **Warm Brown** (`warm-brown`) supplies earth warmth and secondary emphasis.
  Its semantic roles are `--accent`, `--accent-hover`, `--accent-muted`, and
  `--accent-text`.
- **Archive Gold** (`archive-gold`) is reserved for authored structural moments:
  the masthead flag, catalogue numerals, and selected data accents.

### Tertiary

- **Brand Yellow**, **Deep Blue**, and **Light Blue** complete the institutional
  pigment family and support categorical data. They do not become arbitrary UI
  decoration.
- Entity-type colors are stable shared meanings. A person, project,
  organisation, subject, location, genre, or language retains its hue across
  search chips, chart legends, and graph nodes.

### Neutral

- **Cream Background** is the light page ground; **Paper Surface** is the
  card, header, menu, and popover plane; **Sunken Stone** is used for wells,
  code, muted chips, and inset controls.
- **Warm Ink** and **Strong Warm Ink** carry body and display text. Cold neutral
  greys are outside the system.
- **Forest Background**, **Forest Surface**, and **Forest Raised** form the dark
  material stack; **Light Ink** carries the corresponding text.
- `--muted` and `--ink-subtle` are reserved for non-essential text at 15px or
  larger. Their worst-case surface contrast is checked by `npm run lint:tokens`.

### Mode and state rules

- The active mode is `[data-theme="light|dark"]` on `<html>` and `<body>`.
  A module must never infer it independently from `prefers-color-scheme`.
- `--highlight-bg` is the one found-term wash shared by core markup and DRE
  Search. `--dre-hl-bg` is a temporary compatibility alias.
- Status colors use their semantic roles (`--success`, `--warning`, `--error`,
  `--info`) and paired backgrounds rather than ad hoc hues.
- Fixed light plaques are permitted only for institutional marks whose artwork
  requires one; use `--plaque-bg`.

**The One-seed Rule.** Never hard-code a primary shade in a component. Change
the seed once and allow the semantic roles to re-resolve.

**The Rare-gold Rule.** Gold earns attention by scarcity. Do not repeat it on
every divider, heading, or card.

**The Measured-contrast Rule.** Contrast claims belong in executable checks.
When a pairing changes, update the test rather than asserting compliance in
prose alone.

## Typography

- **Display Font:** Spectral (with Georgia and Times New Roman fallbacks)
- **Body Font:** Hanken Grotesk (with system UI fallbacks)
- **Mono Font:** the system monospace stack

**Character:** Spectral supplies a warm, scholarly voice with real weight in
display and long-form moments. Hanken Grotesk remains compact, legible, and
neutral enough for facets, metadata, navigation, and dense visualization
controls. Both families are self-hosted with Latin and Latin Extended subsets.

### Hierarchy

- **Display** (800, `--text-4xl`, `--leading-tight`): one page or masthead idea.
- **Headline** (700, `--text-3xl`, `--leading-tight`): record titles and major
  section headings.
- **Title** (600, `--text-2xl`, `--leading-snug`): section and dashboard titles.
- **Body** (400, `--text-base`, `--leading-normal`): general copy and metadata.
- **Reading body** (400, `--text-lg`, `--leading-relaxed`): abstracts and
  exhibit prose where the available line length supports it.
- **Label** (600, `--text-xs`, wide tracking when uppercase): eyebrows, facets,
  chips, metadata labels, and compact controls.
- **Micro** (`--text-2xs`): dense legends and captions only. It is not a
  substitute for fitting too much UI into too little space.

Display sizes may be fluid; operational sizes remain fixed so controls and
labels do not drift between breakpoints. Long prose normally targets
`--measure-narrow`; records and forms may use `--measure-base`; broad search
results may use `--measure-wide`. Page-builder HTML blocks are not globally
measure-capped: previous attempts created an unusable blank half-page and were
reverted.

Tabular numerals belong on corpus counts, dates in aligned lists, pagination,
metadata values, and visualization summaries. `text-wrap: balance` is suitable
for short display headings, not for body paragraphs.

**The Two-voice Rule.** Spectral speaks when content asks to be read; Hanken
Grotesk speaks when the interface asks to be operated.

**The No-shadow-scale Rule.** Every size and line height comes from the shared
type and rhythm tokens. Do not create a parallel Sass or module-local scale.

## Layout

The page uses a centered container (`--container-max: 81.25rem`) with a
responsive gutter (`--space-4`, rising to `--space-8`). The spacing scale is a
4-point rhythm from `--space-1` through `--space-24`; semantic aliases such as
`--space-md` point to those numeric steps and never introduce new values.

The authoritative viewport ladder is 600, 768, 1024, 1200, and 1460px. Theme
chrome may use these breakpoints. Module-internal layouts should prefer
container queries when the component's own width, rather than the viewport,
determines its composition.

### Surface modes

- **Persuade:** the home masthead introduces AMIRA and offers a route into the
  corpus without turning the archive into a marketing page.
- **Operate:** search, filters, compare tools, maps, and dashboard controls
  prioritize scanability, state, and reliable target sizes.
- **Read:** records, publications, and prose privilege hierarchy, measure, and
  continuity.
- **Experience:** maps, networks, IIIF, and image-led collections let the
  artifact or data view lead while keeping controls discoverable.

### Responsive behavior

- The header remains one row. JavaScript measures whether the full navigation
  fits and switches to the drawer before labels wrap.
- Record pages use a main reading column and apparatus rail when space allows,
  then stack without reordering the document meaning.
- Search facets collapse behind an explicit control on narrow screens.
- Visualization blocks reserve meaningful height while loading, avoid layout
  shifts, and never trap ordinary page scrolling.
- Touch controls target at least `--size-control-lg` (44px) where they are the
  primary interaction.
- Print removes sticky chrome and interactive controls, exposes essential URLs,
  and preserves record hierarchy.

**The One-ladder Rule.** Use the five shared breakpoints or a component query.
Do not add a near-duplicate breakpoint to solve a local spacing problem.

**The No-horizontal-overflow Rule.** Every representative surface must remain
within the viewport at 320px, 390px, 200% text zoom, and intermediate desktop
widths where the navigation changes mode.

## Elevation & Depth

The system is layered, not glossy. Most separation comes from a tonal step and
a warm hairline border. Shadows are soft, warm-tinted, and reserved for floating
or interactive elevation: menus, popovers, the mobile drawer, hovered cards,
and the record apparatus. Dark-mode shadows deepen while raised surfaces become
slightly lighter than the forest ground.

### Shadow vocabulary

- **Hairline separation** (`--border-light` / `--border`) is the default.
- **Ambient low** (`--shadow-xs` / `--shadow-sm`) supports cards and compact
  overlays.
- **Floating** (`--shadow-md` / `--shadow-lg`) belongs to menus, hover elevation,
  and deliberately raised controls.
- **Drawer or modal** (`--shadow-xl`) is reserved for major temporary layers.
- **Primary glow** (`--glow-sm`) may support a primary interactive state, never
  ambient decoration.

The masthead's catalogue column is sunken into its band rather than floated
above it. Dashboard loading states use a quiet inset surface with reduced-motion
aware shimmer. Frosted controls are a sanctioned exception only when placed
over unpredictable user imagery, such as a lightbox.

**The Flat-by-default Rule.** A surface begins with tone and border. Add a
shadow only when it communicates state, overlap, or elevation.

**The No-glass-chrome Rule.** Do not apply translucent blur to ordinary cards,
navigation, or dashboard panels.

## Shapes

The form language is institutional and instrument-like: gently curved rather
than pillowy, with consistent borders and no ornamental asymmetry.

- Small controls use `--radius-sm` (6px).
- Inputs and standard controls use `--radius-md` (8px).
- Cards and larger panels use `--radius-lg` (12px).
- `--radius-xl` (16px) is exceptional and should correspond to a genuinely
  larger enclosure.
- Full pills are reserved for chips, tags, compact filters, and circular or
  capsule controls whose semantics justify the silhouette.
- Structural rules are normally 1px. The 3px brand flag is an authored
  signature, not a generic left-border accent.

Cards use a complete border. Blockquotes use a full frame and a quotation mark.
Titles may use a short underline accent. Side stripes, arbitrarily missing
corners, and extreme mixed radii are not part of the system.

**The Complete-frame Rule.** If a component needs a boundary, draw the whole
boundary or use a tonal change. Do not signal importance with a coloured side
stripe.

## Components

The components are refined and restrained. They use semantic tokens, expose
clear focus and disabled states, and allow module-owned controls to keep their
own identity without fighting global element selectors. The representative
renderable subset lives in `.impeccable/design.json`; the implementation remains
authoritative.

### Header and navigation

The sticky header uses the paper or forest surface, a 3px Uni-Grün top flag,
the Africa Multiple lockup, federated search, utility controls, and a measured
inline-or-drawer navigation. Menu labels never wrap. The drawer is a right-side
panel on larger narrow windows and becomes full-width only on small screens.
The light/dark toggle is a labelled `aria-pressed` button and updates both root
theme attributes before dependent charts repaint.

### Masthead

The deep-plate masthead is carried by eyebrow, Spectral display title, lede,
textual entry links, a gold flag, and a sunken catalogue column of corpus counts.
It has quiet, balanced, and bold token treatments; bold is the default. It does
not duplicate the header search on wide screens. On narrower screens, where the
header search collapses, the masthead supplies a full field.

### Buttons

- **Shape:** controlled curve (`--radius-md`) and a 44px primary touch target.
- **Primary:** `--primary` fill with `--primary-contrast` text.
- **Hover / active:** derived primary roles plus a restrained lift.
- **Focus:** the shared visible `--ring-focus`; never remove it.
- **Secondary / ghost:** paper or transparent ground with semantic border and
  ink; state may introduce the primary-muted surface.
- Theme rules must not globally overpower module buttons. Keep base specificity
  low enough for a single module class to win.

### Inputs and search fields

Fields use a surface or sunken ground, a complete `--border-strong` outline,
the body font, and the shared focus ring. Labels remain visible; placeholders
are hints rather than labels. Search controls preserve the query in navigation
and expose clear, translated empty, loading, error, and unavailable states.

### Chips and tags

Chips are compact, fully rounded, and information-bearing. Selected or
interactive variants use semantic primary or entity colors without allowing
raw pigments to compromise contrast. Subjects, resource types, and facet values
must remain distinguishable by text, not color alone.

### Cards and resource lists

Resource cards use the panel surface, a full hairline border, `--radius-lg`, and
quiet shadow. Hover may lift slightly when the whole card is actionable. Lists
remain available where dense comparison is more important than image-forward
browsing. Pagination, sorting, and layout toggles form one coherent control
cluster.

### Record and linked-resource patterns

Record metadata is grouped semantically: Abstract; Description; People and
roles; Subjects; Origins and context; Rights and access; Identifiers and
sources; and Further details as a lossless fallback. The apparatus rail owns
citation styles, DOI, licence, permalink, and copy actions. Linked resources
merge duplicate records, expose relationship facets, and use a native
`<details>` disclosure with a dense responsive card grid.

### Visualizations and maps

DRE Visualizations inherits the shared font, surface, control, focus, entity
color, and stacking contracts. Canvas and WebGL libraries receive resolved sRGB
colors and font stacks through `window.DRETokens`, then repaint after a
`data-theme` change. Maps preserve ordinary page scroll, provide keyboard and
list alternatives where applicable, and reserve fullscreen content for
`--z-stage`, below dialogs and tooltips.

### DRE Search

DRE Search is an Operate surface. Its Svelte components inherit the semantic
tokens, retain clear facet and result state, keep list mode as the dependable
baseline, and may add gallery or map views when content warrants them. The
federated route, corpus tabs, facet panels, result cards, autocomplete, and
zero-result recovery must be tested together with theme chrome.

### Mirador

Mirador is framed as scholarly media apparatus, not a second application pasted
into the page. The theme supplies `window.DRE_MIRADOR_CONFIG`; the local default
uses the Braun accent rather than Mirador's cyan, restrained controls, no
language switcher, and no workspace menu for the theme's single-item use case.
The wrapper provides the accessible name and constrains viewer elevation. Do not
style unstable internals when a supported configuration option exists.

### Shared integration contract

The complete token API, mode contract, JavaScript bridge, fallback rules,
stacking scale, data-color rules, and cross-repository release procedure are in
[`docs/DESIGN-INTEGRATION.md`](docs/DESIGN-INTEGRATION.md). Treat that document
as required reading before changing a token consumed by DRE Search or DRE
Visualizations.

## Do's and Don'ts

### Do

- **Do** start every design task from `PRODUCT.md`, this document, and the
  relevant surface brief or route evidence.
- **Do** use semantic CSS custom properties for color, type, spacing, radius,
  depth, motion, layout, and stacking.
- **Do** design and inspect light and dark modes together.
- **Do** preserve a single meaningful `<h1>`, a logical heading hierarchy, and
  reading order independent of the desktop layout.
- **Do** group metadata by scholarly meaning and retain unknown properties under
  Further details.
- **Do** give empty, loading, offline, unavailable, permission, and error states
  a clear path forward.
- **Do** resolve canvas and WebGL colors through `window.DRETokens` and repaint
  them when the theme changes.
- **Do** use the generated token fallback artifacts when a module must render
  outside this theme.
- **Do** run `npm run build`, `npm run test:unit`, and `npm run i18n:check`
  before shipping a theme change, then run the bounded production smoke suite
  after deployment.
- **Do** use browser-local CSS or JavaScript injection only for ephemeral visual
  experiments, with production version guards and no writes or form submission.
- **Do** keep generated comps as directional evidence. Implementation must still
  meet content, accessibility, responsive, and integration constraints.

### Don't

- **Don't** reintroduce `.impeccable.md`; durable product truth belongs in
  `PRODUCT.md` and visual truth belongs here.
- **Don't** redefine a theme token inside a module or create parallel type,
  spacing, radius, breakpoint, or z-index scales.
- **Don't** use raw brand hex values in component rules when a semantic token
  exists.
- **Don't** add gradient text, generic glassmorphism, neon-on-dark effects,
  cold-grey surfaces, colored side stripes, or arbitrary asymmetric radii.
- **Don't** use Inter, DM Sans, or a fashionable editorial serif as a shortcut
  around the established Spectral and Hanken Grotesk system.
- **Don't** render metadata in database order, hide unrecognised properties, or
  put identifiers ahead of the record's meaning.
- **Don't** make a canvas visualization the only way to access its information.
- **Don't** test unversioned working-copy CSS against production and call the
  result a release validation; the deployed asset versions must be recorded.
- **Don't** run destructive, authenticated, or state-changing experiments on
  the public Omeka S instance.
- **Don't** keep polishing indefinitely. Inspect desktop and mobile together,
  fix the observed defects in one batch, confirm once, and stop.
