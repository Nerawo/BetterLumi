# Recipe Detail cleanup and Cooking Session v2

Implementation and release audit for the approved quantity override architecture. Git history and Actions record the publication identity.

## Persistence and compatibility

- IndexedDB Schema 7, BetterLumi identity, stores/indexes and deployment configuration unchanged. No migration callbacks or bulk session rewrite.
- Backup 13 exports both valid Session v1 and v2. Backup 2–12 remain accepted under their existing version-specific compatibility rules. Backup 12 v1 session JSON imports and re-exports unchanged.
- The existing cooking-session:v1: settings key namespace is intentionally retained; the JSON version field identifies the session contract. Opening a recipe through normal user interaction reconciles/upgrades only that session to v2. Import/export does not upgrade sessions.
- v2 adds quantityOverrides: an array of {entryId, quantity, unit, fingerprint, servings}. Quantities are finite nonnegative absolute amounts, with unchanged source units and the serving baseline at edit time. No multipliers or conversions are introduced. Ratio-source quantities retain their ratio representation internally and display percent as before.
- Validation rejects unknown override fields, duplicate/missing IDs, invalid numeric values, mismatched fingerprints/units/servings, wrong recipe-key associations and v2 data mislabeled as Backup 12. Malformed backups fail before writes, leaving valid existing records intact.
- Stale valid recipe revisions/orphan session data survive backups intact. Opening the recipe reconciles stable IDs/fingerprints: reordering/group movement retains valid overrides; replacements, quantity/unit/nutrition changes, removed lines and ambiguous legacy mappings invalidate the affected overrides. Overrides never transfer by ingredient name. Legacy ID promotion may invalidate an override conservatively if identity cannot be retained.
- Existing settings-only compare-and-swap transactions reject stale writes and roll back failed saves.

## UI and semantics

- Quantity text opens a local inline editor with the existing NumberInput temporary-input behavior. Explicit confirm/cancel, invalid-input feedback, a subtle overridden marker and per-line restore are available. Unit stays fixed. Escape cancels.
- Quantity overrides and checklist state are independent: Reset Checklist retains quantities; per-line restore retains checks. Serving changes with either overrides or checks require confirmation. Confirm clears both for the new yield; cancel preserves all state. Finish retains the existing session-completion-only behavior.
- Cooking Mode still scales base recipe lines via recipeServingLines. Overrides affect the displayed journal preparation quantity only. They never feed nutrition calculations, recipe/Pantry persistence, meals, batches or inventory transactions.
- Single upper Recipe Detail nutrition summary retained with existing serving calculations; duplicate lower summary removed. Start Cooking and Add to Meal share the primary row; Edit remains subordinate.
- Caveat handles Latin ingredient names and Method text; Yozai handles Chinese glyphs. Quantities/units/buttons keep UI typography. Compact layout and checkbox design retained. Checkbox-only CSS was narrowed so inline numeric editors do not inherit circular-checkbox styling; local name labels reset generic form margins/fonts.

## Earlier development verification

- TypeScript (tsc -b, also part of production build): PASS.
- Complete unit suite: 863 tests in 86 files PASS, no skipped tests. Includes 14 focused override tests and existing backup/session/nutrition/inventory coverage.
- Relevant browser suite: 35 PASS (cooking journal, quantity overrides, Recipe Detail cleanup/display/yield). Four mobile widths, both languages, all four themes, refresh, serving confirm/cancel, numeric validation, explicit save/cancel/restore and unchanged non-settings tables are covered.
- Final 16px numeric-editor input adjustment: all 8 quantity WebKit cases rerun PASS; final screenshots regenerated and visually inspected. Numeric editor uses 16px to avoid native Safari small-input auto-zoom; display-state quantity keeps the existing compact size.
- Production build/PWA: PASS, 128 precache entries. Existing chunk-size warnings remain non-blocking.
- Backup 13 exact round trip, Backup 12 v1 preservation/lazy upgrade, all previously supported older versions, malformed backup rejection, stale source reconciliation, stale writer rejection and injected save rollback: PASS.
- Logs: work/quantity-v2-all-unit-final.log, work/quantity-v2-webkit-final.log, work/quantity-v2-webkit-input-final.log, work/quantity-v2-build-final.log.
- Native-scale screenshots: work/screenshots/cooking-quantity-edit-390.png and work/screenshots/cooking-quantity-saved-390.png. Isolated synthetic recipes only; production browser data untouched.

Native iPhone Safari keyboard/PWA behavior still requires device acceptance; automated mobile WebKit is not native-device verification.

## Changed files (complete local approved Recipe/Cooking Journal work)

