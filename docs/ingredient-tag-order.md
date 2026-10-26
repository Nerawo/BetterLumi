# Unified ingredient tag management

Manage Tags now composes the nine existing static built-in definitions and active
custom tag records into one sortable list. `All` and toolbar management controls
are navigation items and are never included. Built-ins show their localized name
and BetterLumi indicator with drag/up/down controls; only custom tags have rename
and delete actions. The shared recipe-category manager retains its existing
behavior. On mobile, only the tag list scrolls; the modal header and create form
remain visible.

Ordering is a JSON array of stable IDs in the existing settings table under
`ingredientTagOrder`. Nothing is written merely by opening a manager or browsing.
An explicit reorder atomically updates this setting only: built-in definitions
are never copied into the custom tag table, and custom rows, revisions and food
associations are not rewritten to reorder them.

Without a saved preference, the current built-in order followed by the existing
custom `sortOrder`/legacy-ID order is preserved. Saved IDs are deduplicated and
matched against available tags. Deleted/unavailable IDs are ignored; newly
introduced built-ins and newly created custom tags append after the saved order.
Renaming preserves position because relationships use IDs. Malformed preference
values safely fall back to the default view without rewriting stored data.

Pantry navigation, ingredient assignment and the Recipe ingredient picker share
the same order hook and update reactively. Existing built-in/custom filtering,
search, food sorting and unsaved ingredient form behavior are preserved.

No schema migration or database identity change was needed. The existing version
9 JSON backup already includes settings, so the preference round-trips without
a format change. Older backups without the preference retain the default/legacy
order. No user database/browser profile was opened during implementation; tests
use fake IndexedDB or isolated browser contexts on port 5190.

Changed files:

- `src/ingredient-tag-order.ts`: stable-ID merging and transactional preference writes.
- `src/IngredientTags.tsx`: combined view, reactive order and guarded custom actions.
- `src/NamedCollectionManager.tsx`: generic view types, optional origin labels and
  conditional built-in protection; shared reorder interactions reused.
- `src/ingredient-tags-locale.ts`, `src/reference-library.css`: bilingual source
  labels and compact, internally scrollable manager layout.
- `src/ingredient-tag-order.test.ts`, `tests/ingredient-tag-management.spec.ts`:
  default/legacy ordering, mixed ordering, backup compatibility, record invariance,
  newly introduced tags, mobile controls/scrolling, filters and desktop dragging.
- `tests/reference-library.spec.ts`, `tests/unified-collections.spec.ts`,
  `playwright.reference.config.ts`: existing expectations and relevant coverage.

Food nutrition data, historical records, built-in reference definitions, the
IndexedDB schema/version 6, backup version 9 and the independent public snapshot
repository are unchanged. Physical iPhone Safari still requires device testing.

Validation: TypeScript passed; the full unit suite passed **51 files / 398 tests**.
All **44 relevant browser cases** passed across the five new manager cases and
39 existing reference/food/tag/recipe/mobile-layout regressions. Production build
passed with the existing large-chunk advisory. The optional code audit reports no
missing translations and retains only its three pre-existing unreachable OCR
compatibility modules. `git diff --check` passed.
