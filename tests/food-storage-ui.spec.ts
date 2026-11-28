import {chooseSavedRecipe} from './recipe-picker-helper';
import {test,expect,type Page,type Locator} from '@playwright/test';
test.use({browserName:'webkit',channel:'',viewport:{width:390,height:844},isMobile:true,hasTouch:true});
async function seed(page:Page,language='en'){
 await page.goto('/today');await expect(page.locator('.meal-card')).toBeVisible();
 const fixture=await page.evaluate(async language=>{const d=await import('/src/domain.ts');await d.db.settings.put({key:'language',value:language});const ingredient={...d.stamp(),name:'Synthetic pantry food',nameZh:'',brand:'',basis:'100g',servingGrams:null,calories:600,protein:30,carbs:60,fat:20};await d.db.ingredients.put(ingredient);const recipe={...d.stamp(),name:'Synthetic storage recipe',servings:1,lines:[{ingredientId:ingredient.id,name:ingredient.name,quantity:100,unit:'g',nutrition:{calories:600,protein:30,carbs:60,fat:20}}],instructions:'Keep recipe',stickyNote:'Keep notes'};await d.recipes.put(recipe);return{ingredient,recipe}},language);await page.reload();return fixture;
}
async function storageTab(page:Page){await page.goto('/recipes');await page.locator('#recipes-storage-tab').click()}
async function openMeal(page:Page){await page.goto('/today');await page.locator('#today-tab-food').click();await page.locator('.meal-card .section-heading .primary').click();return page.locator('.add-food-modal')}
async function setRange(slider:Locator,value:number){await slider.evaluate((input,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,String(value));input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}))},value);await expect(slider).toHaveValue(String(value))}
async function noOverflow(target:Locator){expect(await target.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true)}

