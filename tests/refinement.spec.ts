import { test, expect, type Page } from "@playwright/test";
const output =
  "./work/screenshots/";
test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  reducedMotion: "reduce",
});
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-18T12:00:00-04:00") });
  await page.goto("/today");
  await expect(page.locator(".graphic-introduction")).toBeVisible();
  await expect(page.locator(".cover-library-button")).toHaveCount(0);
});
async function seed(page: Page) {
  return page.evaluate(async () => {
    const d = await import("/src/domain.ts");
    const g = await import("/src/goals.ts");
    await g.goalTable.put({
      ...d.stamp(),
      startDate: "2026-01-01",
      endDate: null,
      calorieMin: 1200,
      calorieMax: 1500,
      exerciseMinutes: 30,
      exerciseKcal: null,
    });
    await d.foodLogs.put({
      ...d.stamp(),
      date: "2026-10-18",
      name: "午餐记录",
      category: "lunch",
      source: "quick",
      sourceId: null,
      quantity: 1,
      unit: "entry",
      nutrition: { calories: 860, protein: 34, carbs: 110, fat: 32 },
      lines: [],
      cookingNote: "",
    });
    await d.db.activities.put({
      ...d.stamp(),
      date: "2026-10-18",
      name: "步行",
      type: "walking",
      duration: 25,
      distance: null,
      caloriesBurned: null,
      notes: "",
    });
    const items = [
      {
        name: "Rolled oats",
        nameZh: "燕麦",
        calories: 389,
        protein: 17,
        carbs: 66,
        fat: 7,
      },
      {
        name: "Greek yogurt",
        nameZh: "希腊酸奶",
        calories: 59,
        protein: 10,
        carbs: 5,
        fat: 0.4,
      },
      {
        name: "Spinach",
        nameZh: "菠菜",
        calories: 23,
        protein: 2.9,
        carbs: 3.6,
        fat: 0.4,
      },
      {
        name: "Unknown",
        nameZh: "待补营养",
        calories: null,
        protein: null,
        carbs: null,
        fat: null,
      },
    ].map((i) => ({
      ...d.stamp(),
      ...i,
      brand: "",
      basis: "100g",
      servingGrams: null,
    }));
    await d.db.ingredients.bulkPut(items);
    const recipe = {
      ...d.stamp(),
      name: "燕麦酸奶碗",
      servings: 1,
      lines: [
        {
          ingredientId: items[0].id,
          name: "燕麦",
          quantity: 50,
          unit: "g",
          nutrition: d.ingredientNutrition(items[0], 50, "g"),
        },
        {
          ingredientId: items[1].id,
          name: "希腊酸奶",
          quantity: 150,
          unit: "g",
          nutrition: d.ingredientNutrition(items[1], 150, "g"),
        },
      ],
      instructions:
        "1. 燕麦加入适量水煮软，放凉。\n2. 拌入希腊酸奶，按个人喜好调整口感。\n3. 装碗即可食用。",
      stickyNote: "酸奶等燕麦放凉后再拌入。",
    };
    await d.recipes.put(recipe);
    return recipe.id;
  });
}
test("compact cover keeps real progress above the fold and four updated mobile screenshots", async ({
  page,
}) => {
  const recipe = await seed(page);
  await expect(
    page.locator("[data-testid=food-progress] .progress-number"),
  ).toContainText("860");
  await expect(page.getByTestId("food-progress")).toContainText(
    "还差 340 kcal",
  );
  await expect(
    page.locator("[data-testid=exercise-progress] .progress-number"),
  ).toContainText("25");
  await expect(page.getByTestId("exercise-progress")).toContainText("未记录");
  const foodNumber = (await page
    .locator("[data-testid=food-progress] .progress-number")
    .boundingBox())!;
  const movementNumber = (await page
    .locator("[data-testid=exercise-progress] .progress-number")
    .boundingBox())!;
  expect(Math.abs(foodNumber.y - movementNumber.y)).toBeLessThan(1);
  const cover = (await page.locator(".today-cover").boundingBox())!,
    progress = (await page.locator(".today-progress").boundingBox())!,
    nav = (await page.locator(".mobile-nav").boundingBox())!;
  expect(cover.height).toBeLessThan(480);
  expect(progress.y + progress.height).toBeLessThan(nav.y);
  await expect(page.locator(".ring-legend")).toHaveCount(0);
  await expect(page.locator(".meal-totals")).toHaveCount(0);
  await page.screenshot({ path: output + "精修-Today-手机.png" });
  await page.goto("/pantry");
  await expect(page.locator(".pantry-row")).toHaveCount(4);
  await expect(page.locator(".pantry-controls select")).toHaveCount(0);
  await expect(page.locator(".pantry-sort-trigger")).toBeVisible();
  await expect(page.locator(".pantry-list img")).toHaveCount(0);
  await expect(page.locator(".page h1")).toHaveCount(1);
  await expect(page.locator(".page-pantry> .section-heading h2")).toHaveCount(
    0,
  );
  await page.screenshot({ path: output + "精修-Pantry-手机.png" });
  await page.goto("/more");
  await expect(page.locator(".settings-row")).toHaveCount(5);
  await page.screenshot({ path: output + "精修-More-手机.png" });
  await page.goto("/recipes/" + recipe);
  const modal = page.locator(".recipe-detail-modal");
  await expect(modal).toBeVisible();
  await expect(
    modal.getByRole("heading", { name: "燕麦酸奶碗", exact: true }),
  ).toHaveCount(1);
  await expect(
    modal.getByRole("button", { name: "返回食谱", exact: true }),
  ).toHaveCount(0);
  await expect(modal.locator(".hero-nutrition")).not.toContainText("表示未知");
  await expect(modal.locator(".recipe-method")).toContainText(
    "3. 装碗即可食用。",
  );
  await expect(modal.locator(".paper-note")).toContainText("放凉");
  await page.screenshot({ path: output + "精修-食谱详情-手机.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(await modal.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(
    true,
  );
});
test("Pantry has four compact sort orders, search and unknown-last calories in both directions", async ({
  page,
}) => {
  await seed(page);
  await page.goto("/pantry");
  const choose = async (sort: string) => {
    await page.locator(".pantry-sort-trigger").click();
    await expect(page.getByRole("menuitemradio")).toHaveCount(4);
    await page.locator(`[data-sort="${sort}"]`).click();
  };
  const names = () => page.locator(".pantry-row h3").allTextContents();
  await choose("name-asc");
  expect((await names()).map((s) => s.trim().split(" ")[0])).toEqual([
    "Greek",
    "Rolled",
    "Spinach",
    "Unknown",
  ]);
  await choose("name-desc");
  expect((await names())[0]).toContain("Unknown");
  await choose("calories-asc");
  await expect(page.locator(".pantry-row").first()).toContainText("Spinach");
  await expect(page.locator(".pantry-row").last()).toContainText("Unknown");
  await choose("calories-desc");
  await expect(page.locator(".pantry-row").first()).toContainText(
    "Rolled oats",
  );
  await expect(page.locator(".pantry-row").last()).toContainText("Unknown");
  await page.locator(".search input").fill("希腊");
  await expect(page.locator(".pantry-row")).toHaveCount(1);
  await expect(page.locator(".pantry-row")).toContainText("Greek yogurt");
  expect(
    await page.evaluate(async () => {
      const d = await import("/src/domain.ts");
      return d.db.ingredients.count();
    }),
  ).toBe(4);
});
test("More rows respond across their padding, icon and keyboard without route regressions", async ({
  page,
}) => {
  await page.goto("/more");
  const weight = page.locator("[data-setting=weight]");
  const box = (await weight.boundingBox())!;
  await weight.click({ position: { x: box.width - 65, y: box.height - 6 } });
  await expect(page).toHaveURL(/\/weight$/);
  await page.goBack();
  await page.locator("[data-setting=weight]").focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/weight$/);
  await page.goBack();
  await page.locator("[data-setting=appearance]").focus();
  await page.keyboard.press("Space");
  await expect(page.locator(".theme-choices")).toBeVisible();
  await page.keyboard.press("Escape");
  for (const key of ["language", "data", "about"]) {
    const row = page.locator("[data-setting=" + key + "]");
    const b = (await row.boundingBox())!;
    await row.click({ position: { x: 12, y: b.height / 2 } });
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page).toHaveURL(/\/more$/);
    await page.keyboard.press("Escape");
  }
});
