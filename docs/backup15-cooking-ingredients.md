# Cooking preparation ingredients — Backup 15

## Persistence

IndexedDB stays at Schema 7, database `BetterLumi`. No stores, indexes or migration
callbacks are added. Backup 15 accepts the previously supported valid formats 2–14.
Existing recipes, meals, batches and historical snapshots are not bulk rewritten.

Cooking Session v3 extends the existing settings value at
`cooking-session:v1:<recipeId>`. Existing v1/v2 sessions remain readable. A session
becomes v3 only when the user adds or removes a preparation ingredient.

```ts
ingredientChanges: {
  addedLines: { entryId: string; line: RecipeLine; servings: number }[];
  removedEntries: { entryId: string; fingerprint: string }[];
}
```

Original `entries` remain the saved-recipe identity mapping. Added lines carry a
unique stable identity, frozen source/nutrition snapshot, fixed unit and explicit
yield basis. A removal references an original identity and fingerprint. Removing
an added line deletes its temporary snapshot rather than creating a tombstone.
Removal clears that line's checkmark and quantity override. Quantity zero remains
a present ingredient and is never used to represent removal.

Validation covers unique IDs, exact extension fields, finite nonnegative amounts,
positive serving bases, Pantry/batch source types, fixed units, nutrition, group
references, batch references and visible checked/override identities. Backups
labelled below 15 cannot contain v3 sessions. Invalid structures reject before
restore writes. Stale recipe revisions are reconciled only when opened.

## Effective preparation

The preparation is saved-recipe lines minus explicit removals plus temporary
lines, scaled to the current yield, then overlaid with valid absolute quantity
overrides. Existing line order is retained; additions retain their addition order
and appear in the ungrouped section by default. Existing grouped lines preserve
their groups. Renaming/reordering groups does not transfer or invalidate valid
line state. Replacement invalidates stale source associations.

Add to Meal and Make a Batch receive this detached effective recipe through the
existing workflows. Partial consumption, immutable meal/batch nutrition snapshots,
positive source allocations, zero-quantity rules, atomic deductions, inventory
returns, idempotency and rollback remain in the existing transaction services.
Browsing, adding, removing, checking and editing session quantities do not write
inventory or the recipe template.

Update Recipe still requires explicit confirmation. It normalizes effective
quantities to saved yield, keeps stable line/source/group identities, commits
recipe and session in one compare-and-swap transaction, and clears redundant
temporary changes. Remaining checkmarks and current effective amounts survive.
An empty preparation cannot become an empty saved recipe or be sent to meal/batch
creation. No inventory, meal or batch is written by Update Recipe or Method save.

Reset Preparation restores the current saved recipe, default yield and empty
checklist/overrides/set changes. Genuine exit abandons the session. Canceling a
nested meal/batch workflow returns to the same preparation.

## Interaction and verification

The heading plus reuses IngredientPicker (including custom creation, search and
tags) and StoredFoodPicker. Method editing remains available independently. A
650 ms name/row hold requests removal; movement over 10 px, scrolling and pointer
cancellation abort the gesture. Quantity and checkbox controls are excluded.
Right-click, Shift+F10, Context Menu and Delete provide desktop/keyboard access
without persistent row controls.

Regression coverage is in `src/cooking-ingredients.test.ts` and
`tests/cooking-ingredients.spec.ts`, alongside existing cooking-session, recipe,
meal, storage and backup suites. Browser coverage uses isolated synthetic data,
320/375/390/430 px, Chinese/English and the four existing themes. Pointer simulation
does not replace physical iPhone verification of native long press and scrolling.
