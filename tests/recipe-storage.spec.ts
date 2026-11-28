import {chooseSavedRecipe} from './recipe-picker-helper';
import {test,expect,type Page,type Locator} from '@playwright/test';
test.use({browserName:'webkit',channel:'',isMobile:true,hasTouch:true,trace:'retain-on-failure'});
for(const changed of [false,true])test('first prepared batch allocation, changed formula '+changed,async({page})=>{
 await page.goto('/today');
 await expect(page.locator('.meal-card')).toBeVisible();
 const ids=await page.evaluate(async changed=>{
  const d=await import('/src/domain.ts'),{FoodStorage}=await import('/src/food-storage.ts'),{storedRecipeLine}=await import('/src/recipe-storage.ts');
  const storage=new FoodStorage(),batchId=d.stamp().id,mealId=d.stamp().id;
  const nutrition={calories:400,protein:40,carbs:20,fat:10};
  await storage.makeBatch({id:batchId,name:'Sauce',operationId:d.stamp().id,preparedOn:d.localDate(),cookedYieldGrams:400,
   ingredients:[{source:'pantry',line:{ingredientId:'fixture',name:'Tomato',quantity:400,unit:'g',nutrition}}]});
  const batch=(await storage.batches.get(batchId))!;
  await storage.saveRecipeMeal({operationId:d.stamp().id,meal:{...d.stamp(),id:mealId,date:d.localDate(),name:'Recorded sauce',source:'recipe',
   category:'lunch',sourceId:null,quantity:1,unit:'serving',consumptionPercent:0,nutrition:d.unknownNutrition(),lines:[storedRecipeLine(batch)],cookingNote:''}});
  if(changed)await storage.correctFormula({operationId:d.stamp().id,batchId,expectedRevision:batch.revision,cookedYieldGrams:400,
   ingredients:batch.ingredients.map(l=>({...l,nutrition:{calories:800,protein:80,carbs:40,fat:20}}))});
  return {mealId,batchId};
 },changed);
 const state=()=>page.evaluate(async()=>{const d=await import('/src/domain.ts');return (await d.exportAll()).tables});
 const before=await state();
 const open=()=>page.locator('.meal-row').filter({hasText:'Recorded sauce'}).getByRole('button',{name:'编辑',exact:true}).click();
 const modal=page.locator('.add-food-modal'),row=modal.locator('.stored-recipe-source'),save=modal.getByRole('button',{name:'保存记录'});
 await open();await expect(row.getByRole('status')).toHaveCount(0);
 await setRange(modal.getByRole('slider'),50);
 if(changed){
  await expect(row.getByRole('status')).toContainText('批次内容已更新');
  await save.click();await expect(modal).toBeVisible();expect(await state()).toEqual(before);
  await modal.getByRole('button',{name:'取消',exact:true}).click();expect(await state()).toEqual(before);
  await open();await setRange(modal.getByRole('slider'),50);
  await row.getByRole('button').click();await page.locator('.stored-food-picker').getByRole('button',{name:/Sauce/}).click();
 }
 await expect(row.getByRole('status')).toHaveCount(0);
 await save.click();await expect(modal).toHaveCount(0);
 const backup=await page.evaluate(async()=>{const d=await import('/src/domain.ts');const b=await d.exportAll();await d.restoreAll(b);return d.exportAll()});
 expect(backup.version).toBe(21);
 const meal=backup.tables.foodLogs.find(l=>l.id===ids.mealId)!;
 const expected=changed?{calories:100,protein:10,carbs:5,fat:2.5}:{calories:50,protein:5,carbs:2.5,fat:1.25};
 expect(meal).toMatchObject({consumptionPercent:50,nutrition:expected,recipeAllocations:[{batchId:ids.batchId,quantity:50,nutrition:expected}]});
 expect(backup.tables.foodBatches.find(b=>b.id===ids.batchId)?.remainingQuantity).toBe(350);
});
for(const scenario of ['historical','cancel','same stock','other stock','A B A','never allocated'] as const)
test('Backup 20 raw recipe allocation: '+scenario,async({page})=>{
 await page.goto('/today');
 await expect(page.locator('.meal-card')).toBeVisible();
 const ids=await page.evaluate(async never=>{
  const d=await import('/src/domain.ts'),{FoodStorage}=await import('/src/food-storage.ts'),{storedRecipeLine}=await import('/src/recipe-storage.ts');
  const s=new FoodStorage(),a={...d.stamp(),name:'Raw A',nameZh:'',brand:'',basis:'100g' as const,servingGrams:null,calories:60,protein:null,carbs:4,fat:1};
  const b={...a,...d.stamp(),name:'Raw B',calories:80,protein:6,carbs:8,fat:4};
  const stocks=[];
  for(const item of [a,b]){
   await d.db.ingredients.put(item);
   const id=d.stamp().id;await s.registerStock({id,operationId:d.stamp().id,ingredientId:item.id,grams:400,date:d.localDate()});stocks.push(id);
  }
  const line=storedRecipeLine((await s.batches.get(stocks[0]))!),id=d.stamp().id;
  await s.saveRecipeMeal({operationId:d.stamp().id,meal:{...d.stamp(),id,date:d.localDate(),name:'Stored yogurt recipe',source:'recipe',category:'lunch',sourceId:null,quantity:1,unit:'serving',consumptionPercent:never?0:100,nutrition:line.nutrition,lines:[line],cookingNote:''}});
  await d.db.ingredients.update(a.id,{calories:54,protein:8,carbs:2,fat:2});
  if(!never){const m=(await s.meals.get(id))!;await s.saveRecipeMeal({operationId:d.stamp().id,expectedRevision:m.revision,meal:{...m,consumptionPercent:0}})}
  await d.restoreAll(await d.exportAll());return {id,stocks};
 },scenario==='never allocated');
 const tables=()=>page.evaluate(async()=>(await (await import('/src/domain.ts')).exportAll()).tables);
 const before=await tables();
 await page.locator('.meal-row').filter({hasText:'Stored yogurt recipe'}).getByRole('button',{name:'编辑',exact:true}).click();
 const modal=page.locator('.add-food-modal'),row=modal.locator('.stored-recipe-source');
 await setRange(modal.getByRole('slider'),50);
 const choose=async(name:string)=>{await row.getByRole('button').click();await page.locator('.stored-food-picker').getByRole('button',{name:new RegExp(name)}).click()};
 if(scenario==='never allocated'){
  await expect(row.getByRole('status')).toContainText('重新选择');await modal.getByRole('button',{name:'保存记录'}).click();
  expect(await tables()).toEqual(before);await choose('Raw A');
 }
 if(scenario==='other stock'||scenario==='A B A')await choose('Raw B');
 if(scenario==='same stock'||scenario==='A B A')await choose('Raw A');
 const expected=scenario==='other stock'?[40,3,4,2]:['historical','cancel'].includes(scenario)?[30,0,2,.5]:[27,4,1,1];
 await expect(modal.locator('.meal-nutrition-preview strong')).toHaveText(expected.map((v,i)=>Math.round(v)+(i?' g':' kcal')));
 await modal.getByRole('button',{name:scenario==='cancel'?'取消':'保存记录',exact:true}).click();
 await expect(modal).toHaveCount(0);
 if(scenario==='cancel'){expect(await tables()).toEqual(before);return}
 const after=await tables(),actual=after.foodLogs.find(m=>m.id===ids.id);
 const chosen=scenario==='other stock'?1:0;
 expect(actual.nutrition).toEqual(Object.fromEntries(['calories','protein','carbs','fat'].map((k,i)=>[k,expected[i]])));
 expect(actual.recipeAllocations).toMatchObject([{batchId:ids.stocks[chosen],quantity:50}]);
 expect(actual.historicalAllocationBases).toMatchObject([{batchId:ids.stocks[chosen],lineId:actual.lines[0].lineId}]);
 for(const [i,id] of ids.stocks.entries())expect(after.foodBatches.find(b=>b.id===id).remainingQuantity).toBe(i===chosen?350:400);
 await page.evaluate(async()=>{const d=await import('/src/domain.ts');await d.restoreAll(await d.exportAll())});expect(await tables()).toEqual(after);
});
async function seed(page:Page,language='en'){
 await page.goto('/#/recipes');await expect(page.locator('.recipe-fab')).toBeVisible();
 const f=await page.evaluate(async language=>{
  const d=await import('/src/domain.ts'),{FoodStorage}=await import('/src/food-storage.ts');await d.db.settings.put({key:'language',value:language});
  const pantry={...d.stamp(),name:'Dry pasta fixture',brand:'',basis:'100g',servingGrams:null,calories:350,protein:12.5,carbs:62.5,fat:2.5};await d.db.ingredients.put(pantry);
  const line={ingredientId:pantry.id,name:pantry.name,quantity:80,unit:'g',nutrition:{calories:280,protein:10,carbs:50,fat:2}};
  const s=new FoodStorage(),batches=[];
  for(const name of ['Sauce original','Sauce replacement']){const id=d.stamp().id;await s.makeBatch({operationId:d.stamp().id,id,name,preparedOn:d.localDate(),cookedYieldGrams:1150,ingredients:[{source:'pantry',line:{...line,quantity:1150,nutrition:{calories:2300,protein:115,carbs:null,fat:0}}}]});batches.push(id)}
  return{pantry,line,batches};
 },language);await page.reload();return f;
}
async function setRange(slider:Locator,value:number){await slider.evaluate((el,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(el,String(value));el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))},value)}
async function noOverflow(page:Page,modal:Locator){expect(await modal.evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)}
for(const width of [320,375,390,430])test(`mixed recipe templates, direct meals and explicit replacement ${width}`,async({page})=>{
 await page.setViewportSize({width,height:844});const f=await seed(page,width===320?'zh':'en');
 await page.locator('.recipe-fab').click();const editor=page.locator('.recipe-editor-modal');await editor.locator('[name=name]').fill('Pasta template');await editor.locator('.ingredient-add-trigger').click();await page.locator('.ingredient-stored-trigger').click();const picker=page.locator('.stored-food-picker');await expect(picker.locator('.modal-scroll')).toBeVisible();await picker.locator('.storage-list-row').filter({hasText:'Sauce original'}).click();await editor.locator('.recipe-line input').fill('200');await editor.locator('.ingredient-add-trigger').click();await page.locator('.ingredient-picker-modal input[type=search]').fill(f.pantry.name);await page.locator('[data-ingredient-id="'+f.pantry.id+'"]').click();await editor.locator('.recipe-line').filter({hasText:f.pantry.name}).locator('input').fill('80');await noOverflow(page,editor);await editor.locator('.recipe-editor-footer .primary').click();await expect(editor).toHaveCount(0);
 const recipe=await page.evaluate(async()=>{const d=await import('/src/domain.ts');return(await d.recipes.toArray()).find(r=>r.name==='Pasta template')!});expect(recipe.lines[0]).toMatchObject({source:'batch',quantity:200});expect(await page.evaluate(async id=>{const d=await import('/src/domain.ts');return(await d.db.foodBatches.get(id))!.remainingQuantity},f.batches[0])).toBe(1150);
 // Editing the template is still inventory-free.
 await page.locator('.recipe-list-row').filter({hasText:'Pasta template'}).locator('.actions button').first().click();await expect(editor.locator('.recipe-line')).toHaveCount(2);await editor.locator('.recipe-editor-footer .primary').click();await expect(editor).toHaveCount(0);
 await page.goto('/#/today');await page.locator('#today-tab-food').click();await page.locator('.meal-card .section-heading .primary').click();const meal=page.locator('.add-food-modal');await chooseSavedRecipe(meal,recipe.id);await expect(meal.locator('.stored-recipe-source')).toContainText('200');await setRange(meal.getByRole('slider'),50);await expect(meal.locator('.meal-nutrition-preview strong').first()).toHaveText('340 kcal');await noOverflow(page,meal);if(width===390)await meal.screenshot({path:'work/recipe-storage-integration/screenshots/direct-meal-390.png'});await meal.locator('form:visible .add-food-footer .primary').click();await expect(meal).toHaveCount(0);
 let state=await page.evaluate(async id=>{const d=await import('/src/domain.ts');return{batch:await d.db.foodBatches.get(id),meals:await d.foodLogs.toArray()}},f.batches[0]);expect(state.batch!.remainingQuantity).toBe(1050);expect(state.meals[0].recipeAllocations![0].quantity).toBe(100);
 await page.locator('.meal-row .actions button').first().click();await expect(meal.locator('.stored-recipe-source')).toBeVisible();await setRange(meal.getByRole('slider'),100);await meal.locator('form:visible .add-food-footer .primary').click();await expect(meal).toHaveCount(0);expect(await page.evaluate(async id=>{const d=await import('/src/domain.ts');return(await d.db.foodBatches.get(id))!.remainingQuantity},f.batches[0])).toBe(950);
 await page.locator('.meal-row .actions button').last().click();await page.locator('.delete-destructive').click();await expect(page.locator('.meal-row')).toHaveCount(0);expect(await page.evaluate(async id=>{const d=await import('/src/domain.ts');return(await d.db.foodBatches.get(id))!.remainingQuantity},f.batches[0])).toBe(1150);
 // Exhausted original is never silently substituted; the user chooses the replacement.
 await page.evaluate(async id=>{const d=await import('/src/domain.ts'),{FoodStorage}=await import('/src/food-storage.ts');const b=(await d.db.foodBatches.get(id))!;await new FoodStorage().setArchive({operationId:d.stamp().id,batchId:id,expectedRevision:b.revision,action:'archive'})},f.batches[0]);
 await page.locator('.meal-card .section-heading .primary').click();await chooseSavedRecipe(meal,recipe.id);await meal.locator('form:visible .add-food-footer .primary').click();await expect(meal).toBeVisible();await expect(meal.locator('.food-status')).toBeVisible();await meal.locator('.stored-recipe-source button').click();await picker.locator('.storage-list-row').filter({hasText:'Sauce replacement'}).click();await meal.locator('form:visible .add-food-footer .primary').click();await expect(meal).toHaveCount(0);expect(await page.evaluate(async id=>{const d=await import('/src/domain.ts');return(await d.db.foodBatches.get(id))!.remainingQuantity},f.batches[1])).toBe(950);await page.reload();expect(await page.evaluate(async id=>{const d=await import('/src/domain.ts');return(await d.recipes.get(id))!.lines},recipe.id)).toEqual(recipe.lines);
});
test('mixed recipe preparation and saved leftovers retain independent snapshots',async({page})=>{
 await page.setViewportSize({width:390,height:844});const f=await seed(page);
 const recipe=await page.evaluate(async f=>{const d=await import('/src/domain.ts'),{storedRecipeLine}=await import('/src/recipe-storage.ts');const b=(await d.db.foodBatches.get(f.batches[0]))!,l=storedRecipeLine(b);l.quantity=200;l.nutrition=d.scaleNutrition(b.totalNutrition,200*b.fractionPerUnit);const r={...d.stamp(),name:'Mixed preparation',servings:1,lines:[l,f.line],instructions:'Keep',stickyNote:''};await d.recipes.put(r);return r},f);
 await page.locator('#recipes-storage-tab').click();await page.locator('.storage-make-trigger').click();const make=page.locator('.storage-make-modal');await chooseSavedRecipe(make,recipe.id);await expect(make.locator('.recipe-line')).toHaveCount(2);await make.locator('[name=batchName]').fill('Prepared pasta');await make.locator('[name=cookedYieldGrams]').fill('350');await expect(make.locator('.storage-batch-previews strong').first()).toHaveText('680 kcal');await noOverflow(page,make);await make.screenshot({path:'work/recipe-storage-integration/screenshots/mixed-batch-390.png'});await make.locator('.recipe-editor-footer .primary').click();await expect(make).toHaveCount(0);
 await page.goto('/#/today');await page.locator('#today-tab-food').click();await page.locator('.meal-card .section-heading .primary').click();const meal=page.locator('.add-food-modal');await chooseSavedRecipe(meal,recipe.id);await setRange(meal.getByRole('slider'),50);await meal.locator('.leftover-option input').check();await meal.locator('[name=leftoverCookedWeight]').fill('400');await expect(meal.locator('.stored-recipe-source')).toContainText('200');await meal.screenshot({path:'work/recipe-storage-integration/screenshots/leftovers-390.png'});await meal.locator('form:visible .add-food-footer .primary').click();await expect(meal).toHaveCount(0);
 const state=await page.evaluate(async id=>{const d=await import('/src/domain.ts');const m=(await d.foodLogs.toArray()).find(m=>m.leftoverBatchId)!;return{source:await d.db.foodBatches.get(id),meal:m,leftover:await d.db.foodBatches.get(m.leftoverBatchId!)}} ,f.batches[0]);expect(state.source!.remainingQuantity).toBe(750);expect(state.leftover!.remainingQuantity).toBe(200);expect(state.leftover!.ingredients[0].sourceBatchId).toBe(f.batches[0]);expect(state.meal.nutrition.calories).toBe(340);expect(state.meal.recipeAllocations).toBeUndefined();
 await page.locator('.meal-row .actions button').first().click();await setRange(meal.getByRole('slider'),25);await meal.locator('form:visible .add-food-footer .primary').click();await expect(meal).toHaveCount(0);expect(await page.evaluate(async id=>{const d=await import('/src/domain.ts');return(await d.db.foodBatches.get(id))!.remainingQuantity},state.leftover!.id)).toBe(300);
});
test('ratio and weighted recipe sources save future meals atomically without inventing grams',async({page})=>{
 await page.setViewportSize({width:320,height:844});const f=await seed(page);
 const ratio=await page.evaluate(async f=>{const d=await import('/src/domain.ts'),{FoodStorage}=await import('/src/food-storage.ts');const id=d.stamp().id;await new FoodStorage().saveMealWithLeftovers({operationId:d.stamp().id,batchId:id,saveLeftovers:true,meal:{...d.stamp(),name:'Ratio sauce',date:'2000-01-01',category:'lunch',source:'recipe',sourceId:null,quantity:1,unit:'serving',lines:[f.line],baseNutrition:f.line.nutrition,nutrition:f.line.nutrition,consumptionPercent:50,cookingNote:''}});return id},f);
 await page.locator('.recipe-fab').click();const editor=page.locator('.recipe-editor-modal'),picker=page.locator('.stored-food-picker');await editor.locator('[name=name]').fill('Ratio mixed template');await editor.locator('.ingredient-add-trigger').click();await page.locator('.ingredient-stored-trigger').click();await picker.locator('.storage-list-row').filter({hasText:'Ratio sauce'}).click();await expect(editor.locator('.recipe-line input')).toHaveValue('0.5');await editor.locator('.recipe-line input').fill('0.2');await expect(editor.locator('.draft-unit-trigger')).toHaveCount(0);await expect(editor.locator('span.draft-unit-text')).toContainText('original');await editor.locator('.ingredient-add-trigger').click();await page.locator('.ingredient-stored-trigger').click();await picker.locator('.storage-list-row').filter({hasText:'Sauce original'}).click();await editor.locator('.recipe-line').filter({hasText:'Sauce original'}).locator('input').fill('200');await noOverflow(page,editor);await editor.locator('.recipe-editor-footer .primary').click();await expect(editor).toHaveCount(0);
 const recipe=await page.evaluate(async()=>{const d=await import('/src/domain.ts');return(await d.recipes.toArray()).find(r=>r.name==='Ratio mixed template')!});expect(recipe.lines[0]).toMatchObject({sourceBatchId:ratio,quantityBasis:'original-fraction',quantity:.2});
 await page.goto('/#/today?date=2030-02-01');await page.locator('#today-tab-food').click();await page.locator('.meal-card .section-heading .primary').click();const meal=page.locator('.add-food-modal');await chooseSavedRecipe(meal,recipe.id);await expect(meal.locator('[name=date]')).toHaveValue('2030-02-01');await expect(meal.locator('.stored-recipe-source').first()).toContainText('20%');await setRange(meal.getByRole('slider'),50);await expect(meal.locator('.meal-nutrition-preview strong').first()).toHaveText('228 kcal');
 const before=await page.evaluate(async()=>{const d=await import('/src/domain.ts'),fail=()=>{throw Error('Injected multi-source receipt failure')};d.db.inventoryTransactions.hook('creating',fail);(window as any).__undoRecipeFailure=()=>d.db.inventoryTransactions.hook('creating').unsubscribe(fail);return(await d.exportAll()).tables});await meal.locator('form:visible .add-food-footer .primary').click();await expect(meal.locator('.food-status')).toBeVisible();expect(await page.evaluate(async()=>{const d=await import('/src/domain.ts');return(await d.exportAll()).tables})).toEqual(before);await page.evaluate(()=>(window as any).__undoRecipeFailure());await meal.locator('form:visible .add-food-footer .primary').click();await expect(meal).toHaveCount(0);
 const saved=await page.evaluate(async ids=>{const d=await import('/src/domain.ts');return{meals:await d.foodLogs.toArray(),ratio:await d.db.foodBatches.get(ids[0]),weight:await d.db.foodBatches.get(ids[1])}},[ratio,f.batches[0]]);expect(saved.ratio!.remainingQuantity).toBeCloseTo(.4,12);expect(saved.weight!.remainingQuantity).toBe(1050);const m=saved.meals.find(m=>m.name==='Ratio mixed template')!;expect(m.recipeAllocations).toHaveLength(2);expect(m.date).toBe('2030-02-01');await page.reload();await expect(page.locator('.meal-row').filter({hasText:'Ratio mixed template'})).toBeVisible();
});
test('downstream leftovers show an explicit origin conflict without returning processed ingredients',async({page})=>{
 await page.setViewportSize({width:390,height:844});const f=await seed(page);
 const origin=await page.evaluate(async f=>{const d=await import('/src/domain.ts'),{FoodStorage}=await import('/src/food-storage.ts'),{storedRecipeLine}=await import('/src/recipe-storage.ts');const s=new FoodStorage(),b=(await s.batches.get(f.batches[0]))!,line=storedRecipeLine(b);line.quantity=200;line.nutrition=d.scaleNutrition(b.totalNutrition,200*b.fractionPerUnit);const lines=[line,f.line],base=d.sumNutrition(lines.map(l=>l.nutrition)),m={...d.stamp(),name:'Prepared origin',date:d.localDate(),category:'lunch',source:'recipe' as const,sourceId:null,quantity:1,unit:'serving',lines,baseNutrition:base,nutrition:d.scaleNutrition(base,.5),consumptionPercent:50,cookingNote:''},leftover=d.stamp().id;await s.saveMealWithLeftovers({operationId:d.stamp().id,meal:m,saveLeftovers:true,batchId:leftover,cookedWeightGrams:400});await s.saveMeal({operationId:d.stamp().id,mealId:d.stamp().id,batchId:leftover,portion:{unit:'g',quantity:50},date:d.localDate(),category:'dinner'});return{meal:m.id,leftover:await s.batches.get(leftover),source:await s.batches.get(b.id)}},f);
 await page.goto('/#/today');await page.locator('#today-tab-food').click();const row=page.locator('[data-food-log-id="'+origin.meal+'"]');await row.locator('.actions button').last().click();await page.locator('.delete-destructive').click();const conflict=page.locator('.food-storage-modal').filter({hasText:'This meal was not deleted.'});await expect(conflict).toBeVisible();await conflict.locator(':scope > .modal-head button').click();await row.locator('.actions button').first().click();const meal=page.locator('.add-food-modal');await expect(meal).toBeVisible();await setRange(meal.getByRole('slider'),25);await meal.locator('form:visible .add-food-footer .primary').click();await expect(meal.locator('.storage-conflict-actions')).toBeVisible();await meal.getByRole('button',{name:'Correct meal only',exact:true}).click();await page.getByRole('button',{name:'Save meal correction',exact:true}).click();await expect(meal).toHaveCount(0);const after=await page.evaluate(async ids=>{const d=await import('/src/domain.ts');return{meal:await d.foodLogs.get(ids.meal),leftover:await d.db.foodBatches.get(ids.leftover!.id),source:await d.db.foodBatches.get(ids.source!.id)}},origin);expect(after.source).toEqual(origin.source);expect(after.leftover).toEqual(origin.leftover);expect(after.meal!.deletedAt).toBeNull();expect(after.meal!.leftoverInventoryUnchanged).toBe(true);expect(after.meal!.nutrition.calories).toBe(170);await row.locator('.actions button').last().click();await page.locator('.delete-destructive').click();await expect(conflict).toBeVisible();await noOverflow(page,conflict);await conflict.getByRole('button',{name:'Delete meal only',exact:true}).click();await page.locator('.delete-destructive').click();await expect(row).toHaveCount(0);const deleted=await page.evaluate(async ids=>{const d=await import('/src/domain.ts');return{meal:await d.foodLogs.get(ids.meal),leftover:await d.db.foodBatches.get(ids.leftover!.id),source:await d.db.foodBatches.get(ids.source!.id)}},origin);expect(deleted.leftover).toEqual(origin.leftover);expect(deleted.source).toEqual(origin.source);expect(deleted.meal!.deletedAt).toBeTruthy();expect(deleted.meal!.nutrition).toEqual(after.meal!.nutrition);
});

