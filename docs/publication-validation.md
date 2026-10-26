# Publication validation — 22 October 2026

**NOT READY TO PUBLISH.** Source synchronization and the privacy review are complete, but the full browser validation gate is not passing. No final release-preparation commit, push, GitHub repository creation or deployment was performed.

## Scope and checkpoint

473 source/configuration/test/documentation/asset files were copied from the current development working tree using a Git-eligible file list. Publication-specific preparation documents were retained and updated separately. No development .git directory, commits, branches, tags, ignored work files, browser profiles, dependencies or build artifacts were copied.

A verified pre-sync public Git bundle was saved outside this repository. A SHA-256 manifest confirms that the development HEAD and all 475 candidate development files remained unchanged. All 473 copied files matched that manifest before the publication-only README clarification. Application source, data and tests have not been edited to conceal failures or restore retired UI behavior.

The public checkout still has one independent root commit, 918f042026b449a51ac9815760a787cc3b00f8af. Its main/origin refs point to that same commit; no private backup branches/tags or unreachable objects were found. Origin already targets Nerawo/BetterLumi. No network Git operation was performed. The synchronized changes are intentionally uncommitted because validation did not pass; the working tree is not clean and that old HEAD does not represent the updated application.

## Results

| Check | Result |
| --- | --- |
| Locked dependency installation | npm ci passed; lockfile unchanged |
| TypeScript | Passed |
| Full unit suite | 450 passed in 57 files |
| Full Playwright suite | 220 passed, 225 failed, 4 skipped; 449 cases in 91 files |
| Touch-enabled diagnostic rerun | 4 passed, 23 failed; 27 cases; separate from full-run totals |
| Production build | Passed |
| Production UI smoke | 60 checks passed across Chinese/English at 390/430px and English desktop at 1440px |
| Production offline recipe image | Passed at 390/430px after service-worker activation and reload |
| Production dependency advisory audit | No known vulnerabilities reported by npm audit --omit=dev at audit time |
| Candidate privacy/history pattern scan | No findings in 475 candidate files / 362 text files and the existing one-commit public history / 306 text files |
| Ignore guardrails | 18 sensitive/generated path examples excluded; static recipe image/source JSON remain eligible |

Browser validation used isolated Chrome contexts and the public checkout on test ports 5192/5194; production smoke used 5193. No everyday browser profile or port-5173 user storage was opened. Physical iPhone Safari, installed PWA behavior and the real software keyboard were not tested. Chromium mobile/touch emulation is not a substitute for device testing.

The four skipped full-run cases are opt-in LAN tests; no LAN host was supplied. The Windows sandbox prevented automatic server teardown after test execution. Only the two verified temporary public-checkout Vite servers were stopped to let reporters finish. Existing development processes were left untouched. Final reporter totals above are from completed runs, not the earlier test-list output or interrupted initial attempt.

Production smoke covered Today internal tabs, Pantry, Recipes, More, Exercise and Pantry editors, recipe details, document/modal overflow, image decoding and refresh. The built-in recipe image is present in dist and the service-worker precache. Compiled assets contain the food catalog, exercise codes and built-in recipe. Two fresh production test contexts retained zero ingredients, activities and recipeCards after browsing built-ins: no seed occurred.

## Browser failures: release blocker

Failures span 53 files. Many are demonstrably obsolete UI contracts; others still need individual investigation. They are not all proven harmless, and no blanket skip, deleted test or weakened assertion was used.

Concrete examples:

- compact-directories-modals expects four Pantry rows after inserting four fictional user foods; the current combined list correctly has 36 including 32 static foods.
- pantry-row-layout and unified-collections still expect 24 rows after one fictional user item; the current catalog produces 33. ingredient-tag-management expects an earlier default-category population.
- today-tabs expects five tabs ending in Other; the current app has Goals and Calculator as separate inline tabs.
- goal-tolerances, goal-ui-state and several old goal tests assume an editor is present immediately, before entering Edit Goals, or use removed min/max fields.
- consumption-units and recipe-compact still target retired native ingredient selectors. recipe-category-create uses an unscoped result selector which now matches 33 entries.
- Some touch tests failed before interaction because the default full-suite context lacks hasTouch. The explicit touch rerun removed that configuration obstacle, but 23 cases still failed on counts, retired selectors or old display expectations.
- Older exercise/overview tests assert a previous metric order, progress markup, optional-date layout or frequency behavior. Other timeouts and geometry failures require review rather than an assumption that the app is correct.

