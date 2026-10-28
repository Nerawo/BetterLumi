# Everyday built-in food names and discovery

Baseline: `16c62d8` (206 foods; 104 verified household units across 79 foods).

## Counts and naming

110 foods have a changed Chinese and/or English display name (110 Chinese, 100 English). The presentation map contains 113 reviewed records; three already have the desired names. Other records retain their existing names. No original data name, alias, preparation field, source description or nutrient value is rewritten.

| Original display | Everyday Chinese | Everyday English |
|---|---|---|
| 巴特利特梨（生） / Bartlett pear (raw) | 梨 | Pear |
| Gala 苹果 / Gala Apple | 苹果 | Apple |
| 汤米阿特金斯芒果（生） / Tommy Atkins mango (raw) | 芒果 | Mango |
| 哈斯牛油果（生） / Hass avocado (raw) | 牛油果 | Avocado |
| 黑李子（生） / Black plum (raw) | 李子 | Plum |
| 长粒白米（生） / Long-grain white rice (dry) | 大米 | White rice (dry) |
| 白米饭 / White Rice | 米饭 | White rice (cooked) |
| 长粒糙米饭（熟） / Long-grain brown rice (cooked) | 糙米饭 | Brown rice (cooked) |
| 鸡大腿肉（生，去皮） | 鸡腿肉（生，去皮） | Chicken thigh (raw, skinless) |
| 养殖大西洋三文鱼（生） | 三文鱼（生） | Salmon (raw) |

Shortened cultivar names identify the same exact USDA record, not an official generic average. The existing source dialog retains the original bilingual identity, exact USDA description, preparation and edible-portion information. FDC ID is now visible for Foundation records as well as SR Legacy.

## Representative groups

There are **two groups**, with **four specialized variants hidden from generic browsing**. There are **202 ordinary browsing choices**, while the full reference catalogue remains **206**.

| Group | Everyday representative FDC ID | Retained specialized FDC IDs |
|---|---|---|
| Dry ordinary white rice | 2512381 (long-grain, unenriched) | 169760 (medium-grain), 168931 (short-grain) |
| Cooked ordinary white rice | 168878 (existing long-grain, enriched) | 168930 (medium-grain), 168932 (short-grain) |

These are familiar ordinary white-rice options with similar per-100g nutrient profiles, grouped separately by dry/cooked state. The existing cooked representative keeps its familiar stable ID and verified cup measure. Nutrients are neither merged nor averaged. Enrichment differences remain in source details; the dry/cooked representatives must not be treated as a cooking-yield pair. Glutinous rice, brown rice and rice noodles remain separate choices.

The current catalogue has only one pear, apple, mango and avocado cultivar record each, so those foods need no variant suppression.

Specific queries such as 中粒, 短粒, 中粒白米饭, medium-grain and short grain reveal the corresponding retained variants. Their original names distinguish them. Generic 米饭 / 大米 / rice queries do not expose the four near-duplicate grain-length variants.

## Search and preserved distinctions

- Matching retains both original languages, original aliases, USDA descriptions and category filtering. Everyday names and a few plain-English rice aliases are also searchable.
- Exact everyday names rank first, then prefixes, name substrings, and incidental source/category matches. The default ascending-name Pantry search retains that priority and uses the existing localized name ordering within each rank. Explicit descending-name and calorie sorting keep their existing sorting rules.
- 梨 / pear prioritizes Pear; 苹果 / apple, 芒果 / mango and 牛油果 / avocado work without cultivar knowledge. Existing substring aliases remain supported: 梨 can also find distinct foods with aliases such as 凤梨 and 鳄梨, after the exact Pear match. These are not duplicate pear cultivars.
- 米饭 prioritizes the existing cooked white-rice record; 大米 prioritizes dry white rice. rice prioritizes cooked white rice, and dry rice / raw rice find dry white rice.
- 鸡腿肉 returns raw/cooked and skin-on/skinless thigh choices. Raw/cooked meat, fat percentages, lean-only cuts, braised/grilled preparations and distinct meat cuts remain separate.
- Ambiguous/non-equivalent items remain distinct: generic USDA yam stays 薯蓣 rather than claiming Chinese yam; black common beans do not become black soybeans; sea bass stays 海鲈; yellowfin tuna, blue crab and snow crab remain identified; roasted buckwheat is not grouped with unroasted buckwheat. No ambiguous additional representative group was created.

## List layout

Pantry and the shared Meals/Recipes picker omit verbose preparation/category text from the primary rows. Nutrition and the independent source-info action remain. Detailed technical metadata stays in the existing source dialog.

Pantry uses a shrinkable name column and an automatic-width kcal column, bounded to the row. Long names wrap within the name column; macro text may wrap within its own row. The fix is scoped to Pantry and does not hide page-wide overflow. Category scrolling, bottom navigation, source-icon interaction and modal infrastructure are unchanged.

Layout checks wait for localized content and fonts before measuring. An initial English 320px measurement during loading reported transient overflow; settled-layout checks pass. Native iPhone screenshots/keyboard behavior were not verified by these simulated tests, so an on-device visual check remains necessary.

## Data preservation

- All 206 stable IDs, exact four-nutrient values, source provenance and all 104 unit definitions are unchanged.
- Personal conversions, source-unit precedence and default/archive preferences retain their existing stable-ID storage. Preferences are not transferred between representative and specialized records.
- Hidden variants remain available to direct ID resolution, historical Meals/Recipes editing, explicit-name search and the existing archive view. Archive search also recognizes shortened names. Restore/save behavior is unchanged.
- Historical names, amounts, nutrition snapshots and recipes are not rewritten. New selections use the everyday name with the same original food ID.
- Schema 6, Backup 9, database identity BetterLumi, conversion/calculation formulas, shared iOS keyboard handling and deployment configuration are untouched.

## Validation

- TypeScript passed, including the new historical-reference browser fixture.
- 149 relevant unit tests passed across nine files: naming/search, original nutrient integrity, household units, preferences, recipe references and backup/history preservation.
- 12 targeted mobile WebKit tests passed: all eight Chinese/English combinations at 320/375/390/430px; one source/preparation/logging case; one archived specialized-rice historical editing case; two existing household-unit/default/snapshot flows.
- Two production Chrome offline tests passed against `/BetterLumi/`, including household-unit logging and persistence.
- Production build and PWA generation passed. The existing non-blocking large-chunk warning remains. No full unrelated browser regression was run.

## Files

Production (8):

- `src/everyday-foods.ts` (new)
- `src/reference-library.ts`
- `src/pantry-foods.ts`
- `src/Pantry.tsx`
- `src/IngredientPicker.tsx`
- `src/IngredientManagement.tsx`
- `src/ReferenceSourceInfo.tsx`
- `src/reference-library.css`

Tests (9):

- `src/everyday-foods.test.ts` (new)
- `src/reference-library.test.ts`
- `src/pantry-foods.test.ts`
- `tests/everyday-foods.spec.ts` (new)
- `tests/built-in-foods.spec.ts`
- `tests/built-in-foods-phase2b.spec.ts`
- `tests/household-units.spec.ts`
- `tests/natural-foods.spec.ts`
- `tests/natural-foods-offline.spec.ts`

Documentation (1): this report. Total **18 files**. Older visibility assertions were updated from 206 stored references to 202 ordinary choices; full-catalogue and data-integrity assertions still require all 206 references. Preparation assertions now inspect the existing source dialog, waiting for its focus restoration before changing the search query.

No commit, push or deployment was performed.