- src/CookingMode.tsx
- src/RecipeDetail.tsx
- src/ai-meal-import.test.ts
- src/ai-meal-storage.test.ts
- src/built-in-foods-phase2b.test.ts
- src/built-in-recipes.test.ts
- src/calculator-goals.test.ts
- src/cooking-journal-locale.ts
- src/cooking-journal.css
- src/cooking-journal.test.ts
- src/cooking-journal.ts
- src/cooking-mode-compact.css
- src/domain.ts
- src/everyday-foods.test.ts
- src/exercise-plans.test.ts
- src/exercise-retirement.test.ts
- src/food-storage-backup.test.ts
- src/household-units.test.ts
- src/ingredient-nutrition.test.ts
- src/ingredient-preferences.test.ts
- src/ingredient-tag-order.test.ts
- src/ingredient-tags.test.ts
- src/interactive-planner-goals.test.ts
- src/macro-planner-goals.test.ts
- src/natural-foods.test.ts
- src/professional-guidance.test.ts
- src/recipe-storage.test.ts
- src/reference-library.test.ts
- src/section-goals.test.ts
- src/sticky-notes.test.ts
- src/update.test.ts
- tests/recipe-display-cleanup.spec.ts
- tests/recipe-yield.spec.ts
- src/cooking-quantity.test.ts
- tests/cooking-quantity.spec.ts
- tests/recipe-detail-cleanup.spec.ts
- docs/recipe-detail-cleanup-and-override-audit.md

Other touched unit-test files change only current-export Backup version assertions from 12 to 13; legacy input compatibility fixtures remain covered.

Protected editorial-directories.css is unrelated and untouched by this task; SHA256: 8630e4c0ad3d8705c53ae0f0d961e595e4cca60c76275f0e58a7818642b9ce85.

## Final release audit (2026-11-24)

- Production baseline 0d71f5ea895a2cbebb6abfe8d7bd335ab015cd89 already includes Phase 1/2, local Yozai/Caveat and licenses. They are preserved in the isolated candidate.
- Read-only quantities round to integers for all journal units; editors and persisted overrides retain exact precision. Ratio quantities retain their existing percentage display basis. The technical asterisk is removed; explicit zero keeps a real restore action.
- Complete unit suite: 872 PASS in 86 files; TypeScript, project-subpath production build, PWA (128 entries), six Chromium/WebKit Pages/offline/update preservation tests PASS.
- Offline Cooking Mode loaded all six Yozai shards plus Caveat, CJK/Latin test glyphs and the local license notice with no external font requests or runtime errors. Official v0.868 OFL notice matches the bundled text except one insignificant trailing space.
- User approved necessary obsolete-test corrections after a Pantry selector failure was reproduced on unchanged production HEAD. Tests now cover archive cancel/confirm with unchanged Pantry/history, preserve Recipe delete cancel/confirm, assert retired Exercise UI absence, and verify current Supplements modals. Numeric tests exercise all 27 retained fields with exact-count coverage, rather than counting retired exercise controls. Recipe editor category tests use approved direct pills with unchanged ID/persistence assertions.
- Final related browser release run (including historical gram precision): 147 PASS in one complete run, no skipped tests. Final logs: unit.log, browser-release-pass.log, pages.log, numeric-final.log, storage-final.log in the ignored isolated release folder. Logs/screenshots are never packaged as application data.

### Exact release files

- docs/recipe-detail-cleanup-and-override-audit.md
- src/CookingMode.tsx
- src/RecipeDetail.tsx
- src/ai-meal-import.test.ts
- src/ai-meal-storage.test.ts
- src/built-in-foods-phase2b.test.ts
- src/built-in-recipes.test.ts
- src/calculator-goals.test.ts
- src/cooking-journal-locale.ts
- src/cooking-journal.css
- src/cooking-journal.test.ts
- src/cooking-journal.ts
- src/cooking-mode-compact.css
- src/cooking-quantity.test.ts
- src/domain.ts
- src/everyday-foods.test.ts
- src/exercise-plans.test.ts
- src/exercise-retirement.test.ts
- src/food-storage-backup.test.ts
- src/household-units.test.ts
- src/ingredient-nutrition.test.ts
- src/ingredient-preferences.test.ts
- src/ingredient-tag-order.test.ts
- src/ingredient-tags.test.ts
- src/interactive-planner-goals.test.ts
- src/journal-quantity.test.ts
- src/journal-quantity.ts
- src/macro-planner-goals.test.ts
- src/natural-foods.test.ts
- src/professional-guidance.test.ts
- src/recipe-storage.test.ts
- src/reference-library.test.ts
- src/section-goals.test.ts
- src/sticky-notes.test.ts
- src/update.test.ts
- tests/compact-directories-modals.spec.ts
- tests/cooking-journal-visual.spec.ts
- tests/cooking-quantity.spec.ts
- tests/numeric-inputs.spec.ts
- tests/recipe-detail-cleanup.spec.ts
- tests/recipe-display-cleanup.spec.ts
- tests/recipe-editor-redesign.spec.ts
- tests/recipe-yield.spec.ts
- tests/storage-consumption-redesign.spec.ts

Storage precision regression assertions now follow the already deployed new-input one-decimal rule. Historical full-precision no-op records remain tested unchanged in storage-gram-precision.spec.ts. No Food Storage production code changed.
