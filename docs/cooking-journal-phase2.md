# Cooking Journal Phase 2 — Local Review

Phase 1 remains implemented locally. No commit, push, deployment, database reset or migration was performed.

## Presentation and interaction

- Recipe Detail, Create/Edit Recipe and Cooking Mode share inline JournalHeading highlighting, locally bundled heading fonts, restrained rules and the existing theme variables. No new theme settings, card backgrounds, texture assets or shadows.
- Cooking Mode shows the recipe name once in a 26px editorial serif header, with a small localized mode label above it. Existing close behavior remains.
- Compact yield stepper supports half-serving buttons and arbitrary positive decimal input. Checklist reset still requires the Phase 1 confirmation. The displayed input buffer is respected when stepping immediately after typing.
- Native WebKit debugging found that canceling pointerdown suppressed the subsequent touch-generated click. The final implementation preserves native clicks, coordinates blur while stepping, and avoids a second blur submission during an active save. Tests now assert that the reset dialog actually opens.
- Cooking layout uses approximately 54/46 Method/Ingredients tracks (1.15fr / 1fr), a continuous divider and content-driven height. At 320px it stacks; 375/390/430px retain two columns. Method is 13px with 1.75 line height, ingredient text 13px, quantities 11px, visible checkboxes 15px with 44px label targets. Checked quantities retain readable contrast.
- JournalMethod decorates only step prefixes already present; original instructions, blank lines and escaping are preserved. No numbered steps are invented.
- Detail retains categories, photo upload/replacement/removal, yield, both existing nutrition summaries, complete ingredient list, instructions, sticky notes, Edit and Add to Meal. Empty groups are omitted from reading views; ungrouped ingredients remain visible. No checkboxes in normal detail. Empty photo affordance is 44px instead of a large placeholder.
- Start Cooking is the primary detail action; Edit and Add to Meal remain explicit secondary actions. Compact mobile footer uses two rows, desktop uses three columns.
- Grouped editor renders a group's lines directly below its editable heading, then Add Ingredient/Add Stored Food actions targeting that group. Group ordering/deletion and line moving/ordering use contextual menus. Full-width per-row group dropdowns are no longer permanently visible. Existing replacement, deletion, amount/unit controls and inline Pantry creation are reused. Empty groups can be edited and populated. Removing a group retains its ingredients.
- Equivalent Add Meal and Make a Batch editors still use the existing flat presentation when no groups prop is supplied. Their calculations, snapshots and transaction paths were not redesigned.

## Fonts and licensing

- Caveat: local WOFF2 subset, 40,464 bytes; basic Latin headings, digits and common punctuation.
- LXGW WenKai TC: local WOFF2 subset, 27,436 bytes; fixed journal labels and common Chinese cooking headings. Custom glyphs outside the small subset use the existing editorial language fallback. This deliberately avoids distributing a multi-megabyte full CJK handwriting font.
- Combined font payload: 67,900 bytes (66.3 KiB). Scoped to headings, mode labels and existing step numbers. Recipe titles retain the existing serif; instructions, ingredients, quantities and inputs retain readable UI fonts.
- Official sources: https://github.com/google/fonts/tree/main/ofl/caveat and https://github.com/google/fonts/tree/main/ofl/lxgwwenkaitc . Both are SIL OFL 1.1, allowing bundled redistribution and web embedding with their license notices. Original notices remain beside the assets, and public/fonts/journal-licenses.html is distributed and precached offline.
- No runtime requests to Google Fonts or other font CDNs; Vite emits local hashed WOFF2 assets under the configured Pages base.

## Preserved boundaries

Schema 7, Backup 12, database identity BetterLumi, stable line IDs, session persistence/reconciliation, recipe nutrition, recipeServingLines, historical snapshots, inventory transactions and wake-lock behavior remain unchanged from Phase 1. The only shared Modal extension is an optional eyebrow label; existing callers keep their original h2 structure. Shared iOS keyboard code is untouched. Today is untouched. Existing editorial-directories.css is preserved exactly (SHA256 8630e4c0ad3d8705c53ae0f0d961e595e4cca60c76275f0e58a7818642b9ce85).

## Verification

