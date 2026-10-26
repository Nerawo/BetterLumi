# Combined Pantry reference browsing

Pantry previously called the personal-only `filterIngredients` function and rendered
only IndexedDB ingredients. The static library was already available in the shared
picker/search flow, but Pantry did not compose it into its own list or result count.

`src/Pantry.tsx` now derives its visible list with the existing `searchFoodChoices`
function, then sorts a copy using `src/pantry-foods.ts`. Static references and personal
ingredients share the same query/tag filter and visible count. With no personal
foods, Vegetables shows five entries, Fruits four, and Dairy & Eggs three. Empty
messaging appears only when the composed result set is empty.

Built-in rows display localized names, preparation state, category, existing
BetterLumi badge/source dialog, and rounded nutrition summaries. They never receive
the personal food editor/delete handlers. Personal rows retain their names, brands,
aliases, recorded nutrition basis and existing actions, with a quiet tag/My Food
source line. Sorting uses localized names or the existing recorded calorie basis;
unknown calories stay last in either direction. Neither input list is mutated.

No changes were made to the static food dataset, IndexedDB schema, database identity,
backup format, existing records or history. No seeding/copy workflow was introduced.
Browsing, searching, filtering, sorting and opening source details perform no writes.
Only existing explicit personal-food edit/create/delete actions can save user changes.
The separate public snapshot repository was not modified.

Files for this focused follow-up:

- `src/Pantry.tsx`
- `src/pantry-foods.ts`
- `src/reference-library.css`
- `src/reference-locale.ts`
- `src/pantry-foods.test.ts`
- `tests/pantry-built-in-foods.spec.ts`
- `tests/reference-library.spec.ts`
- `tests/ingredient-tags.spec.ts`
- `tests/unified-collections.spec.ts`
- `playwright.reference.config.ts`
- This document.

Tests cover category totals, mixed-source counts/search, custom tags, sorting,
read-only reference rows, source controls, empty results, unchanged database exports
and refresh persistence. Browser checks use isolated test contexts on port 5190,
including Chinese/English mobile and desktop layouts; no real user browser profile
or persistent database is accessed. Physical iPhone Safari still requires device QA.

Validation: TypeScript passed; 49 unit-test files / 357 tests passed; 29 relevant
browser cases passed across the main run and focused reruns after correcting old
personal-only count assumptions and test fixtures. Production build passed with
the existing large-chunk advisory. The optional code audit has no missing
translations; its three pre-existing unreachable OCR compatibility modules remain
unchanged.
