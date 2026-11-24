# Reference-based Cooking Journal refinement

Local only. No commit, push, deployment or user data modification.

## Final presentation

- Uppercase COOKING JOURNAL label (11px), one left-aligned 30px editorial-serif recipe title and existing accessible close action.
- Compact precise yield stepper without an underline, progress on the same row when space permits, original yield retained as small supporting information; a rule separates controls from the journal.
- 52/48 Method/Ingredients columns with a continuous divider, top aligned; 320px retains the readable stacked fallback. Section headings stay English in Chinese mode as requested.
- 21px medium section headings, stronger theme-aware irregular highlights; 14px semibold group labels on rectangular theme surfaces.
- 14px readable instructions; original step prefixes receive muted accent styling. No text is rewritten and no step titles are guessed.
- Circular 18px native-semantic checkbox inputs with visible keyboard focus, 14px ingredient names and 12px quantities on a separate line. Checked rows retain readable quantities.
- Existing platform UI font fallbacks are scoped to the three recipe journal dialogs to achieve a firmer reference-like face. Existing serif recipe titles remain; no global font, theme or Today change.
- Footer reset aligns left; Finish aligns right with a 5px-radius primary button.
- Recipe Detail and Create/Edit keep the grouped layout, direct group-specific ingredient creation, existing references and all actions. Group headings/readability share the revised hierarchy.

## Display precision

journalQuantity() formats grams to at most one decimal in Cooking Mode and Recipe Detail; positive values that would round to zero display <0.1 g. Other units retain meaningful numeric precision, including small original-batch percentages. This formatter never feeds calculations, input values, sessions, snapshots or inventory transactions.

## Structured step title audit — not implemented

Recipe.instructions is currently a plain string. Independent editable step headings require an optional ordered field such as instructionSteps?: {id, title?: string, text: string}[], with explicit user opt-in and no automatic conversion of existing instructions. Recommend a separately approved Backup 13 validation/version gate while retaining Schema 7 and legacy plain-text fallback. No such extension, persistence field or conversion was implemented here. Visual refinement proceeds independently, as requested.

## Verification

- TypeScript: PASS.
- 53 relevant unit tests: PASS (cooking sessions, journal text preservation, gram display, source inventory safety).
- 18 targeted mobile WebKit cases: PASS. Final scoped-font adjustment additionally reran all 9 visual cases: PASS.
- Widths 320/375/390/430px, Chinese/English, four themes, grouped source selection and inline creation, precise stepper/reset confirmation, checklist persistence, long content and viewport resizing covered.
- Production build/PWA: PASS, 123 precache entries; existing non-fatal chunk warnings remain.
- Preserved Schema 7, Backup 12, recipe/line IDs, sessions and reconciliation, nutrition scaling, historical snapshots, inventory services, wake lock and shared keyboard handling.
- Unrelated editorial-directories.css remains byte-identical: SHA256 8630e4c0ad3d8705c53ae0f0d961e595e4cca60c76275f0e58a7818642b9ce85.

## Changes for this refinement (Phase 1/2 work remains local)

- src/CookingMode.tsx
- src/RecipeDetail.tsx
- src/cooking-journal.css
- src/cooking-journal-locale.ts
- src/journal-quantity.ts
- src/journal-quantity.test.ts
- tests/cooking-journal-visual.spec.ts
- docs/cooking-journal-reference-refinement.md

## Native-scale screenshots

- work/screenshots/journal-reference-unchecked-390.png
- work/screenshots/journal-reference-unchecked-320.png
- work/screenshots/journal-reference-checked-390.png
- work/screenshots/journal-reference-lavender-390.png
- work/screenshots/journal-reference-detail-390.png
- work/screenshots/journal-reference-editor-pastry-390.png
- work/screenshots/journal-reference-editor-custard-390.png

## Deviations / acceptance

Structured step titles await separate persistence approval; plain user-authored instructions stay exact. 320px stacks rather than cramping the two columns. The original recipe yield remains as small supporting information. Existing egg-tart sample quantities/nutrition were preserved instead of changing them to match the reference illustration. Title typography retains BetterLumi's serif. All screenshots use isolated sample records, never real recipes. Real iPhone Safari/PWA keyboard, OS suspension and hardware wake-lock behavior still require native acceptance.
