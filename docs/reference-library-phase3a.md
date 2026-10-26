# Built-in exercise references — Phase 3A

Static presets remain in `src/data/builtInExercises.ts`; nothing seeds reference
entries into IndexedDB. All codes, MET values and original descriptions were
checked against the official 2024 Adult Compendium category pages:

| Preset | Code | MET | Official category |
| --- | --- | --- | --- |
| Walking, moderate transportation pace | 16060 | 3.5 | [Transportation](https://pacompendium.com/transportation/) |
| Jogging, self-selected | 12020 | 7.5 | [Running](https://pacompendium.com/running/) |
| Running, 5.0–5.2 mph | 12030 | 8.5 | Running |
| Running, 6.0–6.3 mph | 12050 | 9.3 | Running |
| Freestyle, slow/recreational | 18240 | 5.8 | [Water activities](https://pacompendium.com/water-activities/) |
| Freestyle, fast/vigorous | 18230 | 9.8 | Water activities |
| Cycling, self-selected easy | 01015 | 4.3 | [Bicycling](https://pacompendium.com/bicycling/) |
| Cycling, self-selected moderate | 01016 | 7.0 | Bicycling |
| Cycling, self-selected vigorous | 01017 | 9.0 | Bicycling |
| Badminton, social singles/doubles | 15030 | 5.5 | [Sports](https://pacompendium.com/sports/) |
| Badminton, competitive match | 15025 | 9.0 | Sports |
| Resistance training, multiple exercises, 8–15 reps | 02054 | 3.5 | [Conditioning](https://pacompendium.com/conditioning-exercise/) |
| Resistance training, vigorous | 02050 | 6.0 | Conditioning |
| Calisthenics, moderate | 02022 | 3.8 | Conditioning |
| Calisthenics, vigorous | 02020 | 7.5 | Conditioning |

The source panel displays the original activity description, activity code, MET,
source title, official link and a bilingual explanation of estimation uncertainty.
Walking uses transportation code 16060 specifically, not a substituted walking
exercise entry with a different MET.

## Estimation and persistence

`exercise-estimate.ts` computes `MET × 3.5 × weightKg / 200 × minutes`. It uses
the existing shared `WeightData` latest recorded measurement, never the calendar
date or a calculator override. When no valid measurement exists, it uses 70 kg
and explicitly discloses that reference weight. Height, age, sex and BMI are not
required. The formula estimates gross expenditure; it is not a measurement or
an additional-energy adjustment to the separate goal planner.

Kcal are rounded only in the editor's display. Automatic saves retain full
precision. Manual edits—including a temporarily empty field—are preserved across
duration, intensity, exercise and weight changes. Restore automatic estimation is
an explicit action. Unknown/custom exercise names never receive an inferred MET.

Only actual exercise logs are saved. Optional additive Activity properties are
`calorieSource` (`automatic`/`manual`) and `exerciseEstimate` (reference ID, MET,
weight, weight source/record ID, original source metadata and estimated kcal).
Final kcal and duration remain the authoritative history snapshot. Opening a
saved automatic log preserves that snapshot; explicitly changing duration/type
or restoring estimation opts into a fresh estimate. Later weight or library
changes never update saved logs.

No database version, identity, indexes or table changes are needed (version 6).
Existing version-9 JSON exports/imports preserve these optional properties;
older records and backups without them continue working. Existing user records
are not backfilled, rewritten or migrated. Food references and the public-release
repository are outside this change.

## Verification

Unit coverage checks the complete code/MET map, bilingual search, full precision,
invalid inputs, fallback, latest-weight resolution, backup roundtrip, no seeding,
and immutability after weight/reference changes. Browser coverage exercises
Chinese/English mobile and desktop, intensity selection, source panel, reactive
estimates, manual overrides/restoration, custom entry, blank numeric input,
refresh persistence and preserving existing records. Browser fixtures use
isolated profiles on the test origin, not the user's browser database.

Physical iPhone Safari testing is still required; automated mobile checks use
Chromium touch emulation.

## Files in this phase

- `src/data/builtInExercises.ts`: verified static preset catalog.
- `src/exercise-estimate.ts`, `src/exercise-estimate.test.ts`: pure estimation,
  search, snapshot construction and unit coverage.
- `src/Activity.tsx`, `src/BuiltInExerciseSelector.tsx`: existing editor integration.
- `src/db.ts`: optional Activity metadata types only; no schema changes.
- `src/ReferenceSourceInfo.tsx`, `src/reference-locale.ts`,
  `src/reference-library.css`: source details, bilingual copy and compact styling.
- `src/reference-library.test.ts`, `src/built-in-foods.test.ts`,
  `tests/reference-library.spec.ts`: update obsolete empty-exercise expectations.
- `tests/built-in-exercises.spec.ts`, `playwright.reference.config.ts`: browser coverage.
- `tests/exercise-editors-consistency.spec.ts`: explicitly open the Activity tab
  before testing the existing custom/plan-linked editor workflow.
- This report: source mapping, calculation and compatibility notes.

Validation: TypeScript passed; 402 unit tests in 52 files passed. Sixteen distinct
browser checks passed across the new exercise suite (5), reference integration
suite (6), and existing exercise editor suite (5). The first broader browser run
had a transient food-dialog timeout; the complete reference integration rerun
passed. Existing editor tests also needed the explicit Activity-tab prerequisite.
Production build passed, including PWA generation. Vite retains its bundle-size
advisory. No further dataset phases, commits, pushes or public-release changes
were performed.