test('copies a recipe into a batch, consumes grams and exposes correction/archive/restore/discard with real history',async({page})=>{
 const fixture=await seed(page);await storageTab(page);await page.getByRole('button',{name:'Make a Batch',exact:true}).click();const make=page.locator('.storage-make-modal');await chooseSavedRecipe(make,fixture.recipe.id);await make.locator('[name=batchName]').fill('Prepared rice');await make.locator('.batch-review > summary').click();await make.locator('.recipe-line input').fill('50');await make.locator('.recipe-line input').blur();await make.locator('[name=cookedYieldGrams]').fill('300');await make.locator('[name=cookedYieldGrams]').blur();await expect(make.locator('.nutrition-strip').first().locator('strong').first()).toHaveText('300 kcal');await expect(make.locator('.nutrition-strip').last().locator('strong').first()).toHaveText('100 kcal');await make.locator('.form-actions .primary').click();await expect(make).toHaveCount(0);
 let state=await page.evaluate(async id=>{const d=await import('/src/domain.ts');return{recipe:await d.recipes.get(id),batch:(await d.db.foodBatches.toArray())[0],meals:await d.foodLogs.count()}},fixture.recipe.id);expect(state.recipe).toEqual(fixture.recipe);expect(state.meals).toBe(0);expect(state.batch.remainingQuantity).toBe(300);const row=page.locator('.storage-list-row');await expect(row).toContainText('300 g');await expect(row.locator('progress')).toHaveAttribute('value','1');
 await row.click();const detail=page.locator('.storage-detail-modal');await expect(detail).toContainText('Formula has not been used');await expect(detail.locator('.storage-ingredient-snapshots')).toContainText('50 g');await detail.getByRole('button',{name:'Record consumption',exact:true}).click();let consumption=page.locator('.storage-meal-form');await consumption.locator('[name=storageGrams]').fill('150');await expect(consumption.locator('.nutrition-strip strong').first()).toHaveText('150 kcal');await consumption.locator('.form-actions .primary').click();await expect(page.locator('.storage-meal-form')).toHaveCount(0);await expect(detail).toContainText('Formula locked');
 await detail.getByRole('button',{name:'Adjust remaining quantity',exact:true}).click();let action=page.locator('.storage-action-modal');await action.locator('input[type=number]').fill('350');await action.locator('input:not([type=number])').fill('Measured actual remainder');await action.locator('.form-actions .primary').click();await expect(action).toHaveCount(0);await expect(detail.locator('.storage-summary')).toContainText('350 g');
 await detail.getByRole('button',{name:'Archive batch',exact:true}).click();await action.locator('.form-actions .primary').click();await expect(detail.locator('.storage-summary')).toContainText('Manually archived');await detail.getByRole('button',{name:'Restore batch',exact:true}).click();await action.locator('.form-actions .primary').click();await expect(detail.locator('.storage-summary')).toContainText('Active');
 await detail.getByRole('button',{name:'Discard remaining food',exact:true}).click();await action.getByRole('button',{name:'Cancel',exact:true}).click();expect(await page.evaluate(async id=>{const d=await import('/src/domain.ts');return(await d.db.foodBatches.get(id))!.remainingQuantity},state.batch.id)).toBe(350);await detail.getByRole('button',{name:'Discard remaining food',exact:true}).click();await action.locator('.form-actions .primary').click();await expect(detail.locator('.storage-summary')).toContainText('Discarded');await expect(detail.locator('.storage-history')).toContainText('Actual inventory corrected');await noOverflow(detail);await detail.screenshot({path:'work/screenshots/food-storage-detail-390.png'});
});
test('makes a batch from scratch with Pantry and stored-food ingredients; cancellation floats through confirmation and returns stock once',async({page})=>{
 const fixture=await seed(page);const source=await page.evaluate(async recipe=>{const d=await import('/src/domain.ts'),s=await import('/src/food-storage.ts');const id=d.stamp().id;await new s.FoodStorage().makeBatch({operationId:d.stamp().id,id,name:'Source sauce',preparedOn:d.localDate(),ingredients:s.copyRecipeForBatch(recipe),cookedYieldGrams:600});return id},fixture.recipe);
 await storageTab(page);await page.getByRole('button',{name:'Make a Batch',exact:true}).click();const make=page.locator('.storage-make-modal');await make.locator('[name=batchName]').fill('Prepared pasta');await make.locator('.batch-review > summary').click();await make.locator('.ingredient-add-trigger').click();const picker=page.locator('.ingredient-picker-modal');await picker.locator('input[type=search]').fill(fixture.ingredient.name);await picker.locator('[data-ingredient-id="'+fixture.ingredient.id+'"]').click();await expect(picker).toHaveCount(0);await make.locator('.recipe-line input').fill('50');await make.locator('.recipe-line input').blur();await expect(make.locator('.nutrition-strip').first().locator('strong').first()).toHaveText('300 kcal');await make.locator('.storage-add-source').click();await page.locator('.stored-food-picker .storage-list-row').filter({hasText:'Source sauce'}).click();await make.locator('.recipe-line').filter({hasText:'Source sauce'}).locator('input').fill('200');await make.locator('[name=cookedYieldGrams]').fill('800');expect(await page.evaluate(async id=>{const d=await import('/src/domain.ts');return(await d.db.foodBatches.get(id))!.remainingQuantity},source)).toBe(600);await expect(make.locator('.nutrition-strip').first().locator('strong').first()).toHaveText('500 kcal');await make.locator('.form-actions .primary').click();await expect(make).toHaveCount(0);
 expect(await page.evaluate(async id=>{const d=await import('/src/domain.ts');return(await d.db.foodBatches.get(id))!.remainingQuantity},source)).toBe(400);await page.locator('.storage-list-row').filter({hasText:'Prepared pasta'}).click();const detail=page.locator('.storage-detail-modal');await detail.getByRole('button',{name:'Cancel preparation',exact:true}).click();const action=page.locator('.storage-action-modal');await action.getByRole('button',{name:'Cancel',exact:true}).click();expect(await page.evaluate(async id=>{const d=await import('/src/domain.ts');return(await d.db.foodBatches.get(id))!.remainingQuantity},source)).toBe(400);await detail.getByRole('button',{name:'Cancel preparation',exact:true}).click();await action.getByRole('button',{name:'Confirm',exact:true}).click();await expect(detail.locator('.storage-summary')).toContainText('Canceled');await expect(detail.getByRole('button',{name:'Cancel preparation',exact:true})).toHaveCount(0);expect(await page.evaluate(async id=>{const d=await import('/src/domain.ts');return{quantity:(await d.db.foodBatches.get(id))!.remainingQuantity,meals:await d.foodLogs.count()}},source)).toEqual({quantity:600,meals:0});
});
test('saves recipe leftovers explicitly, retains storage tab drafts, consumes current ratios, edits/deletes and converts to measured grams',async({page})=>{
 const fixture=await seed(page);let modal=await openMeal(page);await expect(modal.locator('.source-tabs button')).toHaveCount(4);await expect(modal.locator('.source-tabs button').first()).toHaveAttribute('aria-pressed','true');await chooseSavedRecipe(modal,fixture.recipe.id);await setRange(modal.getByRole('slider'),50);const opt=modal.locator('.leftover-option input');await expect(opt).not.toBeChecked();await opt.check();await modal.locator('form:visible > .add-food-footer .primary').click();await expect(modal).toHaveCount(0);
 const origin=await page.evaluate(async()=>{const d=await import('/src/domain.ts');return{batch:(await d.db.foodBatches.toArray())[0],meal:(await d.foodLogs.toArray())[0]}});expect(origin.batch).toMatchObject({mode:'ratio',remainingQuantity:.5});expect(origin.meal.nutrition.calories).toBe(300);
 modal=await openMeal(page);await modal.locator('.source-tabs button').nth(2).click();let form=modal.locator('.storage-meal-form');await form.locator('.meal-batch-select button').tap();await page.locator('.draft-unit-menu [data-unit="'+origin.batch.id+'"]').tap();const slider=form.getByRole('slider');await form.locator('[name=storageStockPercent]').fill('50');await expect(form.locator('.nutrition-strip strong').first()).toHaveText('150 kcal');await modal.locator('.source-tabs button').last().click();await modal.locator('.source-tabs button').nth(2).click();await expect(slider).toHaveValue('0.25');await form.locator('.form-actions .primary').click();await expect(modal).toHaveCount(0);
 let saved=await page.evaluate(async()=>{const d=await import('/src/domain.ts');return(await d.foodLogs.toArray()).find(m=>m.storageConsumption)!});expect(saved.nutrition.calories).toBe(150);await page.reload();await page.locator('#today-tab-food').click();let row=page.locator('.meal-row').filter({hasText:/150\s*kcal/});await row.locator('.actions button').first().click();await expect(modal.locator('.source-tabs button').nth(2)).toHaveAttribute('aria-pressed','true');form=modal.locator('.storage-meal-form');await form.locator('[name=storageStockPercent]').fill('25');await form.locator('.form-actions .primary').click();await expect(modal).toHaveCount(0);row=page.locator('.meal-row').filter({hasText:/75\s*kcal/});await row.locator('.actions button').last().click();await page.locator('.delete-destructive').click();await expect(row).toHaveCount(0);expect(await page.evaluate(async id=>{const d=await import('/src/domain.ts');return(await d.db.foodBatches.get(id))!.remainingQuantity},origin.batch.id)).toBe(.5);
 await storageTab(page);await page.locator('.storage-list-row').click();const detail=page.locator('.storage-detail-modal');await detail.getByRole('button',{name:'Convert to grams',exact:true}).click();const action=page.locator('.storage-action-modal');await action.locator('input[type=number]').fill('250');await action.locator('.form-actions .primary').click();await expect(detail.locator('.storage-summary')).toContainText('250 g');await detail.getByRole('button',{name:'Record consumption',exact:true}).click();form=page.locator('.storage-meal-form');await form.locator('[name=storageGrams]').fill('50');await expect(form.locator('.nutrition-strip strong').first()).toHaveText('60 kcal');await form.locator('.form-actions .primary').click();expect(await page.evaluate(async id=>{const d=await import('/src/domain.ts');return(await d.foodLogs.get(id))!.nutrition.calories},origin.meal.id)).toBe(300);
});
test('shows an origin conflict and requires explicit confirmation before correcting only the meal',async({page})=>{
 const fixture=await seed(page);const original=await page.evaluate(async recipe=>{const d=await import('/src/domain.ts'),s=await import('/src/food-storage.ts'),service=new s.FoodStorage();const id=d.stamp().id,meal={...d.stamp(),name:'Origin meal',date:d.localDate(),category:'lunch',source:'recipe' as const,sourceId:recipe.id,quantity:1,unit:'serving',baseNutrition:recipe.lines[0].nutrition,nutrition:{calories:300,protein:15,carbs:30,fat:10},consumptionPercent:50,lines:recipe.lines,cookingNote:''};await service.saveMealWithLeftovers({operationId:d.stamp().id,meal,batchId:id,saveLeftovers:true});await service.saveMeal({operationId:d.stamp().id,mealId:d.stamp().id,batchId:id,portion:{unit:'percent',quantity:50},date:d.localDate(),category:'lunch'});return{meal:(await d.foodLogs.get(meal.id))!,batch:(await d.db.foodBatches.get(id))!}},fixture.recipe);
 await page.reload();await page.locator('#today-tab-food').click();await page.locator('.meal-row').filter({hasText:/300\s*kcal/}).locator('.actions button').first().click();const modal=page.locator('.add-food-modal');await setRange(modal.getByRole('slider'),25);await modal.locator('form:visible .add-food-footer .primary').click();await expect(modal.locator('.food-status')).toContainText('later inventory activity');expect(await page.evaluate(async id=>{const d=await import('/src/domain.ts');return d.db.foodBatches.get(id)},original.batch.id)).toEqual(original.batch);
 await setRange(modal.getByRole('slider'),35);await modal.getByRole('button',{name:'Correct meal only',exact:true}).click();let confirm=page.locator('.food-storage-modal').filter({hasText:'Correct the meal without changing inventory?'});await confirm.getByRole('button',{name:'Cancel',exact:true}).click();expect(await page.evaluate(async id=>{const d=await import('/src/domain.ts');return d.foodLogs.get(id)},original.meal.id)).toEqual(original.meal);await modal.getByRole('button',{name:'Correct meal only',exact:true}).click();await confirm.getByRole('button',{name:'Save meal correction',exact:true}).click();await expect(modal).toHaveCount(0);const after=await page.evaluate(async ids=>{const d=await import('/src/domain.ts');return{meal:await d.foodLogs.get(ids.meal.id),batch:await d.db.foodBatches.get(ids.batch.id)}},original);expect(after.batch).toEqual(original.batch);expect(after.meal).toMatchObject({consumptionPercent:35,leftoverInventoryUnchanged:true,nutrition:{calories:210}});
});
for(const width of [320,375,390,430])for(const language of ['zh','en'])test(`storage responsive controls and four source tabs ${language} ${width}`,async({page})=>{
 await page.setViewportSize({width,height:844});const fixture=await seed(page,language);await storageTab(page);await page.locator('.storage-make-trigger').click();const make=page.locator('.storage-make-modal');await chooseSavedRecipe(make,fixture.recipe.id);await make.locator('[name=cookedYieldGrams]').fill('');await expect(make.locator('[name=cookedYieldGrams]')).toHaveValue('');await make.locator('[name=cookedYieldGrams]').fill('400');await noOverflow(make);await expect(make.locator('.form-actions .primary')).toBeInViewport();await make.locator(':scope > .modal-head button').click();const modal=await openMeal(page);await noOverflow(modal);await modal.locator('.source-tabs button').nth(2).click();await expect(modal.locator('.storage-meal-form')).toBeVisible();await noOverflow(modal);const tabs=await modal.locator('.source-tabs button').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return{x:r.x,right:r.right,height:r.height,top:r.top}}));expect(tabs[0].x).toBeGreaterThanOrEqual(0);expect(tabs[3].right).toBeLessThanOrEqual(width);expect(tabs.every(tab=>tab.height>=44&&Math.abs(tab.top-tabs[0].top)<1)).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);if(width===320&&language==='en')await modal.screenshot({path:'work/screenshots/food-storage-add-meal-320-en.png'});
});

