import { test, expect, type Page } from "@playwright/test";
test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  reducedMotion: "reduce",
});
async function imageFile(page: Page, name: string, w: number, h: number) {
  const base64 = await page.evaluate(
    ({ w, h }) => {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#567080";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#efd6aa";
      ctx.fillRect(w * 0.3, h * 0.2, w * 0.4, h * 0.6);
      return canvas.toDataURL("image/png").split(",")[1];
    },
    { w, h },
  );
  return { name, mimeType: "image/png", buffer: Buffer.from(base64, "base64") };
}
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-18T12:00:00-04:00") });
  await page.goto("/today");
  await expect(page.locator(".graphic-introduction")).toBeVisible();
});
test("four icon-only destinations, four real themes, text pantry and two-column recipes preserve functionality", async ({
  page,
}) => {
  await expect(page.locator(".sidebar")).toHaveCount(0);
  await expect(page.locator(".mobile-nav button")).toHaveCount(4);
  for (const button of await page.locator(".mobile-nav button").all())
    expect(await button.innerText()).toBe("");
  await page.goto("/more");
  await page.locator("[data-setting=appearance]").click();
  for (const name of ["杏桃陶土", "灰调薰衣草", "原版橄榄", "雾蓝 / 奶油"]) {
    await page
      .locator(".theme-choices")
      .getByRole("button", { name, exact: false })
      .click();
    await expect(
      page
        .locator(".theme-choices")
        .getByRole("button", { name, exact: false }),
    ).toHaveAttribute("aria-pressed", "true");
  }
  await page
    .locator(".theme-choices")
    .getByRole("button", { name: "杏桃陶土", exact: false })
    .click();
  await expect.poll(()=>page.evaluate(async()=>{const d=await import("/src/domain.ts");return (await d.db.settings.get("theme"))?.value})).toBe("apricot");await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "apricot");
  expect(
    await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--bg")
        .trim(),
    ),
  ).toBe("#F8F1E9");
  await page.evaluate(async () => {
    const d = await import("/src/domain.ts");
    const i = {
      ...d.stamp(),
      name: "Test ingredient",
      nameZh: "别名",
      brand: "",
      basis: "100g",
      servingGrams: null,
      calories: 100,
      protein: 2,
      carbs: 15,
      fat: 3,
      photo: "data:image/png;base64,AA==",
    };
    await d.db.ingredients.put(i);
    for (let n = 0; n < 3; n++)
      await d.recipes.put({
        ...d.stamp(),
        name: "食谱 " + n,
        servings: 1,
        lines: [
          {
            ingredientId: i.id,
            name: i.name,
            quantity: 100,
            unit: "g",
            nutrition: d.ingredientNutrition(i, 100, "g"),
          },
        ],
        instructions: "完整做法",
        stickyNote: "",
      });
  });
  await page.goto("/pantry");
  await expect(page.locator(".pantry-row[data-user-food-id]")).toHaveCount(1);
  await expect(
    page.locator(".pantry-list img,.pantry-list .ingredient-photo"),
  ).toHaveCount(0);
  await page.locator(".search input").fill("别名");
  await expect(page.locator(".pantry-row")).toHaveCount(1);
  await page.goto("/recipes");
  await expect(page.locator(".recipe-list-row:has(.actions)")).toHaveCount(3);
  const cards = page.locator(".recipe-list-row:has(.actions)");
  const a = await cards.nth(0).boundingBox(),
    b = await cards.nth(1).boundingBox();
  expect(b!.y).toBeGreaterThan(a!.y);
  expect(b!.x).toBe(a!.x);
  await expect(page.getByText("FEATURED", { exact: true })).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "work/editorial-recipes-mobile.png" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.locator(".mobile-nav")).toBeVisible();
  expect((await page.locator(".mobile-nav").boundingBox())!.width).toBeLessThan(
    500,
  );
});
test("meal photos are real records, optional photographs survive reload and consumption preserves decimal, zero and above-100 values", async ({
  page,
}) => {
  const file = await imageFile(page, "real-meal.png", 900, 700);
  await page.getByRole("button", { name: "添加餐食", exact: true }).click();
  await page.locator(".add-food .source-tabs button").nth(2).click();
  await page.locator(".add-food .nutrition-fields input").first().fill("200");
  await page.locator(".add-food input[name=consumptionPercent]").fill("50.5");
  await page.locator(".meal-extras > summary").click();
  await page.locator(".meal-photo-input input[type=file]").setInputFiles(file);
  await page.getByRole("button", { name: "保存记录", exact: true }).click();
  await expect(page.locator(".meal-card .meal-photo")).toHaveCount(0);
  await expect(page.getByTestId("food-progress")).toContainText("101");
  await page.reload();
  await expect(page.locator(".meal-card .meal-photo")).toHaveCount(0);
  await page
    .locator(".meal-card .meal-row")
    .getByRole("button", { name: "编辑", exact: true })
    .click();
  await page.locator(".add-food input[name=consumptionPercent]").fill("0");
  await page.getByRole("button", { name: "保存记录", exact: true }).click();
  await expect(page.getByTestId("food-progress")).toContainText("0kcal");
  await page
    .locator(".meal-card .meal-row")
    .getByRole("button", { name: "编辑", exact: true })
    .click();
  await page.locator(".add-food input[name=consumptionPercent]").fill("150");
  await page.getByRole("button", { name: "保存记录", exact: true }).click();
  await expect(page.getByTestId("food-progress")).toContainText("300");
  const saved = await page.evaluate(async () => {
    const d = await import("/src/domain.ts");
    return (await d.foodLogs.toArray())[0];
  });
  expect(saved.photo).toBe(
    "data:image/png;base64," + file.buffer.toString("base64"),
  );
  expect(saved.baseNutrition.calories).toBe(200);
  expect(saved.nutrition.calories).toBe(300);
});
