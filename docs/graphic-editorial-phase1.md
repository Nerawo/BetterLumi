# BetterLumi · Graphic Editorial Phase 1

日期：2026-10-19。分支：design/graphic-editorial。基于维护版 68a8e14。

## 完成的视觉调整

- Today 使用浓缩英文标题、本地可离线字体、可翻译的中文标题与森林绿、陶土橙、金黄、桃色几何构图。中文保持可读的 CJK 无衬线字体。
- Food / Activity 保留并排。实际数值、单位、热量圆环、三种营养素进度与运动目标层次统一；沿用原有每日/周均计算和缺失值语义。
- 餐食以文字、竖向色条和醒目的热量数字呈现。运动记录、嵌套计划、补充剂、体重、周计划及底部工具区域统一为轻量日志排版。
- 照片库与裁剪仍可从顶部图标进入；“我的封面照片”可展开预览。原图及独立裁剪参数保留。
- 固定四图标导航不变，四种主题保留。切换日期时目标区域保持稳定，避免日历上移。

## 数据与范围

未改动 IndexedDB 名称、版本、表结构、迁移、备份格式、目标计算、营养聚合、计划关联或日志计算。没有改动依赖与 Vite 配置。用户的 localhost:5173 服务与来源未更换。测试使用独立浏览器上下文及测试来源，不访问日常使用的浏览器资料。新增手机测试在只读交互前后比较全部导出 tables，相同。

Recipes、Pantry、More、Weight 及其相关弹窗与维护版作 390/430px × 中英文对比，共 32 组图像一致。没有进行这些页面的重设计。

## 验证

| 检查 | 结果 |
| --- | --- |
| npm.cmd run typecheck | 通过 |
| npm.cmd run check:code | 通过；71 个模块、565 处字面翻译引用 |
| npm.cmd test | 17 个文件，115 项通过 |
| npm.cmd run build | 通过；PWA 缓存 120 项，含本地字体 |
| 专项浏览器测试 | 初轮 28 项通过；修正后 16 项通过（包含 5 项重叠新用例） |
| 手机截图与交互 | 390/430px、中英文、四主题、桌面、空记录、零值、缺失营养、周均覆盖、计划折叠与照片编辑 |
| 生产版离线检查 | 离线刷新可打开 Today，Service Worker 控制页面，本地显示字体可加载 |
| 全套浏览器最终运行 | 99 通过 / 48 失败 / 0 跳过 |

旧文档基线为 142 项：94 通过 / 48 失败。本轮全套 147 项（新增 5 项），相比基线新增失败 0 项。对比按失败用例身份统计；旧用例的首个失败提示可能因新版布局而变化，不表示全部旧故障原因完全相同。完整记录保留在项目 work/graphic-final-all-browser.json；对比在 work/graphic-final-comparison.json。旧基线说明见 docs/maintenance-v1.0.1-browser.md。

中间一次全套运行为 83 通过 / 64 失败；发现的 16 个新增失败中，2 个涉及日期切换时日历轻微上移，已固定目标区高度修复；其余涉及旧展示定位与断言。修正后重新运行完整 147 项，得到以上最终结果。

测试没有删除或跳过。随设计更新了旧标题/照片入口定位、已移除餐食缩略图的展示断言、热量圆环与细进度条的视觉断言及简短空态文案；继续验证原图保留、目标数值、记录关联和备份一致性。

## 修改文件

- src/CoverLibrary.tsx：图形化页首与可展开照片预览，保留照片管理和裁剪。
- src/TodayProgress.tsx、src/OverviewGoalProgress.tsx：展示方式与简短空态，复用已有计算。
- src/graphic-today.css：仅 Today 的设计令牌、排版、进度与记录样式。
- src/main.tsx：加载新样式。
- src/i18n.ts：中英文标题与照片预览文案。
- public/fonts/barlow-condensed-latin-800.woff2、public/fonts/barlow-condensed-OFL.txt：本地 Barlow Condensed 字体与 SIL OFL 授权，无新增 npm 依赖。
- resource/graphic-editorial.png：用户提供的设计参考，未作为运行时背景图使用。
- tests/graphic-today.spec.ts：新增 5 项测试与截图。
- tests/editorial.spec.ts、tests/overview-levels.spec.ts、tests/unified-overview-delete.spec.ts、tests/update.spec.ts：更新与新设计直接相关的定位/展示断言。
- docs/graphic-editorial-phase1.md：本报告与完整浏览器失败清单。

## 已知限制与剩余问题

仍有旧浏览器测试失败，详见下表；不能将本次结果称为“全套全部通过”。生产构建保留原先主包超过 500kB 的体积提示。已用 Windows Chrome 做触控模拟，尚未在真实 iPhone Safari 或安装版 PWA 上验证。