test('known-weight leftovers are opt-in on every fresh opening; normal unchecked recipe meals do not add inventory',async({page})=>{
 const fixture=await seed(page);let modal=await openMeal(page);await chooseSavedRecipe(modal,fixture.recipe.id);await setRange(modal.getByRole('slider'),50);await modal.locator('.leftover-option input').check();await modal.locator('[name=leftoverCookedWeight]').fill('600');await modal.locator('form:visible .add-food-footer .primary').click();await expect(modal).toHaveCount(0);let batches=await page.evaluate(async()=>{const d=await import('/src/domain.ts');return d.db.foodBatches.toArray()});expect(batches).toHaveLength(1);expect(batches[0]).toMatchObject({mode:'weight',originalCookedYield:600,remainingQuantity:300});
 modal=await openMeal(page);await chooseSavedRecipe(modal,fixture.recipe.id);await setRange(modal.getByRole('slider'),50);await expect(modal.locator('.leftover-option input')).not.toBeChecked();await modal.locator('form:visible .add-food-footer .primary').click();await expect(modal).toHaveCount(0);expect(await page.evaluate(async()=>{const d=await import('/src/domain.ts');return{batches:await d.db.foodBatches.count(),meals:await d.foodLogs.count()}})).toEqual({batches:1,meals:2});
});
test('failed inventory save leaves the dialog open and every store unchanged; retry records exactly once',async({page})=>{
 const fixture=await seed(page);const id=await page.evaluate(async recipe=>{const d=await import('/src/domain.ts'),s=await import('/src/food-storage.ts');const id=d.stamp().id;await new s.FoodStorage().makeBatch({operationId:d.stamp().id,id,name:'Failure fixture',preparedOn:d.localDate(),ingredients:s.copyRecipeForBatch(recipe),cookedYieldGrams:600});return id},fixture.recipe);
 const modal=await openMeal(page);await modal.locator('.source-tabs button').nth(2).click();const form=modal.locator('.storage-meal-form');await form.locator('.meal-batch-select button').tap();await page.locator('.draft-unit-menu [data-unit="'+id+'"]').tap();await form.locator('[name=storageGrams]').fill('700');await form.locator('.form-actions .primary').click();await expect(modal).toBeVisible();expect(await form.locator('[name=storageGrams]').evaluate((el:HTMLInputElement)=>el.validity.rangeOverflow)).toBe(true);await form.locator('[name=storageGrams]').fill('100');
 const before=await page.evaluate(async()=>{const d=await import('/src/domain.ts'),fail=()=>{throw Error('Synthetic inventory receipt failure')};(window as any).__storageTestFailure=fail;d.db.inventoryTransactions.hook('creating',fail);return(await d.exportAll()).tables});await form.locator('.form-actions .primary').click();await expect(form.getByRole('alert')).toBeVisible();expect(await page.evaluate(async()=>{const d=await import('/src/domain.ts');return(await d.exportAll()).tables})).toEqual(before);
 await page.evaluate(async()=>{const d=await import('/src/domain.ts');d.db.inventoryTransactions.hook('creating').unsubscribe((window as any).__storageTestFailure);delete (window as any).__storageTestFailure});await form.locator('.form-actions .primary').click();await expect(modal).toHaveCount(0);expect(await page.evaluate(async id=>{const d=await import('/src/domain.ts');return{quantity:(await d.db.foodBatches.get(id))!.remainingQuantity,meals:await d.foodLogs.count(),receipts:(await d.db.inventoryTransactions.toArray()).filter(t=>t.kind==='meal').length}},id)).toEqual({quantity:500,meals:1,receipts:1});
});

