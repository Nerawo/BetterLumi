# Food Storage — Phase 2 UI integration

Implemented locally. No commit, push, deployment, database reset or reference-data change.

## Baseline and scope

Phase 1 was reviewed before implementation: `docs/food-storage-phase1.md`, its batch/transaction service, validators, snapshots and migration/backup tests. Baseline remains **Schema 7**, **Backup 10**, database **BetterLumi**. Phase 2 adds no stores or migrations and retains all 41 previously uncommitted Phase 1 files.

Two missing Phase 1 capabilities were reported before implementation: safe initial-leftover meal synchronization, and explicit unused-preparation cancellation. Both are now implemented in the existing service with revision checks, retry receipts and atomic rollback. No parallel inventory implementation was added to the UI.

## UI delivered

- Recipes now has internal **My Recipes / Food Storage** tabs; bottom navigation is unchanged. Existing recipe search, categories, sorting, actions and detail navigation remain available.
- Food Storage shows active/archived batches, names, dates, remaining quantities/nutrition, progress and Make a Batch. Progress compares remaining original-nutrition fraction with the initially stored fraction, including leftovers and subsequent conversion. Corrections above the initial quantity retain their actual percentage; the visual bar caps at 100%.
- Batch details display original cooked weight or original complete-portion reference, actual remainder, per-100g nutrition for weight mode / remaining nutrition for ratio mode, frozen ingredient snapshots, status and inventory history. Household units use existing localization; ratio ingredient snapshots display percentages rather than invented weights.
- Detail actions reuse `saveMeal`, `adjustRemaining`, `convertToWeight`, `setArchive`, `updateMetadata`, and the new cancellation operation. Formula lock status is visible; saved ingredient snapshots are not edited through a generic recipe form.
- Make a Batch starts from a detached copy of an existing user/built-in recipe or from scratch. It reuses `RecipeLineEditor` / `IngredientPicker` for Pantry ingredients. Stored-food sources are specific active batches, not recipe templates. Source duplicates in this form are prevented so ratio previews have one unambiguous allocation per source. Final cooked grams are required; total and per-100g previews update from snapshots. Source inventory is untouched until the atomic save succeeds, and no meal is created.
- Add Meal has four sources in order: **Saved Recipes / Pantry / Food Storage / Quick Log**; fresh openings retain Saved Recipes as default. The existing rectangular selector pattern and full-width slider styling are reused. Storage drafts survive tab switches. Numeric input buffers may be blank while editing.
- Weighted consumption uses grams; ratio consumption uses a 0–100% slider of current available remainder. For edits, that meal's own allocation is included in available inventory, as specified in Phase 1. Zero percent may be previewed; recording requires a positive amount under Phase 1's technical validation.
- Recipe leftovers appear only below 100%, default unchecked on every fresh opening, and create a linked batch only after explicit opt-in. The optional weight is clearly labeled as **complete prepared weight**, distinct from **current remaining measured grams** used for later ratio conversion.
- Storage-linked meals use atomic service operations for saving/editing/deleting, including the existing deletion-confirmation entry point. The selected batch can change during a storage-meal edit. Existing non-storage meals keep their existing source-editing behavior; conversion between an existing non-storage record and an inventory record is not performed implicitly.

## New transactional capabilities and safeguards

### Initial leftover meal edits

`editLeftoverOrigin` requires expected meal and batch revisions.

- `sync` is permitted only without downstream inventory activity. It updates the actual complete-portion snapshots and leftover fraction/quantity together with the meal. Repeated safe origin corrections remain supported. Independently edited batch name, notes and preparation date are preserved.
- Consumption, independent corrections, conversion, use in another batch, discard/cancellation or a prior explicit unsynchronized correction prevents silent synchronization.
- The UI displays a conflict and offers the batch-detail correction workflow or an explicit **meal-only correction** confirmation. Canceling that confirmation changes nothing.
- `meal-only` updates the current meal form values and deliberately leaves the batch, later meals and inventory unchanged. `FoodLog.leftoverInventoryUnchanged: true` records that decision. Backup validation requires an appropriate explicit correction receipt before accepting the marker.
- Both strategies run with the associated meal, stock, history and optional plan-completion callback in one transaction. A failed callback/write cannot report successful partial application.
- Origin-meal deletion retains the linked batch and does not return the originally eaten portion.

