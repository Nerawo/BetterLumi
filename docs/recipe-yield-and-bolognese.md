# Recipe yield and first built-in recipe

## Stage A — validated before Stage B

The existing recipe.servings field is the canonical yield. Missing legacy values read as one without rewriting records. Full stored ingredient quantities remain the full batch. Cooking servings default to one and are temporary. Ingredient amounts and nutrition scale by cooking servings / canonical yield. The meal form independently asks for consumed servings, permits fractional values and empty editing buffers, and saves a copied ingredient/nutrition snapshot. Existing meal snapshots, including the historical whole-recipe unit, are not reinterpreted or recomputed from current references.

The recipe editor exposes yield while retaining existing ingredient, category, image and note workflows. Import accepts older recipes with a missing yield, rejects invalid explicit yield, and leaves the record unchanged. Stage A validation: 438 unit tests, three focused bilingual mobile/desktop browser tests and production build passed before adding the built-in recipe.

## Static reference recipe

Exactly one recipe is composed beside user recipes: Tagliatelle al Ragù Bolognese / 博洛尼亚肉酱宽面, canonical yield six. It is not inserted into recipeCards. Canonical editing, deletion, category assignment and copying from the meal editor are unavailable for this reference. Actual meal consumption is saved only after an explicit user action.

The ragù source is [Accademia Italiana della Cucina, 20 April 2023](https://www.accademiaitalianadellacucina.it/sites/default/files/Rag%C3%B9%20alla%20bolognese%20-%20ricetta%20aggiornata%2020%20aprile%202023.pdf). Pasta at 80 g dry per serving is BetterLumi’s choice, outside the registered ragù formula. The source says a glass of wine and optional milk; the canonical BetterLumi variant deliberately uses half a US cup of red wine and half a US cup of whole milk, and includes the milk.

## Verified ingredient references

New records were checked against the complete official USDA SR Legacy April 2018 downloadable JSON archive, not search snippets. Selected nutrient and portion facts are recorded in [recipe-bolognese-usda-records.json](data/recipe-bolognese-usda-records.json); the archive URLs are recorded there. The Foundation April 2026 archive supplies the existing milk record’s cup weight. Original supplied energy is retained, not derived from rounded macros.

All nutrient values below are per 100 g edible portion, in kcal / grams.

| Exact USDA description | FDC snapshot | NDB | kcal | Protein | Carbs | Fat |
| --- | --- | --- | --- | --- | --- | --- |
| Pasta, dry, enriched | 169736 | 20120 | 371 | 13 | 74.7 | 1.51 |
| Beef, ground, 85% lean meat / 15% fat, raw (Includes foods for USDA's Food Distribution Program) | 171796 | 23567 | 215 | 18.6 | 0 | 15 |
| Pork, fresh, belly, raw | 167812 | 10005 | 518 | 9.34 | 0 | 53 |
| Onions, raw | 170000 | 11282 | 40 | 1.1 | 9.34 | 0.1 |
| Celery, raw | 169988 | 11143 | 14 | 0.69 | 2.97 | 0.17 |
| Tomato products, canned, puree, without salt added | 170460 | 11547 | 38 | 1.65 | 8.98 | 0.21 |
| Tomato products, canned, paste, without salt added (Includes foods for USDA's Food Distribution Program) | 170459 | 11546 | 82 | 4.32 | 18.9 | 0.47 |
| Oil, olive, salad or cooking | 171413 | 4053 | 884 | 0 | 0 | 100 |
| Alcoholic beverage, wine, table, red | 173190 | 14096 | 85 | 0.07 | 2.61 | 0 |

Mappings: generic dry enriched pasta represents tagliatelle; raw 85%-lean beef represents ground beef; fresh raw uncured pork belly represents fresh pancetta, not cooked bacon; unsalted tomato purée represents passata; generic unsalted tomato paste represents double concentrate; generic olive oil represents extra virgin; red table wine represents dry red wine. These approximations are disclosed in the source panel. Existing raw carrot (FDC 2258586) and whole milk (FDC 746782) nutrient values remain unchanged.

Full batch amounts: pasta 480 g; beef 400 g; pork belly 150 g; onion, carrot and celery 60 g each; purée 200 g; paste 16 g; oil 40.5 g; wine 117.6 g; milk 124.5 g. USDA portions: paste 16 g/tbsp; oil 13.5 g/tbsp; wine 29.4 g/fl oz, four fl oz per half US cup; Foundation milk 249 g/cup. Water or light broth is qualitative as needed; salt/pepper are to taste. Unmeasured broth and seasonings are excluded from the estimate. No fabricated evaporation, alcohol retention or fat-loss factor is applied. Actual results vary with ingredients, cooking and serving sizes.

## Calculated nutrition (not hard-coded in application)

| Basis | kcal | Protein g | Carbs g | Fat g |
| --- | --- | --- | --- | --- |
| Full six-serving batch | 4098.9874 | 160.59327 | 401.94371 | 192.0998 |
| One serving | 683.164566667 | 26.765545 | 66.990618333 | 32.016633333 |

Application totals are derived from referenced ingredient values at runtime. Display rounding does not alter stored meal snapshots.

## Static image

public/images/recipes/tagliatelle-ragu-bolognese.webp — 800 × 800 px, 1:1, WebP, 153244 bytes (149.7 KiB). One canonical crop from the 800 × 1200 source, x=0/y=300/width=800/height=800, retaining the main plated bowl. Canvas WebP quality 0.82 strips source metadata; no upscaling and no original photograph was copied into the repository. The 48 × 48 list thumbnail uses cover; detail uses contain with a 260 px maximum height. The asset path respects Vite BASE_URL. WebP is included in the existing service-worker precache patterns. User-uploaded recipe images retain their original storage/editing behavior.

## Data compatibility

No database identity, IndexedDB schema version (6), backup format (9), development origin or development port change. No reference foods or recipes are seeded. Only a user’s explicit save operation can write a user recipe or meal. Validation uses isolated browser contexts on the test origin, never the user’s browser profile. The separate public snapshot repository is untouched.

## Changed files

Yield/scaling and UI: src/recipe-nutrition.ts, src/recipe-yield-locale.ts, src/recipe-yield.css, src/Recipes.tsx, src/RecipeDetail.tsx, src/Meals.tsx, src/main.tsx; backward-compatible import validation in src/domain.ts.

Static references/source: src/data/builtInRecipes.ts, src/data/builtInFoods.ts (nine additional USDA ingredients only), src/BuiltInRecipeSource.tsx, docs/data/recipe-bolognese-usda-records.json. Static image: public/images/recipes/tagliatelle-ragu-bolognese.webp. Build integration: vite.config.ts adds WebP to the existing precache extension list.

Tests: src/recipe-yield.test.ts, src/built-in-recipes.test.ts, tests/recipe-yield.spec.ts, tests/built-in-recipes.spec.ts. Existing food count, preparation/source, recipe editor, image and list-nutrition tests were updated for the expanded catalog and yield controls. Relevant recipe scenarios in tests/exercise-recipe-workflow.spec.ts now check per-serving values while retaining historical snapshots.

## Validation scope

TypeScript passes; 450 unit tests across 57 files pass; production build passes with the existing large-chunk warning. A 21-case recipe UI suite passed, covering source/detail, yield, user image uploads, category editing and list nutrition. The final 19-case food/Pantry/yield/meal-snapshot browser suite also passes, including manual ingredient edits after serving changes. Production image/detail tests passed at 390 px Chinese, 430 px English and 1440 px English, including online and offline refresh. Testing uses Chromium with mobile/touch viewports; a physical iPhone Safari was not available. No claim is made that the entire historical browser suite passed: the old mixed exercise/overview scenarios assume pre-tab Today layouts and were excluded from the final focused recipe run.
