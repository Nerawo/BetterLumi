import {jumpToDate} from "./date-jump";
import { test, expect, chromium, type Page } from "@playwright/test";
test("ingredient replacement and explicit variation/original actions remain independent", async ({
  page,
}) => {
  await seed(page);
  await page.goto("/recipes");
  await page.getByRole("link", { name: "Reading recipe" }).click();
  await page
    .getByRole("button", { name: "Add to Today’s Meals", exact: true })
    .click();
  await page.locator(".meal-advanced > summary").click();
  await page.locator(".add-food .recipe-line input").fill("60");
  const replacement = await page.evaluate(async () => {
    const d = await import("/src/domain.ts");
    const item = {
      ...d.stamp(),
      name: "Replacement ingredient",
      nameZh: "",
      brand: "",
      basis: "100g",
      servingGrams: null,
      calories: 200,
      protein: 5,
      carbs: 20,
      fat: 3,
    };
    await d.db.ingredients.put(item);
    return item.id;
  });
  await page.locator(".ingredient-replace-toggle").click();
  await page.locator(".add-food .replace-select").selectOption(replacement);
  page.once("dialog", (d) => d.accept("Explicit variation"));
  await page
    .getByRole("button", { name: "Save as variation", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Variation saved");
  const snapshots = await page.evaluate(async () => {
    const d = await import("/src/domain.ts");
    return (await d.recipes.toArray()).map((r) => ({
      name: r.name,
      quantity: r.lines[0].quantity,
    }));
  });
  expect(snapshots.find((r) => r.name === "Reading recipe")?.quantity).toBe(
    100,
  );
  expect(snapshots.find((r) => r.name === "Explicit variation")?.quantity).toBe(
    60,
  );
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Update original recipe", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Original recipe updated explicitly",
  );
  await page.getByRole("button", { name: "Log Once", exact: true }).click();
  const log = await page.evaluate(async () => {
    const d = await import("/src/domain.ts");
    return (await d.foodLogs.toArray())[0];
  });
  expect(log.lines[0].quantity).toBe(60);
  expect(log.lines[0].ingredientId).toBe(replacement);
});
test("reopening an isolated browser profile retains IndexedDB records and explicit Chinese preference", async ({}, info) => {
  const profile = info.outputPath("persistent-profile");
  const options = {
    channel: "chrome",
    headless: true,
    args: ["--disable-crash-reporter", "--disable-breakpad"],
  };
  let context = await chromium.launchPersistentContext(profile, options);
  let p = await context.newPage();
  await p.goto("http://127.0.0.1:5190/pantry");
  await p.getByRole("heading", { name: "Pantry" }).waitFor();
  await p.evaluate(async () => {
    const d = await import("/src/domain.ts");
    await d.db.ingredients.put({
      ...d.stamp(),
      name: "Retained on reopen",
      nameZh: "",
      brand: "",
      basis: "100g",
      servingGrams: null,
      calories: null,
      protein: null,
      carbs: null,
      fat: null,
    });
    await d.db.settings.put({ key: "language", value: "zh" });
  });
  await expect(
    p.getByText("Retained on reopen", { exact: true }),
  ).toBeVisible();
  await context.close();
  context = await chromium.launchPersistentContext(profile, options);
  p = await context.newPage();
  await p.goto("http://127.0.0.1:5190/pantry");
  await expect(p.getByRole("heading", { name: "Pantry" })).toBeVisible();
  await expect(
    p.getByText("Retained on reopen", { exact: true }),
  ).toBeVisible();
  await context.close();
});
async function seed(page: Page) {
  await page.evaluate(async () => {
    const d = await import("/src/domain.ts");
    const { recipeNotes, goalTable } = await import("/src/goals.ts");
    const i = {
      ...d.stamp(),
      name: "Test oats",
      nameZh: "测试燕麦",
      brand: "Test only",
      basis: "100g",
      servingGrams: null,
      calories: 400,
      protein: 10,
      carbs: 65,
      fat: 6,
    };
    await d.db.ingredients.put(i);
    const r = {
      ...d.stamp(),
      name: "Reading recipe",
      servings: 2,
      lines: [
        {
          ingredientId: i.id,
          name: i.name,
          quantity: 100,
          unit: "g",
          nutrition: { calories: 400, protein: 10, carbs: 65, fat: 6 },
        },
      ],
      instructions:
        "1. First step.\n\n" +
        "A long cooking instruction with careful details. ".repeat(80) +
        "\n\n2. FINAL STEP — ENJOY.",
      stickyNote: "Keep this original note",
      category: "Breakfast",
    };
    await d.recipes.put(r);
    await goalTable.put({
      ...d.stamp(),
      startDate: "2026-01-01",
      endDate: null,
      calorieMin: 1500,
      calorieMax: 1800,
      exerciseMinutes: 30,
      exerciseKcal: null,
    });
  });
}
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-17T12:00:00-04:00") });
  await page.goto("/today");
  await page.evaluate(async () => {
    const d = await import("/src/domain.ts");
    await d.db.settings.put({ key: "language", value: "en" });
  });
  await expect(
    page.locator(".graphic-headline"),
  ).toBeVisible();
});
test("URL refresh, browser history, detail deep links and saved English", async ({
  page,
}) => {
  for (const path of ["recipes", "pantry", "more", "weight"]) {
    await page.goto("/" + path);
    await page.reload();
    await expect(page).toHaveURL(new RegExp("/" + path));
    await expect(page.locator(".page h1")).toBeVisible();
  }
  await seed(page);
  await page.goto("/recipes");
  await page.getByRole("link", { name: "Reading recipe" }).click();
  await expect(page).toHaveURL(/\/recipes\/.+/);
  await page.reload();
  await expect(page.locator(".recipe-method")).toContainText(
    "FINAL STEP — ENJOY.",
  );
  await page
    .locator(".recipe-detail-modal>.modal-head")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await expect(page).toHaveURL(/\/recipes$/);
  await page.goForward();
  await expect(page.locator(".recipe-method")).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/recipes$/);
  await page.goto("/recipes/missing-id");
  await expect(
    page.getByRole("heading", {
      name: "This recipe is unavailable or has been deleted.",
    }),
  ).toBeVisible();
});
test("Journal input/calendar/URL stay synchronized and use desktop columns", async ({
  page,
}) => {
  await seed(page);
  await page.goto("/journal?date=2026-10-17");
  const input = page.getByTestId("selected-day");
  await jumpToDate(page,"2026-09-05");
  await expect(page).toHaveURL(/date=2026-09-05/);
  await expect(page.getByTestId("selected-day")).toHaveAttribute("datetime", "2026-09-05");
  await expect(
    page.getByRole("heading", { name: "September 2026" }),
  ).toBeVisible();
  await page.getByRole("button", {name:"Expand month", exact:true}).click();
  await page.locator('[data-date="2026-09-11"]').click();
  await expect(input).toHaveAttribute("datetime","2026-09-11");
  await page.goBack();
  await expect(input).toHaveAttribute("datetime","2026-09-05");
  await page.reload();
  await expect(input).toHaveAttribute("datetime","2026-09-05");
  const left = await page.locator(".calendar-card").boundingBox();
  await expect(page.locator(".journal-day-panel")).toHaveCount(0);
  expect(left!.height).toBeLessThan(420);
  await expect(
    page.locator('[data-date="2026-09-05"] .activity-ring'),
  ).toHaveCount(0);
});
test("direct weight entry stays on Today and persists into /weight and the calendar", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Record Weight", exact: true })
    .click();
  const form = page.getByRole("dialog");
  await form.locator("input[name=value]").fill("154.323583526");
  await form.locator("select").selectOption("lb");
  await form.locator("input[name=value]").fill("154.323583526");
  await form.locator("textarea").fill("Morning measurement");
  await form.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.locator(".weight-mini strong")).toContainText("70.0");
  await page.reload();
  await expect(page.locator(".weight-mini strong")).toContainText("70.0");
  await page
    .getByRole("button", { name: "View weight journal", exact: true })
    .click();
  await expect(page).toHaveURL(/\/weight$/);
  await expect(page.locator(".line-chart circle")).toHaveCount(1);
  await expect(page.getByText("Morning measurement")).toBeVisible();
  await page
    .locator(".record-list")
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .locator("textarea")
    .fill("Edited historical note");
  await page
    .getByRole("dialog")
    .last()
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect(page.getByText("Edited historical note")).toBeVisible();
  await page.goto("/journal?date=2026-10-17");
  await expect(page.locator(".weight-mini")).toContainText("70.0 kg");
});
test("custom activities, tags and manual energy persist and remain separate from food", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Log movement", exact: true }).click();
  const form = page.getByRole("dialog");
  await form.locator("input[name=name]").fill("My custom cable flow");
  await form.locator("input[name=duration]").fill("45");
  await form.getByLabel("Strength Training", { exact: true }).check();
  await form.getByLabel("Anaerobic", { exact: true }).check();
  await form.getByLabel("Add any body-part label").fill("Rotator cuff");
  await form.getByRole("button", { name: "Add", exact: true }).click();
  await form.locator("input[name=caloriesBurned]").fill("240");
  await form.getByRole("button", { name: "Save", exact: true }).click();
  await page.reload();
  await expect(page.locator(".activity-row")).toContainText(
    "My custom cable flow",
  );
  await expect(page.locator(".activity-row")).toContainText("Rotator cuff");
  await expect(page.locator(".activity-row")).toContainText("240 kcal");
  await page.goto("/journal?date=2026-10-17");
  await expect(page.locator(".today-layout .activity-row")).toContainText(
    "Strength Training",
  );
  await page.goto("/more");
  await expect(page.locator(".activity-history")).toHaveCount(0);
});
test("independent custom supplement schedules and editing survive refresh", async ({
  page,
}) => {
  for (const [name, days] of [
    ["Schedule A", ["Tuesday", "Wednesday"]],
    ["Schedule B", ["Thursday", "Friday"]],
  ] as const) {
    await page
      .getByRole("button", { name: "Add supplement", exact: true })
      .click();
    const form = page.getByRole("dialog");
    await form.locator("input[name=name]").fill(name);
    await form.locator("input[name=dosage]").fill("1");
    await form.locator("input[name=unit]").fill("tablet");
    await form.locator(".supplement-schedule-options button").last().click();
    for (const day of days) await form.getByLabel(day, { exact: true }).check();
    await form.getByRole("button", { name: "Save", exact: true }).click();
  }
  await page.goto("/journal?date=2026-10-20");
  await expect(page.locator(".today-support .supplement-row")).toHaveCount(
    1,
  );
  await expect(
    page.locator(".today-support .supplement-row"),
  ).toContainText("Schedule A");
  await page.reload();
  await expect(
    page.locator(".today-support .supplement-row"),
  ).toContainText("Schedule A");
  await jumpToDate(page,'2026-10-22');
  await expect(page.locator(".today-support .supplement-row")).toHaveCount(
    1,
  );
  await expect(
    page.locator(".today-support .supplement-row"),
  ).toContainText("Schedule B");
  await page
    .locator(".today-support .supplement-row")
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByLabel("Thursday", { exact: true }),
  ).toBeChecked();
  await page
    .getByRole("dialog")
    .getByLabel("Friday", { exact: true })
    .uncheck();
  await page
    .getByRole("dialog")
    .getByLabel("Saturday", { exact: true })
    .check();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await page.reload();
  await jumpToDate(page,'2026-10-24');
  await expect(
    page.locator(".today-support .supplement-row"),
  ).toContainText("Schedule B");
});
test("sticky notes CRUD and Log Once do not overwrite the original recipe", async ({
  page,
}) => {
  await seed(page);
  await page.goto("/recipes");
  await page.getByRole("link", { name: "Reading recipe" }).click();
  await page
    .getByRole("button", { name: "＋ Write a sticky note", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .last()
    .locator("textarea")
    .fill("New paper note");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await page.reload();
  const note = page
    .locator(".paper-note")
    .filter({ hasText: "New paper note" });
  await note.locator(".note-text").click();
  await page.getByRole("dialog").locator("textarea").fill("Revised paper note");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await page
    .locator(".paper-note")
    .filter({ hasText: "Revised paper note" })
    .locator("summary")
    .click();
  await page.addLocatorHandler(page.locator('.delete-confirmation-modal'),async dialog=>{await dialog.locator('.delete-destructive').click()},{times:1});
  await page
    .locator(".paper-note")
    .filter({ hasText: "Revised paper note" })
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await expect(page.getByText("Revised paper note")).toHaveCount(0);
  await expect(
    page
      .locator(".recipe-detail-modal .note-text")
      .filter({ hasText: "Keep this original note" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Add to Today’s Meals", exact: true })
    .click();
  await page.locator(".meal-advanced > summary").click();
  await page.locator(".add-food .recipe-line input[type=number]").fill("75");
  await page.locator(".meal-extras > summary").click();
  await page
    .locator(".add-food textarea[name=cookingNote]")
    .fill("Only this meal");
  await page.getByRole("button", { name: "Log Once", exact: true }).click();
  await expect(page.locator(".meal-card .meal-row")).toContainText(
    "Only this meal",
  );
  await page.goto("/recipes");
  await page.getByRole("link", { name: "Reading recipe" }).click();
  await expect(page.locator(".detail-ingredients")).toContainText("100 g");
  await expect(page.locator(".recipe-method")).toContainText(
    "FINAL STEP — ENJOY.",
  );
});
test("mobile quick meals are optional, goals version and calendar dots are real, language persists", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".mobile-nav")).toBeVisible();
  await page.getByRole("button", { name: "Edit goals", exact: true }).click();
  const form = page.getByRole("dialog");
  await form
    .getByLabel("Intake reference — minimum kcal", { exact: true })
    .fill("1500");
  await form
    .getByLabel("Intake reference — maximum kcal", { exact: true })
    .fill("1800");
  await form
    .getByLabel("Exercise target — minutes", { exact: true })
    .fill("30");
  await form
    .getByRole("button", { name: "New dated version", exact: true })
    .click();
  await page.getByRole("button", { name: "Add food", exact: true }).click();
  await expect(page.locator(".add-food .source-tabs button")).toHaveCount(3);
  await expect(page.locator(".add-food .import-entry")).toHaveCount(0);
  await page
    .locator(".add-food .source-tabs")
    .getByRole("button", { name: "Quick entry", exact: true })
    .click();
  await page.locator(".add-food .nutrition-fields input").first().fill("1700");
  await page.getByRole("button", { name: "Save entry", exact: true }).click();
  await expect(page.locator(".meal-row")).toHaveCount(1);
  await expect(
    page
      .locator(".mobile-nav")
      .getByRole("button", { name: "Journal", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator('[data-date="2026-10-17"]')).toHaveAttribute(
    "data-food-status",
    "within",
  );
  await expect(page.locator('[data-date="2026-10-17"]')).toHaveAttribute(
    "data-exercise-status",
    "none",
  );
  await page
    .locator(".mobile-nav")
    .getByRole("button", { name: "More", exact: true })
    .click();
  await page.getByRole("button", { name: /Language/ }).click();
  await page.getByRole("button", { name: "简体中文", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("heading", { name: "More" })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

