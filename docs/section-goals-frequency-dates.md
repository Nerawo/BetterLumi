# Personal Goals: section frequency and optional dates

Nutrition Goals has one Daily / Weekly average selector. All enabled nutrient targets in a newly saved version share `nutritionFrequency`; individual Off flags, target values, and tolerance snapshots remain separate. Exercise retains its Daily / Weekly total selector. Its duration and burned-calorie units now sit outside the inputs.

Weekly nutrition uses the existing local Monday–Sunday window and shared daily aggregation. Each nutrient independently sums complete daily values and divides by its number of valid recorded days. Missing days/fields are not zero. Formal weekly achievement requires seven valid days for that nutrient. Weekly exercise still sums actual records once. Overview rings use the same weekly averages, and the existing Sunday star lists eligible achieved nutrients and exercise goals.

## Dates and version selection

New forms default to Limit dates off. Dates remain in the session draft when the switch is turned off and back on before saving. First enabling an empty date restriction initializes its start to the computer's local today, not a previously selected journal date. Existing explicit periods initialize with Limit dates on and retain their exact start/end. An empty end has no expiration.

Each goal family can persist `unrestricted: true` inside its existing period object. The stored `startDate` on such a period is only a version-ordering anchor, not a start restriction; `endDate` must be null. An unrestricted period is eligible on any selected date, including dates before that anchor. History displays No date limits rather than presenting that anchor as a restriction.

An unrestricted version establishes a baseline until superseded. The latest unrestricted baseline uses the existing revision / creation-time / ID tie-breakers. Only newer applicable dated versions supersede it. Among applicable dated versions, existing start-date-first precedence remains unchanged. After a newer dated restriction expires, the unrestricted baseline resumes. With no unrestricted version, existing dated-only selection is unchanged. Disabled family flags continue to mask goals without deleting values.

## Save Goals follow-up

The primary editor action is now Save Goals / 保存目标. When both goal families match the same existing effective-start pair, the editor updates only that matching version, retaining its ID, creation timestamp, and unrestricted ordering anchors. Expiration changes are edits to that same version. Changing either effective start or switching between dated and unrestricted creates a version instead. When independently resolved families have no single matching stored date pair, a new combined version preserves both source records.

Duplicate date versions are never merged or deleted: the latest matching revision / creation time / ID is edited deterministically. An expected-revision check in the write transaction rejects stale or deleted edit targets. Other historical versions remain byte-for-byte unchanged. Internal callers that do not supply an editing context continue using append-only `saveGoalVersion` behavior. The Cancel action still discards drafts without writing.

Calories and Detailed Nutrition Planning now share the same compact row class, 44px controls, 12px/500 label typography, aligned info icons and restrained top dividers. The checkbox and disclosure chevron occupy matching right-hand control slots; both label and chevron support expansion, and information buttons do not toggle it. Existing tolerance popover logic and nutrient calculations are unchanged.

Follow-up validation: TypeScript and production build passed, with **181 unit tests** and **32 browser cases** passing. Browser coverage includes Chinese/English at 390px, 430px and 1440px in Chrome/WebKit; same-date updates, new-date creation, Cancel, history preservation, popovers, weekly progress, and session restoration. The UI changes are in `GoalCards.tsx`, `journal-shared.css`, `goal-tolerances-locale.ts`, and the save-success copy in `update-locale.ts`; scoped persistence changes are in `goals.ts`. No database schema or backup-format change was needed for this follow-up.

## Persistence and backup compatibility

- IndexedDB remains schema version **6**. No stores, indexes, migrations, names, origins, or ports changed. The new fields are additive metadata; existing rows are not rewritten.
- `nutritionFrequency?: 'daily' | 'weekly'` is absent on legacy versions. Their stored metric modes remain intact, including mixed daily/weekly versions. The editor consolidates the period only when the user explicitly saves a new version.
- `nutritionPeriod.unrestricted?` and `exercisePeriod.unrestricted?` default to false when absent. Historical periods therefore keep their original meaning.
- Removed the obsolete startup/import code that discarded weekly macronutrient test settings. Import now retains goal records exactly after validation.
- JSON export is now **version 7**. Current restore accepts versions **2–7**; older backups need no destructive conversion. Version 7 explicitly prevents older builds (which can discard weekly macros) from importing these new settings under the old format. This does not guarantee running an older app build against the current database is safe; keep backups before downgrading.
- Unsaved frequency, date switches, date values, and numeric input remain session drafts, separate from IndexedDB goals and exports. Cancel and explicit save behavior are unchanged.

## Verification

Unit tests cover daily versus weekly averages for every nutrient, nutrient-specific completeness and explicit zero, exercise totals, unrestricted and dated overlap, deterministic ordering, preserving legacy records, and v7/legacy backup round trips. Mobile browser tests cover Chinese/English at 320/390/430px in Chrome and WebKit, date-switch restoration, invalid end dates, units, append-only saving, reload, distinct daily/weekly totals, and a single calendar star listing five achievements. WebKit emulation is not a physical iPhone test.

Final results: TypeScript and production build passed; all **175 unit tests** passed. **32 browser cases** passed (12 section-frequency/date workflows plus 20 existing macro-layout/session/tooltip regressions). The build retains its existing large-bundle warning. The optional code audit still flags the same three pre-existing unreachable OCR modules, with no missing literal translation keys.

Implementation files: `GoalCards.tsx`, `goal-model.ts`, `goals.ts`, `weekly-goals.ts`, `nutrition-goal-display.ts`, `MacronutrientGoals.tsx`, `TodayProgress.tsx`, `domain.ts`, `main.tsx`, `session-state.ts`, `goal-tolerances-locale.ts`, and `journal-shared.css`, with focused unit/browser tests and this note. All prior working changes were preserved on `design/graphic-editorial`; backup branches and tags were untouched.
