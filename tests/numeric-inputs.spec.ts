import {pickIngredient,openPersonalGoalEditor} from './current-ui';
import {test,expect,type Locator} from '@playwright/test';

 for(const [language,width]of [['zh',390],['en',430]] as const)test(`numeric editing across forms ${language}`,async({page},testInfo)=>{
  const engine=testInfo.project.name;
  test.setTimeout(120000);await page.setViewportSize({width,height:844});await page.clock.setFixedTime(new Date('2026-10-20T12:00:00-04:00'));
  await page.goto('/pantry');await expect(page.locator('.pantry-fab')).toBeVisible();
  const ids=await page.evaluate(async language=>{const d=await import('/src/domain.ts');await d.db.settings.put({key:'language',value:language});const ingredient={...d.stamp(),name:'Numeric ingredient',nameZh:'',brand:'',basis:'100g',servingGrams:32,referenceAmount:32,referenceUnit:'g',calories:160,protein:2,carbs:18,fat:9};await d.db.ingredients.put(ingredient);const recipe={...d.stamp(),name:'Numeric recipe',servings:1,lines:[{ingredientId:ingredient.id,name:ingredient.name,quantity:16,unit:'g',nutrition:d.ingredientNutrition(ingredient,16,'g')}],instructions:'',stickyNote:''};await d.recipes.put(recipe);return {ingredient:ingredient.id,recipe:recipe.id};},language);await page.reload();
  let fields=0;
  const exerciseNumbers=async(root:Locator)=>{
   for(const input of await root.locator('input[type=number]:visible').all()){
    const original=await input.inputValue();
    await input.fill('123');await input.press('End');
    await input.press('Backspace');await input.press('Backspace');await input.press('Backspace');
    await expect(input).toHaveValue('');await input.press('Tab');await expect(input).toHaveValue('');
    for(const digit of ['0','8']){await input.fill(digit);await input.press('End');await input.press('Backspace');await expect(input).toHaveValue('');}
    await input.fill('1');await input.press('End');await input.press('.');await input.press('5');await expect(input).toHaveValue('1.5');
    await input.fill(original);await input.press('Tab');fields++;
   }
  };
  await page.locator('.pantry-fab').click();let modal=page.locator('.pantry-editor-modal');await modal.locator('.consumption-unit-editor summary').click();await exerciseNumbers(modal);await modal.locator('[name=basis]').selectOption('serving');await exerciseNumbers(modal);await page.keyboard.press('Escape');
  await page.locator('.mobile-nav button').nth(1).click();await page.locator('.recipe-list-row .actions button').first().click();modal=page.locator('.recipe-editor-modal');await exerciseNumbers(modal);await modal.locator('.recipe-line input[type=number]').fill('');await modal.locator('.form-actions .primary').click();await expect(modal).toBeVisible();expect(await page.evaluate(async id=>{const {recipes}=await import('/src/domain.ts');return (await recipes.get(id))!.lines[0].quantity;},ids.recipe)).toBe(16);await page.keyboard.press('Escape');
  await page.locator('.mobile-nav button').first().click();await page.locator('.meal-card .section-heading .primary').click();modal=page.locator('.add-food-modal');await modal.locator('.source-tabs button').nth(1).click();await pickIngredient(page,ids.ingredient);await exerciseNumbers(modal);await modal.locator('[name=consumptionPercent]').fill('');await modal.locator('.add-food-footer .primary').click();await expect(modal).toBeVisible();expect(await page.evaluate(async()=>{const {foodLogs}=await import('/src/domain.ts');return foodLogs.count();})).toBe(0);await modal.locator('[name=consumptionPercent]').fill('100');await modal.locator('.meal-amounts input[type=number]').first().fill('16');await modal.locator('.add-food-footer .primary').click();await expect(modal).toHaveCount(0);expect(await page.evaluate(async()=>{const {foodLogs}=await import('/src/domain.ts');return (await foodLogs.toArray())[0].nutrition.calories;})).toBe(80);
  await page.locator('.meal-card .section-heading .primary').click();modal=page.locator('.add-food-modal');await modal.locator('.source-tabs button').nth(2).click();await exerciseNumbers(modal);await modal.locator('.nutrition-fields input').first().fill('');await modal.locator('.nutrition-fields input').nth(1).fill('0');await modal.locator('.add-food-footer .primary').click();await expect(modal).toHaveCount(0);const quick=await page.evaluate(async()=>{const {foodLogs}=await import('/src/domain.ts');return (await foodLogs.toArray()).find(l=>l.source==='quick')!;});expect(quick.nutrition.calories).toBeNull();expect(quick.nutrition.protein).toBe(0);
  await page.locator('#today-tab-activity').click();await page.locator('.exercise-card .section-heading .primary').click();modal=page.locator('.exercise-record-editor');await exerciseNumbers(modal);await page.keyboard.press('Escape');await page.locator('.exercise-plans-section .section-heading .primary').click();modal=page.locator('.exercise-plan-editor');await exerciseNumbers(modal);await page.keyboard.press('Escape');
  await page.locator('#today-tab-supplements').click();await page.locator('.supplement-heading .primary').click();modal=page.locator('dialog[open]');await exerciseNumbers(modal);await page.keyboard.press('Escape');
  await page.locator('#today-tab-weight').click();await page.locator('.record-weight-button').click();modal=page.locator('dialog[open]');await exerciseNumbers(modal);await page.keyboard.press('Escape');
  await openPersonalGoalEditor(page);const goal=page.locator('.goal-editor-inline');await goal.locator('.nutrition-goal-controls .goal-master-heading input[type=checkbox]').check();await goal.locator('.exercise-goal-heading input[type=checkbox]').check();await goal.locator('.advanced-nutrition-toggle').click();for(const check of await goal.locator('.nutrition-goal-control input[type=checkbox]').all())await check.check();await exerciseNumbers(goal);
  expect(fields).toBeGreaterThanOrEqual(30);console.log(`${engine}/${language}: ${fields} numeric fields cleared and retyped`);
 });