Current feature coverage did pass in the full run: active-goals-overview (12), built-in-exercises (5), built-in-foods (7), built-in-foods-phase2b (5), built-in-recipes (5), exercise-custom-mode (5), exercise-presets-phase3b (7), exercise-selector-cleanup (4), macro-planner (5), pantry-built-in-foods (3), recipe-display-cleanup (6), recipe-yield (4), weight-measurements (4) and weight-sync (8). These focused passes do not replace the failed release gate.

### Full-run failure inventory

| File | Failed cases |
| --- | ---: |
| [compact-directories-modals.spec.ts](../tests/compact-directories-modals.spec.ts) | 6 |
| [compact-exercise-pantry.spec.ts](../tests/compact-exercise-pantry.spec.ts) | 4 |
| [consolidated.spec.ts](../tests/consolidated.spec.ts) | 3 |
| [consumption-units.spec.ts](../tests/consumption-units.spec.ts) | 6 |
| [coordinated-phases.spec.ts](../tests/coordinated-phases.spec.ts) | 6 |
| [cross-page-editorial.spec.ts](../tests/cross-page-editorial.spec.ts) | 6 |
| [daily-macro-editor.spec.ts](../tests/daily-macro-editor.spec.ts) | 2 |
| [editorial-directories.spec.ts](../tests/editorial-directories.spec.ts) | 4 |
| [editorial.spec.ts](../tests/editorial.spec.ts) | 1 |
| [exercise-recipe-workflow.spec.ts](../tests/exercise-recipe-workflow.spec.ts) | 5 |
| [final-consistency.spec.ts](../tests/final-consistency.spec.ts) | 6 |
| [focused-improvements.spec.ts](../tests/focused-improvements.spec.ts) | 1 |
| [focused-today.spec.ts](../tests/focused-today.spec.ts) | 4 |
| [goal-macro-layout.spec.ts](../tests/goal-macro-layout.spec.ts) | 6 |
| [goal-masters.spec.ts](../tests/goal-masters.spec.ts) | 4 |
| [goal-periods.spec.ts](../tests/goal-periods.spec.ts) | 4 |
| [goal-preview.spec.ts](../tests/goal-preview.spec.ts) | 1 |
| [goal-toggles-plans.spec.ts](../tests/goal-toggles-plans.spec.ts) | 4 |
| [goal-tolerances.spec.ts](../tests/goal-tolerances.spec.ts) | 6 |
| [goal-ui-state.spec.ts](../tests/goal-ui-state.spec.ts) | 4 |
| [graphic-today.spec.ts](../tests/graphic-today.spec.ts) | 5 |
| [health-calculator.spec.ts](../tests/health-calculator.spec.ts) | 16 |
| [homepage.spec.ts](../tests/homepage.spec.ts) | 2 |
| [ingredient-tag-management.spec.ts](../tests/ingredient-tag-management.spec.ts) | 4 |
| [ingredient-tags.spec.ts](../tests/ingredient-tags.spec.ts) | 6 |
| [macro-ring-states.spec.ts](../tests/macro-ring-states.spec.ts) | 4 |
| [mobile-compact.spec.ts](../tests/mobile-compact.spec.ts) | 1 |
| [more-history.spec.ts](../tests/more-history.spec.ts) | 4 |
| [numeric-inputs.spec.ts](../tests/numeric-inputs.spec.ts) | 2 |
| [numeric-planner-polish.spec.ts](../tests/numeric-planner-polish.spec.ts) | 4 |
| [nutrition-summary.spec.ts](../tests/nutrition-summary.spec.ts) | 1 |
| [overview-levels.spec.ts](../tests/overview-levels.spec.ts) | 4 |
| [pantry-reference.spec.ts](../tests/pantry-reference.spec.ts) | 4 |
| [pantry-row-layout.spec.ts](../tests/pantry-row-layout.spec.ts) | 5 |
| [recipe-category-create.spec.ts](../tests/recipe-category-create.spec.ts) | 4 |
| [recipe-compact.spec.ts](../tests/recipe-compact.spec.ts) | 3 |
| [reference-library.spec.ts](../tests/reference-library.spec.ts) | 4 |
| [refinement.spec.ts](../tests/refinement.spec.ts) | 2 |
| [refinements.spec.ts](../tests/refinements.spec.ts) | 7 |
| [review.spec.ts](../tests/review.spec.ts) | 3 |
| [rings-ocr.spec.ts](../tests/rings-ocr.spec.ts) | 4 |
| [section-goals.spec.ts](../tests/section-goals.spec.ts) | 6 |
| [today-coordinated.spec.ts](../tests/today-coordinated.spec.ts) | 4 |
| [today-four-fixes.spec.ts](../tests/today-four-fixes.spec.ts) | 4 |
| [today-hierarchy.spec.ts](../tests/today-hierarchy.spec.ts) | 3 |
| [today-plan-supplement-ui.spec.ts](../tests/today-plan-supplement-ui.spec.ts) | 4 |
| [today-polish.spec.ts](../tests/today-polish.spec.ts) | 4 |
| [today-refinement.spec.ts](../tests/today-refinement.spec.ts) | 2 |
| [today-tabs.spec.ts](../tests/today-tabs.spec.ts) | 8 |
| [unified-collections.spec.ts](../tests/unified-collections.spec.ts) | 3 |
| [unified-overview-delete.spec.ts](../tests/unified-overview-delete.spec.ts) | 4 |
| [update.spec.ts](../tests/update.spec.ts) | 7 |
| [weekly-inline-calendar.spec.ts](../tests/weekly-inline-calendar.spec.ts) | 4 |

