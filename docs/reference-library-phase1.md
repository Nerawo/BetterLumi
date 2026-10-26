# Built-in reference library — Phase 1

This document records the completed Phase 1 baseline. Phase 2A now supplies twelve
foods; see [reference-library-phase2a.md](reference-library-phase2a.md) for the current
dataset, ID extensions and validation. The exercise catalog remains empty.

## Static data boundary

src/data/builtInFoods.ts and builtInExercises.ts define readonly reference types and intentionally empty frozen arrays. No foods, nutrition values, MET values or exercise calorie formula are supplied. IDs use distinct betterlumi:food: and betterlumi:exercise: namespaces. Source fields are explicit metadata, not implicit claims about a provider.

src/data/builtInTags.ts provides nine bilingual static ingredient tags with stable betterlumi:ingredient-tag: IDs. They are composed with custom tags only for display/filtering/assignment, never seeded into IndexedDB. Custom names remain exactly user-entered; localization applies only to built-in labels. The tag manager continues editing/reordering custom records only, preserving their existing order and associations. Default IDs are independent of translated names.

Assigning a default tag explicitly saves its ID in the existing ingredient tagIds field. Existing records are never automatically classified, renamed or modified. putTaggedIngredient and backup reconciliation recognize static default IDs, so user-chosen associations survive roundtrip without exporting or inserting static tag rows. Older backups without tags remain accepted. Database version 6, backup version 9, identity, origin and migrations are unchanged.

## UI integration

The shared ingredient picker composes personal and future built-in foods with AND-combined query/tag filtering. Future reference rows use the BetterLumi Built-in badge and a separate accessible source-info action. The compact shared modal displays only provided attribution fields and an HTTPS source link. It supports Escape, close/backdrop dismissal, focus return and mobile viewport scrolling. It contains no save-to-personal-foods action.

Recipe ingredient selection/replacement accepts reference entries without creating Pantry records. Meal selection has the same picker integration ready when a future nonempty built-in dataset is supplied; with the empty Phase 1 dataset, the existing saved-ingredient selector remains unchanged. Reference foods use grams only until a later dataset/conversion specification supports anything else. Unknown nutrients remain null; existing nutrition scaling is reused, with no placeholder numbers.

The exercise editor has a preset selector that renders only when the reference dataset is nonempty. Selecting a future preset copies its localized name into the existing form. Duration and kcal remain manually editable. No MET or expenditure formula runs; no preset is seeded or auto-saved. Custom exercise creation, editing and plan linking retain the existing persistence path.

## History contracts

RecipeLine already stores name, quantity, unit and a separate nutrition object. FoodLog stores final consumed nutrition plus the existing base nutrition snapshot. New reference selection creates a detached line/nutrition object using the existing shape, not a personal ingredient. Editing recorded quantities scales saved values; display/history do not look up current reference nutrition. Exercise records already store the saved name, duration and final caloriesBurned. Library updates must never trigger writes or recompute historical records. Future dataset phases should validate releases and may add optional provenance snapshots through an explicitly reviewed compatibility change.

## Validation scope

Architecture tests cover nine default labels and stable IDs, unchanged custom names, empty datasets, no seeding/writes on composition, explicit association backup roundtrip, older backups and safe source URLs. Browser cases use isolated test contexts and fictional manual entries with unknown nutrition, covering bilingual mobile layouts, custom tag management, empty food/exercise datasets, source information, unchanged existing records, and existing quantity-unit behavior. No real browser profile or user database is opened.

This implementation is in the development repository. The previously prepared independent public snapshot is intentionally unchanged; publication and reference dataset population are separate tasks.

## Completed checks

TypeScript passed; 47 unit-test files / 324 tests passed. Nineteen relevant browser cases passed across the full run and source-dialog rerun, including Chinese/English, 320/390/430px and selected desktop coverage. Production build passed with the existing large-chunk advisory. Code audit retains only the same three pre-existing unreachable OCR compatibility modules; no missing literal translations were reported. Physical iPhone Safari remains a manual device check.

## Files added and modified

Added:
- Static types/catalogs: src/data/builtInFoods.ts, src/data/builtInExercises.ts, src/data/builtInTags.ts.
- Shared architecture and UI: src/reference-library.ts, src/reference-locale.ts, src/reference-library.css, src/ReferenceSourceInfo.tsx, src/BuiltInExerciseSelector.tsx.
- Tests/configuration: src/reference-library.test.ts, tests/reference-library.spec.ts, playwright.reference.config.ts.
- Documentation: docs/reference-library-phase1.md.

Modified:
- Existing food/exercise UI: src/Activity.tsx, src/IngredientPicker.tsx, src/IngredientTags.tsx, src/Meals.tsx, src/RecipeLineEditor.tsx.
- Shared navigation/modal/read-only name matching: src/CollectionNavigation.tsx, src/ui.tsx, src/collection-order.ts.
- Existing tag assignment/import reconciliation: src/ingredient-tags.ts, src/ingredient-tag-data.ts.
- Existing browser expectations for static default tags/current backup format: tests/ingredient-tags.spec.ts, tests/unified-collections.spec.ts.

No changes to src/db.ts or src/domain.ts, database schema, migrations, backup version, settings, or deployment configuration.
