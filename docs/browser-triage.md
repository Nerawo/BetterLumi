# Browser failure triage and targeted repair

Completed October 26, 2026. This is targeted browser-test repair, not a new full release validation or release approval.

## Outcome

The historical release run remains **220 passed, 225 failed, 4 skipped**; its touch diagnostic remains **4 passed, 23 failed**. Those results are preserved in [publication validation](publication-validation.md).

After repair, the latest targeted result for every current case in the 52 affected development-browser files is **259 passed, 0 failed**. The production-only preview case passed separately (**1 passed**). The six affected touch families passed together (**27 passed, 0 failed, 0 flaky**). Touch cases overlap development cases and must not be added as new unique tests. Every previously failing file was covered. Replaced titles/workflows are counted using current test discovery, not by adding obsolete and replacement cases together.

The current default browser configuration discovers 448 development cases; the remaining production-only case runs separately. We did not rerun all browser cases, the 450 unit tests, the production build, or the 60 production smoke checks during this repair. Their earlier results are not new validation results. No known failure remains in the repaired families; untouched families and interactions between the entire suite still require one final full validation.

## Root-cause families

Counts below assign each of the original 225 first failures to one primary family. They are approximate: shared navigation, fixtures and touch setup often caused downstream failures in several families.

| Primary family | Approximate original failures | Classification | Repair / recommendation |
| --- | ---: | --- | --- |
| Combined static/user catalogs, fixed counts and tag/category management | 42 | A: outdated expectations | Assert the combined visible catalog, read-only built-ins, ordered management rows, source controls and independent user records. Derive composition counts from static catalogs; retain precise filtering/persistence checks. |
| Goals, Calculator, history, date limits and reporting frequency | 63 | A, with setup/timing issues | Enter the current-goals editor explicitly; assert target fields, section-wide frequency, optional dates, current popovers, saves returning to read-only goals, and retained historical versions. |
| Today navigation, hidden panels, plan management and record associations | 66 | A/C | Scope interactions to the selected panel; ToDos belong to Goals. Use the current plan recurrence/menu structure and persistence association API for simulated concurrent actual records. Verify selected-date versus global-latest weight independently. |
| Overview empty states, macro rings and weekly labels | 28 | A | Assert the current gentle empty-state content and visible empty rings; retain populated progress and known/missing nutrient coverage. Remove obsolete requirements that empty and populated panels have identical heights. |
| Ingredient pickers, recipe servings, exercise forms and retired OCR controls | 19 | A/C | Use searchable pickers and current preset/custom workflows. Test legacy photo/recognition preservation without restoring removed OCR controls. Recipe detail defaults to one serving; assert scaled display separately from original stored quantities. Repair malformed ingredient fixtures. |
| Editorial toolbar/theme and layout baselines | 5 | A | Assert current alignment, overflow, touch usability and responsive structure rather than retired wrappers or fixed coordinates. |
| Production-only no-HMR check run against Vite development | 1 | C: environment | Exclude this case from the default development run and explicitly include it in the dedicated production-preview configuration. |
| Fractional browser measurement at a 44 px touch boundary | 1 | C: measurement precision | Allow subpixel measurement tolerance (43.99 px), without reducing the intended touch target. |

No confirmed category-B production regression required an application change. Failures that initially resembled data bugs were investigated rather than patched in application code:

- Weight deletion completed correctly; the following test action targeted ToDos in an inactive panel. Selecting Goals resolved the failure and deletion/fallback behavior remained asserted.
- A concurrent exercise fixture inserted a matching record ID without the occurrence association used by the real save flow. Using the existing persistence API reproduced a genuine concurrent save, which the editor correctly rejects without overwriting the other record.
- A Pantry fixture omitted required brand data and used the wrong nutrition shape. Repairing the fictional fixture removed the failure; production storage was unchanged.
- A recipe test expected the whole-recipe 100 g quantity in the default one-serving view of a two-serving recipe. It now expects 50 g while separately verifying that the original stored line remains 100 g after meal logging.

## Touch and infrastructure

The original touch failures were primarily obsolete selectors/workflows plus suites invoking tap without enabling touch. No hover-only product defect was confirmed. The affected suites explicitly enable touch; the desktop drag-ordering case intentionally retains desktop input. The combined rerun covered goals/tolerance popovers, draft restoration, category creation/retry, tag management, sorting and Today navigation.

The default server configuration uses a configurable isolated test port, strict port binding and no accidental reuse of another checkout's server. A deliberately supplied external test server can be selected explicitly. Persistent-browser tests resolve URLs from the configured base URL instead of a hard-coded port. Tests wait for completed saves/modal closure before reload. Ordinary application development remains on its existing port.

Targeted runs used isolated development and production-preview servers and fresh test contexts. The production preview verified no HMR client, no visibility-triggered remount/reload after 21 seconds, retained draft input, and refresh restoration of selected tab/date and draft. Browser emulation does not certify physical iPhone Safari/PWA keyboard, OS eviction or safe-area behavior; those remain manual checks.

## Changed files

Only browser tests, browser configuration and this reporting documentation changed in this triage. Shared helper [current-ui.ts](../tests/current-ui.ts) centralizes current Goals editing and ingredient-picker interactions. Configuration changes are in [playwright.config.ts](../playwright.config.ts) and [playwright.goal-preview.config.ts](../playwright.goal-preview.config.ts).

The following 53 existing browser-test files changed (compared with the pre-triage checkpoint):