### Touch rerun failure inventory

| File | Failed cases |
| --- | ---: |
| [focused-improvements.spec.ts](../tests/focused-improvements.spec.ts) | 1 |
| [goal-tolerances.spec.ts](../tests/goal-tolerances.spec.ts) | 6 |
| [goal-ui-state.spec.ts](../tests/goal-ui-state.spec.ts) | 4 |
| [ingredient-tag-management.spec.ts](../tests/ingredient-tag-management.spec.ts) | 4 |
| [recipe-category-create.spec.ts](../tests/recipe-category-create.spec.ts) | 4 |
| [today-coordinated.spec.ts](../tests/today-coordinated.spec.ts) | 4 |

Detailed JSON, screenshots and error contexts are retained only in ignored work directories. They include machine-specific diagnostic paths and must not be force-added or uploaded. The completed JSON reports are work/work/release-browser-results.json and work/work/release-touch-results.json; the older work/release-browser-results.json is test-list output, not the final run.

## Privacy and data architecture

No common-format secret, known private measurement fixture, concrete private LAN address, personal Windows account path, browser authentication dump or complete user backup was found in the publication candidates or reachable public history. New reference JSON contains public USDA provenance, not a user export. The built-in recipe image contains no EXIF/XMP chunks; the supplied original photograph and local absolute path are not included. Existing design-reference images are mockups, not captured personal journals. Pattern scanning and inspection cannot guarantee the absence of every possible secret.

IndexedDB identity remains BetterLumi, schema version **6**. Primary backup format remains **9**, including existing backward compatibility. Publication preparation added no migration and changed no database/storage/origin behavior. Normal development remains port 5173. Actual wellness records stay in the user's browser, while transient page/draft state stays browser-local. Publishing source or building dist does not publish those stores. Exported backups can contain private wellness data and must stay outside Git.

32 foods, 15 exercise variants across seven categories, nine default ingredient tags and one built-in recipe remain static reference definitions. They are composed with user records for display without inserting reference records into IndexedDB. Meals retain nutrition snapshots; exercises retain final kcal/source snapshots. Goal versions and existing body/weight history were not edited. Tests used fictional data and fake IndexedDB or fresh browser contexts.

## Remaining work before a release commit

1. Reconcile the failed browser contracts with the current intended behavior, investigate residual functional failures, and rerun the complete release suite with correct touch configuration. Do not restore obsolete UI or relax persistence assertions merely to obtain green tests.
2. Once validation passes, review the staged publication files, repeat privacy/history checks, commit the exact tested tree and verify a clean working tree. No release commit exists yet.
3. Check physical iPhone Safari/PWA keyboard, scrolling and safe areas. Confirm image redistribution rights and choose a project license intentionally. Font license files remain included.
4. The build retains the known large-chunk advisory (main JavaScript about 786 kB uncompressed); npm ci also reports a deprecated transitive glob version. No dependency upgrade or unrelated refactor was made. The production audit result is not a full development-tool security assessment.
5. Deployment paths assume a domain root and SPA fallback/HTTPS. GitHub Pages repository-subpath deployment still needs separate configuration and validation. A new deployment origin has separate browser storage; any user-data transfer must be an explicit private backup/import.

In GitHub Desktop, add this existing local public checkout and review Changes only. Do not click Push origin or Publish until the browser gate is resolved and a final verified commit has been approved.


## Targeted browser repair follow-up — October 26, 2026

The historical results above are unchanged. [Browser triage and targeted repair](browser-triage.md) documents the root causes, all updated test files and validation scope. Latest targeted coverage: 259 development cases passed, the separate production-preview case passed, and the combined affected touch run passed 27/27. No application source, IndexedDB schema or backup format changed in this repair. All original failing files were covered; the complete release suite has not been rerun. One final full validation is recommended before any release commit or publication.
