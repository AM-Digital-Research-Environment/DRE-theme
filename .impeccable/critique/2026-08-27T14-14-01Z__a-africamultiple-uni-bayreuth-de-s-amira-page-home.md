---
target: AMIRA live homepage and global chrome
total_score: 23
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
timestamp: 2026-08-27T14-14-01Z
slug: a-africamultiple-uni-bayreuth-de-s-amira-page-home
---
### Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---:|---|
| 1 | Visibility of system status | 2/4 | The collection dashboard's loading state is not exposed through `role="status"` or `aria-live`. |
| 2 | Match system / real world | 3/4 | The scholarly language fits, but "Research," "Index," "Collections," AMRCs, FAIR and CARE require prior knowledge. |
| 3 | User control and freedom | 2/4 | Direct routes exist, but the very long homepage has no section index or clear shortcut through the visualization sequence. |
| 4 | Consistency and standards | 3/4 | Theme and modules share the visual language; visualization toolbars are denser and more icon-led than the global chrome. |
| 5 | Error prevention | 2/4 | Search is clear, but overlapping corpus routes are insufficiently explained before visitors choose. |
| 6 | Recognition rather than recall | 3/4 | Search and collection counts are visible; icon-only tools and overlapping IA labels add recall demands. |
| 7 | Flexibility and efficiency | 2/4 | Search, direct links, exports and embeds help experts, but the 7,786px mobile page has no accelerator. |
| 8 | Aesthetic and minimalist design | 2/4 | The masthead is disciplined; five dense paragraphs and nine equal-weight visualization blocks dilute focus. |
| 9 | Error recognition and recovery | 2/4 | Search and visualization recovery guidance is not discoverable from the landing state. |
| 10 | Help and documentation | 2/4 | Visualization descriptions help, but toolbar actions and domain abbreviations lack contextual guidance. |
| **Total** |  | **23/40** | **Acceptable — distinctive foundation, significant usability refinement needed.** |

### Design Specificity Verdict

**LLM assessment:** AMIRA feels authored for its research context. The forest plate, gold rule and catalogue numerals, Spectral/Hanken pairing, photography-free presentation, and "In the collection" index form a recognisable scholarly-modernist identity. Specificity weakens below the masthead, where institutional prose and nine similarly weighted visualizations make the page feel exhaustive rather than editorially guided.

**Deterministic scan:** the paired local fixture produced zero findings in one scanned markup file, but the detector had to use its degraded regex fallback because its parser dependencies were unavailable. That result cannot validate applied selectors, design tokens, or computed contrast and must not be interpreted as a clean bill of health.

**Browser evidence:** production served Omeka S 4.2.1, DRE-theme 2.29.0, DRESearch 1.20.0, and DRE Visualizations 2.28.0. No horizontal overflow or console errors were observed. The available browser surface was read-only, so mutable detector injection was unavailable and no reliable user-visible overlay exists.

### Overall Impression

The opening is convincing and unusually specific for an Omeka site. The biggest opportunity is to extend that editorial confidence through the rest of the homepage: decide what visitors should do first, reduce the distance to discovery, and keep module controls from overwhelming the reading path.

### What's Working

1. The masthead has genuine product character: expressive type, restrained institutional colour, useful counts, and a clear research-archive tone.
2. Discovery has several viable entrances: global search, editorial links, and corpus-specific links with real collection counts.
3. The semantic baseline is promising: skip link, labelled search, landmarks, named controls, and descriptive chart alternatives are present.

### Priority Issues

#### [P1] Mobile control targets are smaller than the project's 44px floor

- **Why it matters:** one-handed and motor-impaired users get unforgiving targets at the theme/module boundary.
- **Evidence:** menu ≈35×28px, header search/theme controls 40×40px, visualization tools 32×32px, MapLibre controls 29×29px, and several legend toggles ≈20px high.
- **Fix:** keep icon glyphs unchanged but expand the actual hit areas to at least 44×44px, beginning with the menu and adjacent visualization controls.
- **Suggested command:** `/impeccable adapt`

#### [P1] The homepage delays discovery behind too much introductory material

- **Why it matters:** on mobile, visitors cross roughly 1,220px of masthead and five paragraphs before reaching "Collection overview" near y≈3,054px.
- **Evidence:** the hydrated page measured about 7,786px high, with ten catalogue choices and nine visualization sections.
- **Fix:** retain title, promise, search, and one primary route in the first mobile sequence; progressively disclose the corpus catalogue and move secondary institutional explanation to an About surface.
- **Suggested command:** `/impeccable distill`

#### [P2] The information architecture exposes organisational categories before visitor intent

- **Why it matters:** a first-time visitor must infer the difference between "Research," "Index," and "Collections" while also interpreting ten corpus categories.
- **Fix:** organise the first layer around actions such as Search, Explore research, Browse entities, and View visualizations; preserve detailed destinations below that layer and define unavoidable abbreviations inline.
- **Suggested command:** `/impeccable clarify`

#### [P2] Visualization structure is verbose for assistive technology and silent during loading

- **Why it matters:** all nine visualization headings contain toolbar buttons, so heading names absorb actions such as "Copy embed code"; meanwhile the dashboard's loading transition has no live-status announcement.
- **Fix:** keep title text alone inside each heading, move toolbars to labelled sibling containers, and expose loading/completion through a stable region with a polite status.
- **Suggested command:** `/impeccable harden`

### Cognitive Load

High: four of eight checks fail—single focus, chunking, minimal choices, and progressive disclosure. Grouping and visual hierarchy are comparatively strong, but seven top-level navigation choices, ten corpus links, five prose paragraphs, and nine visualization sections exceed a comfortable first-visit decision load.

### Emotional Journey

The masthead is the peak: authoritative, warm, and substantial. The valley starts when the visitor moves into long institutional explanation before experiencing the collection. The page ends informationally, without a curated next step. The reassuring "no account required" message appears too late to support the initial search decision.

### Persona Red Flags

- **Jordan, first-time visitor:** overlapping navigation terms and unexplained abbreviations obscure the first decision; open-access reassurance is buried.
- **Sam, accessibility-dependent visitor:** landmarks and chart alternatives help, but small controls, toolbar actions nested in headings, missing `aria-current`, and an unannounced async loading transition weaken navigation.
- **Casey, distracted mobile visitor:** a long masthead, ten early catalogue choices, and 124 focusable elements create a costly one-handed path and make returning to context difficult.
- **Project-specific researcher:** the interface proves the corpus is rich, but delays the shortest path from a research question to a relevant record.

### Minor Observations

- Neither of the two hero links is established as the single recommended next step.
- Inline prose spans far beyond a comfortable reading measure on desktop.
- The mobile drawer changed state attributes in automation but remained measured off-canvas; this requires physical-browser confirmation before being treated as a defect.
- No contrast conclusion is justified because screenshots and computed detector checks were unavailable.
- The empty detector result is an undercount, not evidence of absence.

### Questions to Consider

- Is the homepage's primary job immediate record discovery or explanation of the AMIRA infrastructure?
- What is genuinely lost if mobile initially shows three corpus entrances rather than ten?
- Could one interpreted visualization lead, with the remaining views disclosed as "Explore all collection data"?
- Would AMIRA feel more confident if visitors experienced the corpus before reading its institutional provenance?
