# BetterLumi v1.0.1 代码清理报告

日期：2026-10-19。本轮仅清理与维护，没有开始视觉改版。

## 基线与分支

原项目目录没有 Git 仓库。检查忽略规则和常见密钥模式后，建立本地仓库，完整归档当时的源码、测试、静态资源和历史说明。

- 基线提交：`a839edf97fb176f222729593c6614d02fdeee633`。
- `backup/v1.0.1`、`v1.0.1` 和初始 `main` 均保留在该基线。
- 清理工作位于 `maintenance/v1.0.1-cleanup`；没有移动原始标签。
- `node_modules`、`dist`、`work`、测试产物及生成的 `public/ocr` 继续忽略，未提交生成资源或秘密文件。
- 产品基线按 v1.0.1 标记；历史 `package.json` / lockfile 包版本 `0.1.0` 未作为发布操作改动。

## 已验证并移除的内容

| 内容 | 依据与处理 |
| --- | --- |
| `src/LegacyApp.tsx.bak`、`src/LegacyApp-original.tsx.bak` | 两份内容相同；不在入口、动态导入或测试引用中。原文仍可从基线恢复。 |
| `src/style.css`、`src/theme.ts` | 仅由上述旧备份引用；当前应用使用 `olive.css`、`editorial.css` 和 `themes.ts`。 |
| `ActivityHistory`、`DateNav`、空实现 `GoalSummary` | 没有实际调用或动态引用；当前日历、运动日志和目标界面仍在原模块中。 |
| `num`、`knownSum`、`statusKey`、旧运动标签重导出 | 无调用者，未替换任何现有计算或序列化路径。 |
| 未使用 imports、局部声明和 props | 清除严格未使用检查发现的问题，并移除 `Recipes.addMeal`、`MealList.notice`、运动计划编辑器未使用的 `date` 透传。详情弹窗的 Add to Meals 和日期语义保留。 |
| 270 条失效 CSS 选择器 | `olive.css` 143 条、`editorial.css` 127 条；限定为无应用引用的旧布局选择器，包括侧栏、旧营养汇总、旧食谱占位图和旧计划布局。保留混合规则中的有效选择器。 |
| 14 条废弃翻译 | 中英各 7 条：`recipeImageActions`、`noApplicableNutrientGoals`、`nutritionUnknown`、`activityHistory`、`noActivityHistory`、`noApplicableGoal`、`overviewVersionChanged`。 |

没有移除依赖。React、Dexie、i18next、图标、Tailwind、OCR、PWA 和测试依赖均有实际用途。

## 小范围整理

- 将食谱编辑和 Add Food 共用的食材行组件移到 `src/RecipeLineEditor.tsx`，避免餐食编辑器依赖整个食谱目录模块。组件实现与基线一致，仅改名和调整导入。
- 将语言初始化写成显式副作用导入，保留初始化顺序。
- TypeScript 启用 `noUnusedLocals`、`noUnusedParameters`，新增 `npm.cmd run typecheck`。
- 新增 `npm.cmd run check:code`：检查 71 个应用模块的入口可达性，以及 561 处中英文字面量翻译引用。动态键不据此自动删除。
- 更新 README，去除多个互相矛盾的“最新更新”、旧导航/数据库版本和 OCR 状态说明；历史更新文档保留。
- 增加运动关联回归测试：备份恢复后，实际记录的零值、未知值和编辑过的标签仍保留；更新计划不覆盖实际记录；重新完成不重复创建关联日志。
- 初轮完整浏览器复测观察到一次分类创建后的焦点丢失。基线和清理版本各重复该用例 10 次均通过，但代码中存在恢复焦点先于控件解除禁用的时序隐患；使用项目已有的 `flushSync` 保证先提交启用状态，再执行排队的焦点恢复。不改变分类保存、校验或关联关系。

## 有意保留的兼容与候选代码