test('records two meals from explicitly registered raw stock across a live Pantry correction',async({page})=>{
 const {ingredient,recipe}=await seed(page);
 await page.evaluate(async id=>{const {db}=await import('/src/domain.ts');await db.ingredients.update(id,{calories:60})},ingredient.id);
 await storageTab(page);
 await page.getByRole('button',{name:'Add Pantry stock'}).tap();
 const form=page.locator('dialog[open] form').last();
 await form.locator('.draft-unit-trigger').tap();
 await page.getByRole('menuitemradio',{name:ingredient.name}).tap();
 await form.locator('input[type=number]').fill('350');await form.locator('.form-actions .primary').tap();
 await page.locator('.storage-list-row').filter({hasText:ingredient.name}).tap();
 const detail=page.locator('.storage-detail-modal');
 async function record(calories:number){
  await detail.getByRole('button',{name:'Record consumption',exact:true}).tap();
  const consumption=page.locator('.storage-meal-form');await consumption.locator('[name=storageGrams]').fill('100');
  await expect(consumption.locator('.nutrition-strip strong').first()).toHaveText(calories+' kcal');
  await consumption.locator('.form-actions .primary').tap();await expect(consumption).toHaveCount(0);
 }
 await record(60);
 await page.evaluate(async id=>{const {db}=await import('/src/domain.ts');await db.ingredients.update(id,{calories:55})},ingredient.id);
 await expect(detail.locator('.nutrition-strip strong').first()).toHaveText('55 kcal');
 await record(55);await expect(detail.locator('.storage-summary')).toContainText('150 g');
 await page.goto('/#/recipes/'+recipe.id);await expect(page.locator('.hero-nutrition .nutrition-strip strong').first()).toHaveText('55 kcal');
 const snapshots=await page.evaluate(async()=>{const {foodLogs}=await import('/src/domain.ts');return (await foodLogs.toArray()).map(m=>Math.round(m.nutrition.calories!)).sort()});
 expect(snapshots).toEqual([55,60]);
});

