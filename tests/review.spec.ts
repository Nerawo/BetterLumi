import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-17T12:00:00-04:00") });
  await page.goto("/today");
  await expect(page.locator(".today-progress")).toBeVisible();
});
async function seed(page: any) {
  return page.evaluate(async () => {
    const d = await import("/src/domain.ts");
    const c = await import("/src/categories.ts");
    await c.saveCategory("早餐");
    await c.saveCategory("快速");
    const cats = await c.categories.toArray();
    const i = {
      ...d.stamp(),
      name: "燕麦",
      nameZh: "",
      brand: "",
      basis: "100g",
      servingGrams: null,
      calories: 400,
      protein: 10,
      carbs: 60,
      fat: 5,
    };
    await d.db.ingredients.put(i);
    const r = {
      ...d.stamp(),
      name: "晨间燕麦",
      servings: 2,
      lines: [
        {
          ingredientId: i.id,
          name: i.name,
          quantity: 100,
          unit: "g",
          nutrition: d.ingredientNutrition(i, 100, "g"),
        },
      ],
      instructions: "完整步骤\n".repeat(50) + "最后一步",
      stickyNote: "原有便签",
      categoryIds: cats.map((c) => c.id),
    };
    await d.recipes.put(r);
    await d.foodLogs.put({
      ...d.stamp(),
      date: "2026-10-16",
      name: "历史早餐",
      category: "breakfast",
      source: "quick",
      sourceId: null,
      quantity: 1,
      unit: "entry",
      nutrition: { calories: 500, protein: null, carbs: null, fat: null },
      lines: [],
      cookingNote: "",
    });
    await d.db.activities.put({
      ...d.stamp(),
      date: "2026-10-16",
      type: "other",
      duration: 30,
      distance: null,
      notes: "历史运动",
    });
    return { recipe: r.id, cats };
  });
}
test("calendar above meals synchronizes the selected day while old links and history select/edit historical meals", async ({
  page,
}) => {
  await seed(page);
  await page.goto("/journal?date=2026-10-16");
  await expect(page).toHaveURL("/today?date=2026-10-16");
  await expect(
    page.locator("nav").getByRole("button", { name: "日记", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByTestId("food-progress")).toContainText(
    "500",
  );
  await expect(page.locator(".meal-card .meal-row")).toHaveCount(1);
  await expect(page.locator(".meal-card")).toContainText("历史早餐");
  await expect(page.locator(".today-layout .exercise-card")).toContainText("历史运动");
  const meals = await page.locator(".meal-card").boundingBox();
  const calendar = await page.locator(".calendar-card").boundingBox();
  expect(calendar!.y + calendar!.height).toBeLessThanOrEqual(meals!.y);
  await page
    .locator(".meal-card .meal-row")
    .getByRole("button", { name: "编辑", exact: true })
    .click();
  await page.locator(".add-food input:not([type])").fill("已编辑历史");
  await page.getByRole("button", { name: "保存记录", exact: true }).click();
  await expect(page.getByTestId("food-progress")).toContainText(
    "500",
  );
  await expect(page.locator(".meal-card")).toContainText("已编辑历史");
  await page.locator('[data-date="2026-10-15"]').click();
  await page.goBack();
  await expect(page.getByTestId("selected-day")).toHaveAttribute("datetime", "2026-10-16");
  await page.goForward();
  await expect(page.getByTestId("selected-day")).toHaveAttribute("datetime", "2026-10-15");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("category manager, multi assignments, modal state, touch-visible nutrition, notes and deep links", async ({
  page,
}) => {
  const data = await seed(page);
  await page.goto("/recipes");
  await page.getByPlaceholder("搜索食谱").fill("晨间");
  await page.getByRole("tab", { name: "早餐", exact: true }).click();
  await page.getByRole("link", { name: "晨间燕麦", exact: true }).click();
  const modal = page.locator(".recipe-detail-modal");
  await expect(modal).toBeVisible();
  await expect(page.locator(".recipe-grid")).toBeAttached();
  await expect(modal.locator(".hero-nutrition")).toBeVisible();
  await expect(modal.locator(".recipe-method")).toContainText("最后一步");
  await page.keyboard.press("Escape");
  await expect(modal).toHaveCount(0);
  await expect(page.getByPlaceholder("搜索食谱")).toHaveValue("晨间");
  await expect(
    page.getByRole("tab", { name: "早餐", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.goForward();
  await expect(modal).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(modal.locator(".hero-nutrition")).toBeVisible();
  expect(await modal.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(
    true,
  );
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "管理分类", exact: true }).click();
  let dialog = page.getByRole("dialog").last();
  await dialog.getByLabel("分类名称").fill("晚餐");
  await dialog.getByRole("button", { name: "创建分类", exact: true }).click();
  await expect(dialog).toContainText("晚餐");
  const row = dialog.locator(".simple-row").filter({ hasText: "晚餐" });
  await row.getByRole("button", { name: "编辑", exact: true }).click();
  await dialog.getByLabel("分类名称").fill("晚间");
  await dialog.getByRole("button", { name: "保存", exact: true }).click();
  await expect(dialog).toContainText("晚间");
  await page.keyboard.press("Escape");
  await page
    .locator(".recipe-card .actions")
    .getByRole("button", { name: "编辑", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", {name: "选择分类", exact: true}).click();
  await expect(dialog.getByLabel("早餐", { exact: true })).toBeChecked();
  await expect(dialog.getByLabel("快速", { exact: true })).toBeChecked();
  await dialog.getByLabel("晚间", { exact: true }).check();
  await dialog.locator(".category-picker-done").click();
  await dialog.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByRole("tab", { name: "晚间", exact: true }).click();
  await expect(page.locator(".recipe-card")).toHaveCount(1);
  await page.getByRole("button", { name: "管理分类", exact: true }).click();
  dialog = page.getByRole("dialog");
  page.once("dialog", (d) => d.accept());
  await dialog
    .locator(".simple-row")
    .filter({ hasText: "晚间" })
    .getByRole("button", { name: "删除", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(page.locator(".recipe-card")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".recipe-card")).toHaveCount(1);
  await page.goto("/recipes/" + data.recipe);
  await expect(modal).toBeVisible();
  await modal
    .getByRole("button", { name: "＋ 写张便利贴", exact: true })
    .click();
  dialog = page.getByRole("dialog").last();
  await dialog.locator("textarea").fill("新增纸条");
  await dialog.getByRole("button", { name: "保存", exact: true }).click();
  await page.reload();
  await expect(
    modal.locator(".note-text").filter({ hasText: "新增纸条" }),
  ).toBeVisible();
  await modal.locator(".note-text").filter({ hasText: "新增纸条" }).click();
  dialog = page.getByRole("dialog").last();
  await dialog.locator("textarea").fill("修改纸条");
  await dialog.getByRole("button", { name: "保存", exact: true }).click();
  const note = modal.locator(".paper-note").filter({ hasText: "修改纸条" });
  await note.locator("summary").click();
  page.once("dialog", (d) => d.accept());
  await note.getByRole("button", { name: "删除", exact: true }).click();
  await expect(note).toHaveCount(0);
  await expect(
    modal.locator(".note-text").filter({ hasText: "原有便签" }),
  ).toBeVisible();
});
test("More removes exercise history and switches all four persistent palettes", async ({
  page,
}) => {
  await seed(page);
  await page.goto("/more");
  await expect(page.locator(".activity-history")).toHaveCount(0);
  await page.getByRole("button", { name: /外观与主题/ }).click();
  const swatches = page.locator(".theme-choices>button");
  await expect(swatches).toHaveCount(4);
  await swatches.nth(1).click();
  await expect(swatches.nth(1)).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "apricot");
  expect(
    await page.evaluate(async () => {
      const d = await import("/src/domain.ts");
      return d.db.activities.count();
    }),
  ).toBe(1);
});

test("closing with X, Escape and backdrop preserves list scrolling; tab keyboard navigation works", async ({
  page,
}) => {
  const data = await seed(page);
  await page.evaluate(async (id) => {
    const d = await import("/src/domain.ts");
    const r = await d.recipes.get(id);
    for (let n = 0; n < 12; n++)
      await d.recipes.put({ ...r, ...d.stamp(), name: "滚动食谱 " + n });
  }, data.recipe);
  await page.goto("/recipes");
  await expect(page.getByRole("tab")).toHaveCount(3);
  await page.getByRole("tab", { name: "全部", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab").nth(1)).toHaveAttribute(
    "aria-selected",
    "true",
  );
  const lastRecipe=page.locator(".recipe-card h3 a").last();
  await lastRecipe.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => scrollY);
  expect(before).toBeGreaterThan(0);
  await lastRecipe.click();
  await expect(page.locator(".recipe-detail-modal")).toBeVisible();
  await page
    .locator(".recipe-detail-modal>.modal-head")
    .getByRole("button", { name: "关闭", exact: true })
    .click();
  await expect(page.locator(".recipe-detail-modal")).toHaveCount(0);
  expect(Math.abs((await page.evaluate(() => scrollY)) - before)).toBeLessThan(
    3,
  );
  await lastRecipe.click();
  await page.mouse.click(2, 2);
  await expect(page.locator(".recipe-detail-modal")).toHaveCount(0);
  await lastRecipe.click();
  await page.keyboard.press("Escape");
  await expect(page.locator(".recipe-detail-modal")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await lastRecipe.click();
  await page.clock.runFor(600);
  await page.screenshot({ path: "work/recipe-modal-mobile.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await page.goto("/today?date=2026-10-16");
  await expect(page.locator(".calendar-card")).toBeVisible();
  await page.clock.runFor(600);
  await page.screenshot({
    path: "work/today-calendar-mobile.png",
    fullPage: true,
  });
});