- `db.ts`、`domain.ts` 的旧表、历史字段、迁移、两套备份 API 和校验：用于旧记录与旧备份，不因为当前界面没有直接显示就删除。
- `servings`、历史分类、旧周期类型、照片/标签 OCR 元数据、运动关联字段和目标生效历史。
- 周均营养素旧测试配置的读取/导入兼容处理；活跃宏量营养素目标仍只有关闭/每日，热量周均和运动周总量不变。
- `sumNutrition` 与 `measurement`：前者要求来源完整，后者保留已知部分与完整度，语义不同，不能合并为同一种求和。
- 持久值驱动的翻译、动态状态/页面类、复杂伪类以及仍参与响应式和主题级联的样式；没有批量删除不确定候选。
- 所有现有图片、字体及许可证；`resource` 中的用户原始照片即使与默认封面相同也保留。
- 历史浏览器测试：其中一部分仍期待已被后续需求取代的界面；本轮没有删除、跳过或放宽断言。
- OCR 准备脚本的完成日志是正常开发反馈，没有当作调试日志移除。
- `themes.chooseTheme` 仍被浏览器测试动态调用，没有按普通的页面静态引用判断删除。

## 验证

| 检查 | 结果 |
| --- | --- |
| TypeScript（含严格未使用检查） | 通过 |
| 模块与字面量翻译检查 | 通过；71 个模块、561 处引用 |
| 单元测试 | 17 个文件、115 项通过；基线 114 项，新增 1 项回归测试 |
| 分类管理焦点复测 | 修正后覆盖两种宽度、中英文，重复 5 轮，共 20/20 通过 |
| 完整 Playwright 浏览器测试 | 基线 94 通过 / 48 失败；清理后 94 通过 / 48 失败；新增失败 0，未跳过用例 |
| 基线视觉对比 | 64/64 通过：390px、430px，中英文，四主题，主要页面、计划展开状态及七类弹窗；尺寸一致，无超出每通道 5/255 抗锯齿容差的像素差异 |
| 生产构建 | 通过；PWA 119 项预缓存，正常生成 service worker |
| 生产离线验证 | 通过：service worker 接管、离线刷新/导航、OCR worker 运行时缓存、真实零值及未知值的持久保存 |
| 关键兼容文件对比 | 20 个数据/业务/配置文件与基线内容一致（忽略 Git 换行转换） |
| 依赖完整性 / Git 空白检查 | `npm.cmd ls --depth=0`、`git diff --check` 通过 |
| ESLint | 原项目没有依赖、配置或 lint 命令，未声称已运行；使用 TypeScript 未使用检查和代码引用检查，不额外引入依赖 |

测试使用独立 Chrome 上下文、测试端口和模拟 IndexedDB，没有访问日常 `localhost:5173` 的浏览器数据。数据库逻辑版本仍为 5，应用 JSON 备份版本仍为 5。没有新增架构、迁移、清空或重命名数据库的代码。

构建 CSS 从 258.22 kB 降至 239.76 kB。原有主包大于 500 kB 的构建提示仍存在，本轮没有进行模块重写或拆包。

## 剩余限制

完整浏览器套件仍未全绿：本轮 48 项失败均已在基线出现，包括旧布局/旧目标控件断言、旧选择器，以及仍需独立排查的超时。没有通过改回旧界面、删除或跳过测试来掩盖问题。详见 [浏览器测试基线对比](./maintenance-v1.0.1-browser.md)。零新增失败并不表示所有原有交互问题都已修复。

实体 iPhone Safari / 安装版 PWA 未做真机验证；本轮移动端验证使用 Chrome 390px / 430px 视口。历史包版本元数据和旧界面测试应在后续明确的发布/测试维护任务中处理。

## 修改文件

新增：`src/RecipeLineEditor.tsx`、`scripts/check-code.mjs`、本报告及浏览器测试对比附录。

删除：`src/LegacyApp.tsx.bak`、`src/LegacyApp-original.tsx.bak`、`src/style.css`、`src/theme.ts`。

其余修改：

```text
README.md
package.json
tsconfig.json
src/Activity.tsx
src/ExercisePlans.tsx
src/GoalCards.tsx
src/Meals.tsx
src/More.tsx
src/Pantry.tsx
src/RecipeDetail.tsx
src/RecipeCategoryManager.tsx
src/Recipes.tsx
src/Weight.tsx
src/editorial.css
src/olive.css
src/goals.ts
src/i18n.ts
src/locale.ts
src/main.tsx
src/ui.tsx
src/update-locale.ts
src/editorial.test.ts
src/update.test.ts
src/exercise-plans.test.ts
```

可重复执行：`npm.cmd run typecheck`、`npm.cmd run check:code`、`npm.cmd test`、`npm.cmd run test:browser`、`npm.cmd run build`。