- [compact-directories-modals.spec.ts](../tests/compact-directories-modals.spec.ts)
- [compact-exercise-pantry.spec.ts](../tests/compact-exercise-pantry.spec.ts)
- [consolidated.spec.ts](../tests/consolidated.spec.ts)
- [consumption-units.spec.ts](../tests/consumption-units.spec.ts)
- [coordinated-phases.spec.ts](../tests/coordinated-phases.spec.ts)
- [cross-page-editorial.spec.ts](../tests/cross-page-editorial.spec.ts)
- [daily-macro-editor.spec.ts](../tests/daily-macro-editor.spec.ts)
- [editorial-directories.spec.ts](../tests/editorial-directories.spec.ts)
- [editorial.spec.ts](../tests/editorial.spec.ts)
- [exercise-recipe-workflow.spec.ts](../tests/exercise-recipe-workflow.spec.ts)
- [final-consistency.spec.ts](../tests/final-consistency.spec.ts)
- [focused-improvements.spec.ts](../tests/focused-improvements.spec.ts)
- [focused-today.spec.ts](../tests/focused-today.spec.ts)
- [goal-macro-layout.spec.ts](../tests/goal-macro-layout.spec.ts)
- [goal-masters.spec.ts](../tests/goal-masters.spec.ts)
- [goal-periods.spec.ts](../tests/goal-periods.spec.ts)
- [goal-preview.spec.ts](../tests/goal-preview.spec.ts)
- [goal-toggles-plans.spec.ts](../tests/goal-toggles-plans.spec.ts)
- [goal-tolerances.spec.ts](../tests/goal-tolerances.spec.ts)
- [goal-ui-state.spec.ts](../tests/goal-ui-state.spec.ts)
- [graphic-today.spec.ts](../tests/graphic-today.spec.ts)
- [health-calculator.spec.ts](../tests/health-calculator.spec.ts)
- [homepage.spec.ts](../tests/homepage.spec.ts)
- [ingredient-tag-management.spec.ts](../tests/ingredient-tag-management.spec.ts)
- [ingredient-tags.spec.ts](../tests/ingredient-tags.spec.ts)
- [macro-ring-states.spec.ts](../tests/macro-ring-states.spec.ts)
- [mobile-compact.spec.ts](../tests/mobile-compact.spec.ts)
- [more-history.spec.ts](../tests/more-history.spec.ts)
- [numeric-inputs.spec.ts](../tests/numeric-inputs.spec.ts)
- [numeric-planner-polish.spec.ts](../tests/numeric-planner-polish.spec.ts)
- [nutrition-summary.spec.ts](../tests/nutrition-summary.spec.ts)
- [overview-levels.spec.ts](../tests/overview-levels.spec.ts)
- [pantry-reference.spec.ts](../tests/pantry-reference.spec.ts)
- [pantry-row-layout.spec.ts](../tests/pantry-row-layout.spec.ts)
- [recipe-category-create.spec.ts](../tests/recipe-category-create.spec.ts)
- [recipe-compact.spec.ts](../tests/recipe-compact.spec.ts)
- [reference-library.spec.ts](../tests/reference-library.spec.ts)
- [refinement.spec.ts](../tests/refinement.spec.ts)
- [refinements.spec.ts](../tests/refinements.spec.ts)
- [review.spec.ts](../tests/review.spec.ts)
- [rings-ocr.spec.ts](../tests/rings-ocr.spec.ts)
- [section-goals.spec.ts](../tests/section-goals.spec.ts)
- [today-coordinated.spec.ts](../tests/today-coordinated.spec.ts)
- [today-four-fixes.spec.ts](../tests/today-four-fixes.spec.ts)
- [today-hierarchy.spec.ts](../tests/today-hierarchy.spec.ts)
- [today-plan-supplement-ui.spec.ts](../tests/today-plan-supplement-ui.spec.ts)
- [today-polish.spec.ts](../tests/today-polish.spec.ts)
- [today-refinement.spec.ts](../tests/today-refinement.spec.ts)
- [today-tabs.spec.ts](../tests/today-tabs.spec.ts)
- [unified-collections.spec.ts](../tests/unified-collections.spec.ts)
- [unified-overview-delete.spec.ts](../tests/unified-overview-delete.spec.ts)
- [update.spec.ts](../tests/update.spec.ts)
- [weekly-inline-calendar.spec.ts](../tests/weekly-inline-calendar.spec.ts)

Assertions still verify functional outcomes, persisted values, data independence, historical versions, selected-date behavior and overflow/accessibility where relevant. Retired UI requirements were replaced with current product contracts, not restored in the application.

## Data and source safety

All 319 application-source/static-asset entries match the pre-triage development source manifest. The private development manifest also has no file mismatch and its HEAD is unchanged. Apparent application-source changes relative to the older public Git commit belong to the earlier publication sync, not this repair. No production source code was changed to satisfy a browser assertion.

IndexedDB identity/schema remain BetterLumi / **6**; primary backup format remains **9**. No migrations, formula changes, historical snapshot rewrites or real-user database operations were performed. Fixtures run in isolated test storage only. Generated reports, browser profiles and screenshots remain in ignored work directories. No final release commit, push or deployment was created.

## Recommended next gate

Recommend one final complete release validation of the exact candidate tree: TypeScript, unit suite, production build, complete development browser suite, dedicated production-preview tests and touch coverage. Do not count production-only tests as skipped development tests. Preserve report artifacts privately and review any newly exposed interaction/isolation failures. Then review publication privacy/staging and physical iPhone Safari/PWA behavior before an explicitly approved release commit or upload.
