# Inline Health Calculator and interactive planner

The Calculator remains the sixth Today tab. It uses document scrolling and the existing themes, inputs and safe-area spacing; it is neither a modal nor a new route.

## Overview and drafts

- BMI uses the latest valid Weight Journal record and saved height. Its one Current weight reference follows the journal display preference; there is no overview unit selector. Collapsible adult BMI categories precede Body Data & Goal Estimation. The adult classification is hidden for known ages under 20. BMI is a screening measure, not a diagnosis.
- Height uses settings.heightCm. Current weight follows the latest valid Weight Journal record until explicitly overridden in the calculator; manual weight never writes to the journal. Blank drafts remain blank.
- settings.healthGoalCalculatorDraft retains its version-1 envelope. The active exercise inputs are exerciseEnabled and exerciseMinutes (default 150). Legacy plannerMode, dailyIntake, exerciseCalories, exerciseCustom and keepExerciseCustom fields remain accepted and preserved for backup compatibility, but are never read as calculation overrides. Old drafts retain the last explicitly entered duration; outputs never change it. Writes remain serialized.
- Journal edits update BMI automatically even when the planner has a separate manual calculation-weight draft. Ordinary estimates now derive immediately from the current draft; there is no Calculate button or old-result snapshot to become stale. A slider and one compact native numeric input edit each value. Numeric input supports temporary blanks; explicit external changes synchronize even if Safari leaves another input focused.

## One-way live calculation

planInteractively reuses estimatedEnergy, conversions and assessGoalPlan. Only body data/activity, target weight, target duration and optional exercise minutes are editable. Sliders accompany precise numeric inputs for the three planning inputs; blank drafts remain blank.

- Signed change in kg × 7,700 / days adjusts baseline maintenance. Losing weight subtracts the required deficit; gaining weight adds a surplus. Additional planned weekly exercise kcal ÷ 7 increases the theoretical food intake while keeping the target/timeline fixed.
- Exercise uses the existing net moderate assumption: (4 − 1) MET × current weight in kg × weekly minutes / 60. The resting 1 MET is already included in baseline. Sessions already represented by Daily Activity must not be entered again; actual logged exercise is never automatically added.
- Estimated weekly exercise calories and daily intake are read-only editorial results with small Calculated labels. There are no sliders, numeric input fields, custom expenditure flags or reverse-duration controls for either output. Legacy overrides are inert even when calling goal persistence directly.
- Zero exercise minutes produces an explicit calculated zero, not missing data. Missing/invalid minutes produce an unavailable result, never a guessed zero. Disabling exercise removes its contribution without touching saved exercise goals.
- No calculated result writes back into a planning input. Explicit adoption of a suggested timeline and explicit Apply actions remain user initiated.
- Units and display rounding remain unchanged. Intake and exercise kcal are displayed as integers, matching saved targets; formulas retain their intermediate precision. Unsafe arithmetic stays visible with warnings and cannot bypass existing application screening.
- Results and supporting summaries are compact, with maintenance, BMR, target BMI, total/weekly change and methodology in the existing details disclosure.

