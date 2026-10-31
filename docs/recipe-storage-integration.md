# Saved Recipes with Food Storage ingredients

Local implementation for review; not committed, pushed or deployed.

## Data model and compatibility

- IndexedDB schema remains **7**. No stores, indexes or migration definitions changed. The database identity remains **BetterLumi**.
- Backup export is **11**. Valid versions **2–10** remain supported by the existing importer. There is no automatic data rewrite on application load.
- Existing Pantry recipe lines remain valid without a `source` field. New stored-food lines use `source: 'batch'`, a stable `lineId`, explicit `sourceBatchId`, `quantityBasis` (`g` or `original-fraction`), intended quantity/unit and frozen nutrition. A batch is never presented as a Pantry ingredient.
- Ordinary recipe meals have `recipeAllocations`: exact batch and line IDs, original-composition fraction, actual inventory quantity/unit, consumed nutrition and transaction receipt ID. Multiple allocations can reference one or several batches.
- Preparation with leftovers uses the existing `leftoverBatchId` / `originMealId` relationship instead of direct meal allocations. The leftover batch holds the complete prepared composition, source fractions and frozen snapshots; its remaining inventory represents only the unconsumed part.
- Backup validation checks references, line identities, units, allocation quantities, receipts, composition totals and source lineage before restore writes. A backup labelled version 10 cannot carry the new recipe metadata. Tests confirm older supported backups continue to load.

## Transactions and inventory meaning

Saving a recipe template never deducts stock or changes the source batch. Exhausted or archived sources remain valid frozen template references. Recording actual use requires an available source; replacement is explicit and never modifies the template or historical meals.

For an ordinary meal, prepared recipe line quantities already include servings. The consumption percentage is applied once. The service aggregates previous and requested allocations by batch and applies their **net difference** atomically. Deleting the meal returns its exact allocations to the original source batches, including after ratio-to-weight conversion.

For preparation with leftovers, the service deducts sources for the **entire prepared portion once**, creates the meal and the independent leftover batch, and saves lineage and a stable retry receipt in one transaction. Later consumption of leftovers changes only the leftover batch inventory.

For a mixed-recipe origin meal:

- With no downstream inventory activity, editing can synchronize the consumed/remaining split. Deleting makes the complete prepared dish available as leftover inventory. Neither operation returns processed source ingredients; the deleted meal retains its historical nutrition snapshot.
- After use, adjustment, conversion or use as another preparation's source, automatic synchronization/deletion returns a structured conflict. The UI offers batch review and explicitly confirmed meal-only correction or deletion. Those explicit operations preserve leftover inventory and all downstream history.
- The prepared formula remains frozen. Canceling a mixed-recipe leftover batch cannot return sources that have already become prepared food. Existing eligible ordinary batch preparation cancellation remains unchanged.

All mutations use the existing Dexie inventory transaction service. Food logs, affected batches and inventory receipts commit together; the existing meal form also includes its notes/plans in the outer transaction. Retry IDs, optimistic revisions and overdraw validation are retained. There are no network calls inside inventory transactions.

## UI

- Create/Edit Recipe exposes Add Ingredient and Add Stored Food. Pantry inline creation is retained.
- Stored-food selection shows name, available inventory, preparation date and nutrition. Weighted quantities use grams; ratio quantities explicitly refer to the original composition (1 = whole), without invented weight.
- Meal entry shows required quantities and actual source choices. Replacements update that meal's preview only. Changed source composition is reported rather than silently changing the nutrition on save.
- Make a Batch copies both Pantry and stored-food lines, supports explicit source replacement and retains the required measured cooked yield. Source deductions happen only on successful creation.
- Chinese/English labels, existing modal scrolling and the shared keyboard implementation are retained.

## Validation

- TypeScript: passed (`npm run typecheck`).
- Complete unit suite: **811 tests / 81 files passed**, including **25 new recipe-storage tests**.
- Mobile WebKit: **37 distinct tests passed across focused runs**. Final changed feature suite: 7/7. Other runs covered Food Storage, inline ingredient creation, batch modal visibility, gram precision and future meals.
- Widths: 320, 375, 390 and 430 px; Chinese/English responsive checks included. Modal tests include simulated standalone viewport/keyboard changes.
- Production Pages build: passed with `APP_BASE=/BetterLumi/`.
- PWA generation: passed, 120 precache entries; manifest scope/start URL remain `/BetterLumi/`.
- Existing chunk-size and static/dynamic import warnings remain non-fatal. No dependency or deployment configuration changes were made.
- Initial development-server WebKit attempts interrupted by source hot reload were rerun successfully with stable source. No skipped assertions are counted as passing.

Screenshots (synthetic data in isolated browser test contexts):

- `work/recipe-storage-integration/screenshots/direct-meal-390.png`
- `work/recipe-storage-integration/screenshots/mixed-batch-390.png`
- `work/recipe-storage-integration/screenshots/leftovers-390.png`

## Manual iPhone acceptance

1. Save a recipe with 200 g of stored sauce plus Pantry pasta; verify source stock is unchanged.
2. Log servings at 50% consumption, verify preview and exact stock deductions, reopen and delete; verify the original sources are restored.
3. Archive/exhaust the original sauce and explicitly choose a replacement. Verify the recipe template and old meals do not change.
4. Copy the mixed recipe into Make a Batch, measure cooked yield and save. Verify source stock changes once.
5. Save a mixed-recipe meal with leftovers. Change the initial split before downstream use, then consume some leftovers and confirm automatic origin sync/delete is blocked. Explicit meal-only actions must preserve all inventory.
6. Repeat in iPhone Safari and installed PWA with keyboard open, source-picker cancellation and long forms. Native keyboard and PWA lifecycle behavior still require real-device confirmation.

No real production browser data was read, modified, cleared or claimed to be backed up. The unrelated `src/editorial-directories.css` modification remains byte-for-byte preserved and outside this task.

## Exact task file list

- `docs/recipe-storage-integration.md`
- `src/FoodStorage.tsx`
- `src/Meals.tsx`
- `src/RecipeDetail.tsx`
- `src/RecipeLineEditor.tsx`
- `src/StoredFoodPicker.tsx`
- `src/ai-meal-import.test.ts`
- `src/ai-meal-storage.test.ts`
- `src/built-in-foods-phase2b.test.ts`
- `src/built-in-recipes.test.ts`
- `src/calculator-goals.test.ts`
- `src/domain.ts`
- `src/everyday-foods.test.ts`
- `src/exercise-plans.test.ts`
- `src/food-storage-backup.test.ts`
- `src/food-storage-locale.ts`
- `src/food-storage-model.ts`
- `src/food-storage.css`
- `src/food-storage.ts`
- `src/household-units.test.ts`
- `src/ingredient-nutrition.test.ts`
- `src/ingredient-preferences.test.ts`
- `src/ingredient-tag-order.test.ts`
- `src/ingredient-tags.test.ts`
- `src/interactive-planner-goals.test.ts`
- `src/macro-planner-goals.test.ts`
- `src/natural-foods.test.ts`
- `src/professional-guidance.test.ts`
- `src/recipe-storage.test.ts`
- `src/recipe-storage.ts`
- `src/reference-library.test.ts`
- `src/section-goals.test.ts`
- `src/sticky-notes.test.ts`
- `src/update.test.ts`
- `tests/food-storage-ui.spec.ts`
- `tests/recipe-storage.spec.ts`

36 task files. Twenty existing unit test files change only the expected current export version from 10 to 11; their data-preservation assertions are retained. The Food Storage backup test also updates the export version and round-trip test name.
