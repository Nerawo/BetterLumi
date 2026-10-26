import {openPersonalGoalEditor} from './current-ui';
import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-17T12:00:00-04:00") });
  await page.goto("/today");
  await expect(
    page.getByRole("heading", { name: /当日概览/ }),
  ).toBeVisible();
});
test("default Chinese, calm empty states, compact ordering and responsive layout", async ({
  page,
}) => {
  await expect(page.locator("html")).toHaveAttribute("lang", "zh");
  await expect(page.getByTestId("food-progress")).toContainText(
    "今天还没有吃饭吗？",
  );
  await expect(page.getByTestId("exercise-progress")).toContainText(
    "今天还没有运动吗？",
  );
  await expect(page.locator(".today-progress [role=progressbar]")).toHaveCount(
    0,
  );
  await expect(page.getByTestId("food-progress")).not.toContainText("0 kcal");
  await expect(page.getByRole("heading", { name: "未来计划" })).toHaveCount(0);
  await expect(page.locator(".today-layout .exercise-card")).toHaveCount(1);
  await page.locator("#today-tab-activity").click();await expect(page.locator(".exercise-plans-section")).toBeVisible();
  await expect(page.locator(".today-support .weight-mini")).toHaveCount(1);
  await expect(page.locator(".goal-settings .goal-values")).toHaveCount(0);
  const food = await page.getByTestId("food-progress").boundingBox();
  const exercise = await page.getByTestId("exercise-progress").boundingBox();
  expect(exercise!.x).toBeGreaterThan(food!.x);
  const top = await page.locator(".today-progress").boundingBox();
  const columns = await page.locator("#today-panel-activity .today-layout").boundingBox();
  expect(top!.y + top!.height).toBeLessThan(columns!.y);
  await page.setViewportSize({ width: 390, height: 844 });
  const mFood = await page.getByTestId("food-progress").boundingBox();
  const mExercise = await page.getByTestId("exercise-progress").boundingBox();
  expect(Math.abs(mExercise!.y - mFood!.y)).toBeLessThan(2);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await openPersonalGoalEditor(page);await expect(page.locator(".goal-editor-inline")).toBeVisible();await page.locator(".goal-editor-inline .form-actions button").first().click();
  await page.goto("/more");
  await page.locator("[data-setting=language]").click();
  await page.getByRole("button", { name: "English", exact: true }).click();await expect.poll(()=>page.evaluate(async()=>{const d=await import("/src/domain.ts");return (await d.db.settings.get("language"))?.value})).toBe("en");
  await page.goto("/today");
  await expect(
    page.getByRole("heading", { name: /Daily overview/ }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});
test("below, within, above, unknown and no-goal states update live with separate exercise metrics", async ({
  page,
}) => {
  const ids = await page.evaluate(async () => {
    const d = await import("/src/domain.ts");
    const g = await import("/src/goals.ts");
    const goal = {
      ...d.stamp(),
      startDate: "2026-10-01",
      endDate: null,
      calorieMin: 1500,
      calorieMax: 1800,
      exerciseMinutes: 30,
      exerciseKcal: 200,
    };
    const food = {
      ...d.stamp(),
      date: d.localDate(),
      name: "真实测试餐食",
      source: "quick",
      sourceId: null,
      category: "uncategorized",
      quantity: 1,
      unit: "entry",
      nutrition: { calories: 500, protein: null, carbs: null, fat: null },
      lines: [],
      cookingNote: "",
    };
    await g.goalTable.put(goal);
    await d.foodLogs.put(food);
    const a = {
      ...d.stamp(),
      date: d.localDate(),
      type: "other",
      name: "测试运动",
      duration: 20,
      caloriesBurned: null,
      distance: null,
      notes: "",
    };
    await d.db.activities.put(a);
    return { food: food.id, activity: a.id, goal: goal.id };
  });
  const f = page.getByTestId("food-progress"),
    e = page.getByTestId("exercise-progress");
  await expect(f).toContainText("距目标下限还差 1000 kcal");
  await expect(e).toContainText("还差 10 分钟");
  await expect(e.locator(".overview-unknown").first()).toHaveText("未记录");
  await expect(e.getByRole("progressbar")).toHaveCount(1);
  await page.evaluate(async (ids) => {
    const d = await import("/src/domain.ts");
    const old = await d.foodLogs.get(ids.food);
    await d.foodLogs.update(ids.food, {
      nutrition: { ...old.nutrition, calories: 1600 },
    });
    await d.db.activities.update(ids.activity, {
      duration: 45,
      caloriesBurned: 80,
    });
  }, ids);
  await expect(f).toContainText("已进入目标范围");
  await expect(f.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "100",
  );
  await expect(e).toContainText("已达标");
  await expect(e).toContainText("还差 120 kcal");
  await expect(e.getByRole("progressbar")).toHaveCount(2);
  await page.evaluate(async (ids) => {
    const d = await import("/src/domain.ts");
    const old = await d.foodLogs.get(ids.food);
    await d.foodLogs.update(ids.food, {
      nutrition: { ...old.nutrition, calories: 2100 },
    });
  }, ids);
  await expect(f).toContainText("超出目标上限 300 kcal");
  await expect(f.locator(".progress-track.above")).toBeVisible();
  await openPersonalGoalEditor(page);await page.locator("[name=caloriesTarget]").fill("2100");await page.locator(".goal-editor-inline .form-actions .primary").click();
  await expect(f).toContainText("已进入目标范围");
  await page.evaluate(async (ids) => {
    const d = await import("/src/domain.ts");
    const g = await import("/src/goals.ts");
    const old = await d.foodLogs.get(ids.food);
    await d.foodLogs.update(ids.food, {
      nutrition: { ...old.nutrition, calories: null },
    });
    for (const goal of await g.goalTable.toArray())
      await g.goalTable.update(goal.id, {
        deletedAt: new Date().toISOString(),
      });
  }, ids);
  await expect(f.locator(".overview-unknown").first()).toHaveText("未记录");
  await expect(f.getByRole("progressbar")).toHaveCount(0);
  await page.evaluate(async (ids) => {
    const d = await import("/src/domain.ts");
    const old = await d.foodLogs.get(ids.food);
    await d.foodLogs.update(ids.food, {
      nutrition: { ...old.nutrition, calories: 700 },
    });
  }, ids);
  await expect(f.locator(".progress-number")).toContainText("700");
  await expect(f).not.toContainText("未设置目标");
  await expect(f.locator(".progress-track")).toHaveCount(0);
  await expect(f).not.toContainText("还差");
  await expect(page.locator(".meal-totals")).toHaveCount(0);
  const summary = await page.locator(".today-progress").boundingBox();
  await page.locator("#today-tab-food").click();const meal = await page.locator(".meal-card .meal-row").boundingBox();
  expect(summary!.y + summary!.height).toBeLessThan(meal!.y);
  await page.evaluate(async (ids) => {
    const d = await import("/src/domain.ts");
    await d.softDelete(d.foodLogs, ids.food);
    await d.softDelete(d.db.activities, ids.activity);
  }, ids);
  await expect(f).toContainText("今天还没有吃饭吗？");
  await expect(e).toContainText("今天还没有运动吗？");
});