test('legacy stock changes basis only after confirming the Pantry link',async({page})=>{
 const {recipe,ingredient}=await seed(page);
 const id=await page.evaluate(async ({recipe,ingredient})=>{
  const d=await import('/src/domain.ts'),s=await import('/src/food-storage.ts'),id=d.stamp().id;
  await new s.FoodStorage().makeBatch({id,operationId:d.stamp().id,name:ingredient.name,preparedOn:d.localDate(),ingredients:s.copyRecipeForBatch(recipe),cookedYieldGrams:100});
  await d.db.ingredients.update(ingredient.id,{calories:55});
  return id;
 },{recipe,ingredient});
 await storageTab(page);await page.locator('.storage-list-row').filter({hasText:ingredient.name}).tap();
 const detail=page.locator('.storage-detail-modal'),action=page.locator('.storage-action-modal');
 for(const confirm of [false,true]){
  await expect(detail.locator('.nutrition-strip strong').first()).toHaveText('600 kcal');
  await detail.getByRole('button',{name:'Link remaining stock to a Pantry ingredient'}).tap();
  await action.locator('.draft-unit-trigger').tap();await action.getByRole('menuitemradio',{name:ingredient.name}).tap();
  await action.getByRole('button',{name:confirm?'Save':'Cancel',exact:true}).tap();await expect(action).toHaveCount(0);
 }
 await expect(detail.locator('.nutrition-strip strong').first()).toHaveText('55 kcal');
 const data=await page.evaluate(async id=>{const {db}=await import('/src/domain.ts');return {batch:await db.foodBatches.get(id),receipts:await db.inventoryTransactions.count()}},id);
 expect(data.batch).toMatchObject({remainingQuantity:100,totalNutrition:{calories:600},stock:{kind:'pantry-ingredient',ingredientId:ingredient.id}});
 expect(data.receipts).toBe(1);
});

