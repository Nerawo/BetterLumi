# Ingredient tags and searchable recipe ingredients

## Storage and compatibility

- Dexie schema version 6 adds only `ingredientTags` (`id,name,updatedAt,deletedAt`). Existing tables and records are unchanged during upgrade.
- Ingredients optionally store `tagIds: string[]`. Missing arrays mean no tags. Recipe categories remain an independent collection.
- Names use the existing category normalization rule (trim and collapse whitespace), with case-insensitive duplicate checks. User names are displayed verbatim and never translated.
- Tag renaming keeps the stable ID. Deletion soft-deletes the definition and removes only its ingredient associations in one transaction. Saving an ingredient filters out missing/deleted tag IDs, including stale form selections.

## JSON backups

- Main backup version is now 6. Export includes tag definitions and ingredient `tagIds`.
- Restore continues accepting versions 2 through 5; absent tag definitions default to an empty collection. The existing version-1 helper format also supports an optional `ingredientTags` table and accepts old files without it.
- Restore validates tag names/metadata, rejects duplicate active names and malformed associations before writing, deduplicates tag IDs, and removes references to missing/deleted definitions. Validation works on a clone of the imported data.
- Restore retains its existing replace-from-backup behavior; no automatic reset or rewrite is performed during normal startup or migration.

## UI

Pantry navigation and the recipe ingredient picker share the same tag collection and AND-combined name/alias/brand search. Add/edit ingredient forms open the same tag manager without unmounting their draft fields. Newly created tags are selected only for that draft. Recipe add and replacement share one picker; its results scroll independently while search/cancel remain accessible. Quantity edits preserve existing nutrition snapshots; explicit unit switches retain the existing convenient defaults.

## Validation

151 unit tests cover additive migration, backup compatibility/reconciliation, tag lifecycle, search, nutrition, and existing goal/exercise behavior. Browser tests exercise Chinese/English at 320/390/430 px in Chrome and WebKit, including safe isolated backup restore, custom units, numeric clearing, drafts, and long lists. Physical iPhone keyboard/Safari behavior still requires device testing.

## Unified management and saved order

Recipes, Pantry and the ingredient picker now use CollectionNavigation: fixed All, independently scrolling saved-order pills, and only one management button (none in the picker). NamedCollectionManager provides creation, inline rename, confirmed delete, desktop drag handles and keyboard/touch-friendly move buttons.

Optional sortOrder is stored on recipeCategories and ingredientTags records. No IndexedDB migration or backup format bump is needed: both remain version 6. Old records without metadata retain their previous primary-key order; new records append after them. Manual reordering writes positions transactionally. Renaming reads the current record so stale edit objects cannot overwrite its order. Import validates nonnegative finite ordering metadata before writing.

Search matches associated active tag/category names as well as the existing text fields, and combines with the active single-tag/category filter. Recipe search does not inspect ingredient tags.
