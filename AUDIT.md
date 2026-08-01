# DRE-theme — design & token audit

> **Status: implemented in v2.22.0.** Every finding below (A1–A7, B1–B9, C1–C3)
> is addressed in the theme; §4's breaking-change register is the upgrade note,
> and DRE Search has already been updated for the one rename that reaches it.
> The document is kept as the rationale for those changes — it is the "before",
> and `DESIGN.md` is the "after". Two items were deliberately scoped **out**:
> the home page's *Three ways in* panels and *Featured collections* rows are
> Omeka **page content** an admin authors in blocks, not theme chrome, so the
> theme supplies the masthead, the entry points and the styling rather than
> hard-coding that copy.

Reviewed at commit `3b65547` (v2.21.1), against the live site
(`data.africamultiple.uni-bayreuth.de/s/amira`): home page and item `32324`.

Read together with the redesign mockups in `DRE Redesign.dc.html` (Home + item
record, light/dark, three brand-presence options).

**Headline.** The colour engine is genuinely good — a single-seed OKLCH system
with derived variants is better than most institutional themes ship, and the
documentation discipline is unusual. The weaknesses are not in the palette. They
are (1) a **token layer that stops at colour**: type, layout and spacing are
still governed by Sass magic numbers that the CSS custom properties never reach;
(2) **page architecture inherited from Omeka/Lively** — a single flat metadata
`<dl>`, region containers with a green rule under them, one decorative gradient
doing all the editorial work; (3) a handful of **contract hygiene** issues that
will bite the sibling modules.

Severity: **A** = fix before next release · **B** = should fix · **C** = tidy.

---

## 1. Tokens

### A1 · Two parallel type systems; the CSS scale is dead for headings
`_typography.scss` defines a considered `--text-xs … --text-4xl` scale *and* a
full set of `$font__h1-sm-size … $font__h6-base-size` Sass variables.
`base/typography/_headings.scss` consumes **only the Sass set**, so
`--text-2xl` / `--text-3xl` never render a heading. Two sources of truth for the
same decision, and the drift is already visible: the inline comments in
`_headings.scss` say `//40px`, `//50px`, `//30px` where the values are 36px, the
clamp, and 20px. h5/h6 are annotated `//30px` and are 20px/17px.

*Fix:* delete the `$font__h*-size` variables; author headings from `--text-*`.
One scale, in CSS, visible in devtools. Internal-only change — no module reads
the Sass vars.

### A2 · The heading ramp collides with itself
h2 small (1.875rem) is identical to h3 base (1.875rem); h1 and h2 are both
weight 800 in Spectral. Below `$md` the h2/h3 distinction disappears entirely,
and on an item page h1 vs h2 reads as weight-only.

*Fix:* one ramp with real distance and role-differentiated weight —
h1 800 / h2 700 / h3 600 — plus `--leading-*` tokens (see B1) instead of the
single `$font__headings-line-height: 1.2` applied at every size.

### A3 · Contrast claim is not true for `--muted`
`_colors.scss` and DESIGN.md both state every text/surface pairing meets AA.
Light `--muted: oklch(60% 0.010 58)` on `--surface: oklch(99.2% …)` is ≈3.6:1 —
below 4.5:1 — and it is used for captions, labels and disabled text. Dark
`--muted: oklch(60% 0.011 78)` on `oklch(19% …)` is ≈4.3:1, also short.
`--ink-subtle` (55% L) is marginal at 13px uppercase with wide tracking — which
is exactly where it is used, on the metadata label rail.

*Fix:* light `--muted` → ~52% L, `--ink-subtle` → ~50% L; dark `--muted` → ~68% L,
`--ink-subtle` → ~72% L. Then either verify the blanket claim or scope it
("body and UI text ≥ 4.5:1; `--muted` is for 15px+ non-essential text").
Worth adding a contrast assertion to `lint:tokens` — the current lint checks
*syntax* (raw hex, px sizes) but not the property the design actually promises.

### A4 · No layout tokens at all
The layout layer is entirely Sass/px: `$wrap-max-width: 1300px`,
`$header-min-height: 74px`, `gap: 50px` and `padding-bottom: 50px` in
`_regions.scss`, `right: -30px`, and `#content { padding: 3rem 10rem 4rem 4rem }`
for the search page. Meanwhile `--measure-wide` is 1160px — a *second*,
disagreeing container width, and the one the search page hard-codes. Nothing in
CSS can read the header height, so `scroll-padding-top: 6rem` (96px) is a magic
number that (a) doesn't match the 74px header and (b) is declared twice, in
`base/_theme.scss` **and** `base/layout/_layout.scss`.

*Fix:* add a layout family and consume it everywhere —
`--container-max: 81.25rem`, `--container-gutter`, `--header-height: 4.625rem`,
`--scroll-offset: calc(var(--header-height) + var(--space-6))`, `--rail-width`,
`--label-col` (replacing the component-local `--metadata-label-col`). Delete one
of the two `scroll-padding-top` declarations. Off-grid 50px/30px → `--space-12`
/ `--space-8`.

