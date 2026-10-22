# BetterLumi — Today 布局细化与封面功能退役

基于 design/graphic-editorial 的 04cc925。只调整本次 Today 布局，不启动新一轮整体设计。

## 界面

- 概览保持 Food / Movement 两列，以真实数值、目标进度、补充指标构成层级。运动实际分钟数移至补充区域，时长和消耗目标仍独立显示；没有修改日/周周期、目标或聚合计算。
- 蛋白质、碳水、脂肪使用固定的标签/数值、圆环、范围行，保证部分缺失和关闭目标时仍对齐。关闭目标显示简短状态而不绘制进度；全部关闭时收紧空白。真实零与未知保持区别。
- Food、Movement、Supplements、Exercise Plans、Personal Goals 使用共同的标题、右侧主要按钮、细分隔线和间距规则。运动计划保留中性行、实际运动保留竖向色条；收紧计划摘要和分组间距，保留所有折叠、完成、关联和编辑操作。
- More 直接呈现个人目标配置：热量及日/周均周期、三项每日营养素，以及运动时长/消耗及日/周总量周期。明确显示关闭或未设置，继续用原编辑器和历史版本；待办与备忘保持在其下方且可折叠。
- 大标题、几何图形、颜色、日历、五标签、固定四图标底栏不变；移除顶部图片图标后收紧品牌栏间距。

## 完整移除 Today 封面定制

删除 CoverLibrary.tsx、CoverFrame.tsx、covers.ts、cover-crop.ts，替换为无图片状态、处理器或数据库订阅的 TodayHeader.tsx。移除专用上传、替换、删除、选择、随机、裁切交互和弹窗，以及专用 CSS、翻译键、图标导入和删除类型。

旧 images 表、cover 字段、设置和导入/导出校验保留，没有改动 db.ts、domain.ts、schema 或迁移。保留 public/default-cover.jpg，避免旧备份中对该静态地址的引用失效；这不提供任何定制入口。未触碰 resource 内图片或数据库中原图。Recipes / Pantry 源码与共享图片处理逻辑未改。

CSS AST 对比确认：editorial.css 除封面专用选择器外，所有剩余共享样式声明与基线一致。所有新增布局样式限定在 Today。

## 验证

- npm.cmd run typecheck：通过；构建另执行 tsc -b。
- npm.cmd run check:code：通过，69个应用模块、547处字面翻译引用，中英文运行时另由浏览器断言覆盖。
- npm.cmd test：17个文件，108项通过。此前7项仅针对已退役的裁切/随机选择行为的测试随实现删除；原图、裁切参数、旧图片与设置的备份往返及无效备份拒绝测试保留。
- npm.cmd run build：通过。PWA缓存120项；主包约591.54 kB，仍有既有的500 kB体积提示。
- 相关 Playwright 集合：31通过，0失败、0跳过、0 flaky。覆盖390/430px × 中英文、四主题及桌面；五标签、日期、键盘、营养零/缺失/关闭与日周混合周期、计划折叠/关联/不重复计数、补剂、体重、待办、目标版本编辑/取消/刷新与历史日期。
- 其中4项新增测试验证：所有封面入口不存在；已有封面原图、裁切和过时每日选择设置保持逐项原值；More 的内联目标配置与目标编辑；Pantry 产品图/标签图上传、保存、刷新、移除均正常。
- 原有4项食谱图片回归通过：添加、替换、移除、刷新持久化、三种长宽比、错误文件拒绝、事件隔离，且其余配方字段保持不变。
- 只读流程比较完整导出 tables，操作前后完全一致；数据库版本仍为5。
- 首轮28通过/3失败：2处新增英文断言误用了完整名称而现有翻译为“Weekly avg.”，已纠正；1次测试受开发热更新重置日期状态影响。停止代码编辑后，完整31项稳定复跑全部通过，无跳过或放宽数据断言。
- 历史全量浏览器基线见 docs/maintenance-v1.0.1-browser.md（94通过/48既有失败），此前 Graphic Editorial 全量为99通过/同48失败。本轮没有重跑旧全量套件，不声明这些历史失败已修复。退役的3个封面交互浏览器用例由新的入口不存在/数据保留及现有其他图片功能测试覆盖。

已检查16张手机截图，没有发现本次布局的横向溢出、重叠或裁切。验证环境为Windows Chrome手机触控模拟，尚未在真实iPhone Safari/安装版PWA上验证。localhost:5173保持原来源，测试仅使用独立来源的新浏览器上下文。

## 修改文件

新增：src/TodayHeader.tsx、tests/today-polish.spec.ts、本报告。

删除：src/CoverLibrary.tsx、src/CoverFrame.tsx、src/covers.ts、src/cover-crop.ts。

修改：src/main.tsx、src/TodayProgress.tsx、src/MacronutrientGoals.tsx、src/GoalCards.tsx、src/ExercisePlans.tsx、src/DeleteConfirmation.tsx、src/graphic-today.css、src/editorial.css、src/editorial-locale.ts、src/i18n.ts、src/editorial.test.ts。

测试适配：tests/graphic-today.spec.ts、tests/today-tabs.spec.ts、tests/editorial.spec.ts、tests/refinement.spec.ts、tests/unified-overview-delete.spec.ts。仅涉及本次布局/退役功能；未删去其他图片或数据行为断言。

没有变更依赖、数据库名称/版本、迁移、备份格式、localhost端口或保护分支/标签。
