# Food Storage — Phase 1 data foundation

Status: implemented locally; no Food Storage UI, commit, push or deployment.

## Verified baseline and migration

The inspected baseline was database `BetterLumi`, Dexie schema 6, and the production `exportAll` backup format 9. The v1 helpers in `db.ts` are older, partial helpers and are not the production backup entry point.

Schema **7** adds only `foodBatches` and `inventoryTransactions`. All 18 existing stores and their indexes stay in place. There is no v7 upgrade callback, seed, reset, record rewrite, store deletion, or database/origin change. Existing v1–v6 migration definitions remain intact. Tests cover native WebKit IndexedDB v6→v7, all prior store rows, and older v4/v5 migrations.

Production backup format **10** includes both new stores. Valid formats 2–9 continue to import; absent inventory becomes empty tables on an explicitly requested full restore. The existing replace-on-restore semantics remain unchanged; migration itself never invokes restore or clears a table. Validation completes before the write transaction. Import failures roll back all stores. New inventory may not be mislabeled as an older backup version.

The obsolete partial v1 export/restore helpers remain compatible when no inventory exists, but reject use when inventory exists instead of silently omitting or stranding linked records. Use `exportAll` / `restoreAll` for production backups.

## Models and invariants

- `FoodBatch`: stable ID, record metadata, display name, optional source recipe ID, preparation date, notes, detached actual ingredient snapshots, original complete-portion nutrition, optional original cooked yield, current quantity, mode, nutritional fraction per current unit, permanent `everUsed`, archive reason, and separate origin-meal linkage.
- `BatchIngredient`: frozen quantity/unit/nutrition. A processed-source ingredient additionally retains source batch ID and fraction of that source's original composition. Source recipes are copied templates, never selectable ingredient types.
- `StorageTransaction`: stable caller-supplied operation ID, operation type, canonical request receipt, batch/meal references, signed inventory movements, and reason. Conversion receipts preserve measured grams and prior ratio information. Requests also retain creation/formula-correction input snapshots.
- `FoodLog.storageConsumption`: an ordinary inventory allocation with batch ID, original nutrition fraction, and transaction ID.
- `FoodLog.leftoverBatchId`: the initial recipe meal's leftover origin, with deliberately different deletion semantics.

The existing `FoodLog.source` enum remains unchanged. Inventory meals use `quick` plus their explicit storage linkage; do not infer inventory relationships from `sourceId`, names, or recipe IDs. Existing meals without either new field retain their previous behavior.

Nutrition uses existing `sumNutrition` / `scaleNutrition`; no kcal-from-macros calculation is introduced. Unknown nutrients remain null. No snapshot values are rounded for persistence.

Current nutrition is `totalNutrition × remainingQuantity × fractionPerUnit`.

- New weighted batch: measured cooked yield is required and positive; quantity is that yield and fraction per gram is its reciprocal. No meal is created.
- Leftovers: the full prepared-portion nutrition and ingredient snapshots are required. Only explicit `saveLeftovers: true`, with consumption below 100%, creates inventory. Known **complete prepared weight** creates gram inventory; unknown weight creates ratio inventory. Complete nutrition must agree with the ingredient snapshots. The supplied draft is cloned, not modified.
- Ratio consumption: percentages select the CURRENT remainder. For example, .5 of the original portion followed by 50% consumption leaves .25, and another 50% leaves .125.
- Ratio meal editing: its previous allocation is virtually returned before computing a new percentage, so the edit uses currently available inventory including that meal's own allocation. Other meals and manual corrections remain independent.
- Conversion: the input is measured weight of the CURRENT remainder. New fraction per gram is current original-nutrition fraction divided by measured grams. Original cooked yield stays unknown if it was unknown; prior meals and original composition do not change. Earlier ratio allocations restore the correct grams if subsequently deleted.
- Manual correction may exceed the original quantity; it changes only current inventory and records a reason, never the original yield/composition.

## Atomic operations

`FoodStorage` accepts an optional `LumiDB` instance and exposes:

- `makeBatch`, plus the detached-copy helper `copyRecipeForBatch`.
- `saveMealWithLeftovers` for a new recipe meal with explicit opt-in/out.
- `saveMeal` to create/edit ordinary inventory meals or change their selected batch.
- `deleteMeal` to soft-delete linked meals and restore only their direct allocations.
- `correctFormula` for eligible unused batches.
- `adjustRemaining`, `convertToWeight`, `setArchive`, and `updateMetadata`.

Every mutation includes the batches, inventory receipts and associated food logs in one Dexie read/write transaction. Failed writes and overdraw roll back every change, including earlier source deductions or returns to another batch. Transactions serialize competing consumption.

Callers must generate one stable operation ID per intended mutation and reuse it only for retries of the identical request. An identical retry returns the original receipt without reapplying anything, even after a later edit/delete. Reusing a key for different input returns `CONFLICT`. Mutation requests are detached before asynchronous work. Edits/deletes/manual corrections/conversions/archive operations require the expected record revision; stale changes return `CONFLICT`.

`FoodStorageError` exposes `code` (`INVALID`, `NOT_FOUND`, `OVERDRAW`, `ARCHIVED`, `LOCKED`, `CONFLICT`) and, where applicable, `batchId`. Raw IndexedDB failures propagate; the service never reports success after a failed transaction.

