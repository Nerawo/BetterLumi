# v1.0.1 浏览器测试基线对比

两次均运行全部 142 项 Playwright 测试，workers=3，未删除、跳过或放宽旧断言。基线：94 通过 / 48 失败；清理后：94 通过 / 48 失败。新增失败：0。

此表保留全部基线失败，不把与当前需求不符的历史测试当作已修复。超时和交互问题仍需单独诊断；当前通过次数的波动不能直接归因于本轮清理。完整运行日志保留在项目忽略的 work/baseline-browser.json 和 work/cleanup-browser.json。

| 文件 | 用例 | 对比结果 | 基线首个提示/定位器 |
| --- | --- | --- | --- |
| consolidated.spec.ts | shared modal date picker and nonmutating goal drafts 390 | 基线和清理后均失败 | locator('dialog.modal').locator('[name=startDate]') |
| consolidated.spec.ts | shared modal date picker and nonmutating goal drafts 430 | 基线和清理后均失败 | locator('dialog.modal').locator('[name=startDate]') |
| editorial.spec.ts | four icon-only destinations, four real themes, text pantry and two-column recipes preserve functionality | 基线和清理后均失败 | Expected: < 2 |
| exercise-recipe-workflow.spec.ts | planned actions, independent actual records and matched headings 390 | 基线和清理后均失败 | Test timeout of 45000ms exceeded. |
| exercise-recipe-workflow.spec.ts | planned actions, independent actual records and matched headings 430 | 基线和清理后均失败 | Test timeout of 45000ms exceeded. |
| exercise-recipe-workflow.spec.ts | weekly editing, double-toggle prevention, rollback and retained history | 基线和清理后均失败 | Test timeout of 45000ms exceeded. |
| exercise-recipe-workflow.spec.ts | specific-date plans stay editable through compatibility view, new editor is compact | 基线和清理后均失败 | locator('.exercise-plan-editor').locator('.plan-repeat button') |
| exercise-recipe-workflow.spec.ts | a stale planned log cannot overwrite an actual record saved by another window | 基线和清理后均失败 | Test timeout of 45000ms exceeded. |
| final-consistency.spec.ts | inline category and supplement composition at 390 | 基线和清理后均失败 | Error: locator.selectOption: Error: Element is not a <select> element |
| final-consistency.spec.ts | inline category and supplement composition at 430 | 基线和清理后均失败 | Error: locator.selectOption: Error: Element is not a <select> element |
| focused-improvements.spec.ts | exercise entries share a compact list, keep inline tags and preserve manual calories | 基线和清理后均失败 | locator('.today-layout > div').nth(1).locator('.exercise-card').locator('.activity-row') |
| focused-today.spec.ts | Stable overview, compact schedule and independent to-dos 390 zh | 基线和清理后均失败 | Expected: 280 |
| focused-today.spec.ts | Stable overview, compact schedule and independent to-dos 390 en | 基线和清理后均失败 | Expected: 280 |
| focused-today.spec.ts | Stable overview, compact schedule and independent to-dos 430 zh | 基线和清理后均失败 | Expected: 280 |
| focused-today.spec.ts | Stable overview, compact schedule and independent to-dos 430 en | 基线和清理后均失败 | Expected: 280 |
| homepage.spec.ts | default Chinese, calm empty states, compact ordering and responsive layout | 基线和清理后均失败 | getByTestId('food-progress') |
| homepage.spec.ts | below, within, above, unknown and no-goal states update live with separate exercise metrics | 基线和清理后均失败 | getByTestId('exercise-progress') |
| nutrition-summary.spec.ts | one daily summary preserves unknowns, real zero, dates and reactive editing/deletion | 基线和清理后均失败 | getByTestId('food-progress') |
| recipe-compact.spec.ts | saved recipe is compact, optional edits stay closed and snapshots remain separate at 320px | 基线和清理后均失败 | Expected: < 1 |
| recipe-compact.spec.ts | saved recipe is compact, optional edits stay closed and snapshots remain separate at 360px | 基线和清理后均失败 | Expected: < 1 |
| recipe-compact.spec.ts | saved recipe is compact, optional edits stay closed and snapshots remain separate at 390px | 基线和清理后均失败 | Expected: < 1 |
| refinement.spec.ts | compact cover keeps real progress above the fold and four updated mobile screenshots | 基线和清理后均失败 | locator('[data-testid=exercise-progress] .progress-number') |
| refinements.spec.ts | independent plan disclosure and derived per-date completion survive reload without actual logs | 基线和清理后均失败 | locator('.scheduled-plan') |
| refinements.spec.ts | supplement compact status, collapse, date persistence and management access | 基线和清理后均失败 | locator('.today-support .ritual-card').first().locator('.supplement-status').first() |
| refinements.spec.ts | create or reuse normalized categories in detail picker and keep recipe fields | 基线和清理后均失败 | Test timeout of 45000ms exceeded. |
| refinements.spec.ts | localized editable dates and fixed Pantry FAB at 390 | 基线和清理后均失败 | getByRole('dialog').locator('[name=startDate]') |
| refinements.spec.ts | localized editable dates and fixed Pantry FAB at 430 | 基线和清理后均失败 | getByRole('dialog').locator('[name=startDate]') |
| review.spec.ts | category manager, multi assignments, modal state, touch-visible nutrition, notes and deep links | 基线和清理后均失败 | Test timeout of 45000ms exceeded. |
| rings-ocr.spec.ts | required calorie examples and missing exercise metric render independent rings | 基线和清理后均失败 | getByTestId('exercise-progress') |
| today-coordinated.spec.ts | selected date is shared by overview and exactly one daily food/exercise list | 基线和清理后均失败 | getByTestId('exercise-progress').locator('.progress-number') |
| today-coordinated.spec.ts | four plan schedules, occurrence checks and actual logs stay separate across reload | 基线和清理后均失败 | Test timeout of 45000ms exceeded. |
| today-hierarchy.spec.ts | journal hierarchy, compact utilities and weight semantics 390 | 基线和清理后均失败 | Expected: "0px" |
| today-hierarchy.spec.ts | journal hierarchy, compact utilities and weight semantics 430 | 基线和清理后均失败 | Expected: "0px" |
| today-plan-supplement-ui.spec.ts | Today grouping, actual-only summary, compact forms and supplement menu 390 | 基线和清理后均失败 | locator('.planned-movement').locator(':scope > summary') |
| today-plan-supplement-ui.spec.ts | Today grouping, actual-only summary, compact forms and supplement menu 430 | 基线和清理后均失败 | locator('.planned-movement').locator(':scope > summary') |
| today-plan-supplement-ui.spec.ts | removed parent plans retain editable actual records, empty states, and legacy schedule | 基线和清理后均失败 | locator('.today-layout .activity-row') |
| today-plan-supplement-ui.spec.ts | new plan segmented recurrence, item drafts, reduced viewport footer and persisted weekdays | 基线和清理后均失败 | Error: locator.click: Error: strict mode violation: locator('.exercise-plan-editor').locator('.planned-exercise-fields').first().locator('summary') resolved to 2 elements: |
| unified-overview-delete.spec.ts | Unified delete cancellation and success in all workflows 390 | 基线和清理后均失败 | Test timeout of 45000ms exceeded. |
| unified-overview-delete.spec.ts | Unified delete cancellation and success in all workflows 430 | 基线和清理后均失败 | Test timeout of 45000ms exceeded. |
| update.spec.ts | ingredient replacement and explicit variation/original actions remain independent | 基线和清理后均失败 | Test timeout of 45000ms exceeded. |
| update.spec.ts | direct weight entry stays on Today and persists into /weight and the calendar | 基线和清理后均失败 | locator('.weight-mini') |
| update.spec.ts | custom activities, tags and manual energy persist and remain separate from food | 基线和清理后均失败 | Test timeout of 45000ms exceeded. |
| update.spec.ts | sticky notes CRUD and Log Once do not overwrite the original recipe | 基线和清理后均失败 | Test timeout of 45000ms exceeded. |
| update.spec.ts | mobile quick meals are optional, goals version and calendar dots are real, language persists | 基线和清理后均失败 | Test timeout of 45000ms exceeded. |
| weekly-inline-calendar.spec.ts | Immediate week targets, nutrient rings and circular calendar 390 zh | 基线和清理后均失败 | getByTestId('food-progress').locator('.macronutrient-goals').locator('[data-goal-metric=protein] svg') |
| weekly-inline-calendar.spec.ts | Immediate week targets, nutrient rings and circular calendar 390 en | 基线和清理后均失败 | getByTestId('food-progress').locator('.macronutrient-goals').locator('[data-goal-metric=protein] svg') |
| weekly-inline-calendar.spec.ts | Immediate week targets, nutrient rings and circular calendar 430 zh | 基线和清理后均失败 | getByTestId('food-progress').locator('.macronutrient-goals').locator('[data-goal-metric=protein] svg') |
| weekly-inline-calendar.spec.ts | Immediate week targets, nutrient rings and circular calendar 430 en | 基线和清理后均失败 | getByTestId('food-progress').locator('.macronutrient-goals').locator('[data-goal-metric=protein] svg') |