test('packs cooking output independently and records fractional servings',async({page})=>{
 const {recipe}=await seed(page);
 await page.evaluate(async id=>{const d=await import('/src/domain.ts');await d.recipes.update(id,{servings:4})},recipe.id);
 await page.goto('/recipes/'+recipe.id);
 await page.locator('.journal-recipe-detail .start-cooking').tap();
 await page.locator('.journal-add-storage').click();
 const make=page.locator('.storage-make-modal');
 await make.getByRole('button',{name:/^Servings/}).click();
 const packed=make.locator('.batch-results input[type=number]');
 await expect(packed).toHaveValue('4');
 await packed.fill('5');
 await expect(make.locator('.storage-batch-nutrition').first()).toContainText('600 kcal');
 await expect(make.locator('.storage-batch-nutrition').last()).toContainText('120 kcal');
 await make.locator('.form-actions .primary').click();
 await expect(make).toHaveCount(0);
 await storageTab(page);
 await page.locator('.storage-list-row').filter({hasText:recipe.name}).click();
 await page.getByRole('button',{name:'Record consumption',exact:true}).click();
 const form=page.locator('.storage-meal-form');
 await form.locator('.storage-actual-amount input').fill('0.5');
 await expect(form.locator('.nutrition-strip')).toContainText('60 kcal');
 await form.locator('.form-actions .primary').click();
 await expect(form).toHaveCount(0);
 await expect(page.locator('.storage-remaining-emphasis')).toContainText('4.5');
});

