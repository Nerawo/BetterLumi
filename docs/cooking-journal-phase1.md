# Cooking Journal Phase 1

Implemented locally only. No commit, push, deployment, user-data reset, or migration.

## Persistence and compatibility

- IndexedDB Schema 7 and database identity BetterLumi remain unchanged; no new stores, indexes, or callbacks.
- Backup 12 includes optional Recipe.ingredientGroups ({id,name}[], ordered by array), RecipeLine.groupId, and stable RecipeLine.lineId.
- Existing permanent IDs are retained. Legacy Pantry line IDs are generated in editor draft state only and persisted only on explicit Save. Entering Cooking Mode never writes recipe templates.
- Active/completed sessions use settings keys cooking-session:v1:<recipeId>. Each stores version, session ID, recipe ID/revision, servings, ordered fingerprint entries, checked IDs, legacy identity mappings, status, and a review flag.
- Backup export/import validates group ID uniqueness and references, line IDs, session structure, serving quantities, checked-entry membership, legacy mappings, and key/recipe associations. Invalid backups are rejected before the existing restore transaction; valid records are not silently dropped.
- Backup 2–11 acceptance is retained. Existing version-1 partial helpers are unchanged; the application uses the full exportAll/restoreAll path.
- Stale revisions and orphan sessions are preserved in backups. Session entries describe their previous recipe revision; reconciliation is performed on opening the recipe rather than rejecting valid stale sessions or rewriting recipes during restore.

## Reconciliation

- Permanent line ID plus fingerprint (source, ingredient/batch identity, quantity basis, name, quantity, unit, frozen nutrition) determines whether a check survives.
- Group headings, group assignment and ordering are excluded from the fingerprint.
- Unique legacy fingerprints can follow reordered rows or be promoted to permanent editor IDs. Identical repeated legacy rows retain their mapping across unchanged refresh/reopening; on ambiguous recipe revision changes they receive unchecked identities and a visible review/restart message.
- Added lines start unchecked; removed lines disappear; replacement, quantity, unit or snapshot changes invalidate their previous checks.
- Serving changes with progress require explicit confirmation; Cancel restores both the original session yield and checks.
- Settings writes use Dexie transactions with compare-and-swap to reject stale concurrent edits. Failed writes restore the displayed previous state and show an error. Invalid session recovery requires an explicit restart confirmation and does not change recipe data.
- Finish marks the current session completed. Reopening creates a fresh session. Close preserves the active session.

## UI and safety

- Create/Edit Recipe: group add/rename/reorder/remove, per-line assignment and within-group ordering; inline Pantry creation and stored-food selection continue through existing pickers.
- Removing a group returns its lines to Ungrouped; no ingredient deletion.
- Normal detail shows every ingredient, organized by heading, without checklist interactions, retaining image, instructions, yield, nutrition and notes.
- Start Cooking replaces the detail dialog with a dedicated scrollable mode. Method is left, ingredient checklist right, with a divider. Below 360px it stacks for readability. Existing modal keyboard/safe-area handling is reused without changing shared Modal code.
- recipeServingLines supplies scaled quantities; templates and frozen snapshots stay unchanged.
- Cooking actions only write their own settings key. They never invoke meal, batch, inventory, or goal services.
- Wake lock is best-effort, reacquired on visible supported contexts and released on exit; unsupported/denied requests do not block cooking.
- No handwriting fonts, highlighter treatments, new font assets, or Phase 2 visual design introduced.

## Verification

- TypeScript: npx tsc -b — PASS.
- Complete units: 843 tests / 83 files — PASS; includes 23 new journal tests, Backup 12 round trips, older formats, mixed Backup 11 sources, failures and stale writes.
- Final mobile WebKit: cooking-journal, inline-ingredient and recipe-picker suites — 16 tests (see work/cooking-browser-verified.log).
- Mobile matrix: 320/375/390/430px, Chinese/English, four themes, checkbox persistence, group editor cancel, yield confirmation, keyboard-like viewport changes, long internal scrolling, live recipe reconciliation and mocked wake lock lifecycle.
- Existing recipe-storage and food-storage-backup unit suites retain real allocation, rollback, leftovers and inventory restoration coverage.
- Production build and PWA generation — PASS; 120 precache entries. Existing non-fatal chunk-size/static-dynamic import warnings remain.
- Native iPhone Safari/PWA, real software keyboard, OS suspension and hardware wake lock require real-device acceptance. WebKit resize and mocked APIs are not native verification.
- Preserved unrelated editorial-directories.css SHA256: 8630e4c0ad3d8705c53ae0f0d961e595e4cca60c76275f0e58a7818642b9ce85.

## Screenshots (isolated synthetic browser data)

- work/screenshots/cooking-journal-390.png
- work/screenshots/cooking-journal-320.png
- work/screenshots/cooking-groups-editor-390.png
- work/screenshots/cooking-recipe-overview-390.png

## Changed files

- src/CookingMode.tsx
- src/RecipeDetail.tsx
- src/RecipeGroupsEditor.tsx
- src/RecipeLineEditor.tsx
- src/Recipes.tsx
- src/ai-meal-import.test.ts
- src/ai-meal-storage.test.ts
- src/built-in-foods-phase2b.test.ts
- src/built-in-recipes.test.ts
- src/calculator-goals.test.ts
- src/cooking-journal-locale.ts
- src/cooking-journal.css
- src/cooking-journal.test.ts
- src/cooking-journal.ts
- src/cooking-session.ts
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
- tests/cooking-journal.spec.ts
- docs/cooking-journal-phase1.md

The 23 older test-file edits only update expected current export version from 11 to 12. Their original nutrition, history, preference and compatibility assertions remain.

## Manual acceptance

1. Open an existing ungrouped recipe; close Cooking Mode after checking a line, refresh, reopen and confirm restoration.
2. Add/rename/reorder groups; move repeated ingredients and stored-food lines; cancel once, then save and inspect the full overview.
3. Check lines, then edit the recipe: reorder/group changes retain valid checks; replacement/quantity/unit changes clear the affected checks.
4. Change cooking yield; test both confirmation choices. Reset, finish and reopen the session.
5. Compare Food Storage inventory before/after every cooking action. It must stay identical.
6. Export Backup 12 and restore in a separate test browser. Keep the real production browser/data untouched.
7. Test Safari and installed PWA on a physical iPhone, including keyboard, scrolling, app switching, restart and wake lock availability.
