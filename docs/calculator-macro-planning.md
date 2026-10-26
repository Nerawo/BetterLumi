# Calculator macronutrient planning

## Preview and arithmetic

The compact Nutrition Plan control sits after estimated intake/exercise expenditure
and before the existing plan summary and Apply Plan action. Balanced is the default;
High Protein is an equal alternative, without claims of superior outcomes. Three
editorial numbers show Protein / Carbohydrate / Fat in grams. Plan explanations and
AMDR details are collapsed by default. The existing calculation-reference section
retains its content and adds macro methodology and official source links.

`macro-planner.ts` is a pure, write-free calculation:

- Balanced protein: latest calculation weight in kg × 1.4.
- High Protein protein: weight × 1.6.
- Fat: selected calorie target × 0.30 ÷ 9.
- Carbohydrate: (calorie target − protein × 4 − fat calories) ÷ 4.

It uses the exact calorie target the existing calculator will save, without changing
its calorie calculation, safety screening, exercise assumptions or rounding rule.
Display rounds grams, while goal targets retain calculation precision. kg/lb/jin
and week/month conversions retain the same physical inputs and macro allocation.

Synthetic arithmetic checks (70 kg, 2,000 kcal/day):

| Plan | Protein | Carbohydrate | Fat | Internal energy |
| --- | --- | --- | --- | --- |
| Balanced | 98 g | 252 g | 66.666… g | 2,000 kcal |
| High Protein | 112 g | 238 g | 66.666… g | 2,000 kcal |

AMDR checks use protein 10–35%, carbohydrate 45–65%, fat 20–35% of calories.
An out-of-range proportion remains an informational caution and does not affect
calorie eligibility or disable application. The expanded caution names the nutrient,
actual percentage and reference range. A supported 1,284-kcal synthetic case still
applies with a high-protein carbohydrate-ratio caution.

Invalid, empty, non-finite and nonpositive inputs do not produce macro targets.
If residual carbohydrate would be negative, the function returns no allocation
rather than inventing negative grams or clamping. The UI explicitly explains that
existing macro targets will be retained; the existing calorie safety rules still
determine whether calories can be applied.

Sources checked:

- [Dietary Guidelines for Americans 2025–2030, protein section](https://cdn.realfood.gov/DGA_508.pdf):
  1.2–1.6 g/kg/day; the midpoint is BetterLumi's chosen Balanced default.
- [National Academies, Dietary Reference Intakes / AMDR](https://nap.nationalacademies.org/catalog/10490/dietary-reference-intakes-for-energy-carbohydrate-fiber-fat-fatty-acids-cholesterol-protein-and-amino-acids).
- The original catalog endpoint rate-limited retrieval; the ranges were also checked
  against the [National Academies' official AMDR table](https://www.nationalacademies.org/read/27957/chapter/5).

These are general adult planning references, not individualized prescriptions.

## Goals, history and special circumstances

Changing a scheme updates only the Calculator preview/draft preference. The existing
draft setting stores optional `nutritionPlan`; its envelope remains version 1.
No active goals change until an explicit Apply Plan action.

Application re-evaluates the plan at the existing persistence boundary and uses the
same `goals` table, `saveGoalVersion`, tolerance settings and atomic transaction as
before. Eligible automatic nutrition saves kcal plus all three macro targets;
enabled eligible exercise saves weekly minutes and kcal in the same transaction.
Existing daily/weekly-average nutrition tracking frequency is retained; numerical
macro values always represent grams per day, never weekly totals. Duplicate
applications are no-ops and failures roll back the entire operation.

New full-nutrition versions carry optional `nutritionOnly: true` metadata. This
keeps them out of exercise-version resolution rather than copying exercise goals
into a newer nutrition version. It preserves existing exercise periods and future
scheduled exercise goals, including unrestricted baselines. Current Goals, Overview
and calendar evaluations continue resolving the same table. The resolved view
does not retain the storage-only flag, and a later manual full-goal edit cannot
accidentally reuse a nutrition-only history row. History labels show only the
nutrition period for these new rows; existing rows retain their presentation.

Professional/special-circumstance mode produces no automatic P/C/F preview or goal
allocation. Its explicit manual calorie application keeps existing macro settings
untouched; users can edit calorie/protein/carbohydrate/fat targets independently
in the existing Personal Goals editor. Legacy pregnancy, breastfeeding and other
guidance flags continue using the existing unified-mode resolver.

## Compatibility and validation

IndexedDB identity, schema version (6), tables and indexes are unchanged. No
migration, reseeding or database initialization is added. JSON backup format remains
version 9; the optional goal/draft metadata is preserved by existing export/restore.
Old records/backups without these fields keep their existing behavior. No old goal,
meal, exercise, body record or historical nutrition snapshot is rewritten.

Browser fixtures use isolated profiles and test-origin storage, not the user's
browser database. Bilingual 390/430px mobile and desktop checks cover scheme
switching, warnings, units, application, immediate Current Goals/Overview updates,
refresh, empty numeric editing and professional-mode compatibility. Physical
iPhone Safari remains a manual verification limitation.

## Files in this change

- `src/macro-planner.ts`, `src/macro-planner-locale.ts`: pure allocation and translations.
- `src/HealthGoalCalculator.tsx`, `src/health-calculator.css`, `src/planner-locale.ts`:
  compact preview, explanation/source links, updated application copy.
- `src/calculator-settings.ts`, `src/calculator-goals.ts`: draft preference and atomic application.
- `src/goal-model.ts`, `src/goals.ts`, `src/GoalCards.tsx`: optional nutrition-only version isolation/history.
- `src/macro-planner.test.ts`, `src/macro-planner-goals.test.ts`: calculation and persistence tests.
- `src/interactive-planner-goals.test.ts`: expected complete nutrition application.
- `tests/macro-planner.spec.ts`: new bilingual/mobile integration coverage.
- `tests/active-goals-overview.spec.ts`: expect the newly enabled third macro goal;
  measure transient-feedback layout relative to Calculator rather than the Overview
  above it, which legitimately changes when new nutrient goals become active.
- This implementation report.

Final validation: TypeScript passed; 420 unit tests across 54 files passed;
23 relevant browser tests passed; production build and PWA generation passed.
Vite retains its bundle-size advisory. No deployment or public repository changes
were performed.
