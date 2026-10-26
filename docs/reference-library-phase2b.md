# Built-in reference library — Phase 2B

## Source selection

Exactly eleven foods were added to the existing static catalog, for a total of
23. All twelve Phase 2A records and their nutrition values are unchanged.

The new foods use exact **USDA FoodData Central SR Legacy** records, retrieved
from the official full-food API on **2026-10-22**. SR Legacy's final dataset release
is April 2018; these FDC records have publication date April 1, 2019. The release,
FDC publication date and retrieval date are distinguished in source metadata.
They are not mislabeled as Foundation Foods or April 2026 measurements.

USDA's [data type documentation](https://fdc.nal.usda.gov/data-documentation/)
describes SR Legacy and its final release. The selected API fields, exact source
descriptions, nutrient identifiers, precision and publication metadata are archived
in [data/phase2b-usda-records.json](data/phase2b-usda-records.json).
Only this small public USDA reference extract is retained; it contains no user data,
API credentials, browser storage or personal records. The application makes no
runtime USDA API requests.

All numbers below are per **100 g edible portion**. P/C/F are grams. Calories are
USDA's reported nutrient 1008; they are not recomputed from macros.

| Food / Chinese name | Selected preparation | FDC ID | NDB / official source | kcal | P | C | F |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: |
| Chicken Breast / 鸡胸肉 | Cooked, roasted; skinless meat only | 171477 | [5064](https://fdc.nal.usda.gov/food-search?query=5064) | 165 | 31.02 | 0 | 3.57 |
| 90% Lean Ground Beef / 90% 瘦牛肉末 | Cooked, broiled patty; 90% lean / 10% fat | 174031 | [23563](https://fdc.nal.usda.gov/food-search?query=23563) | 217 | 26.11 | 0 | 11.75 |
| Pork Tenderloin / 猪里脊肉 | Cooked, roasted; separable lean only | 168250 | [10061](https://fdc.nal.usda.gov/food-search?query=10061) | 143 | 26.17 | 0 | 3.51 |
| Atlantic Salmon (farmed) / 大西洋三文鱼（养殖） | Cooked, dry heat; farmed Atlantic salmon | 175168 | [15237](https://fdc.nal.usda.gov/food-search?query=15237) | 206 | 22.1 | 0 | 12.35 |
| Shrimp / 虾 | Plain cooked edible shrimp | 175180 | [15271](https://fdc.nal.usda.gov/food-search?query=15271) | 99 | 23.98 | 0.2 | 0.28 |
| White Rice / 白米饭 | Cooked, regular long-grain, enriched | 168878 | [20045](https://fdc.nal.usda.gov/food-search?query=20045) | 130 | 2.69 | 28.17 | 0.28 |
| Oats / 燕麦 | Dry, regular or quick, not fortified | 173904 | [8120](https://fdc.nal.usda.gov/food-search?query=8120) | 379 | 13.15 | 67.7 | 6.52 |
| Potato / 土豆 | Baked, flesh and skin, without salt | 170093 | [11674](https://fdc.nal.usda.gov/food-search?query=11674) | 93 | 2.5 | 21.15 | 0.13 |
| Sweet Potato / 红薯 | Baked in skin; flesh only, without salt | 168483 | [11508](https://fdc.nal.usda.gov/food-search?query=11508) | 90 | 2.01 | 20.71 | 0.15 |
| Edamame / 毛豆 | Frozen, prepared; edible shelled beans | 168411 | [11212](https://fdc.nal.usda.gov/food-search?query=11212) | 121 | 11.91 | 8.91 | 5.2 |
| Firm Tofu (calcium-set) / 硬豆腐（硫酸钙凝固） | Raw, firm; prepared with calcium sulfate | 172475 | [16426](https://fdc.nal.usda.gov/food-search?query=16426) | 144 | 17.27 | 2.78 | 8.72 |

The exact English USDA descriptions are stored in each food's `usdaDescription`
field and in the provenance extract. A prepared or cooked label never uses a raw
record. In particular, sweet potato uses cooked FDC 168483, not raw FDC 168482.
Rice is cooked, oats are dry, beef is broiled rather than raw, salmon is farmed
rather than wild, and tofu's firmness/coagulant are explicit. Reported zero
carbohydrate remains zero; unavailable nutrients continue to use `null`.

## Existing UI and data architecture

No new tag collection or database records were needed. The nine existing static
tags already include Meat, Seafood, Grains & Staples, and Legumes & Soy. They map
to 3, 2, 4 and 2 new references respectively. User-assigned tag associations and
custom tag names retain their existing behavior.

Pantry, shared ingredient search, meal selection and recipe selection reuse the
existing composed static/user-food workflow. Names and preparation states are
bilingual. Preparation is visible in ordinary selection results and selected
ingredients; the existing compact source panel additionally shows the exact food,
preparation, USDA description, NDB, FDC snapshot ID, release and provenance dates.
Built-in entries remain read-only, with no copy/save-to-Pantry action.

The existing snapshot path is unchanged. New selections scale exact per-100-g
values; only display summaries round. Meals persist final/base nutrition and
recipe lines persist their own nutrition objects. Later reference updates do not
rewrite history. A browser test simulates revised salmon nutrition, checks that
only a new selection sees the revision, then verifies historical meal and recipe
quantity edits scale their saved snapshots instead.

## Data safety

- IndexedDB identity/schema/version 6: unchanged.
- Backup format/version 9: unchanged.
- Default tags: static; no tag seed or duplicated tag records.
- Built-in foods inserted into IndexedDB: none.
- Existing personal foods, meals, recipes, weights, exercise, goals and settings:
  not modified by this task.
- No real user browser profile or database was opened during validation.
- Development origin/port and independent `BetterLumi-public` snapshot: unchanged.
- No exercise presets, MET logic, Phase 2C or unrelated features were added.

## Files added or changed for Phase 2B

- `src/data/builtInFoods.ts`: eleven references and optional source dates on the
  static reference metadata type; existing Phase 2A values preserved.
- `src/ReferenceSourceInfo.tsx`, `src/reference-locale.ts`,
  `src/reference-library.css`: SR Legacy attribution and compact preparation/source
  identity display in the existing source panel.
- `docs/data/phase2b-usda-records.json`: official public USDA provenance extract.
- `src/built-in-foods-phase2b.test.ts`, `tests/built-in-foods-phase2b.spec.ts`:
  focused dataset, raw/cooked, category, bilingual, source, snapshot and persistence
  coverage.
- `src/built-in-foods.test.ts`, `src/reference-library.test.ts`,
  `src/pantry-foods.test.ts`, `tests/built-in-foods.spec.ts`,
  `tests/reference-library.spec.ts`, `tests/pantry-built-in-foods.spec.ts`,
  `tests/ingredient-tags.spec.ts`, `tests/unified-collections.spec.ts`:
  existing catalog counts/sorting expectations updated for 23 references; original
  Phase 2A value assertions retained.
- `playwright.reference.config.ts`: includes the focused Phase 2B browser tests.
- This report and a forward link in the Phase 2A report.

Physical iPhone Safari testing remains outstanding. Browser validation uses
isolated Chromium mobile touch contexts (390px and 430px, Chinese and English)
plus existing desktop/narrow-width regression cases. It never uses the real user
browser profile or changes the normal development origin.

## Completed validation

- TypeScript checks passed.
- Full unit suite: **50 files / 391 tests passed**.
- Relevant browser suite: **34 tests passed** in the final complete run. This
  includes all five focused Phase 2B cases, four bilingual mobile combinations,
  salmon reference revision/snapshot protection, existing Phase 2A checks and
  Pantry/tag/recipe/unit regressions.
- Production build passed with the existing large-chunk advisory.
- The optional code audit reports no missing translations. Its existing nonzero
  status is limited to three unchanged unreachable OCR compatibility modules.
- `git diff --check` passed.

No schema migration, backup-format change, user-record mutation, built-in food or
default-tag seed, exercise/MET addition, public-snapshot update, push or deployment
was performed. Work stops at Phase 2B.