References: [2024 Adult Compendium](https://pacompendium.com/), [MET assumptions and limitations](https://pacompendium.com/corrected-mets/). These static estimates are not individualized medical prescriptions or guaranteed trajectories.

## Model eligibility and screening

- Mifflin–St Jeor: 10 × kg + 6.25 × height cm − 5 × age, −161/+5 coefficient; activity multipliers 1.2/1.375/1.55/1.725. An omitted coefficient shows formula endpoints, not confidence intervals. BMR is not a minimum intake or an intake goal.
- Existing adult input bounds and conservative screening remain: age 18–120, height 100–250 cm, weight 30–350 kg, duration up to 24 average months. kg/lb/jin and weeks/months use the existing constants.
- Pregnancy, breastfeeding, clinician-directed diet restrictions and minors do not receive personalized dietary or exercise targets. BMI remains informational; restricted adults can still see informational BMR/maintenance estimates.
- The previous Calculate button disabled itself for missing height/weight, minor/excluded profiles and invalid body data, sometimes without explaining the reason. It is removed. Missing data and non-applicable recommendations now have explicit localized messages; entered values remain intact.
- Raw finite theoretical calorie estimates remain visible even if negative or outside screening limits. Such estimates are labeled Not recommended and cannot be directly applied; a longer conservative timeline can be adopted explicitly where available. There is no acknowledgement bypass for unsafe intake.
- Existing profile-specific floors, pace and endpoint energy checks remain conservative product heuristics, not clinically validated guarantees. BMR is never used as a universal floor. Additional exercise is added exactly once to food energy. Application budgets use baseline plus additional net exercise at current and target weights; the required deficit and rate of weight change do not change. Unusually high additional exercise (>25% of minimum baseline TDEE per day) blocks automated diet application rather than making an extreme exercise estimate authorize intake.
- The exact rounded intake is also checked against the profile boundary. New planner nutrition/exercise kcal targets round to the nearest integer, matching displayed values. The legacy maintenance-only application still uses its established 25-kcal rounding, with its actual applicable value shown on the explicit opt-in alternative.

References: [Mifflin–St Jeor](https://pubmed.ncbi.nlm.nih.gov/2305711/), [NIDDK planner eligibility and limitations](https://www.niddk.nih.gov/health-information/weight-management/body-weight-planner). The 7,700 kcal/kg static approximation does not predict metabolic adaptation; professional assessment is needed for individualized planning.

## Goal persistence, history and compatibility

- Calorie-scoped persistence re-evaluates the live input at the persistence boundary, reads saved tolerances and verifies saved height, then appends a calorie-only dated version starting today. Existing daily/weekly calorie frequency is retained. Macronutrients, exercise settings, their effective dates and historical versions are not overwritten.
- Exercise-scoped persistence appends an exercise-only dated version starting today with weekly minutes and weekly kcal. Nutrition settings and their dates remain independently resolved. The unified action has a pending lock, visible success/failure feedback, and no automatic apply on edit or refresh. Dexie subscriptions update overview/editor immediately.
- New optional goal scope:'exercise' supplements the existing scope:'calories'. Nutrition resolution ignores exercise-only records. Exercise resolution ignores calorie-only records. Full goal saves continue using the existing precedence and edit rules. Scoped records never match a full-record edit context. History clearly labels scoped versions.
- IndexedDB remains version **6**, with the same database name, stores, indexes and migrations. No data rewrite or initialization migration is needed; the scope is additive record metadata.
- Main JSON exports use format **9**. Import accepts **2–9**; older goals and unrelated records retain their meaning. Exercise-scoped records mislabeled as format <9 are rejected before writes, just as calorie-scoped records require format ≥8. Older application builds cannot import format 9 safely; use this build to restore new backups. Existing v1 compatibility helpers and legacy database fields are retained.
- Backups contain private health data and must not be committed.

## Verification

Unit coverage includes forward formulas, net exercise including zero, inert legacy overrides, missing/invalid fields, restricted profiles, unsafe targets, long horizons, unit equivalence, independent scoped application, historical preservation, backup v9 round-trip and old backup compatibility. Browser tests cover 390/430/1440 px, Chinese/English, all four themes, input sliders, read-only output presence, blank numeric buffers, inert legacy override behavior, explicit application, unchanged weight records, reload persistence, BMI and existing goal-editor workflows.

Automated Chromium touch/viewport checks do not prove physical iPhone Safari keyboard/drag behavior. Real-device Safari remains a manual validation item. Existing code-audit warnings concern three unrelated OCR compatibility modules retained intentionally; production build retains its existing large-chunk advisory.

Final validation: TypeScript check, all 264 unit tests across 40 files, all 30 focused browser regressions, code checks and production build passed. Browser coverage includes reduced-height mobile viewports with both application actions above the fixed navigation. The retained code-audit notices are the three existing OCR compatibility modules; the build has the existing >500 kB chunk advisory.

## Weight entry refinement

The shared WeightEntry now uses the standard visual-viewport-aware modal shell, a compact date field, prominent weight value with adjacent kg/lb select, secondary notes, and accessible Cancel/Save actions. Canonical kg state remains separate from the numeric edit buffer, preventing unit-only round trips from modifying stored weight. Blank and decimal edits remain editable, with validation on blur/save. Existing IDs and creation timestamps survive edits. No schema or backup format change is introduced by this refinement. Unit selection remains in the Weight Journal and entry form; planner unit selectors continue serving their existing estimation inputs.

## Quick-adjustment slider limits

Target weight uses current calculation kg −15 to +10, in 0.5 kg steps, converted with the existing kg/lb/jin helpers. Missing or unsupported current weight disables only its quick slider with an explanation; manual editing stays available. Duration uses 1–30 weeks in 1-week steps, converted equivalently for months. These are UI quick ranges, not new calculation/eligibility limits. Manual inputs retain values outside the ranges and off-step decimals. A visual-only bounded range value positions the thumb at the nearest endpoint; it never writes a normalized value into the draft. A localized Outside quick-adjustment range hint explains this. The next deliberate slider movement replaces the entered value with that selection. Calculations, persisted drafts, unit changes and refresh always use actual input values. No schema, backup format, goal or record changes occur from moving the visual thumb on render.

Validation: 264 unit tests, 34 browser regressions (including 390/430 px Chinese/English quick-range scenarios), TypeScript and production build.

### Unified plan application
One Apply Plan action commits eligible calorie and enabled weekly exercise goals with the planning draft in one Dexie transaction. Independent calorie/exercise scopes preserve unrelated goals and historical periods. A failed write rolls back the whole operation; unchanged same-day scoped targets do not duplicate history.

Unsupported nutrition remains an estimate. The compact review shows intake, weekly exercise minutes, estimated weekly burn and the exact blocking reason. It has exactly Apply Plan and Back to Edit footer actions, plus the standard close control. Eligible exercise can be applied without changing unsupported nutrition. There is no preference-only application or maintenance substitution option. If no goals are eligible, the persistence boundary rejects the call and the dialog explains that no active goal was saved, without displaying success. Existing automatic calculator-draft retention remains separate from active goals. No schema or backup-format change is required.

## Revised calorie screening tiers

The existing statuses now distinguish Recommended (planning reference), Use caution, and Outside the supported planning range. These are product screening categories, not medical clearance. Current/target adult-underweight exclusions, minors, pregnancy/breastfeeding/clinician-directed restrictions and unreliable inputs remain ineligible. No saved goals or historical evaluations are recalculated or rewritten by changing this live calculator policy.

The old intake floor was max(1200 female / 1500 male, baseline TDEE × (1 − margin)), where the margin was only 10% below BMI 21 or at age 65+, 15% below BMI 25, otherwise 20%. The same margins also rejected total deficits at current/endpoint weight. An intermediate build made those margins caution-only but retained the BMI-21 discontinuity. The current continuous references described below replace that remaining step. BMR was never the intake floor.

Application screening retains 1200/1500 kcal coefficient-specific starting references. Let higherProgress = clamp((BMI − 25) / 5, 0, 1). The supported deficit fraction is 25% + 5% × higherProgress and the absolute daily deficit cap is 500 + 250 × higherProgress kcal. At age 65+, the existing stricter 20% / 500 kcal screen remains. Pace is capped at the lesser of 1 kg/week and 1% of current weight/week; at age 65+, the lesser of 0.75 kg and 0.5%. Only current/target BMI below 18.5 prevents planning on BMI classification grounds; the former BMI20 buffer has been removed. These combined limits are deliberately documented product heuristics; none is a universal safe intake or a validated diagnosis. Both the raw intake and the exact rounded intake must pass.

Additional exercise remains net (4 − 1) MET × kg × weekly minutes / 60, added to intake once, divided by seven. Screening budgets now use baseline + additional exercise consistently, including the target-weight-scaled exercise estimate at the endpoint. Additional exercise above 25% of baseline daily TDEE remains ineligible for automatic nutrition planning. Existing activity multipliers are unchanged; users must exclude exercise already covered by their activity choice.

Diagnostic regression: female coefficient, age 43, 165 cm, 56.65 to 54.975 kg over 10 weeks, sedentary, no extra exercise gives TDEE 1466.10, deficit 184.25 and intake 1281.85 kcal/day. The old floor was 1319.49 and old endpoint deficit budget was 144.60: both intake and deficit rejected it. The revised result is cautionary and applicable because it is a normal-BMI loss request, not silently changed to maintenance. With the continuous reference, that older fixture no longer triggers intake/deficit cautions specifically. This is a reproducible fixture, not a claim that it matches an unseen user's stored inputs. A nearby exactly-1284 fixture verifies normal Apply Plan persistence with unchanged macros/history and independent weekly exercise.

Evidence context: [MedlinePlus low-calorie diets and supervision](https://medlineplus.gov/ency/patientinstructions/000885.htm), [NIDDK planner restrictions and activity changes](https://www.niddk.nih.gov/bwp), [NHLBI evidence review for adults with overweight/obesity](https://www.nhlbi.nih.gov/sites/default/files/media/docs/obesity-evidence-review.pdf). Clinical weight-loss guidance for overweight/obesity does not establish that every normal-BMI person should lose weight. Reference calorie levels and deficit ranges inform screening, not individual prescriptions. The exact percentage/pace combinations above are product choices, not formulas endorsed as universally safe by these sources.

## BMI boundary continuity and specific explanations

There is no BMI-21 branch. For adults below 65, gentler warning margins use normalProgress = clamp((BMI − 18.5) / 6.5, 0, 1): deficit fraction 15% + 5% × normalProgress, absolute cap 375 + 125 × normalProgress kcal/day. The gentle relative pace is 0.5% + 0.5% × higherProgress of current weight per week (also capped at 0.75 kg/week). Supported limits use the continuous higherProgress formula above. Numerical energy/deficit/pace margins have no step at 21, 25 or 30; descriptive standard BMI category warnings may still change at standard category boundaries. These interpolations are transparent product heuristics, not evidence of a clinically validated continuous BMI risk curve. The supporting evidence informs classification, caution and supervision, not the exact interpolation coefficients.

Adult BMI <18.5 is the sole BMI-based exclusion. The former <20 product buffer and its copy have been removed from eligibility, timeline suggestions and reachable-weight estimates. Minor/excluded profiles, implausible energy estimates, very low intake, unsupported pace and endpoint budgets remain guarded. BMR remains informational.

Assessment results carry transient numeric evidence: intake source (absolute starting reference versus relative energy boundary), gentler/supported current and endpoint deficit budgets, pace limits and energy-estimate issues. planReasonMessage maps these fields to bilingual explanations; it never recalculates eligibility or writes data. The overview, review dialog and calculation details share these explanations. A numerical shortfall, excessive rate, low target BMI or unsupported profile is stated directly. Raw input values and precise calculation semantics are unchanged.

### Fictional regression scenario

The synthetic adult profile uses age 43, female coefficient, 56 kg and 166 cm with light activity. BMR is 1221.5 and baseline TDEE is 1679.5625 kcal/day. Tests choose a two-kilogram change and explicit timelines to compare cautionary and unsupported intake scenarios. Additional exercise is estimated at 420 kcal for 150 minutes/week and increases theoretical intake by 60 kcal/day at the same timeline; it is never deducted twice.

These values are invented regression inputs, not personal measurements or dietary recommendations. Boundary tests preserve continuity around BMI 20/21/25/30, underweight screening, unit invariance, reactive exercise/timeline changes, explicit goal application and history/persistence checks. See synthetic-test-data.md. Real iPhone Safari remains a device-test limitation.

BMI classification reference: [CDC adult BMI categories](https://www.cdc.gov/bmi/adult-calculator/bmi-categories.html). Calorie/planning context: [NIDDK](https://www.niddk.nih.gov/bwp), [MedlinePlus](https://medlineplus.gov/ency/patientinstructions/000885.htm). No database migration or backup-format change is introduced.

## Removal of BMI20 buffer and simplified confirmation

The previous BMI20 buffer has been fully removed, not moved to another number. Eligibility, target-first timelines and duration-first reachable weights use the adult underweight boundary of 18.5 only. Normal BMI is informational and does not certify calorie adequacy. Source checks no longer contain lowReserve or a BMI20 planning guard.

BMI19.8 and20.2 modest-loss cases both pass the independent checks and atomically save nutrition + weekly exercise. Immediate 19.9999/20.0001 cases also retain continuous numerical margins and equal applicability. Underweight targets, low energy, excessive pace and excluded profiles are still rejected for their actual reason.

### Remaining independent application checks (unchanged limits)

These are explicit app model/support limits, not individual medical clearance. No new limit is introduced by removing the BMI buffer.

| Check | Exact remaining condition |
| --- | --- |
| Adult underweight | Current BMI <18.5 or target BMI <18.5 prevents automatic nutrition planning. |
| Profile | Minor age <18, pregnancy/breastfeeding/clinician-restricted flag, missing required values or unsupported formula coefficient prevents automatic nutrition application. BMI information remains separate. |
| Supported input model | Integer age 18–120; height 100–250 cm; current and target weight 30–350 kg; duration >0 and at most 24 average months (104.357142857 weeks). UI quick-slider bounds never clamp manual values. |
| Calorie minimum | Raw intake and exact rounded kcal target must both be >= max(B, currentTotal × (1 − F)). B is 1200 for the female coefficient or1500 for male. F = 0.25 + 0.05 × clamp((currentBMI −25)/5,0,1), or0.20 at age65+. BMR is never used as an intake floor. |
| Deficit budget | Required daily deficit <= max(0, min(C, currentTotal×F, targetTotal×F, currentTotal−B, targetTotal−B)). C = 500 +250×clamp((currentBMI−25)/5,0,1) kcal/day, or500 at age65+. targetTotal uses target-weight baseline TDEE + current extra exercise×target/current weight. |
| Weekly loss pace | Absolute weekly loss <= min(1 kg, 1% of current weight). At age65+, <= min(0.75 kg, 0.5% of current weight). |
| Gain pace | Weekly gain <= min(0.25 kg, 0.5% of current weight, min(250, baseline TDEE×0.1)/1100). |
| Extra exercise for nutrition | Net additional daily exercise must be finite, nonnegative and <=25% of baseline TDEE. Exercise minutes must be finite and within the existing 0–10080/week model input bounds; these bounds are not exercise recommendations. |
| Baseline plausibility | Estimated baseline must be finite, BMR >0, baseline TDEE/kg >=10 and upper estimate TDEE/kg <=80, and baseline TDEE >=B. This is model plausibility, not a BMR-as-intake floor. |
| No eligible goals | Unified apply throws No eligible goals before any goal/draft transaction when neither nutrition nor enabled exercise is eligible; it never returns a preference-only success. |

Independent exercise applicability retains valid adult body data, excluded-profile checks, enabled exercise and valid minutes. Applying exercise alone explicitly leaves nutrition unchanged. Planning settings can still auto-retain edits under the existing draft mechanism; this never activates an unfinished or unsupported goal.

Calorie thresholds do not validate micronutrient composition or guarantee nutritional adequacy. A clinician can assess factors the model does not measure. Confirmed historical goals retain their stored target/range, effective periods and tolerance history.

Validation for this change: 302 unit tests and39 focused browser checks, including Chinese/English at390/430px, BMI19.8/20.2, saved nutrition/exercise history, duplicate prevention, no-eligible feedback, cancellation/focus and reduced-height modal controls. Physical iPhone Safari remains a manual verification item. No database migration or backup change.


## Recorded weight synchronization

BMI, Body Data and the reactive planner now obtain current weight from the shared WeightDataProvider latestWeight, resolved by full measurement timestamp. Calendar selection never scopes calculator weight. The current-weight field is read-only; use the Weight Journal to change the recorded measurement. Its kg/lb selector updates the existing weightUnit display setting, not measurements. Legacy calculator currentWeight/currentWeightUnit draft fields remain serializable for compatibility but do not override the shared record. All other saved planner inputs and Personal Goals remain unchanged. See weight-measurements.md for date grouping, shared subscription and regression coverage. No database/backup version change.


## Body BMR and user-entered professional guidance

Body Data shows a read-only Mifflin–St Jeor resting-energy estimate using the existing estimatedEnergy function: 10 × kg + 6.25 × cm − 5 × age + 5 (male) or −161 (female). It updates from shared latestWeight, height, age and formula coefficient; without valid adult body data and a coefficient it shows a setup prompt. It is a reference estimate, not an intake prescription or universal safety floor. Original equation: https://pubmed.ncbi.nlm.nih.gov/2305711/ .

The existing excluded master remains backward compatible and conservatively prevents automatic personalized recommendations. It is now labeled Special circumstances or professional guidance, with independent optional pregnant, breastfeeding and professionalDiet booleans. Only professionalDiet reveals professionalKcal, initially blank. These optional values live in the existing version-1 calculator draft/settings envelope; closing either progressive section retains values. Legacy excluded-only drafts are not guessed into a particular circumstance. No database version/index/migration or backup version change (DB6/backup9).

Mathematical adult BMR, maintenance and theoretical intake remain visible under special circumstances, while automatic nutrition/exercise eligibility retains existing exclusions. A user-provided professional target never feeds those calculations. The user must explicitly choose Professional guidance target and confirm before applying. Positive finite targets are rounded to whole kcal (the preview shows the saved value), use current calorie tolerance, and save a calorie-scoped version with additive calorieSource: professional metadata. Automatic versions use automatic provenance; old records without metadata remain valid. The professional branch bypasses automatic intake-boundary screening without implying medical verification. It retains existing non-calorie and exercise goals, exact historical records and the ordinary date/version workflow. Repeated identical applies are idempotent and goals/draft save atomically. Closing confirmation commits no goals. Source selection defaults to automatic after reload, so professional data is never silently activated.

Tests cover formula/sex/age changes, latest-weight reactivity, independent flags, empty numeric edits, hidden-value restoration, persisted drafts, explicit selection/confirmation/cancel, low professional targets, invalid/blank targets, duplicate prevention, atomic rollback, old history preservation and backup round-trip. Physical iPhone Safari remains a device QA item.


## Compact calculator and circumstance-aware presentation

This refinement supersedes the previous special-case mathematical-intake presentation: BMI and BMR/maintenance reference estimates remain available, but active special circumstances produce no automatic weight-loss daily-intake suggestion. Normal supported profiles retain the same real-time Mifflin/activity/extra-net-exercise equations and independent screening limits; no BMI20 buffer or additional calorie cutoff is introduced.

The inline flow keeps My BMI, two-column Body Data, Goal Planning sliders and compact Plan Guidance. Activity and special circumstances are native one-line disclosure settings. Activity selection closes its panel and returns keyboard focus to the summary. Methodology, saved range/effective date and detailed risk reasons are collapsed rather than removed. The summary retains one intake result, an optional read-only exercise-calorie result and a single inline target/duration/minutes summary. Inputs retain UI sans-serif typography and 44px controls; important calculated values retain editorial numerals. Normal body-to-apply controls are checked against a 1200px mobile height budget, without shrinking text.

specialCircumstances is the shared pure resolver used by UI, snapshot creation and plan persistence. Pregnant/breastfeeding legacy flags render as one female-only option; male profiles ignore those flags immediately while the original optional fields remain stored. Professional diet and other circumstances are separate flags. New optional otherSpecial in the existing calculator settings JSON marks the independent configuration; there is no IndexedDB or backup-format migration. Legacy excluded-only records resolve conservatively to Other; a legacy disabled master does not reactivate dormant flags. Opening a panel does not write any settings.

Any active special circumstance can reveal the existing manual professional calorie target entry. It starts blank and remains separate from automatic results. Clearing its final digit leaves the field open and empty. Hiding circumstances retains the value; choosing Use professional guidance target and confirming is still required before saving. Source-labelled calorie versions, tolerance ranges, transactional/idempotent persistence and unrelated goal histories remain intact. Automatic exercise prescriptions remain subject to the existing special-case eligibility rules; the read-only expenditure estimate is still available.

Coverage includes female/male transitions, merged legacy flags, every special-case suppression, ordinary live planning, BMI/BMR weight synchronization, activity selection/focus, slider/input bounds, read-only outputs, whole-field clearing, source confirmation/cancel, backup compatibility and reload persistence. Physical iPhone Safari still requires device QA; automated layouts use Chrome touch emulation in Chinese/English at390/430px.

Final QA: 317 unit tests and all77 relevant browser cases pass (including targeted reruns after adapting selectors to collapsed status summaries). Normal 390px Body Data-to-Apply height measured 994.6px, with 16px sans-serif inputs. For an unspecified coefficient/sex, retained pregnancy metadata remains conservatively active until clarified; only an explicitly male profile ignores it. Code audit has no missing literal translations and retains the same three unrelated OCR notices.


## Unified automatic/manual mode (supersedes sex-specific circumstances above)

There is now one checkbox for all users: Special circumstances or receiving professional dietary guidance. The single-line disclosure remains collapsed by default. It explains examples once, without asking for categories. When enabled it directly reveals Daily calorie target, with no nested manual-entry disclosure or extra Use professional target checkbox. BMR, current recorded weight, exercise expenditure estimates and the user's target/time/exercise planning values remain intact. The summary shows the user's manual value with Personal / professional input provenance, not an automatic dietary estimate. Applying still requires the explicit Apply Plan action and confirmation. The existing professional source metadata denotes user-entered targets and is retained for compatibility.

The only active mode is optional specialOrProfessionalGuidance in the existing calculator settings JSON. If absent, any legacy pregnant/breastfeeding/pregnancy/lactation/professionalDiet/otherSpecial flag or the legacy excluded master being true resolves to manual mode regardless of sex. An explicitly saved false overrides legacy true flags, enabling the user to switch back to automatic mode without deleting historical fields. Reading does not rewrite settings; the new flag is saved on explicit interaction. Old flags and professionalKcal survive toggling and backup/restore. No database/schema/index/backup version change, reset or record rewrite.

Sex only affects the existing body-energy formula coefficient; it no longer controls circumstances UI or mode resolution. Tests cover one identical checkbox in both sexes, all legacy flags, explicit-off precedence, empty input, restoring hidden values, manual/automatic results, source-labelled confirmed saving and refresh persistence. All underlying automatic nutrition screening and existing exercise-eligibility rules remain unchanged.


Calculator success feedback now uses the existing fixed global toast for2500 ms (✓ Plan applied), with no persistent result-card success message. Goals now defaults to a live read-only current-goal view, with the existing editor behind Edit. See active-goals-ui.md for synchronization, target/range presentation and compact empty-day overview behavior.