- npx tsc -b — PASS.
- Seven relevant unit files: 107 tests — PASS (work/journal-phase2-unit-pass.log). Grouping/session checks, Backup 12 round trips, Backup 11/older compatibility, mixed recipe inventory/rollback and instruction-presentation safety are retained.
- Eight targeted browser files: 47 tests — PASS, no skips (work/journal-phase2-browser-pass.log). Includes the mobile WebKit matrix and existing Chromium detail/image/yield regressions.
- Browser coverage: 320/375/390/430px, zh/en, all four themes, repeated ingredients, empty groups, long names/instructions, grouped Pantry inline creation, stored-food addition, group movement, explicit recipe save/cancel, precise stepper input, actual reset confirmation, scrolling and keyboard-like viewport resizing, refresh/session restoration, allocation rollback, leftovers, future-dated meals and historical snapshot preservation.
- Narrow obsolete assertions updated: explicit Start Cooking/Add to Meal controls, precise edit/meal action selectors, interactive small upload affordance replacing the large empty image, and unit selectors disambiguated from contextual group selectors. Nutrition/inventory/history assertions were not weakened. The compact-directories selector update was not a run of that entire older full-page suite; executed files are listed below.
- Production APP_BASE=/BetterLumi/ build — PASS (work/journal-phase2-production-final.log). PWA generation — PASS: 123 precache entries. Existing non-fatal chunk warnings remain.
- Fresh isolated production-preview browser, offline reload at /BetterLumi/: both fonts loaded, license page available offline, no external font requests and no runtime errors (work/journal-phase2-offline-final.log). No real production data accessed.

Executed browser files:
- tests/cooking-journal.spec.ts
- tests/cooking-journal-visual.spec.ts
- tests/inline-ingredient.spec.ts
- tests/recipe-yield.spec.ts
- tests/recipe-display-cleanup.spec.ts
- tests/recipe-list-images.spec.ts
- tests/recipe-storage.spec.ts
- tests/built-in-recipes.spec.ts

## Native-scale visual artifacts

All use isolated synthetic egg-tart fixtures, never user recipes. Images are direct modal/section captures without downscaling.

1. work/screenshots/journal-phase2-detail-390.png
2. work/screenshots/journal-phase2-editor-pastry-390.png and journal-phase2-editor-custard-390.png
3. work/screenshots/journal-phase2-cooking-390.png (unchecked)
4. work/screenshots/journal-phase2-cooking-320.png (stacked)
5. work/screenshots/journal-phase2-cooking-390-misty.png (3/6 checked)
6. work/screenshots/journal-phase2-cooking-390-lavender.png (another existing theme)

## Exact Phase 2 file list

- src/CookingMode.tsx
- src/JournalHeading.tsx
- src/JournalMethod.tsx
- src/RecipeGroupsEditor.tsx
- src/RecipeLineEditor.tsx
- src/RecipeDetail.tsx
- src/Recipes.tsx
- src/cooking-journal.css
- src/cooking-journal-locale.ts
- src/ui.tsx
- src/journal-presentation.test.ts
- src/assets/journal/caveat.woff2
- src/assets/journal/wenkai.woff2
- src/assets/journal/caveat-OFL.txt
- src/assets/journal/wenkai-OFL.txt
- src/assets/journal/README.md
- public/fonts/journal-licenses.html
- tests/cooking-journal.spec.ts
- tests/cooking-journal-visual.spec.ts
- tests/built-in-recipes.spec.ts
- tests/compact-directories-modals.spec.ts
- tests/recipe-display-cleanup.spec.ts
- tests/recipe-yield.spec.ts
- tests/recipe-list-images.spec.ts
- tests/recipe-storage.spec.ts
- docs/cooking-journal-phase2.md

Other pending files listed by git status belong to the preserved Phase 1 work and its Backup 12 version assertions, plus the intentionally unrelated CSS. Do not treat all pending files as new Phase 2 edits.

## Remaining limitations and manual acceptance

- Physical iPhone Safari/PWA software keyboard, OS suspension and hardware screen wake lock still need native acceptance. Automated WebKit resize and mocked wake-lock checks are not real-device verification.
- Rare/custom Chinese glyphs outside the small handwriting subset deliberately use the existing serif fallback. They remain readable and offline; full CJK handwriting coverage was not added.
- Review the group menu with touch and keyboard, create Pantry ingredients within each group, test stored-food selection, delete a group and confirm ingredients remain, then cancel/save the editor separately.
- In Cooking Mode, test direct decimal entry followed immediately by plus/minus, both reset-confirmation choices, checkbox refresh recovery, Finish and reopening. Verify inventory stays unchanged throughout.
- Confirm both reading columns, checked quantities and highlighter contrast in all four themes on the actual device before any publication approval.
