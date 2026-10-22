import { test, expect, type Page } from "@playwright/test";
async function fixture(page: Page, blank = false) {
  const data = await page.evaluate((blank) => {
    const c = document.createElement("canvas");
    c.width = 1000;
    c.height = 900;
    const x = c.getContext("2d")!;
    x.fillStyle = "#fff";
    x.fillRect(0, 0, 1000, 900);
    x.fillStyle = "#000";
    x.font = "42px Arial";
    if (!blank)
      [
        "Nutrition Facts",
        "Serving size 1 bar (40 g)",
        "Amount per serving",
        "Calories 230",
        "Total Fat 8g 10%",
        "Saturated Fat 1g 5%",
        "Total Carbohydrate 37g 13%",
        "Protein 3g",
      ].forEach((l, i) => x.fillText(l, 40, 65 + i * 85));
    return c.toDataURL("image/png").split(",")[1];
  }, blank);
  return {
    name: "nutrition.png",
    mimeType: "image/png",
    buffer: Buffer.from(data, "base64"),
  };
}
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-17T12:00:00-04:00"));
  await page.goto("/today");
  await expect(
    page.getByRole("heading", { name: /当日概览/ }),
  ).toBeVisible();
});
test("required calorie examples and missing exercise metric render independent rings", async ({
  page,
}) => {
  await page.evaluate(async () => {
    const d = await import("/src/domain.ts");
    const g = await import("/src/goals.ts");
    await g.goalTable.put({
      ...d.stamp(),
      startDate: "2026-01-01",
      endDate: null,
      calorieMin: 1000,
      calorieMax: 1200,
      exerciseMinutes: 30,
      exerciseKcal: 300,
    });
    for (const [date, calories] of [
      ["2026-10-17", 60],
      ["2026-10-16", 1100],
      ["2026-10-15", 1350],
    ] as const)
      await d.foodLogs.put({
        ...d.stamp(),
        date,
        name: "Test",
        category: "uncategorized",
        source: "quick",
        sourceId: null,
        quantity: 1,
        unit: "entry",
        nutrition: { calories, protein: null, carbs: null, fat: null },
        lines: [],
        cookingNote: "",
      });
    await d.db.activities.put({
      ...d.stamp(),
      date: "2026-10-17",
      type: "other",
      duration: 300,
      caloriesBurned: null,
      distance: null,
      notes: "",
    });
  });
  await expect(page.getByTestId("food-progress")).toContainText(
    "距目标下限还差 940 kcal",
  );
  await expect(page.getByTestId("exercise-progress")).toContainText(
    "已达到时长目标",
  );
  await expect(page.getByTestId("exercise-progress")).toContainText("未记录");
  await page.goto("/journal?date=2026-10-17");
  const ring = (date: string, name: string) =>
    page.locator('[data-date="' + date + '"] [data-ring="' + name + '"]');
  await expect(ring("2026-10-17", "food")).toHaveAttribute(
    "data-progress",
    "6",
  );
  await expect(ring("2026-10-17", "food")).toHaveAttribute(
    "data-state",
    "below",
  );
  await expect(ring("2026-10-16", "food")).toHaveAttribute(
    "data-state",
    "within",
  );
  await expect(ring("2026-10-15", "food")).toHaveAttribute(
    "data-state",
    "above",
  );
  await expect(ring("2026-10-17", "exercise")).toHaveAttribute(
    "data-state",
    "unknown",
  );
  await expect(
    ring("2026-10-17", "exercise").locator(".ring-fill"),
  ).toHaveAttribute("stroke-dasharray", "2 3");
  await expect(
    page.locator(".calendar-grid .goal-dots,.goal-legend"),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.locator('[data-date="2026-10-17"] .calendar-date-number'),
  ).toHaveText("17");
});
test("legacy aliases stay searchable and nutrition basis remains explicit on mobile", async ({
  page,
}) => {
  await page.evaluate(async () => {
    const d = await import("/src/domain.ts");
    await d.db.ingredients.put({
      ...d.stamp(),
      name: "Salmon",
      nameZh: "三文鱼、鲑鱼",
      brand: "",
      basis: "100g",
      servingGrams: null,
      calories: 200,
      protein: 20,
      carbs: null,
      fat: 10,
    });
  });
  await page.goto("/pantry");
  for (const q of ["Salmon", "salMON", "三文鱼", "鲑鱼"]) {
    await page.locator(".search input").fill(q);
    await expect(page.locator(".pantry-row")).toHaveCount(1);
  }
  await page
    .locator(".pantry-row")
    .getByRole("button", { name: "编辑", exact: true })
    .click();
  const form = page.getByRole("dialog");
  await form.locator(".pantry-photo-import > summary").click();
  await expect(form.getByLabel("其他名称（可选）")).toHaveValue("三文鱼、鲑鱼");
  await form.getByLabel("其他名称（可选）").fill("三文鱼、鲑鱼,red fish");
  await form
    .getByLabel("营养数据基准", { exact: true })
    .selectOption("serving");
  await expect(form.locator(".serving-weight")).toHaveClass(/emphasized/);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await form.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await form.getByRole("button", { name: "保存", exact: true }).click();
  await page.reload();
  await page.locator(".search input").fill("RED FISH");
  await expect(page.locator(".pantry-row")).toHaveCount(1);
  const stored = await page.evaluate(async () => {
    const d = await import("/src/domain.ts");
    return (await d.db.ingredients.toArray())[0];
  });
  expect(stored.calories).toBe(200);
  expect(stored.servingGrams).toBeNull();
  expect(stored.basis).toBe("serving");
});
test("real English image OCR requires editable review and explicit apply, preserves both photos, and never uploads", async ({
  page,
  context,
}) => {
  test.setTimeout(90000);
  const remote: string[] = [];
  context.on("request", (r) => {
    if (
      /^https?:/.test(r.url()) &&
      !r.url().startsWith("http://127.0.0.1:5190/")
    )
      remote.push(r.url());
  });
  await page.goto("/pantry");
  await page.getByRole("button", { name: "添加食材", exact: true }).click();
  const form = page.getByRole("dialog");
  await form.locator(".pantry-photo-import > summary").click();
  await form.locator("input[name=name]").fill("OCR label test");
  await form.locator("input[name=nameZh]").fill("标签测试,Label alias");
  await form.locator("form .pantry-editor-body>.nutrition-fields input").first().fill("111");
  await form.locator("form .pantry-editor-body>.nutrition-fields input").nth(1).fill("7");
  const file = await fixture(page);
  await form
    .locator("[data-photo-kind=photo] input[type=file]")
    .first()
    .setInputFiles(file);
  await form
    .locator("[data-photo-kind=labelPhoto] input[type=file]")
    .first()
    .setInputFiles(file);
  await form.getByRole("button", { name: "识别营养标签", exact: true }).click();
  const review = form.locator(".ocr-review");
  await expect(review).toBeVisible({ timeout: 60000 });
  await expect(review.locator(".nutrition-fields input").nth(0)).toHaveValue(
    "230",
  );
  await expect(review.locator(".nutrition-fields input").nth(1)).toHaveValue(
    "3",
  );
  await expect(review.locator(".nutrition-fields input").nth(2)).toHaveValue(
    "37",
  );
  await expect(review.locator(".nutrition-fields input").nth(3)).toHaveValue(
    "8",
  );
  await expect(
    form.locator("form .pantry-editor-body>.nutrition-fields input").first(),
  ).toHaveValue("111");
  expect(
    await page.evaluate(async () => {
      const d = await import("/src/domain.ts");
      return d.db.ingredients.count();
    }),
  ).toBe(0);
  await review.locator(".nutrition-fields input").nth(1).fill("");
  await expect(review.locator(".ocr-apply")).toBeDisabled();
  await review.locator(".nutrition-fields input").nth(1).fill("3");
  await expect(review.locator(".ocr-apply")).toBeEnabled();
  page.once("dialog", (d) => d.accept());
  await review
    .getByRole("button", { name: "确认并应用到表单", exact: true })
    .click();
  await expect(
    form.locator("form .pantry-editor-body>.nutrition-fields input").first(),
  ).toHaveValue("230");
  await expect(form.locator("select[name=basis]")).toHaveValue("serving");
  await expect(form.locator("input[name=servingGrams]")).toHaveValue("40");
  expect(
    await page.evaluate(async () => {
      const d = await import("/src/domain.ts");
      return d.db.ingredients.count();
    }),
  ).toBe(0);
  await form.getByRole("button", { name: "保存", exact: true }).click();
  await page.reload();
  const item = await page.evaluate(async () => {
    const d = await import("/src/domain.ts");
    return (await d.db.ingredients.toArray())[0];
  });
  expect(item.photo).toContain("data:image/png;base64,");
  expect(item.labelPhoto).toBe(item.photo);
  expect(item.nutritionSource).toBe("package-label-ocr");
  expect(item.labelRecognition.text).toContain("Calories 230");
  expect(item.aliases).toEqual(["标签测试", "Label alias"]);
  expect(remote).toEqual([]);
});
test("a real OCR failure leaves manual entry and reference photo saving usable", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto("/pantry");
  await page.getByRole("button", { name: "添加食材", exact: true }).click();
  const form = page.getByRole("dialog");
  await form.locator(".pantry-photo-import > summary").click();
  await form.locator("input[name=name]").fill("Manual fallback");
  await form
    .locator("[data-photo-kind=labelPhoto] input[type=file]")
    .first()
    .setInputFiles(await fixture(page, true));
  await form.getByRole("button", { name: "识别营养标签", exact: true }).click();
  await expect(form.getByRole("alert")).toBeVisible({ timeout: 60000 });
  await form.locator("form .pantry-editor-body>.nutrition-fields input").first().fill("123");
  await form.getByRole("button", { name: "保存", exact: true }).click();
  await page.reload();
  await expect(page.locator(".pantry-row")).toContainText("123 kcal");
  const photo = await page.evaluate(async () => {
    const d = await import("/src/domain.ts");
    return (await d.db.ingredients.toArray())[0].labelPhoto;
  });
  expect(photo).toContain("data:image/png;base64,");
});
test("consumption above 100% is saved, displayed, editable and used in progress", async ({
  page,
}) => {
  await page.getByRole("button", { name: "添加餐食", exact: true }).click();
  await page.locator(".add-food .nutrition-fields input").first().fill("60");
  await page.locator("input[name=consumptionPercent]").fill("150");
  await page.getByRole("button", { name: "保存记录", exact: true }).click();
  await expect(page.getByTestId("food-progress")).toContainText("90kcal");
  await expect(page.locator(".meal-card .meal-row")).toContainText("150%");
  await page.reload();
  await page
    .locator(".meal-row")
    .getByRole("button", { name: "编辑", exact: true })
    .click();
  await expect(page.locator("input[name=consumptionPercent]")).toHaveValue(
    "150",
  );
  await expect(
    page.locator(".add-food .nutrition-fields input").first(),
  ).toHaveValue("60");
});