### B1 · Type tokens carry sizes but no rhythm
There are exactly two line-height tokens (`--line-height-normal`, `-relaxed`)
and heading margins are hard-coded rem values (1.875rem, 3.125rem, 1.75rem,
1.4rem) that are not on the 4pt spacing scale. So the spacing scale exists but
base typography — the most-used surface in the theme — ignores it.

*Fix:* `--leading-tight: 1.1` / `-snug: 1.25` / `-normal: 1.6` / `-relaxed: 1.75`,
and heading margins from `--space-*`. Consider a `--flow-*` pair for
"space between blocks in prose".

### B2 · The light-mode shadow block is duplicated verbatim
`_tokens.scss` declares the light shadow ink + `--shadow-xs…xl` + panel helpers
in `:root`, then repeats all 14 declarations inside
`body[data-theme="light"]`. Colours already solved this with
`@mixin am-light-theme`; tokens didn't. Two hand-synced copies is a latent bug.

*Fix:* `@mixin am-light-tokens` / `am-dark-tokens`, applied the same way
`_colors.scss` applies its theme mixins.

### B3 · Doubled spacing vocabulary
`--space-4` and `--space-md` are the same 1rem, declared independently. Module
authors have to guess which family is canonical, and a change to one silently
diverges from the other.

*Fix:* keep the numeric scale as source of truth and redefine the semantic
aliases as `--space-md: var(--space-4)`. Non-breaking; both names keep working.

### B4 · Legacy escape hatches still in the palette
`--white: #fff` and `--black: #000` are literal colours in a system whose first
principle is "tokens, not hexes" — and they are the exact tool a future
contributor will reach for to break dark mode. `--primary-dark` is a documented
alias of `--primary-hover`; `--secondary` is just `--primary`; `--complementary`
is decorative-only and has an unexplained hue difference between modes (78 vs 80).

*Fix:* grep both modules, then remove `--white`/`--black`/`--primary-dark`, keep
`--secondary`/`--complementary` only if a chart consumes them; align the hue.
None of these appear in the §9 contract list, so removal is not a documented
breaking change — but announce it anyway (see §4).

### B5 · Cross-module token naming is inconsistent
`--dre-hl-bg` is the only token with a product prefix and an abbreviation;
everything else is semantic (`--surface-sunken`, `--border-strong`). It is also
the one token whose *whole purpose* is to be shared, so it is the one that most
needs an obvious name.

*Fix:* introduce `--highlight-bg` and keep `--dre-hl-bg: var(--highlight-bg)` as
a deprecated compatibility alias. **Removing the alias requires a coordinated
breaking release.**

### B6 · Mode parity is authored two different ways
Light mode writes `--footer-text: oklch(94% …)`; dark writes
`--footer-text: var(--ink)`. Same for `--footer-text-muted`. Whether a footer
token is independent or an alias should not depend on which mode you are in.

### C1 · Unused / speculative tokens
`--space-40` (160px), `--radius-2xl`, `--tracking-tighter`, `--glow-sm/-md`,
`--ring-focus-sm`, `--lift-sm`, `--accent-line-sm` — several appear once or not
at all. A token that is never consumed is documentation debt.

### C2 · `--panel-border` needs a comment three times
The custom-property freeze the comment describes is real, but the workaround is
re-declared in three blocks. A `@mixin am-panel-tokens` would state it once.

---

## 2. Design & page architecture

### A5 · The item record is still an Omeka data dump
Item 32324 renders **one flat `<dl>` of ~25 properties** in database order.
Consequences, in the live page: the Abstract — the only thing most readers want
— sits *below* a twelve-link "Subject" run and *above* "Description: pages
1-19"; `DRE ID`, `Identifier`, `WissKI URL`, `has URL` and `Format` are given the
same visual weight as `Author`; the value-annotation disclosure appears twice as
a bare `<h6>` "Value Annotations" mid-flow; and there is no citation, licence or
download affordance anywhere near the top, although this is a journal article
with a DOI.

The grid label rail is right in principle but 10.625rem is too narrow for the
real vocabulary ("Copyright Date", "Parent project", "Access Rights" all wrap to
two lines while the value sits on the first baseline).

*Fix (mockup, item view):* group properties into named sets —
**Abstract · Subjects · Origins & context · Rights & access · Identifiers &
sources** — with the intellectual content first at a real reading measure, admin
identifiers last; move citation/DOI/licence/download/viewer into a sticky right
rail; subjects become chips, not a wall of links; label rail widened to 12rem
with a 14px sentence-case label (uppercase 13px at `--ink-subtle` is the
contrast problem of A3 in its worst context).

### A6 · The home page has two `<h1>`s and no entry points
The live home page renders the banner title as `<h1>` **and** the page title
"Home" as a second `<h1>`, then five paragraphs of prose carrying ~30 inline
links, and only then the collection overview — which is the actual way in, is
below the fold, and arrives as "Loading collection overview…". A researcher's
first screen contains no search field.