### Explicit preparation cancellation

`cancelBatch` checks revision and permanent usage/history eligibility inside the transaction. Eligible preparations have no consumption, independent inventory correction, conversion or downstream use. UI confirmation is required before calling it.

The service restores the exact frozen source-batch allocations using original nutritional fractions and current measurement density, marks the target archived with reason `canceled`, sets its balance to zero, and retains its formula and history. It never returns ingredients simply because a later meal was deleted. Source formula locks remain permanent even after cancellation. Retry keys prevent double returns. Canceled preparations cannot be restocked, restored or discarded through ordinary inventory controls.

The model adds archive reason `canceled`, transaction kinds `edit-origin` / `cancel-batch`, and the optional meal correction marker. These are additive values within the not-yet-published Phase 1 schema/backup foundation; schema and backup versions remain 7/10. Older supported backups and Phase 1 records without these fields continue to validate.

## Focused validation

- `npm run typecheck`: passed.
- **104 distinct relevant unit tests across 8 files** passed over the targeted runs: 16 Phase 2 tests, 61 Phase 1 storage/backup tests, and 27 domain/recipe/unit compatibility tests. Later changes were retested only in the directly affected files.
- **31 distinct WebKit browser cases** passed: 14 new Food Storage UI cases, 15 existing Add Meal selector/portion/slider cases, and 2 selected existing Recipes cases. No full browser regression ran.
- New UI coverage includes recipe/scratch creation, Pantry and batch ingredients, frozen recipe preservation, weight/ratio consumption, edits/deletion, conversion, opt-in leftovers, origin conflicts and explicit correction, confirmation cancellation, archive/restore/discard, eligible preparation cancellation, overdraw validation, failed-save rollback/retry, and Chinese/English 320/375/390/430px layouts.
- A newly introduced asynchronous default-quantity race was found and fixed: fields become editable after initialization, so defaults cannot overwrite a user's first input. Tests cover immediate quantity edits and the resulting preview.
- Screenshot review caught the old three-column source-tab rule overriding the new layout. A scoped four-column rule and same-row assertions now cover the four source tabs. Native slider width/positions remain covered by the existing focused WebKit tests.
- Test-only temporary instrumentation was removed. Screenshots and the local WebKit runner configuration are under ignored `work/`; no shared Playwright or deployment configuration was changed.
- `npm run build`: final production TypeScript/build/PWA verification passed. Non-blocking warnings: the existing >500 kB bundle warning, plus Vite noting that the storage service is now both statically and dynamically imported and therefore is included in the main chunk.

## Remaining verification / Phase 3

- Native iPhone Safari and installed PWA verification is still needed for keyboard animation, touch dragging, safe areas and long-form scrolling. Automated WebKit is not native-device verification. Existing shared keyboard/modal infrastructure was reused unchanged.
- The UI exposes draft ingredient editing during preparation and immutable snapshots afterward; it does not introduce a general saved-batch formula editor. Phase 1's guarded unused-formula correction API remains available.
- Cross-source conversion of an already-saved ordinary meal into a storage-linked record is intentionally not implicit; selecting a different batch for an existing storage meal is supported.
- Phase 3 requirements have not been supplied. No additional phase or unrelated features were started.

## Phase 2 files

Production/UI and service integration:

- `src/Meals.tsx`
- `src/Recipes.tsx`
- `src/FoodStorage.tsx` (new)
- `src/food-storage-locale.ts` (new)
- `src/food-storage.css` (new)
- `src/domain.ts` (overlaps preserved Phase 1 work)
- `src/food-storage.ts` (overlaps preserved Phase 1 work)
- `src/food-storage-model.ts` (overlaps preserved Phase 1 work)

Tests:

- `src/food-storage-phase2.test.ts` (new)
- `tests/food-storage-ui.spec.ts` (new)
- `tests/meal-portion-slider.spec.ts` (four-tab expectations / Quick Log position)
- `tests/editorial.spec.ts` (Quick Log position only)
- `tests/numeric-inputs.spec.ts` (Quick Log position only)
- `tests/rings-ocr.spec.ts` (Quick Log position only)

Report:

- `docs/food-storage-phase2.md` (new)

This phase involves 15 files. Combined with the retained Phase 1 changes, the working tree contains 53 changed/new files; three service/model files overlap the phases. Nothing is staged or committed.
