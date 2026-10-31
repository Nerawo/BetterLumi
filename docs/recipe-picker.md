# Unified recipe picker

Local UI change only. No commit, push or deployment.

## Entry-point audit

- Add Meal → Saved Recipes (including existing meal editing): shared `RecipeSelection`, retaining `chooseRecipe`.
- Make a Batch → Copy from Recipe: same component, retaining the existing detached line-copy logic and From scratch option.
- AI food source matching already has unified searchable Pantry/Recipe results with different source-matching semantics. It is not a native recipe dropdown and remains unchanged.

The picker reuses `Modal`, `CollectionNavigation`, `orderedItems`, `categories` and `filterRecipes`. Categories retain their existing IDs, multiple memberships and order. All includes uncategorized and built-in recipes. Results are deduplicated by recipe ID. Search uses the same case-insensitive name/category matching as My Recipes.

Selecting invokes only the caller's original selection handler. Cancel leaves the selection/draft intact; focus returns to the trigger. The dialog is portaled outside the parent form and uses the existing modal viewport/keyboard behavior. No shared modal changes, persistence writes or inventory operations were added.

## Files changed for this task

- `src/RecipePicker.tsx` (new)
- `src/recipe-picker.css` (new)
- `src/Meals.tsx` (picker integration only; earlier recipe-storage changes retained)
- `src/FoodStorage.tsx` (picker integration only; earlier recipe-storage changes retained)
- `tests/recipe-picker.spec.ts` (new)
- `tests/recipe-picker-helper.ts` (new)
- `tests/batch-modal-visibility.spec.ts`
- `tests/food-storage-ui.spec.ts`
- `tests/future-meals.spec.ts`
- `tests/make-batch-ui.spec.ts`
- `tests/meal-consumption-unified.spec.ts`
- `tests/meal-portion-slider.spec.ts`
- `tests/meal-slider-alignment.spec.ts`
- `tests/recipe-compact.spec.ts`
- `tests/recipe-storage.spec.ts`
- `docs/recipe-picker.md` (this report)

Existing browser test changes replace native dropdown actions with a helper that uses the real picker. One selected-value assertion now checks the selected recipe name. Original nutrition, snapshot, inventory and draft assertions are retained.

## Verification

- TypeScript passed.
- 35 relevant unit tests passed: categories, recipe nutrition/sorting and mixed recipe storage transactions.
- 15 WebKit and 5 Chromium browser cases passed across focused runs: new picker, batch modal visibility, mixed recipes and meal percentage controls.
- Picker checks cover Chinese/English, 320/390 px, search/category combination, multiple memberships, uncategorized recipes, selection/cancel, date/meal preservation, Make a Batch, four live themes and reduced viewport/internal scrolling. Existing regressions also cover 375/430 px and desktop.
- Production build and PWA generation passed (120 precache entries). Existing bundle/import warnings remain non-fatal.

Schema 7, Backup 11, database identity, recipe/category records, inventory services and shared keyboard handling are unchanged by this task. All pre-existing uncommitted work was retained. `src/editorial-directories.css` retains its original SHA256 `8630e4c0ad3d8705c53ae0f0d961e595e4cca60c76275f0e58a7818642b9ce85`.

Native iPhone Safari/PWA keyboard animation and lifecycle behavior still require real-device acceptance; simulated WebKit viewport checks do not establish native verification.