| 文件 | 用例 | 与基线比较 | 首个提示 |
| --- | --- | --- | --- |
| consolidated.spec.ts | shared modal date picker and nonmutating goal drafts 390 | 已有基线失败 | Error: expect(locator).toHaveValue(expected) failed · Locator:  locator('dialog.modal').locator('[name=startDate]') · Expected: "2026-10-01" · Received: "2026-10-18" · Timeout:  5000ms |
| consolidated.spec.ts | shared modal date picker and nonmutating goal drafts 430 | 已有基线失败 | Error: expect(locator).toHaveValue(expected) failed · Locator:  locator('dialog.modal').locator('[name=startDate]') · Expected: "2026-10-01" · Received: "2026-10-18" · Timeout:  5000ms |
| editorial.spec.ts | four icon-only destinations, four real themes, text pantry and two-column recipes preserve functionality | 已有基线失败 | Error: expect(received).toBeLessThan(expected) · Expected: < 2 · Received:   64 |
| exercise-recipe-workflow.spec.ts | planned actions, independent actual records and matched headings 390 | 已有基线失败 | Test timeout of 45000ms exceeded. |
| exercise-recipe-workflow.spec.ts | planned actions, independent actual records and matched headings 430 | 已有基线失败 | Test timeout of 45000ms exceeded. |
| exercise-recipe-workflow.spec.ts | weekly editing, double-toggle prevention, rollback and retained history | 已有基线失败 | Test timeout of 45000ms exceeded. |
| exercise-recipe-workflow.spec.ts | specific-date plans stay editable through compatibility view, new editor is compact | 已有基线失败 | Error: expect(locator).toHaveCount(expected) failed · Locator:  locator('.exercise-plan-editor').locator('.plan-repeat button') · Expected: 3 · Received: 2 · Timeout:  5000ms |
| exercise-recipe-workflow.spec.ts | a stale planned log cannot overwrite an actual record saved by another window | 已有基线失败 | Test timeout of 45000ms exceeded. |
| final-consistency.spec.ts | inline category and supplement composition at 390 | 已有基线失败 | Error: locator.selectOption: Error: Element is not a <select> element · Call log: ·   - waiting for locator('.supplement-section').locator('.supplement-status').first() ·     - locator resolved to <button type="button" aria-haspopup="menu" aria-expanded="false" class="supplement-status" data-status="unconfirmed" aria-label="维生素 D3 · 未确认">…</button> ·   - attempting select option action |
| final-consistency.spec.ts | inline category and supplement composition at 430 | 已有基线失败 | Error: locator.selectOption: Error: Element is not a <select> element · Call log: ·   - waiting for locator('.supplement-section').locator('.supplement-status').first() ·     - locator resolved to <button type="button" aria-haspopup="menu" aria-expanded="false" class="supplement-status" data-status="unconfirmed" aria-label="Omega-3 · 未确认">…</button> ·   - attempting select option action |
| focused-improvements.spec.ts | exercise entries share a compact list, keep inline tags and preserve manual calories | 已有基线失败 | Error: expect(locator).toHaveCount(expected) failed · Locator:  locator('.today-layout > div').nth(1).locator('.exercise-card').locator('.activity-row') · Expected: 1 · Received: 2 · Timeout:  5000ms |
| focused-today.spec.ts | Stable overview, compact schedule and independent to-dos 390 zh | 已有基线失败 | Error: expect(received).toBe(expected) // Object.is equality · Expected: 6 · Received: 4 |
| focused-today.spec.ts | Stable overview, compact schedule and independent to-dos 390 en | 已有基线失败 | Error: expect(received).toBe(expected) // Object.is equality · Expected: 6 · Received: 4 |
| focused-today.spec.ts | Stable overview, compact schedule and independent to-dos 430 zh | 已有基线失败 | Error: expect(received).toBe(expected) // Object.is equality · Expected: 6 · Received: 4 |
| focused-today.spec.ts | Stable overview, compact schedule and independent to-dos 430 en | 已有基线失败 | Error: expect(received).toBe(expected) // Object.is equality · Expected: 6 · Received: 4 |
| homepage.spec.ts | default Chinese, calm empty states, compact ordering and responsive layout | 已有基线失败 | Error: expect(locator).toContainText(expected) failed · Locator: getByTestId('food-progress') · Expected substring: "暂无记录" · Received string:    "饮食暂无饮食记录" · Timeout: 5000ms |
| homepage.spec.ts | below, within, above, unknown and no-goal states update live with separate exercise metrics | 已有基线失败 | Error: expect(locator).toContainText(expected) failed · Locator: getByTestId('exercise-progress') · Expected substring: "距时长目标还差 10 分钟" · Received string:    "运动未记录20分钟时长目标20 / 30分钟还差 10 分钟消耗目标未记录 / 200kcal" · Timeout: 5000ms |
| nutrition-summary.spec.ts | one daily summary preserves unknowns, real zero, dates and reactive editing/deletion | 已有基线失败 | Error: expect(locator).toContainText(expected) failed · Locator: getByTestId('food-progress') · Expected substring: "暂无记录" · Received string:    "饮食暂无饮食记录" · Timeout: 5000ms |
| recipe-compact.spec.ts | saved recipe is compact, optional edits stay closed and snapshots remain separate at 320px | 已有基线失败 | Error: expect(received).toBeLessThan(expected) · Expected: < 1 · Received:   NaN |
| recipe-compact.spec.ts | saved recipe is compact, optional edits stay closed and snapshots remain separate at 360px | 已有基线失败 | Error: expect(received).toBeLessThan(expected) · Expected: < 1 · Received:   NaN |
| recipe-compact.spec.ts | saved recipe is compact, optional edits stay closed and snapshots remain separate at 390px | 已有基线失败 | Error: expect(received).toBeLessThan(expected) · Expected: < 1 · Received:   NaN |
| refinement.spec.ts | compact cover keeps real progress above the fold and four updated mobile screenshots | 已有基线失败 | Error: expect(locator).toContainText(expected) failed · Locator: locator('[data-testid=exercise-progress] .progress-number') · Expected substring: "25" · Received string:    "未记录" · Timeout: 5000ms |
| refinements.spec.ts | independent plan disclosure and derived per-date completion survive reload without actual logs | 已有基线失败 | Error: expect(locator).toHaveCount(expected) failed · Locator:  locator('.scheduled-plan') · Expected: 2 · Received: 0 · Timeout:  5000ms |
| refinements.spec.ts | supplement compact status, collapse, date persistence and management access | 已有基线失败 | Error: expect(locator).toHaveValue(expected) failed · Locator: locator('.today-support .ritual-card').first().locator('.supplement-status').first() · Expected: "unconfirmed" · Error: Not an input element · Call log: |
| refinements.spec.ts | create or reuse normalized categories in detail picker and keep recipe fields | 已有基线失败 | Test timeout of 45000ms exceeded. |
| refinements.spec.ts | localized editable dates and fixed Pantry FAB at 390 | 已有基线失败 | Error: expect(locator).toHaveValue(expected) failed · Locator:  getByRole('dialog').locator('[name=startDate]') · Expected: "2026-01-01" · Received: "2026-10-18" · Timeout:  5000ms |
| refinements.spec.ts | localized editable dates and fixed Pantry FAB at 430 | 已有基线失败 | Error: expect(locator).toHaveValue(expected) failed · Locator:  getByRole('dialog').locator('[name=startDate]') · Expected: "2026-01-01" · Received: "2026-10-18" · Timeout:  5000ms |
| review.spec.ts | category manager, multi assignments, modal state, touch-visible nutrition, notes and deep links | 已有基线失败 | Test timeout of 45000ms exceeded. |
| rings-ocr.spec.ts | required calorie examples and missing exercise metric render independent rings | 已有基线失败 | Error: expect(locator).toContainText(expected) failed · Locator: getByTestId('exercise-progress') · Expected substring: "已达到时长目标" · Received string:    "运动未记录300分钟时长目标300 / 30分钟已达标消耗目标未记录 / 300kcal" · Timeout: 5000ms |
| today-coordinated.spec.ts | selected date is shared by overview and exactly one daily food/exercise list | 已有基线失败 | Error: expect(locator).toHaveText(expected) failed · Locator:  getByTestId('exercise-progress').locator('.progress-number') · Expected: "320min" · Received: "850kcal" · Timeout:  5000ms |
| today-coordinated.spec.ts | four plan schedules, occurrence checks and actual logs stay separate across reload | 已有基线失败 | Test timeout of 45000ms exceeded. |
| today-hierarchy.spec.ts | journal hierarchy, compact utilities and weight semantics 390 | 已有基线失败 | Test timeout of 45000ms exceeded. |
| today-hierarchy.spec.ts | journal hierarchy, compact utilities and weight semantics 430 | 已有基线失败 | Test timeout of 45000ms exceeded. |
| today-plan-supplement-ui.spec.ts | Today grouping, actual-only summary, compact forms and supplement menu 390 | 已有基线失败 | Error: expect(locator).toContainText(expected) failed · Locator: locator('.planned-movement').locator(':scope > summary') · Expected substring: "1/3 · 45 分钟 · 220 kcal" · Received string:    "当日计划1/390 分钟部分数据" · Timeout: 5000ms |
| today-plan-supplement-ui.spec.ts | Today grouping, actual-only summary, compact forms and supplement menu 430 | 已有基线失败 | Error: expect(locator).toContainText(expected) failed · Locator: locator('.planned-movement').locator(':scope > summary') · Expected substring: "1/3 · 45 分钟 · 220 kcal" · Received string:    "当日计划1/390 分钟部分数据" · Timeout: 5000ms |
| today-plan-supplement-ui.spec.ts | removed parent plans retain editable actual records, empty states, and legacy schedule | 已有基线失败 | Error: expect(locator).toHaveCount(expected) failed · Locator:  locator('.today-layout .activity-row') · Expected: 3 · Received: 4 · Timeout:  5000ms |
| today-plan-supplement-ui.spec.ts | new plan segmented recurrence, item drafts, reduced viewport footer and persisted weekdays | 已有基线失败 | Error: locator.click: Error: strict mode violation: locator('.exercise-plan-editor').locator('.planned-exercise-fields').first().locator('summary') resolved to 2 elements: ·     1) <summary>…</summary> aka locator('summary').filter({ hasText: '游泳' }) ·     2) <summary>…</summary> aka locator('summary').nth(4) · Call log: ·   - waiting for locator('.exercise-plan-editor').locator('.planned-exercise-fields').first().locator('summary') |
| unified-overview-delete.spec.ts | Unified delete cancellation and success in all workflows 390 | 已有基线失败 | Test timeout of 45000ms exceeded. |
| unified-overview-delete.spec.ts | Unified delete cancellation and success in all workflows 430 | 已有基线失败 | Test timeout of 45000ms exceeded. |
| update.spec.ts | ingredient replacement and explicit variation/original actions remain independent | 已有基线失败 | Test timeout of 45000ms exceeded. |
| update.spec.ts | direct weight entry stays on Today and persists into /weight and the calendar | 已有基线失败 | Error: expect(locator).toContainText(expected) failed · Locator: locator('.weight-mini') · Expected substring: "70.0 kg" · Received string:    "WeightRecord Weight70.0kgEdited historical noteView weight journal" · Timeout: 5000ms |
| update.spec.ts | custom activities, tags and manual energy persist and remain separate from food | 已有基线失败 | Test timeout of 45000ms exceeded. |
| update.spec.ts | sticky notes CRUD and Log Once do not overwrite the original recipe | 已有基线失败 | Test timeout of 45000ms exceeded. |
| update.spec.ts | mobile quick meals are optional, goals version and calendar dots are real, language persists | 已有基线失败 | Test timeout of 45000ms exceeded. |
| weekly-inline-calendar.spec.ts | Immediate week targets, nutrient rings and circular calendar 390 zh | 已有基线失败 | Error: expect(locator).toHaveAttribute(expected) failed · Locator: getByTestId('food-progress').locator('.macronutrient-goals').locator('[data-goal-metric=protein] svg') · Expected pattern: /80g/ · Received string:  "蛋白质 · 每日 · 80 g · ≥ 70 g · 已进入目标范围" · Timeout: 5000ms |
| weekly-inline-calendar.spec.ts | Immediate week targets, nutrient rings and circular calendar 390 en | 已有基线失败 | Error: expect(locator).toHaveAttribute(expected) failed · Locator: getByTestId('food-progress').locator('.macronutrient-goals').locator('[data-goal-metric=protein] svg') · Expected pattern: /80g/ · Received string:  "Protein · Daily · 80 g · ≥ 70 g · Within your target range" · Timeout: 5000ms |
| weekly-inline-calendar.spec.ts | Immediate week targets, nutrient rings and circular calendar 430 zh | 已有基线失败 | Error: expect(locator).toHaveAttribute(expected) failed · Locator: getByTestId('food-progress').locator('.macronutrient-goals').locator('[data-goal-metric=protein] svg') · Expected pattern: /80g/ · Received string:  "蛋白质 · 每日 · 80 g · ≥ 70 g · 已进入目标范围" · Timeout: 5000ms |
| weekly-inline-calendar.spec.ts | Immediate week targets, nutrient rings and circular calendar 430 en | 已有基线失败 | Error: expect(locator).toHaveAttribute(expected) failed · Locator: getByTestId('food-progress').locator('.macronutrient-goals').locator('[data-goal-metric=protein] svg') · Expected pattern: /80g/ · Received string:  "Protein · Daily · 80 g · ≥ 70 g · Within your target range" · Timeout: 5000ms |
