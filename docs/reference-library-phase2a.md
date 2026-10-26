# Built-in food reference library — Phase 2A

Phase 2B subsequently adds eleven separately sourced foods; see
[reference-library-phase2b.md](reference-library-phase2b.md). The twelve records
documented below keep their original Phase 2A nutrition values.

## Dataset and source policy

The static `src/data/builtInFoods.ts` catalog now contains exactly twelve supplied
USDA FoodData Central Foundation Foods references: Broccoli, Carrot, Spinach,
Roma Tomato, Cucumber, Banana, Gala Apple, Strawberry, Blueberry, Egg, Whole Milk,
and Plain Whole-Milk Greek Yogurt.

The supplied reference release is April 30, 2026; every record stores the requested
`sourceRelease: 'April 2026'`, original USDA description, NDB reference number,
FDC snapshot identifier and official FoodData Central NDB search URL. The source
panel identifies NDB as the reference identifier; the FDC snapshot stays in static
metadata. Data has been transcribed from the supplied dataset, not independently
researched or inferred. No additional foods, exercises or MET values were added.

All four nutrition values retain their full supplied precision per 100 g edible
portion. Calories are never recomputed from macros. Only normal UI summaries round
to whole kcal and one decimal for macros. Milk also uses grams, not milliliters:
no density or serving conversion was supplied.

## Existing architecture and history

The Phase 1 architecture is retained. IDs use the exact supplied `builtin-…`
strings; the existing food ID type also accepts the earlier reserved namespace.
Localized preparation-state fields and the original USDA description extend the
static reference type only. Existing default-tag IDs associate the three supplied
categories with their static tags.

The shared ingredient picker composes personal foods first, then static references.
It searches both languages, original USDA descriptions and bilingual default tags,
with an AND-combined active tag filter. Raw/preparation state and category are
visible in ordinary results, alongside the existing built-in badge and compact
source panel. Selected foods also retain visible preparation information in the
meal and recipe editors. There is no copy/save-to-personal-foods action.

Selecting a reference reuses the existing gram quantity workflow and snapshot
persistence. Logged meals retain final/base nutrition; recipe lines retain detached
nutrition objects. Editing their quantities scales their saved snapshots rather
than looking up revised reference values. A browser test simulates a subsequent
catalog revision and verifies that existing meals and recipes retain their original
nutrition, including when quantities are edited.

There are no new IndexedDB writes on reference loading, searching, filtering or
source inspection. Only explicit meal/recipe saving writes that user-requested
snapshot. No built-in food is inserted into an IndexedDB table or personal Pantry.
Database identity, schema/version 6, backup format/version 9 and existing user data
are unchanged. No user database/browser profile was opened during validation.
The separate public snapshot repository was not modified.

## Files changed in Phase 2A

- Dataset/type: `src/data/builtInFoods.ts`.
- Search and display helpers: `src/reference-library.ts`.
- Picker, selected preparation labels and source UI: `src/IngredientPicker.tsx`,
  `src/Meals.tsx`, `src/RecipeLineEditor.tsx`, `src/ReferenceSourceInfo.tsx`,
  `src/reference-locale.ts`, `src/reference-library.css`.
- New coverage: `src/built-in-foods.test.ts`, `tests/built-in-foods.spec.ts`.
- Existing coverage adapted for a nonempty food catalog:
  `src/reference-library.test.ts`, `tests/reference-library.spec.ts`,
  `tests/ingredient-tags.spec.ts`, `tests/unit-defaults.spec.ts`,
  `playwright.reference.config.ts`.
- This document and a forward link in `docs/reference-library-phase1.md`.
  Earlier Phase 1 changes already present in the working tree are
  preserved; they are not additional Phase 2A architectural changes.

## Validation

- TypeScript validation passed.
- Unit suite: 48 files, 350 tests passed.
- Browser suite: 25 tests passed, plus one additional snapshot-revision test passed
  (26 total). Coverage includes Chinese/English 390px and 430px, existing 320px and
  desktop regression cases, source controls, both searches, preparation labels,
  tag filtering, user food/unit behavior, no seeding/copying, record preservation,
  saved snapshots and refresh persistence. Browser tests use isolated Chromium
  contexts at the test origin on port 5190, never the real development profile.
- Production build passed with the existing large-chunk advisory.
- The optional code audit reports no missing translations. It still exits nonzero
  for the three pre-existing unreachable OCR compatibility modules; those unrelated
  modules were not changed or removed in this task.

Physical iPhone Safari has not been exercised; mobile Chromium touch/viewport checks
are not a substitute for an actual device. No Phase 2B data or exercise/MET work is
included.