The existing domain `softDelete(foodLogs, id)` routes storage-linked meals through this service. Repeated deletion does not restore twice. Other record deletion behavior is unchanged. Phase 2 must use `saveMeal` for storage-linked editing, rather than the existing raw meal editor's `put` path. No new records are created by ordinary UI in Phase 1.

## Locking, lineage and archives

Any successful consumption or use as an ingredient permanently locks that source's formula. Creating a leftover batch also locks it because its formula is already referenced by the initial meal. Deleting consumption never unlocks the batch. Names/notes and inventory corrections remain editable.

Before first use, actual ingredient snapshots and cooked yield may be corrected. If an unused batch contains already-processed source allocations, those exact source snapshots must remain unchanged; Pantry ingredients and cooked yield can still be corrected. Reversing/removing/replacing a processed allocation returns a structured conflict instead of implicitly canceling preparation. No destructive preparation cancellation exists in Phase 1.

Using sauce in pasta deducts sauce once. Eating/deleting pasta affects pasta inventory only. Source formula locks, allocations and snapshots survive backup round trips.

Exhaustion automatically archives; returning inventory reactivates only an exhaustion archive. Manual archive retains stock. Discard removes current stock and archives with a distinct reason. Later meal returns or manual corrections preserve manual/discard archive status until explicit restoration. Empty inventory cannot be explicitly restored as active; correct the quantity first.

The initial leftover meal is not an ordinary inventory consumption. Deleting it preserves the leftover batch and does not restore the already-eaten portion. Editing an already-saved initial recipe meal through the new leftover-creation API returns a conflict pending explicit reconciliation rules.

## Verification

- `npm run typecheck`: passed.
- Targeted Vitest files: 25 files, **340 distinct tests passed** across the targeted runs. This includes **61 new storage/backup tests** and 279 existing compatibility tests. Two old migration tests initially retained schema-6 assertions; their expected version and old-schema fixtures were corrected, then both files (12 tests) passed. No unrelated test failure was found.
- `npx playwright test tests/food-storage-foundation.spec.ts --workers=1`: **2 WebKit tests passed**, including native IndexedDB migration and persistence/reload/backup behavior. The initial new-test launch inherited the repository's Chrome channel; the test-local channel override was corrected. No shared Playwright configuration changed.
- `npm run build`: TypeScript build, production assets and PWA generation passed. Existing non-blocking >500 kB chunk warning remains.
- No full unit/browser regression or real iPhone testing was performed.

Existing tests that explicitly assert the current schema/backup version were updated to 7/10, along with the current table count. Their nutrition, reference data, preference, history, calculation and UI assertions were retained. Old migration fixtures now exclude the two stores that did not exist at that historical schema.

## Phase 2 decisions / limitations

1. No Food Storage controls, navigation, labels or editor integration exist yet. Future UI must call the transactional service and pass stable retry keys/revisions.
2. Explicit policy/UI is still needed for reconciling an edited initial leftover-origin meal. It currently returns a conflict instead of silently changing inventory.
3. Cancellation or reversal of already-processed source allocations is deliberately unsupported. Define safeguards before allowing it.
4. Future weight inputs must distinguish complete prepared weight (leftover creation) from measured remaining weight (ratio conversion).
5. Numeric inventory keeps JavaScript number precision and does not round on save. UI rounding/tolerances and native iPhone interaction will be addressed when UI is authorized.
6. Native iPhone keyboard/UI behavior is outside this data-only phase; the shared keyboard implementation is untouched.

No nutritional reference values, serving-unit weights, existing food IDs, recipe templates, historical snapshots, supplement data, PWA configuration or deployment workflow were changed. All test fixtures run in isolated fake IndexedDB/browser contexts or uniquely named temporary databases.

## Exact changed-file list

- `docs/food-storage-phase1.md`
- `src/built-in-foods-phase2b.test.ts`
- `src/built-in-foods.test.ts`
- `src/built-in-recipes.test.ts`
- `src/calculator-goals.test.ts`
- `src/db.ts`
- `src/domain.test.ts`
- `src/domain.ts`
- `src/everyday-foods.test.ts`
- `src/exercise-estimate.test.ts`
- `src/exercise-plans.test.ts`
- `src/food-storage-backup.test.ts`
- `src/food-storage-model.ts`
- `src/food-storage.test.ts`
- `src/food-storage.ts`
- `src/household-units.test.ts`
- `src/ingredient-nutrition.test.ts`
- `src/ingredient-preferences.test.ts`
- `src/ingredient-tag-order.test.ts`
- `src/ingredient-tags.test.ts`
- `src/interactive-planner-goals.test.ts`
- `src/macro-planner-goals.test.ts`
- `src/natural-foods.test.ts`
- `src/pantry-foods.test.ts`
- `src/professional-guidance.test.ts`
- `src/reference-library.test.ts`
- `src/section-goals.test.ts`
- `src/update.test.ts`
- `src/weight-measurements.test.ts`
- `tests/built-in-foods-phase2b.spec.ts`
- `tests/compact-exercise-pantry.spec.ts`
- `tests/focused-today.spec.ts`
- `tests/food-storage-foundation.spec.ts`
- `tests/household-units.spec.ts`
- `tests/ingredient-tags.spec.ts`
- `tests/natural-foods.spec.ts`
- `tests/today-coordinated.spec.ts`
- `tests/today-polish.spec.ts`
- `tests/today-tabs.spec.ts`
- `tests/unified-overview-delete.spec.ts`
- `tests/weekly-inline-calendar.spec.ts`
