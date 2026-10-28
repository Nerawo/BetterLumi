# Natural food library expansion — 2026-10-28

## Scope and preservation

Baseline commit: 21b5630. Existing foods: **32**. Verified additions: **174**. Total: **206**.
The exact baseline is archived in data/natural-food-baseline.json and tested for full object equality and original ordering. Existing IDs, names, nutrition, source metadata and tags were not replaced. The new immutable records are appended to the static bundle; none are seeded into IndexedDB. Database identity BetterLumi, schema 6 and Backup 9 are unchanged. Personal ingredients, serving-unit preferences, defaults, archive states, Meals/Recipes snapshots, historical records, supplement data and shared keyboard behavior are untouched.

## Official retrieval and nutrient policy

Both official bulk JSON archives were downloaded from the [USDA download page](https://fdc.nal.usda.gov/download-datasets/) on 2026-10-28:

- [Foundation Foods — April 2026](https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_json_2026-04-30.zip); SHA-256 186e988ec542e913f51ef62b86a47758e8cdd0d1dc3889e7b055581f3c09c77a.
- [SR Legacy — April 2018](https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_json_2018-04.zip); SHA-256 0fe8ae486a2c8eb42cb96413f058deb51863a46c8fb8eeb4b1fb45006dd338ef.

Foundation archive: 395 array slots, of which 363 are food objects and **32 are null**. Null rows are reported and never treated as foods. SR Legacy: 7,793 records. Release dates describe the dataset, not the acquisition date of every sample. Each selected record retains its separate FDC publication date.

Only four nutrients are retained. Values are the official record amounts per **100 g edible portion**, without serving normalization or kcal/kJ conversion. [USDA field definitions](https://fdc.nal.usda.gov/docs/Download_Field_Descriptions_Oct2020.pdf) specify the per-100-g basis; the [SR Legacy guide](https://www.ars.usda.gov/ARSUserFiles/80400525/Data/SR-Legacy/SR-Legacy_Doc.pdf) specifies edible portion. Bones, shells and other refuse are excluded even when the original cut is purchased bone-in.

Mapping uses numeric nutrient identifiers: **1003 Protein (g)**, **1004 Total lipid/fat (g)**, **1005 Carbohydrate, by difference (g)**. The latter includes fiber and is not net carbohydrate; no fiber or other micronutrient field is imported. Energy selection is published **2048 (Atwater specific factors)**, otherwise published **1008 (Energy)**, otherwise published **2047 (Atwater general factors)**. No energy or missing macro is calculated by BetterLumi. [USDA Foundation documentation](https://fdc.nal.usda.gov/Foundation_Foods_Documentation/) explains these energy IDs and the carbohydrate definition. The single 2047-only record is red radish, FDC 2747665; its official 19.6 kcal is copied, not estimated. Energy mapping counts: 1008 = 127; 2048 = 46; 2047 = 1. Foundation preference applies only to a defensible matching food with all four valid nutrients and correct preparation/basis; SR exact cooked or mature dry-seed records are used instead of 0%-moisture research beans or incomplete Foundation entries.

The audit rejects missing, negative, non-finite and incorrectly unit-labeled values; duplicate FDC IDs/descriptions and ID collisions; suspicious energy above 900 kcal/100 g, individual macros above 100 g/100 g, and summed macro mass above 101 g/100 g. The mass tolerance permits source rounding. Zero is retained only when USDA reports zero. There is no macro-derived energy comparison because official Atwater methods legitimately differ.

## Coverage

| Category | Added |
|---|---:|
| fruits | 28 |
| vegetables | 30 |
| meat | 40 |
| seafood | 31 |
| grains-staples | 31 |
| legumes-soy | 14 |

Preparation: **101 raw, 19 dry, 54 cooked**. Source types: **54 Foundation Foods, 120 SR Legacy**. Raw/dry and cooked records are separate FDC IDs, with cooking method, skin/meat/cut, fat percentage and variety retained where relevant. Names and preparation labels are bilingual. New aliases support 大米、米饭、糙米、小米、鸡腿、牛排、三文鱼 and their English counterparts. User-defined unit names are never translated or reset.

Existing Gala apple, ripe banana, strawberry, blueberry, broccoli, carrot, spinach, Roma tomato, cucumber, onion, celery, raw pork belly and the existing cooked/packaged references are retained rather than recreated. Generic tomato uses the existing explicit Roma entry; no new generic record is mislabeled as Roma. Existing white cooked long-grain rice is enriched; a new unenriched cooked candidate (169757) was excluded because all four core nutrients are identical and the fortification distinction is outside this four-nutrient model. The new long-grain dry reference is explicitly unenriched; raw and cooked values are never derived from one another.

Selection notes: cantaloupe is translated as 网纹甜瓜, not assigned a Hami-specific cultivar. Sea bass remains mixed marine species and is not represented as Chinese freshwater bass. USDA generic yam is 薯蓣, explicitly not a Chinese-yam-specific record. Black beans are 黑芸豆, not black soybeans. Millet uses the generic USDA millet record and does not assert a particular foxtail cultivar. Roasted buckwheat groats are distinct from unroasted dry buckwheat. Queen crab keeps the original USDA English term alongside the Chinese snow-crab label and USDA qualifier; no narrower species is asserted. These identification limits remain visible in the bilingual record metadata.

## Exclusions, discrepancies and gaps

All 17 specific exclusions, including the exact available core nutrient values, are retained in data/natural-food-provenance.json under reviewedExclusions. See data/natural-food-import-audit.json for machine-readable reasons. Incomplete Foundation blackberry, seedless-watermelon, napa-leaf, pie-pumpkin, leek and scallion candidates were excluded. The separately chosen SR entries use their own four values, and their names no longer claim the missing Foundation-specific cultivar/plant part. Negative carbohydrate candidates include Foundation raw chicken skin-on cuts and skin-on pork belly; no clamping or zero replacement was used. Selected skin-on chicken equivalents come from separate valid SR records; the existing raw pork belly is unchanged. 0%-moisture research beans are inappropriate for ordinary as-sold dry beans and are also incomplete.

Held or missing from this curated import (not a claim that no official record exists anywhere):

- **Dragon fruit / 火龙果**: No suitable record in the two downloaded official archives; not estimated.
- **Job’s tears / 薏米**: No suitable record in the two downloaded official archives; no barley substitution.
- **King oyster mushroom / 杏鲍菇**: Complete Foundation record exists but archive description/input samples do not explicitly identify raw/cooked preparation. Held for further source verification.
- **Oat groats, dry/cooked / 燕麦米**: Generic oats/rolled oats are not an explicit groat match; existing dry rolled oats retained. No exact cooked groat record selected.
- **Sardines / 沙丁鱼**: Downloaded SR matches are canned preparations with bones; no plain raw/cooked edible-flesh match selected.
- **Duck breast/leg, raw / 生鸭胸鸭腿**: No matching domestic White Pekin raw breast/leg record in downloaded archives; no wild-duck substitution. Cooked White Pekin records selected.
- **Squid, plain cooked / 原味熟鱿鱼**: No suitable plain cooked counterpart selected; fried squid is not substituted.
- **Cassava, plain boiled / 煮木薯**: No exact plain boiled record selected in downloaded archives; raw record is independent.
- **Pork belly, plain cooked / 原味熟五花肉**: No exact plain cooked record selected; existing raw belly retained.

The cooked yam candidate was also excluded because its official description combines boiling/draining and baking. No single preparation is fabricated. No unresolved nutrient discrepancy was accepted in the 174 selected foods. Exact preparation for king oyster mushroom remains unresolved and is explicitly held, despite a complete four-nutrient record.

## Reproducible workflow

No API key is used or stored. Requires Node.js and PowerShell Expand-Archive on Windows, or unzip on other platforms. From the repository root:

```powershell
node scripts/import-natural-foods.mjs --download
node scripts/import-natural-foods.mjs --from-archives --check
node scripts/import-natural-foods.mjs --check
```

--download retrieves the two pinned official archives into ignored work/usda-import, checks ZIP and extracted JSON hashes before transformation, and regenerates the four-nutrient provenance, bundle and machine audit. A changed archive hash stops the process for review. --from-archives uses already downloaded/extracted official files. --check performs byte-for-byte generated-output checks without rewriting outputs. With no source flag, regeneration is offline from the committed public provenance extract. Selection metadata is scripts/data/natural-food-selection.json; stable new IDs are betterlumi:food:usda-fdc-<FDC ID>.

Only the curated four-nutrient public extract is committed, not the full archives or unrelated nutrients. Ordinary Pantry, Meals and Recipes search does not contact USDA. The static library is bundled in application JavaScript, covered by the existing PWA precache; no deployment or service-worker configuration is changed.

## Validation

Focused tests cover all imported nutrients and source units/identifiers; exact original-record preservation; duplicate IDs; bilingual search; preparation distinctions; existing recipe reference resolution; user-unit/default/archive preservation; historical snapshots and Backup 9 round-trips. Integration and production offline validation results are recorded in the completion report. No unrelated full browser regression is required.

## Validation commands and results

- TypeScript: passed.
- 112 relevant unit tests across eight files: passed.
- Six targeted WebKit cases: passed (four original reference/snapshot compatibility cases plus new Chinese 320 px and English 390 px cases).
- Production /BetterLumi/ build and PWA generation: passed; 118 precache entries.
- One Chrome production test: fresh offline page, bilingual search, food selection/logging and offline refresh passed. No USDA API requests were made by ordinary use.
- Full source-archive regeneration check: passed; all generated files exactly match the checked-in four-nutrient extract.
- Non-blocking existing Vite bundle-size warning remains. Native iPhone verification is still recommended; no native-device claim is made.

Repeat the production-only offline test after building:

```powershell
$env:APP_BASE='/BetterLumi/'
npm run build
$env:BETTERLUMI_OFFLINE_PRODUCTION='1'
npx playwright test --config playwright.natural-foods-offline.config.ts
```

The dedicated test configuration mounts preview at the same production base. The test is explicitly skipped in the ordinary dev-server browser suite because that suite does not produce a service worker; existing CI checks and deployment configuration are unchanged.

Modified/new files (19):

- src/data/builtInFoods.ts
- src/data/natural-foods.generated.json
- src/reference-library.ts
- src/natural-foods.test.ts
- src/built-in-foods.test.ts
- src/built-in-foods-phase2b.test.ts
- src/pantry-foods.test.ts
- src/reference-library.test.ts
- tests/natural-foods.spec.ts
- tests/natural-foods-offline.spec.ts
- tests/built-in-foods.spec.ts
- tests/built-in-foods-phase2b.spec.ts
- playwright.natural-foods-offline.config.ts
- scripts/import-natural-foods.mjs
- scripts/data/natural-food-selection.json
- docs/data/natural-food-baseline.json
- docs/data/natural-food-provenance.json
- docs/data/natural-food-import-audit.json
- docs/natural-food-expansion.md

## Final targeted source-record audit — 2026-10-28

Compared all 18 available entries for the requested food groups, including glutinous rice, directly against the original downloaded USDA JSON archives. Both archive JSON SHA-256 hashes match the pinned import manifest. This comparison did not re-import, rewrite or normalize any food data.

**Result: all 15 newly imported entries PASS exact bulk-source comparison. Three retained pre-expansion entries are flagged ISSUE only for numerical precision differences between the SR bulk archive and the earlier saved USDA API extract. All three exactly match that earlier extract, retrieved 2026-10-22. No newly imported nutrient, ID, dataset, description, unit or mapping error was found.**

Values below are the current library values per **100 g edible portion**. Energy is kcal; P/C/F are grams. Foundation = Foundation Foods, April 2026; SR = SR Legacy, April 2018. All FDC IDs, dataset types and original USDA descriptions matched exactly. Chinese/English names and preparation qualifiers were reviewed against those descriptions. Dry grain weights are uncooked weights. Meat/seafood values exclude bones, shells and other refuse.

| Food (Chinese / English) | FDC ID | Dataset | State | kcal | Protein | Carbohydrates | Fat | Result | Comparison note |
|---|---:|---|---|---:|---:|---:|---:|---|---|
| 长粒白米（生） / Long-grain white rice (dry) | 2512381 | Foundation | Dry / uncooked | 370 | 7.04 | 80.3 | 1.03 | PASS | Exact source values; no rounding or conversion. |
| 白米饭 / White Rice | 168878 | SR | Cooked | 130 | 2.69 | 28.17 | 0.28 | ISSUE | Carbohydrates: library/API 28.17; bulk 28.2 |
| 中粒白米（生） / Medium-grain white rice (dry) | 169760 | SR | Dry / uncooked | 360 | 6.61 | 79.3 | 0.58 | PASS | Exact source values; no rounding or conversion. |
| 中粒白米饭（熟） / Medium-grain white rice (cooked) | 168930 | SR | Cooked | 130 | 2.38 | 28.6 | 0.21 | PASS | Exact source values; no rounding or conversion. |
| 短粒白米（生） / Short-grain white rice (dry) | 168931 | SR | Dry / uncooked | 358 | 6.5 | 79.2 | 0.52 | PASS | Exact source values; no rounding or conversion. |
| 短粒白米饭（熟） / Short-grain white rice (cooked) | 168932 | SR | Cooked | 130 | 2.36 | 28.7 | 0.19 | PASS | Exact source values; no rounding or conversion. |
| 长粒糙米（生） / Long-grain brown rice (dry) | 2512380 | Foundation | Dry / uncooked | 368 | 7.25 | 76.7 | 3.31 | PASS | Exact source values; no rounding or conversion. |
| 长粒糙米饭（熟） / Long-grain brown rice (cooked) | 169704 | SR | Cooked | 123 | 2.74 | 25.6 | 0.97 | PASS | Exact source values; no rounding or conversion. |
| 糯米（生） / Glutinous rice (dry) | 168883 | SR | Dry / uncooked | 370 | 6.81 | 81.7 | 0.55 | PASS | Exact source values; no rounding or conversion. |
| 糯米饭（熟） / Glutinous rice (cooked) | 169711 | SR | Cooked | 97 | 2.02 | 21.1 | 0.19 | PASS | Exact source values; no rounding or conversion. |
| 小米（生） / Millet (dry) | 169702 | SR | Dry / uncooked | 378 | 11 | 72.8 | 4.22 | PASS | Exact source values; no rounding or conversion. |
| 小米饭（熟） / Millet (cooked) | 168871 | SR | Cooked | 119 | 3.51 | 23.7 | 1 | PASS | Exact source values; no rounding or conversion. |
| 鸡胸肉（生，去皮） / Chicken breast (raw, skinless) | 2646170 | Foundation | Raw | 112 | 22.5 | 0 | 1.93 | PASS | Exact source values; no rounding or conversion. |
| 鸡胸肉 / Chicken Breast | 171477 | SR | Cooked | 165 | 31.02 | 0 | 3.57 | ISSUE | Protein: library/API 31.02; bulk 31 |
| 牛小排（生，去骨） / Beef short ribs (raw, boneless) | 170826 | SR | Raw | 235 | 17.5 | 0 | 18.3 | PASS | Exact source values; no rounding or conversion. |
| 牛小排（炖熟，瘦肉） / Beef short ribs (braised, lean) | 169569 | SR | Cooked | 240 | 28.8 | 0 | 13.8 | PASS | Exact source values; no rounding or conversion. |
| 养殖大西洋三文鱼（生） / Farmed Atlantic salmon (raw) | 2684441 | Foundation | Raw | 203 | 20.3 | 0 | 13.1 | PASS | Exact source values; no rounding or conversion. |
| 大西洋三文鱼（养殖） / Atlantic Salmon (farmed) | 175168 | SR | Cooked | 206 | 22.1 | 0 | 12.35 | ISSUE | Fat: library/API 12.35; bulk 12.4 |

### Precision discrepancies and proposed disposition

- FDC 171477: protein **31.02 g** in the library and original API extract, versus **31 g** in the bulk archive.
- FDC 175168: fat **12.35 g** in the library and original API extract, versus **12.4 g** in the bulk archive.
- FDC 168878: carbohydrate **28.17 g** in the library and original API extract, versus **28.2 g** in the bulk archive.

These are consistent with coarser bulk-export precision; the upstream serialization cause was not independently established. They are not changes introduced by this expansion. **Proposed disposition: retain the existing values and IDs, document the source representations, and do not reduce earlier API precision solely to force bulk equality.** No dataset correction has been applied. If numerical harmonization is later desired, the three exact field changes above require separate approval and source review; they are outside this report-only audit.

### Preparation and naming qualifications

- Long-grain white rice: dry Foundation 2512381 is explicitly **unenriched**; retained cooked SR 168878 is **enriched**. These are separately named/sourced references, not a same-product raw-to-cooked conversion pair. Medium- and short-grain raw/cooked entries are unenriched.
- Beef short ribs: raw 170826 is boneless chuck short ribs, **separable lean and fat**; cooked 169569 is boneless chuck short ribs, **separable lean only**, braised. Both specify external fat trimmed to 0 inches; this does not mean zero intrinsic fat. The Chinese cooked name includes 瘦肉. Do not infer a cooking yield or nutrient change from this non-equivalent pair.
- Chicken breast: raw 2646170 is boneless and skinless; retained cooked 171477 is meat only, roasted. Skinlessness and cooking are preserved in preparation metadata even where the retained short display name omits them.
- Salmon: both records explicitly refer to farmed Atlantic salmon, raw versus dry-heat cooked. No wild/farmed or species substitution is used.
- Millet: source descriptions are generic Millet, raw / Millet, cooked. Chinese 小米 is the existing broad display mapping; the records do not establish a specific foxtail-millet cultivar/species, as already qualified in the import selection notes.

### Exact original descriptions and nutrient mapping

- **2512381 — Foundation Foods**: Rice, white, long grain, unenriched, raw. Energy nutrient **2048**; protein **1003**, carbohydrate by difference **1005**, total fat **1004**.
- **168878 — SR Legacy**: Rice, white, long-grain, regular, enriched, cooked. Energy nutrient **1008**; protein **1003**, carbohydrate by difference **1005**, total fat **1004**.
- **169760 — SR Legacy**: Rice, white, medium-grain, raw, unenriched. Energy nutrient **1008**; protein **1003**, carbohydrate by difference **1005**, total fat **1004**.
- **168930 — SR Legacy**: Rice, white, medium-grain, cooked, unenriched. Energy nutrient **1008**; protein **1003**, carbohydrate by difference **1005**, total fat **1004**.
- **168931 — SR Legacy**: Rice, white, short-grain, raw, unenriched. Energy nutrient **1008**; protein **1003**, carbohydrate by difference **1005**, total fat **1004**.
- **168932 — SR Legacy**: Rice, white, short-grain, cooked, unenriched. Energy nutrient **1008**; protein **1003**, carbohydrate by difference **1005**, total fat **1004**.
- **2512380 — Foundation Foods**: Rice, brown, long grain, unenriched, raw. Energy nutrient **2048**; protein **1003**, carbohydrate by difference **1005**, total fat **1004**.
- **169704 — SR Legacy**: Rice, brown, long-grain, cooked (Includes foods for USDA's Food Distribution Program). Energy nutrient **1008**; protein **1003**, carbohydrate by difference **1005**, total fat **1004**.
- **168883 — SR Legacy**: Rice, white, glutinous, unenriched, uncooked. Energy nutrient **1008**; protein **1003**, carbohydrate by difference **1005**, total fat **1004**.
- **169711 — SR Legacy**: Rice, white, glutinous, unenriched, cooked. Energy nutrient **1008**; protein **1003**, carbohydrate by difference **1005**, total fat **1004**.
- **169702 — SR Legacy**: Millet, raw. Energy nutrient **1008**; protein **1003**, carbohydrate by difference **1005**, total fat **1004**.
- **168871 — SR Legacy**: Millet, cooked. Energy nutrient **1008**; protein **1003**, carbohydrate by difference **1005**, total fat **1004**.
- **2646170 — Foundation Foods**: Chicken, breast, boneless, skinless, raw. Energy nutrient **2048**; protein **1003**, carbohydrate by difference **1005**, total fat **1004**.
- **171477 — SR Legacy**: Chicken, broilers or fryers, breast, meat only, cooked, roasted. Energy nutrient **1008**; protein **1003**, carbohydrate by difference **1005**, total fat **1004**.
- **170826 — SR Legacy**: Beef, chuck, short ribs, boneless, separable lean and fat, trimmed to 0" fat, all grades, raw. Energy nutrient **1008**; protein **1003**, carbohydrate by difference **1005**, total fat **1004**.
- **169569 — SR Legacy**: Beef, chuck, short ribs, boneless, separable lean only, trimmed to 0" fat, all grades, cooked, braised. Energy nutrient **1008**; protein **1003**, carbohydrate by difference **1005**, total fat **1004**.
- **2684441 — Foundation Foods**: Fish, salmon, Atlantic, farm raised, raw. Energy nutrient **2048**; protein **1003**, carbohydrate by difference **1005**, total fat **1004**.
- **175168 — SR Legacy**: Fish, salmon, Atlantic, farmed, cooked, dry heat. Energy nutrient **1008**; protein **1003**, carbohydrate by difference **1005**, total fat **1004**.

Foundation entries in this targeted set use official energy 2048 (Atwater specific); SR entries use official energy 1008. Only the existing record amount fields were compared. No 4-4-9 calculation, kcal/kJ conversion, per-serving normalization, macro rounding or cooked-from-raw estimation was performed.

Validation for this report update: direct 18-record source/value/unit/identity comparison; original archive hash checks; comparison to the three earlier API source extracts; final file-hash preservation check. No TypeScript, unit or browser rerun is needed for a Markdown-only update. Dataset, code, IDs, Schema 6, Backup 9, historical records and preferences are unchanged.

## Verified household serving units — 2026-10-28

The 206-food catalogue and all four nutrient values are unchanged. A separate static catalogue now supplies **104 verified household measures for 79 foods**: **54 foods have one**, **25 have two**, and **127 remain gram-only**. Every food retains g, with the existing default unchanged unless the user explicitly chooses a different default. No original IDs or personal records are modified.

| Category | Foods receiving units | Household units | Category total |
|---|---:|---:|---:|
| vegetables | 18 | 25 | 38 |
| fruits | 18 | 27 | 32 |
| dairyEggs | 2 | 2 | 3 |
| meat | 3 | 5 | 45 |
| seafood | 7 | 8 | 33 |
| grains-staples | 20 | 24 | 36 |
| legumes-soy | 9 | 9 | 16 |
| condiments-other | 2 | 4 | 3 |

### Source and verification

Used only the original, hash-pinned USDA Foundation April 2026 and SR Legacy April 2018 JSON archives already downloaded for this import. Each measure matches the **exact existing FDC ID and food description**. No portion from a similar variety, raw/cooked counterpart or other food is borrowed. The original FoodPortion ID, amount, measure-unit ID/name, modifier and gramWeight are retained in [data/household-unit-provenance.json](data/household-unit-provenance.json). Selection labels/edible-basis review are in scripts/data/household-unit-selection.json; verification statuses, complete excluded candidates, coverage and gram-only food lists are in [data/household-unit-audit.json](data/household-unit-audit.json).

[USDA Weights documentation](https://fdc.nal.usda.gov/Foundation_Foods_Documentation/) specifies household gram weights for edible material without refuse, including an apple without its core/stem and a chicken leg without its bone. The [SR guide, section 4.9](https://www.ars.usda.gov/ARSUserFiles/80400525/Data/SR-Legacy/SR-Legacy_Doc.pdf) documents amount, measure description and gram weight. Selected measures retain source size, cutting/packing and preparation qualifiers. No gross-to-edible yield, density assumption or mL-to-gram equivalence is introduced. A USDA cup is labeled 杯 / cup, never an unspecified bowl.

Examples from exact records: peeled banana 1105314/267795, 1 = 115 g; shell-free large egg 748967/193781, 1 = 50.3 g; cooked enriched long-grain rice 168878/83928, 1 cup = 158 g; medium baked potato 170093/86029, 1 = 173 g. Roasted chicken breast 171477/88819 preserves the original 0.5 breast = 86 g, bone and skin removed. Cooked small clams 171975/89662 preserve 20 = 190 g, edible meat; the existing quantity ratio handles fractional or single-piece input. No source rounding or pre-normalization of these counts/weights is performed.

### Conservative exclusions and limitations

- Exact Gala apple 1750341 and strawberry 2346409 provide only RACC portions in these archives. RACC is a regulatory reference amount, **not** a verified apple, strawberry or cup. Both remain gram-only; no generic apple/berry record was substituted. Many other modern Foundation fruits also remain gram-only for the same reason.
- Raw rice, raw/dry legumes, generic variable-size meat cuts, fillets without a useful size definition and unspecified shrimp remain gram-only. Raw chicken breast 2646170 and farmed shrimp 2684443 have RACC-only source portions. Cooked shrimp 175180 has only an ounce measure. No shrimp-piece size was fabricated.
- Weight-only oz/lb, NLEA/RACC, whole-carcass yield measures, zero counts, incompatible skin/preparation modifiers, clam-plus-liquid measures and less useful/ambiguous candidates are excluded. The complete per-candidate reasons and original weights remain in the machine audit.
- Cup portions preserve distinctions such as chopped/sliced/whole, mashed, shelled beans, and spaghetti not packed. Potato and fruit pieces retain their source size; peeled fruit and shellfish weights mean edible flesh. Approximation symbols indicate natural food-size variation, not unverified data. Native iPhone display/selection should still be checked before release.

### Preferences, history and implementation

Official units are separate from personal units: runtime source keys are usda:portion:<FDC ID>:<FoodPortion ID>. They are never copied into saved custom-unit arrays. Meals, Recipes and management selectors compose official and personal options at read time. User-defined exact key or localized-label matches take precedence, keeping the user's own weight and selected default. If a user previously selected an official default and later creates a conflicting custom display label, both remain identifiable using a USDA suffix on the official label; no default is reset. No private user database was inspected to count actual conflicts; these cases are covered by synthetic tests.

The ingredient-management modal reuses its current rows: official rows are selectable, source-qualified and read-only, while custom rows keep edit/remove. Cancel discards unsaved selection; Save can retain an explicit official key in the existing preferred string. The conversion path only adds lookup of these static weights before the existing gram-scaling calculation. Recipes and historical Meals continue to use saved nutrition snapshots for quantity edits. Recipe detail translates only the display label, not stored keys or quantities.

Schema 6, Backup 9, database identity BetterLumi, archive/restore semantics, historical records, reference nutrients, custom conversion formulas and shared keyboard handling are unchanged. No migration, live USDA API dependency, dependency installation or deployment change was introduced. Static portions are bundled and precached with the existing PWA.

### Reproduction and validation

```powershell
node scripts/import-household-units.mjs --download
node scripts/import-household-units.mjs --from-archives --check
node scripts/import-household-units.mjs --check
```

--download retrieves/checks the same pinned official archives and generates only portion provenance, portion data and the portion audit. It does not re-import nutrition. --from-archives reuses the downloaded official files. With neither source flag, regeneration uses the public portion extract offline. --check compares byte-for-byte without rewriting generated outputs.

Validation: TypeScript passed; 60 relevant unit tests passed; five mobile WebKit cases passed (new Chinese 320 px and English 390 px household flows plus three existing custom-unit/history/archive cases); production /BetterLumi/ build and PWA generation passed; both production Chrome offline cases passed, including fractional household-unit logging and reload. No full unrelated browser regression was run. The existing non-blocking Vite bundle-size warning remains.

Files added/changed for the serving-unit task (15): src/household-units.ts; src/data/household-units.generated.json; src/household-units.test.ts; src/ingredient-preferences.ts; src/IngredientManagement.tsx; src/Meals.tsx; src/RecipeLineEditor.tsx; src/RecipeDetail.tsx; scripts/import-household-units.mjs; scripts/data/household-unit-selection.json; docs/data/household-unit-provenance.json; docs/data/household-unit-audit.json; docs/natural-food-expansion.md; tests/household-units.spec.ts; tests/natural-foods-offline.spec.ts. No CSS, shared modal code, nutrition files, database definition or backup implementation was changed.