*Fix (mockup, home view):* one `<h1>`; the masthead carries eyebrow → title →
lede → **search field**; the corpus counts become a hairline six-cell strip
directly under it (the "way in", above the fold, and legible before JS);
prose reduced to two paragraphs at 44rem beside the partner list; "Three ways
in" (search / index / visualisations) and typographic collection rows replace
the link-dense paragraphs. Suppress the redundant page title on pages whose
banner already states it.

### A7 · The banner does all the editorial work, and it is one gradient
A single 108° three-stop wash, at 58/70/60% brand mix in light and 32/28/32% in
dark, is the theme's only visual device. Because it must work behind both a tall
hero and a slim strip, it ends up as a generic coloured header — the "weak
masthead" complaint. It is also decorative: it carries no information.

*Fix:* keep photography-free, but let **type and rule** carry the masthead
(large Spectral title, 3px brand flag, hairline count strip, gold numerals),
and demote the wash to an optional treatment. The three brand-presence options
in the mockup show the range: **A quiet** (stone ground, green only on
interactive), **B balanced** (green flags/rules/CTA — closest to today),
**C bold** (deep Uni-Grün masthead ground with cream type). All three use the
same tokens; only the `--masthead-*` role tokens change.

### B7 · Lively residue in `_regions.scss`
`.regions-container` draws `border-bottom: 1px solid $color__secondary` — a
full-width **green rule** under every region container, plus `gap: 50px`,
`padding-bottom: 50px` and `::after` offsets at `-30px`. This is stock-theme
furniture, not a system decision, and it is the single loudest "vanilla Omeka"
signal left in the CSS.

*Fix:* `--border` hairline (or nothing), spacing from the scale.

### B8 · `#content` search-page padding
`padding: 3rem 10rem 4rem 4rem` (asymmetric, 160px right) inside a
`max-width: 1160px` — a fix for a layout problem that should be solved with a
grid and `--container-*`.

### B9 · No page-level rhythm
Home, browse, item and static pages share one container and one vertical
padding, so every page has the same silhouette. The redesign gives the item page
a content + rail grid and the home page a full-bleed masthead band; that
difference is what stops a collection from reading like an admin back-end.

### C3 · Stat cards on the home band
Eleven bordered, shadowed, hover-lifting cards under the hero is a lot of chrome
for eleven numbers. As a hairline strip of numerals they read faster and stop
competing with the hero. (The shared `.rv-stat-card` look is still right
*inside* a dashboard.)

---

## 3. What is genuinely good — keep

- **Single-seed `color-mix` engine.** Changing `--primary-base` really does
  re-tint the theme, in both modes. Do not dilute this.
- **Warm stone / forest-dark neutrals.** The refusal of cold grey is the most
  distinctive thing about the theme, and it survives at every level.
- **Spectral + Hanken, self-hosted.** Correct call, correctly justified (GDPR,
  no render-blocking CDN, latin-ext for transliteration).
- **The documented anti-patterns and the lint that enforces them.** Rare and
  valuable; extend it (A3, B1) rather than replacing it.
- **The §9 module contract.** The idea that tokens are a public API between
  theme, DRE Search and DRE Visualizations is the right architecture.
- **No icon webfont**, `svg-icon()` masks, `prefers-reduced-motion`, the print
  stylesheet, the FOUC head script.

---

## 4. Breaking-change register (for DRE Search & DRE Visualizations)

| Change | Impact | Mitigation |
|---|---|---|
| `--dre-hl-bg` → `--highlight-bg` | **Breaking** — DRE Search paints match highlights with it | retain `--dre-hl-bg: var(--highlight-bg)` until a coordinated breaking release |
| Remove `--white` / `--black` / `--primary-dark` | Low — not in the §9 contract; grep both modules first | keep as aliases for one minor if a call site exists |
| Remove / re-hue `--secondary`, `--complementary` | Low–medium — a chart may use `--complementary` | check `dashboard-core.js`; if used, promote to `--brand-gold` |
| `--space-md` etc. become `var(--space-4)` | None (same computed value) | — |
| New `--container-*`, `--header-height`, `--leading-*`, `--label-col` | None (additive) | add to the §9 contract table so modules may rely on them |
| `--muted` / `--ink-subtle` lightness change | None structurally; visual | announce in the changelog; modules inherit the fix |
| Delete `$font__h*-size` Sass vars | None (theme-internal) | — |

Nothing in the **brand** layer changes: `--primary-base` stays `#009260` and the
six `--brand-*` pigments keep their exact brand-book values, so the chart
palettes stay in sync.

---

## 5. Suggested order of work

1. **A3** contrast fix + contrast assertion in `lint:tokens` (smallest change,
   largest correctness win, and it makes the DESIGN.md claim true).
2. **A1/A2/B1** one type scale in CSS, real heading ramp, leading tokens.
3. **A4/B7/B8** layout tokens; retire the Lively region furniture.
4. **A5** item-record grouping + rail (needs `view/omeka/site/item/show.phtml`
   and `common/resource-values.phtml` overrides).
5. **A6/A7** home masthead + entry points; pick a brand-presence option.
6. **B2/B3/B4/B5/B6** token hygiene, with the register above in the changelog.
