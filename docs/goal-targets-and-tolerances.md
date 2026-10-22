# BetterLumi — Nutrition targets, tolerance settings and goal history

## Delivered

Nutrition Goals now use one target input per enabled metric, with a read-only range and a small touch/keyboard information popover. Calories retain Daily / Weekly Average, macros remain daily-only, and existing master/metric toggles, independent effective periods and explicit New dated version saving remain intact. Advanced macros remain collapsed by default.

Default tolerances: calories ±50 kcal; protein ±10 g; carbohydrates ±15 g; fat ±5 g. All range creation, saved-snapshot validation and date-aware evaluation use `acceptableRange`: minimum=max(0,target-tolerance), maximum=target+tolerance. Missing targets/records are not zero; explicitly recorded zero is valid.

More now has standard settings rows in this order: Weight journal, Goal Tolerances, Goal history, Appearance, Language, Backup & restore, Privacy & About. Goal history uses the exact same settings-row rendering, font, icons, spacing and chevron as its siblings. Its existing read-only history is shown in a scrollable panel; the standalone serif heading has been removed.

Goal Tolerances has four numeric preferences, save/cancel, negative/empty validation and a compact Restore Defaults confirmation. Numeric fields remain freely clearable while editing. Preferences persist in IndexedDB and reactively update target-based progress. Information popovers dismiss outside or with Escape, adapt above/below the label, avoid the fixed navigation and remain usable in a reduced viewport.

## Compatibility and effective dates

- No database schema migration, database rename or backup-format bump. Dexie and main JSON backup remain v6.
- Existing goal records are never bulk converted or rewritten. Old min/max versions keep their exact original ranges and evaluation semantics.
- In the new editor, legacy bounds derive a draft target: midpoint for a bounded range, the existing bound for a one-sided goal, blank for an unbounded goal. The information popover shows the saved legacy range. Only explicit New dated version saving adopts the target/tolerance rule.
- New goal versions add optional `nutritionTargets`, `nutritionTolerances` (saved snapshot), and `nutritionToleranceRevision` metadata while retaining compatible min/max fields and all effective dates.
- Preferences use one `settings.goalTolerances` JSON value containing a version-1 list of dated tolerance events. This is a settings-payload version, not a database or backup version change.
- Preference events apply from the user's local date. Daily evaluation ignores later dates; weekly calorie evaluation uses the applicable event within the selected Monday–Sunday week, preserving the existing current-week policy. Completed earlier weeks and previous daily evaluations remain unchanged. Events after a goal's end date do not alter that expired reference.
- Goal history displays the original saved range snapshot. It does not rewrite itself to current preferences. Target-based current evaluations apply the dated preference overlay as a read-only view.
- The same resolved goal view feeds Today progress, daily nutrient indicators, weekly averages and calendar rings/stars. Seven complete calorie days are still required for weekly nutrition achievement. Exercise semantics are unchanged.
- Backup export already serializes the new optional fields/settings. Restore validates target snapshots and preference event values/dates before writing, and accepts legacy backups without them. Runtime evaluation context is stripped before saving a goal.

## Files

Added:
- src/goal-tolerance-model.ts
- src/goal-tolerances.ts
- src/goal-tolerances-locale.ts
- src/GoalTargetInfo.tsx
- src/GoalTolerancePanel.tsx
- src/goal-tolerances.test.ts
- tests/goal-tolerances.spec.ts
- playwright.tolerances.config.ts

Updated:
- src/GoalCards.tsx
- src/More.tsx
- src/goal-model.ts
- src/goals.ts
- src/main.tsx
- src/ui.tsx
- src/journal-shared.css
- src/domain.ts, src/db.ts (import validation only; no schema changes in this task)

Existing unrelated working changes were preserved on design/graphic-editorial.

## Validation

- TypeScript: passed.
- Unit tests: 163 passed / 28 files, including 9 focused tolerance tests.
- Browser tests: 12 passed in Chrome and WebKit. Chinese/English at 390/430px plus desktop 1440px; target/range editing, clearing final digit, independent masters, information popovers, reduced viewport, outside/Escape dismissal, settings persistence, negative validation, restore confirmation/cancellation, settings typography/order, history snapshots and no unintended goal/food mutations.
- Weekly browser coverage verifies live tolerance updates, incomplete-data blocking, seven-day achievement and calendar star details, while keeping old-week ranges and stored goal data unchanged.
- Backup roundtrip and malformed preference rejection: passed in isolated tests.
- Production build and PWA generation: passed; existing large-bundle warning remains.
- Code audit reports no missing literal translations. It continues to exit 1 for the three existing unreachable OCR modules (label-ocr.ts, LabelOcrPanel.tsx, nutrition-label.ts), left untouched.

Physical iPhone Safari is not available here. Windows WebKit touch contexts and reduced viewports were tested; actual iOS keyboard/PWA gestures still need device testing. Tests use isolated browser contexts and port 5190, without changing the user's localhost origin or resetting real data.