test('legacy leftover edits distinguish the recorded share from a new remaining-stock percentage',async({page})=>{
 const {recipe}=await seed(page);
 const ids=await page.evaluate(async recipe=>{
   const d=await import('/src/domain.ts'),{FoodStorage}=await import('/src/food-storage.ts'),storage=new FoodStorage();
   const batchId=d.stamp().id,mealId=d.stamp().id;
   const meal={...d.stamp(),date:d.localDate(),source:'recipe' as const,sourceId:recipe.id,category:'lunch',name:'Origin',quantity:1,unit:'serving',consumptionPercent:25,baseNutrition:recipe.lines[0].nutrition,nutrition:{calories:150,protein:7.5,carbs:15,fat:5},cookingNote:'',lines:recipe.lines};
   await storage.saveMealWithLeftovers({operationId:d.stamp().id,meal,batchId,saveLeftovers:true});
   await storage.saveMeal({operationId:d.stamp().id,mealId,batchId,date:meal.date,category:'dinner',portion:{unit:'percent',quantity:50}});
   const backup=await d.exportAll();backup.version=20;
   backup.tables.inventoryTransactions.find(tx=>tx.mealId===mealId).request='opaque legacy receipt';
   await d.restoreAll(backup);return {batchId,mealId};
 },recipe);
 const snapshot=()=>page.evaluate(async ids=>{
   const d=await import('/src/domain.ts');return {meal:await d.foodLogs.get(ids.mealId),batch:await d.db.foodBatches.get(ids.batchId),receipts:await d.db.inventoryTransactions.toArray()};
 },ids);
 const before=await snapshot();
 await page.goto('/today');await page.locator('#today-tab-food').click();
 const edit=()=>page.locator('.meal-row').filter({hasText:/225\s*kcal/}).locator('.actions button').first().click();
 const form=page.locator('.storage-meal-form'),amount=form.locator('[name=storageStockPercent]');
 await edit();await expect(form).toContainText('Recorded: 37.5% of the original batch');await expect(amount).toHaveCount(0);
 await form.getByRole('button',{name:'Adjust consumed amount'}).click();await expect(amount).toHaveValue('');
 await amount.fill('25');await form.getByRole('button',{name:'Cancel',exact:true}).click();
 expect(await snapshot()).toEqual(before);
 await edit();await form.locator('.form-actions .primary').click();await expect(form).toHaveCount(0);expect(await snapshot()).toEqual(before);
 await edit();await form.getByRole('button',{name:'Adjust consumed amount'}).click();await amount.fill('25');
 await form.locator('.form-actions .primary').click();await expect(form).toHaveCount(0);
 const after=await snapshot();expect(after.meal.storageConsumption.originalFraction).toBe(.1875);expect(after.meal.nutrition.calories).toBe(112.5);
 expect(after.batch.remainingQuantity).toBe(.5625);expect(after.receipts).toHaveLength(before.receipts.length+1);
 expect(JSON.parse(after.receipts.find(tx=>tx.id===after.meal.storageConsumption.transactionId).request).input.portion.quantity).toBe(25);
});

test('whole-batch percent preview and saved debits use the original output',async({page})=>{
 const {recipe}=await seed(page);await storageTab(page);
 await page.getByRole('button',{name:'Make a Batch',exact:true}).click();
 const make=page.locator('.storage-make-modal');
 await chooseSavedRecipe(make,recipe.id);
 await make.getByRole('button',{name:/^Whole batch/}).click();
 await expect(make.locator('[name=cookedYieldGrams]')).toHaveCount(0);
 await expect(make.locator('.storage-batch-nutrition')).toHaveCount(1);
 await make.locator('.form-actions .primary').click();
 await expect(make).toHaveCount(0);
 await page.locator('.storage-list-row').filter({hasText:recipe.name}).click();
 const detail=page.locator('.storage-detail-modal');
 for(const [percent,kcal,remaining] of [[25,150,75],[50,300,25]]){
   await detail.getByRole('button',{name:'Record consumption',exact:true}).click();
   const form=page.locator('.storage-meal-form');
   await form.getByLabel('Percentage of original batch',{exact:true}).fill(String(percent));
   await expect(form.locator('.nutrition-strip strong').first()).toHaveText(kcal+' kcal');
   await form.locator('.form-actions .primary').click();await expect(form).toHaveCount(0);
   await expect(detail.locator('.storage-remaining-emphasis')).toContainText(remaining+'%');
 }
 await detail.getByRole('button',{name:'Record consumption',exact:true}).click();
 const form=page.locator('.storage-meal-form');
 await form.getByLabel('Percentage of original batch',{exact:true}).fill('50');
 await form.locator('.form-actions .primary').click();
 await expect(form.getByRole('alert')).toContainText('exceeds available inventory');
 await form.getByRole('button',{name:'Cancel',exact:true}).click();
 await expect(detail.locator('.storage-remaining-emphasis')).toContainText('25%');
});
