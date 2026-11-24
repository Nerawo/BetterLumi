# Compact handwritten Cooking Mode — local review

Cooking Mode presentation only. Phase 1/2 work remains local. No commit, push or deployment.

## Scope and implementation

- Added src/cooking-mode-compact.css, imported after the existing journal CSS by CookingMode.tsx. All selectors are scoped to .cooking-mode.
- Recipe Detail, Recipe Editor and the shared cooking-journal.css were byte-compared with their pre-task copies and remain unchanged. editorial-directories.css SHA256 remains 8630e4c0ad3d8705c53ae0f0d961e595e4cca60c76275f0e58a7818642b9ce85.
- CSS flex wrapping keeps the circular checkbox first, names readable, quantities pushed right when they fit. Long names and long units wrap without ellipsis or truncation. No production JavaScript width measurements.
- Existing journalQuantity() remains unchanged: at-most-one-decimal gram display, original stored precision preserved; meaningful other-unit precision stays intact.
- Title, conventional UI controls/progress/footer, 52/48 tracks, 320px stacked fallback and circular checkboxes are preserved. No models, grouping, stable IDs, session reconciliation, scaling, inventories, historical records, Schema 7 or Backup 12 changes. No structured step titles or Backup 13.

## Typography and spacing (390px measured)

- Method / Ingredients: Caveat (JournalHand), 19px / 24.7px line height.
- Group headings: LXGW WenKai TC (JournalWenKai), 13px / 19.5px.
- Instructions: WenKai, 13px / 20.15px; existing step numbers 12.5px.
- Ingredient names: WenKai, 13px / 19.5px.
- Quantities/units: existing platform UI stack, 11.5px / 17.25px.
- All checklist rows retain at least 44px height, with 4px vertical padding. Heading gap 8px; group margins 7px above headings, 2px below headings, 10px after groups. Circular checkbox remains 18px. Checked text is struck through; quantity retains normal UI readability.
- Reused the existing licensed local WenKai face, expanding its official Google Fonts subset from 27,436 to 58,212 bytes for common cooking verbs and egg-tart ingredient/instruction glyphs. No new font family/dependency or runtime CDN calls. Existing OFL notices remain. Unsupported custom characters use readable platform fallbacks. Caveat asset is unchanged.

## Before/after

Identical isolated six-serving egg-tart recipe, Chinese, 390px viewport, Method + Ingredients element only:
- Before: 462.953125px.
- After: 365.5625px.
- Reduction: 21.04%.
- Six actual row heights after: 44, 44, 44, 44, 44, 44px.
- Measurements: work/cooking-compact-before.json and work/cooking-compact-after.json. Typography/layout values are measured, not inferred from screenshot scaling.

## Verification

- TypeScript and production build/PWA generation pass; 123 precache entries. Existing non-fatal chunk warnings remain.
- 28 targeted unit tests pass: cooking session/grouping/reconciliation, original instruction preservation, gram/non-gram display precision.
- Mobile WebKit: all 18 cases PASS in the final complete rerun (work/cooking-compact-browser-final.log). An earlier run had a development-server navigation interruption; no tests were skipped or assertions bypassed.
- Widths 320/375/390/430px; Chinese/English; all four themes; grouped/ungrouped recipes, mixed Pantry/stored-food references, short/long names, meaningful long units, partial checks, serving reset confirmation, refresh persistence, viewport resize and unchanged inventory.
- Long-wrap fixture explicitly checks that the quantity starts below the complete long name, and retains 0.000125 for a long non-gram unit.
- Existing meaningful visual assertions preserved; typography assertion now verifies the requested bundled handwritten heading family. No tests skipped.

## Files changed in this refinement

- src/CookingMode.tsx (CSS import only)
- src/cooking-mode-compact.css (new)
- src/assets/journal/wenkai.woff2 (same licensed family, expanded subset)
- src/assets/journal/README.md
- tests/cooking-journal-visual.spec.ts (measurements, font assertion and wrap coverage)
- docs/cooking-mode-compact-refinement.md

Earlier Phase 1/2/reference pending files are preserved, not new work from this refinement. Native iPhone Safari/PWA keyboard, app suspension and real wake-lock behavior still require device acceptance.

## Native-scale review images

- work/screenshots/cooking-compact-unchecked-390.png
- work/screenshots/cooking-compact-checked-390.png
- work/screenshots/cooking-compact-320.png
- work/screenshots/cooking-compact-long-390.png
