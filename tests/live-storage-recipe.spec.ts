import {expect,test} from '@playwright/test';
import {chooseSavedRecipe} from './recipe-picker-helper';

for(const scenario of ['reduce','increase','unchanged','reselect A','select B','A to B to A','prepared','restore','cancel'] as const)
test('stock meal edit: '+scenario,async({page})=>{
 await page.goto('/today');
 await expect(page.locator('.meal-card')).toBeVisible();
 const ids=await page.evaluate(async scenario=>{
  const d=await import('/src/domain.ts');
  const {FoodStorage}=await import('/src/food-storage.ts');
  const item={...d.stamp(),name:'Historical raw yogurt',nameZh:'',brand:'',basis:'100g' as const,servingGrams:null,calories:60,protein:8,carbs:4,fat:1};
  await d.db.ingredients.put(item);
  const storage=new FoodStorage(),batchId=d.stamp().id,mealId=d.stamp().id;
  if(scenario==='prepared')await storage.makeBatch({id:batchId,operationId:d.stamp().id,name:item.name,preparedOn:d.localDate(),cookedYieldGrams:350,ingredients:[{source:'pantry',line:{ingredientId:item.id,name:item.name,quantity:350,unit:'g',nutrition:d.ingredientNutrition(item,350,'g')}}]});
  else await storage.registerStock({id:batchId,operationId:d.stamp().id,ingredientId:item.id,grams:350,date:d.localDate()});
  await storage.saveMeal({mealId,batchId,operationId:d.stamp().id,portion:{quantity:100,unit:'g'},date:d.localDate(),category:'lunch'});
  await d.db.ingredients.update(item.id,{calories:55,protein:7,carbs:3,fat:2});
  const other={...item,...d.stamp(),name:'Stock B'};
  await d.db.ingredients.put(other);
  const otherId=d.stamp().id;
  await storage.registerStock({id:otherId,operationId:d.stamp().id,ingredientId:other.id,grams:350,date:d.localDate()});
  await d.db.ingredients.update(other.id,{calories:80,protein:6,carbs:8,fat:3});
  if(scenario==='restore'){const backup=await d.exportAll();if(backup.version!==20)throw Error('Expected Backup 20');await d.restoreAll(JSON.parse(JSON.stringify(backup)))}
  return {batchId,mealId,otherId};
 },scenario);
 for(let i=0;i<(scenario==='unchanged'?3:1);i++){
 await page.locator('.meal-row').filter({hasText:'Historical raw yogurt'}).getByRole('button',{name:'编辑',exact:true}).click();
 const form=page.locator('.storage-meal-form');
 await expect(form.locator('.meal-nutrition-preview strong').first()).toHaveText('60 kcal');
 const grams=form.locator('[name=storageGrams]');
 const select=async(id:string)=>{await form.locator('.meal-batch-select button').click();await page.getByRole('menuitemradio').and(page.locator('[data-unit="'+id+'"]')).click()};
 if(scenario==='select B'||scenario==='A to B to A')await select(ids.otherId);
 if(['reselect A','A to B to A','prepared'].includes(scenario))await select(ids.batchId);
 const amount=scenario==='increase'?150:scenario==='unchanged'?100:50;
 if(scenario!=='unchanged'){await grams.fill(String(amount));await grams.press('Tab')}
 const base=scenario==='select B'?[80,6,8,3]:['reselect A','A to B to A'].includes(scenario)?[55,7,3,2]:[60,8,4,1];
 const values=base.map(v=>v*amount/100);
 const {recipeNutritionDisplay}=await import('../src/recipe-nutrition-display');
 await expect(form.locator('.meal-nutrition-preview strong')).toHaveText(values.map((v,i)=>recipeNutritionDisplay(v)+(i?' g':' kcal')));
 await form.getByRole('button',{name:scenario==='cancel'?'取消':'保存记录',exact:true}).click();
 await expect(form).toHaveCount(0);
 const saved=await page.evaluate(async ids=>{
  const d=await import('/src/domain.ts');
  return {meal:await d.foodLogs.get(ids.mealId),batch:await d.db.foodBatches.get(ids.batchId),other:await d.db.foodBatches.get(ids.otherId)};
 },ids);
 expect(saved.batch?.remainingQuantity).toBe(scenario==='cancel'?250:scenario==='select B'?350:350-amount);
 expect(saved.other?.remainingQuantity).toBe(scenario==='select B'?350-amount:350);
 const [calories,protein,carbs,fat]=scenario==='cancel'?[60,8,4,1]:values;
 for(const [key,value] of Object.entries({calories,protein,carbs,fat}))expect(saved.meal?.nutrition[key as keyof typeof saved.meal.nutrition]).toBeCloseTo(value,12);
 }
});

test('a Pantry correction updates the raw-stock recipe card, detail and meal without revisiting the recipe editor',async({page})=>{
 await page.goto('/#/recipes');await expect(page.locator('.recipe-fab')).toBeVisible();
 const fixture=await page.evaluate(async()=>{
  const {db,recipes,stamp,localDate}=await import('/src/domain.ts');
  const {FoodStorage}=await import('/src/food-storage.ts');
  const {storedRecipeLine}=await import('/src/recipe-storage.ts');
  const ingredient={...stamp(),name:'Test yogurt',nameZh:'',brand:'',basis:'100g' as const,servingGrams:null,calories:60,protein:8,carbs:4,fat:2};
  await db.ingredients.put(ingredient);
  const storage=new FoodStorage(),id=stamp().id;
  await storage.registerStock({id,operationId:stamp().id,ingredientId:ingredient.id,grams:350,date:localDate()});
  const recipe={...stamp(),name:'Yogurt from raw stock',instructions:'',stickyNote:'',servings:1,lines:[storedRecipeLine((await storage.batches.get(id))!)]};
  await recipes.put(recipe);return {ingredient:ingredient.id,recipe};
 });
 const card=page.locator('.recipe-list-row').filter({hasText:fixture.recipe.name});
 await expect(card.locator('.recipe-metadata')).toContainText('60 kcal');
 await page.evaluate(async id=>{const {db}=await import('/src/domain.ts');await db.ingredients.update(id,{calories:55})},fixture.ingredient);
 await expect(card.locator('.recipe-metadata')).toContainText('55 kcal');
 await card.getByRole('link',{name:fixture.recipe.name,exact:true}).click();
 const detail=page.locator('.recipe-detail-modal');
 await expect(detail.locator('.hero-nutrition strong').first()).toContainText('55');
 await detail.locator('.modal-head button').click();
 await page.goto('/#/today');await page.locator('.meal-card .section-heading .primary').click();
 const meal=page.locator('.add-food-modal');await chooseSavedRecipe(meal,fixture.recipe.id);
 await expect(meal.locator('.meal-nutrition-preview strong').first()).toHaveText('55 kcal');
 expect(await page.evaluate(async id=>(await import('/src/domain.ts')).recipes.get(id),fixture.recipe.id)).toEqual(fixture.recipe);
});
