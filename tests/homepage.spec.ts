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
  const food=page.getByTestId("food-progress");
  await expect(food.locator(".progress-number")).toHaveText("未记录");
  await expect(food.locator(".calorie-target-unset")).toBeVisible();
  await expect(food.getByRole("progressbar")).toHaveCount(0);
  await expect(page.getByTestId("exercise-progress")).toHaveCount(0);
  await expect(page.locator("#today-tab-activity")).toHaveCount(0);
  await page.setViewportSize({width:390,height:844});
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
test("below, within, above, unknown and no-goal states update live while historical activity stays independent", async ({
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
  const target=f.locator('[data-goal-metric=calories]');
  await expect(target).toHaveAttribute('data-status','below');
  await expect(e).toHaveCount(0);
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
  await expect(target).toHaveAttribute('data-achieved','true');
  await expect(target.getByRole('progressbar')).toHaveAttribute('aria-valuenow','100');
  await page.evaluate(async (ids) => {
    const d = await import("/src/domain.ts");
    const old = await d.foodLogs.get(ids.food);
    await d.foodLogs.update(ids.food, {
      nutrition: { ...old.nutrition, calories: 2100 },
    });
  }, ids);
  await expect(target).toHaveAttribute('data-status','above');
  await expect(f.locator(".progress-track.above")).toBeVisible();
  await openPersonalGoalEditor(page);await page.locator("[name=caloriesTarget]").fill("2100");await page.locator(".goal-editor-inline .form-actions .primary").click();
  await expect(target).toHaveAttribute('data-achieved','true');
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
  
  await expect(f.locator(".calorie-target-unset")).toBeVisible();
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
  await expect(f.locator(".progress-number")).toHaveText("未记录");
  await expect(e).toHaveCount(0);
});
