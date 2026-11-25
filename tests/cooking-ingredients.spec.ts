import {test,expect,type Page,type Locator} from '@playwright/test';
test.use({browserName:'webkit',channel:'',isMobile:true,hasTouch:true});
async function seed(page:Page,language='zh'){
 await page.goto('/recipes');await expect(page.locator('.recipe-fab')).toBeVisible();const f=await page.evaluate(async language=>{
  const d=await import('/src/domain.ts'),{FoodStorage}=await import('/src/food-storage.ts');await d.db.settings.put({key:'language',value:language});
  const egg={...d.stamp(),name:'Egg journal test',nameZh:'测试鸡蛋',brand:'',aliases:[],basis:'100g',servingGrams:null,calories:100,protein:10,carbs:5,fat:2};await d.db.ingredients.put(egg);
  const milk={lineId:'milk',ingredientId:'milk',name:language==='zh'?'豆奶':'Soy milk',quantity:130,unit:'mL',nutrition:{calories:65,protein:4,carbs:3,fat:2},groupId:'filling'},flour={...milk,lineId:'flour',ingredientId:'flour',name:language==='zh'?'低筋面粉 Low-gluten flour with a long journal name':'Long pastry flour with a descriptive journal name',quantity:100,unit:'g',groupId:'pastry'},batchId=d.stamp().id;
  await new FoodStorage().makeBatch({operationId:d.stamp().id,id:batchId,name:'Journal sauce',preparedOn:d.localDate(),cookedYieldGrams:1000,ingredients:[{source:'pantry',line:{...milk,quantity:1000,unit:'g',nutrition:{calories:1000,protein:100,carbs:200,fat:0}}}]});
  const recipe={...d.stamp(),name:'Egg tarts journal · 蛋挞',servings:2,lines:[milk,flour],ingredientGroups:[{id:'filling',name:language==='zh'?'内馅':'Custard'},{id:'pastry',name:language==='zh'?'塔皮':'Pastry'}],instructions:'1. Mix the pastry.\n混合塔皮，冷藏后制作。\n2. Prepare the filling.',stickyNote:''};await d.recipes.put(recipe);return {recipe,egg,batchId};
 },language);await page.reload();await page.locator('.recipe-list-row').filter({hasText:f.recipe.name}).locator('h3 a').tap();await page.locator('.start-cooking').tap();await expect(page.locator('.cooking-mode .journal-check-row')).toHaveCount(2);return f;
}
async function read(page:Page,id:string){return page.evaluate(async id=>{const d=await import('/src/domain.ts');return {recipe:await d.recipes.get(id),session:JSON.parse((await d.db.settings.get('cooking-session:v1:'+id))!.value),batches:await d.db.foodBatches.toArray(),transactions:await d.db.inventoryTransactions.toArray(),meals:await d.foodLogs.toArray(),pantry:await d.db.ingredients.toArray()}},id)}
async function swipeRemove(page:Page,row:Locator){
 await row.scrollIntoViewIfNeeded();const label=row.locator('.journal-line-name'),shell=row.locator('..');
 const dimensions=()=>row.evaluate(el=>{
  const {width,height}=el.getBoundingClientRect();
  return {width,height,nameHeight:el.querySelector('.journal-line-name')!.getBoundingClientRect().height};
 });
 const initial=await dimensions();
 const pointer={pointerType:'touch',pointerId:4,isPrimary:true,button:0,clientY:24};
 await label.dispatchEvent('pointerdown',{...pointer,clientX:100});
 await label.dispatchEvent('pointermove',{...pointer,clientX:40});
 expect(await dimensions()).toEqual(initial);
 await label.dispatchEvent('pointerup',{...pointer,clientX:40});
 expect(await dimensions()).toEqual(initial);
 await expect(page.locator('.journal-remove-confirm')).toHaveCount(0);
 await shell.locator('.draft-remove').tap();
 await expect(page.locator('.journal-remove-confirm .modal-head')).toContainText(await label.innerText());
}
async function addEgg(page:Page,id:string){await page.locator('.cooking-mode .journal-ingredient-add').tap();await page.locator('.ingredient-picker-modal .search input').fill('Egg journal test');if(page.viewportSize()?.width===390&&await page.locator('html').getAttribute('lang')==='zh')await page.locator('.ingredient-picker-modal').screenshot({path:'work/screenshots/ingredient-picker-390.png'});await page.locator(`.ingredient-picker-modal [data-ingredient-id="${id}"]`).tap();await expect(page.locator('.ingredient-picker-modal')).toHaveCount(0)}
for(const width of [320,375,390,430])for(const language of ['zh','en'])test(`preparation ingredient set ${width} ${language}`,async({page})=>{
 await page.setViewportSize({width,height:844});const f=await seed(page,language),mode=page.locator('.cooking-mode'),plus=mode.locator('.journal-ingredient-add'),first=mode.locator('.journal-check-row:has(#cooking-check-milk)'),baseline=await read(page,f.recipe.id);await page.evaluate(()=>document.fonts.ready);
 const geometry=await mode.evaluate(e=>{const a=e.querySelector('.journal-method-heading')!.getBoundingClientRect(),b=e.querySelector('.journal-ingredients-heading')!.getBoundingClientRect(),button=e.querySelector('.journal-ingredient-add')!.getBoundingClientRect(),title=e.querySelector('.journal-ingredients-heading h3')!.getBoundingClientRect();return {aligned:Math.abs(a.top-b.top)<1,safe:title.right<=button.left+1,touch:button.width>=40&&button.height>=40}});expect(geometry.safe).toBe(true);expect(geometry.touch).toBe(true);if(width>320)expect(geometry.aligned).toBe(true);await expect(mode.locator('.line-add,.journal-check-row svg')).toHaveCount(0);
 if(width===390&&language==='zh')await mode.screenshot({path:'work/screenshots/ingredient-headings-390.png'});
 await mode.locator('.journal-method-edit-trigger').tap();await expect(mode.locator('.journal-method-confirm')).toBeVisible();await expect(plus).toBeEnabled();await mode.locator('.journal-method-editor textarea').fill('Updated Method while adding an ingredient.');await addEgg(page,f.egg.id);await expect(mode.locator('textarea')).toHaveValue('Updated Method while adding an ingredient.');await expect(mode.locator('.journal-check-row')).toHaveCount(3);if(width===390&&language==='zh')await mode.screenshot({path:'work/screenshots/ingredient-method-edit-390.png'});await mode.locator('.journal-method-confirm').tap();await expect(mode.locator('.journal-method-editor')).toHaveCount(0);await expect(mode.locator('.journal-update')).toBeVisible();
 let state=await read(page,f.recipe.id);expect(state.recipe!.lines).toEqual(f.recipe.lines);expect(state.pantry).toEqual(baseline.pantry);expect(state.transactions).toEqual(baseline.transactions);expect(state.batches).toEqual(baseline.batches);expect(state.session.version).toBe(3);const temporary=mode.locator('.journal-check-row').filter({hasText:'Egg journal test'});await temporary.locator('input[type=checkbox]').check();await expect(temporary.locator('input[type=checkbox]')).toBeEnabled();await temporary.locator('.journal-quantity-trigger').tap();await temporary.locator('.journal-quantity-edit input').fill('40.125');await temporary.locator('.journal-quantity-edit input').press('Enter');await expect(temporary.locator('.journal-quantity-restore')).toBeVisible();
 await swipeRemove(page,temporary);if(width===390&&language==='zh')await page.locator('.journal-remove-confirm').screenshot({path:'work/screenshots/ingredient-remove-confirm.png'});await page.locator('.journal-remove-confirm .form-actions button').first().tap();await expect(temporary).toBeVisible();await expect(temporary.locator('input[type=checkbox]')).toBeChecked();
 await swipeRemove(page,temporary);await page.locator('.journal-remove-confirm .primary').tap();await expect(temporary).toHaveCount(0);state=await read(page,f.recipe.id);expect(state.session.ingredientChanges.addedLines).toEqual([]);expect(state.session.checked).toEqual([]);expect(state.session.quantityOverrides).toEqual([]);await expect(mode.locator('.journal-update')).toHaveCount(0);
 await swipeRemove(page,first);await page.locator('.journal-remove-confirm .primary').tap();await expect(mode.locator('.journal-check-row')).toHaveCount(1);await expect(mode.locator('.journal-update')).toBeVisible();state=await read(page,f.recipe.id);expect(state.recipe!.lines).toEqual(f.recipe.lines);expect(state.session.ingredientChanges.removedEntries.map((r:any)=>r.entryId)).toEqual(['milk']);if(width===390&&language==='zh')await mode.screenshot({path:'work/screenshots/ingredient-after-removal-390.png'});
 await plus.tap();await page.locator('.ingredient-picker-modal .ingredient-stored-trigger').tap();await page.locator('.stored-food-picker .storage-list-row').filter({hasText:'Journal sauce'}).tap();await expect(mode.locator('.journal-check-row')).toHaveCount(2);state=await read(page,f.recipe.id);expect(state.session.ingredientChanges.addedLines[0].line.sourceBatchId).toBe(f.batchId);expect(state.batches).toEqual(baseline.batches);
 await mode.locator('.journal-footer .primary').tap();const meal=page.locator('.add-food-modal');await expect(meal).toBeVisible();await meal.locator('.add-food-footer button').first().tap();await expect(mode).toBeVisible();expect((await read(page,f.recipe.id)).session).toEqual(state.session);
 await mode.locator('.journal-add-storage').tap();const batch=page.locator('.storage-make-modal');await expect(batch.locator('.recipe-line')).toHaveCount(2);await expect(batch.locator('.recipe-line').filter({hasText:'Journal sauce'}).locator('input[type=number]')).toHaveValue('100');await batch.locator('.recipe-editor-footer button').first().tap();expect((await read(page,f.recipe.id)).session).toEqual(state.session);
 for(const theme of ['misty','apricot','lavender','olive']){await page.evaluate(async theme=>(await import('/src/themes.ts')).applyTheme(theme),theme);expect(await mode.evaluate(e=>e.scrollWidth>e.clientWidth)).toBe(false)}
 await mode.locator('.journal-reset').tap();await page.locator('.journal-reset-confirm .form-actions button').first().tap();expect((await read(page,f.recipe.id)).session).toEqual(state.session);await mode.locator('.journal-reset').tap();await page.locator('.journal-reset-confirm .primary').tap();await expect(mode.locator('.journal-check-row')).toHaveCount(2);await expect(mode.locator('.journal-update')).toHaveCount(0);expect((await read(page,f.recipe.id)).recipe!.instructions).toBe('Updated Method while adding an ingredient.');
 await addEgg(page,f.egg.id);await mode.locator('.modal-head button').tap();await page.locator('.start-cooking').tap();await expect(mode.locator('.journal-check-row')).toHaveCount(2);await expect(mode.locator('.journal-update')).toHaveCount(0);
});
test('long press cancels on movement/scroll; quantity and checkbox remain independent; keyboard removal works',async({page})=>{
 await page.setViewportSize({width:390,height:844});await seed(page);const mode=page.locator('.cooking-mode'),row=mode.locator('.journal-check-row').first(),name=row.locator('.journal-line-name'),box=(await name.boundingBox())!;await page.mouse.move(box.x+8,box.y+8);await page.mouse.down();await page.mouse.move(box.x+30,box.y+30);await page.waitForTimeout(720);await page.mouse.up();await expect(page.locator('.journal-remove-confirm')).toHaveCount(0);await page.mouse.move(box.x+8,box.y+8);await page.mouse.down();await mode.locator('.journal-scroll').dispatchEvent('scroll');await page.waitForTimeout(720);await page.mouse.up();await expect(page.locator('.journal-remove-confirm')).toHaveCount(0);
 await row.locator('input[type=checkbox]').tap();await expect(row.locator('input[type=checkbox]')).toBeChecked();await row.locator('.journal-quantity-trigger').tap();await expect(row.locator('.journal-quantity-edit input')).toBeFocused();await row.locator('.journal-quantity-edit input').press('Escape');await expect(page.locator('.journal-remove-confirm')).toHaveCount(0);await row.focus();await row.press('Shift+F10');await expect(page.locator('.journal-remove-confirm')).toBeVisible();await page.locator('.journal-remove-confirm .form-actions button').first().tap();await row.focus();await row.press('Delete');await page.locator('.journal-remove-confirm .primary').tap();await expect(mode.locator('.journal-check-row')).toHaveCount(1);
});
test('empty preparation disables destinations; serving changes require confirmation for ingredient changes',async({page})=>{
 await page.setViewportSize({width:390,height:844});const f=await seed(page,'en'),mode=page.locator('.cooking-mode');
 for(const id of ['milk','flour']){const row=mode.locator(`.journal-check-row:has(#cooking-check-${id})`);await row.focus();await row.press('Delete');await page.locator('.journal-remove-confirm .primary').tap();await expect(page.locator('.journal-remove-confirm')).toHaveCount(0);await expect(row).toHaveCount(0)}
 await expect(mode.locator('.journal-check-row')).toHaveCount(0);await expect(mode.locator('.journal-footer .primary')).toBeDisabled();await expect(mode.locator('.journal-add-storage')).toBeDisabled();await expect(mode.locator('.journal-update')).toBeDisabled();await expect(mode.locator('.journal-ingredient-add')).toBeEnabled();
 await addEgg(page,f.egg.id);const before=await read(page,f.recipe.id),serving=mode.locator('.journal-serving-stepper input');page.once('dialog',dialog=>void dialog.dismiss());await serving.fill('4');await serving.blur();await expect(serving).toHaveValue('2');expect((await read(page,f.recipe.id)).session).toEqual(before.session);
 page.once('dialog',dialog=>void dialog.accept());await serving.fill('4');await serving.blur();await expect(mode.locator('.journal-footer .primary')).toBeEnabled();await expect(mode.locator('.journal-quantity-trigger')).toContainText('200');await mode.locator('.journal-reset').tap();await page.locator('.journal-reset-confirm .primary').tap();await expect(mode.locator('.journal-check-row')).toHaveCount(2);await expect(serving).toHaveValue('2');await expect(mode.locator('.journal-update')).toHaveCount(0);
});
test('heading picker preserves search on canceled custom creation and adds a new custom ingredient only to preparation',async({page})=>{
 await page.setViewportSize({width:390,height:844});const f=await seed(page,'en'),mode=page.locator('.cooking-mode'),before=await read(page,f.recipe.id);await mode.locator('.journal-ingredient-add').tap();const picker=page.locator('.ingredient-picker-modal');await picker.locator('.search input').fill('Journal vanilla');await picker.locator('.ingredient-create-trigger').tap();const editor=page.locator('.pantry-editor-modal');await editor.locator('.modal-head button').tap();await expect(picker.locator('.search input')).toHaveValue('Journal vanilla');await picker.locator('.ingredient-create-trigger').tap();await editor.locator('[name=name]').fill('Journal vanilla');await editor.locator('.nutrition-fields input').first().fill('100');await editor.locator('.form-actions .primary').tap();await expect(mode.locator('.journal-check-row')).toHaveCount(3);await expect(mode.locator('.journal-check-row').filter({hasText:'Journal vanilla'})).toBeVisible();const after=await read(page,f.recipe.id);expect(after.recipe).toEqual(before.recipe);expect(after.pantry).toHaveLength(before.pantry.length+1);expect(after.batches).toEqual(before.batches);expect(after.meals).toEqual(before.meals);expect(after.transactions).toEqual(before.transactions);
});
test('Update Recipe preserves identity, normalizes added quantities and commits only after explicit confirmation',async({page})=>{
 await page.setViewportSize({width:390,height:844});const f=await seed(page,'en'),mode=page.locator('.cooking-mode');await mode.locator('.journal-serving-stepper input').fill('4');await mode.locator('.journal-serving-stepper input').blur();await expect(mode.locator('.journal-footer .primary')).toBeEnabled();await addEgg(page,f.egg.id);const added=mode.locator('.journal-check-row').filter({hasText:'Egg journal test'});await added.locator('.journal-quantity-trigger').tap();await added.locator('.journal-quantity-edit input').fill('60.125');await added.locator('.journal-quantity-edit input').press('Enter');await added.locator('input[type=checkbox]').check();await expect(added.locator('input[type=checkbox]')).toBeEnabled();await swipeRemove(page,mode.locator('.journal-check-row:has(#cooking-check-milk)'));await page.locator('.journal-remove-confirm .primary').tap();const before=await read(page,f.recipe.id),id=before.session.ingredientChanges.addedLines[0].entryId;await mode.screenshot({path:'work/screenshots/ingredient-update-visible.png'});await mode.locator('.journal-update').tap();await page.locator('.journal-update-confirm .form-actions button').first().tap();expect(await read(page,f.recipe.id)).toEqual(before);await mode.locator('.journal-update').tap();await page.locator('.journal-update-confirm .primary').tap();await expect(mode.locator('.journal-update')).toHaveCount(0);await expect(added.locator('input[type=checkbox]')).toBeChecked();await expect(added.locator('.journal-quantity-trigger')).toContainText('60');const after=await read(page,f.recipe.id);expect(after.recipe!.id).toBe(f.recipe.id);expect(after.recipe!.lines.map(l=>[l.lineId,l.quantity])).toEqual([['flour',100],[id,30.0625]]);expect(after.batches).toEqual(before.batches);expect(after.transactions).toEqual(before.transactions);expect(after.meals).toEqual(before.meals);
});
test('modified ingredient set saves one meal or batch through existing transaction paths',async({page})=>{
 await page.setViewportSize({width:390,height:844});const f=await seed(page,'en'),mode=page.locator('.cooking-mode');await mode.locator('.journal-ingredient-add').tap();await page.locator('.ingredient-picker-modal .ingredient-stored-trigger').tap();await page.locator('.stored-food-picker .storage-list-row').filter({hasText:'Journal sauce'}).tap();await mode.locator('.journal-footer .primary').tap();const meal=page.locator('.add-food-modal');await meal.locator('[name=consumedServings]').fill('1');await meal.locator('.add-food-footer .primary').dblclick();await expect(mode).toHaveCount(0);const result=await page.evaluate(async id=>{const d=await import('/src/domain.ts');return {meals:await d.foodLogs.toArray(),source:await d.db.foodBatches.get(id)}},f.batchId);expect(result.meals).toHaveLength(1);expect(result.source!.remainingQuantity).toBe(950);expect(result.meals[0].lines).toHaveLength(3);
 await page.goto('/recipes/'+f.recipe.id);await page.locator('.start-cooking').tap();await mode.locator('.journal-ingredient-add').tap();await page.locator('.ingredient-picker-modal .ingredient-stored-trigger').tap();await page.locator('.stored-food-picker .storage-list-row').filter({hasText:'Journal sauce'}).tap();await mode.locator('.journal-add-storage').tap();const batch=page.locator('.storage-make-modal');await batch.locator('[name=cookedYieldGrams]').fill('300');await batch.locator('.recipe-editor-footer .primary').dblclick();await expect(mode).toHaveCount(0);const after=await page.evaluate(async id=>{const d=await import('/src/domain.ts');return {batches:await d.db.foodBatches.toArray(),source:await d.db.foodBatches.get(id)}},f.batchId);expect(after.batches).toHaveLength(2);expect(after.source!.remainingQuantity).toBe(850);expect(await page.evaluate(async id=>(await import('/src/domain.ts')).recipes.get(id),f.recipe.id)).toEqual(f.recipe);
});

for(const origin of ['recipes','meal'])test('touch replacement in '+origin+' preserves slot and returns the actual ingredient',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 const f=await seed(page),mode=page.locator('.cooking-mode'),meal=page.locator('.meal-journal');
 if(origin==='meal'){
  await mode.locator('.modal-head button').tap();await page.goto('/today');
  await page.locator('.meal-card .section-heading .primary').tap();
  const {chooseSavedRecipe}=await import('./recipe-picker-helper');await chooseSavedRecipe(meal,f.recipe.id);
  await meal.locator('.meal-start-cooking').tap();
 }
 const row=mode.locator('.draft-row-shell[data-line-id="milk"]'),identity=row.locator('.journal-line-name'),checkbox=row.locator('input[type=checkbox]');
 await checkbox.tap();await expect(checkbox).toBeChecked();
 await row.locator('.journal-quantity-trigger').tap();await row.locator('.journal-quantity-edit input').fill('17.125');
 await row.locator('.journal-quantity-edit input').press('Enter');
 const dialog=page.locator('.draft-confirmation'),picker=page.locator('.ingredient-picker-modal');
 const touch={pointerType:'touch',pointerId:7,isPrimary:true,button:0,clientX:160,clientY:170};
 const down=()=>identity.dispatchEvent('pointerdown',touch);
 const up=()=>identity.dispatchEvent('pointerup',touch);
 const hold=async()=>{await identity.scrollIntoViewIfNeeded();await down();await expect(dialog).toBeVisible();await up()};
 const shots='work/screenshots/meal-cooking-actions/';
 await down();await identity.dispatchEvent('pointermove',{...touch,clientY:205});await page.waitForTimeout(600);await up();
 await expect(dialog).toHaveCount(0);await expect(checkbox).toBeChecked();
 await hold();await expect(picker).toHaveCount(0);
 await dialog.screenshot({path:shots+'replacement-confirm.png',scale:'css'});
 await dialog.locator('.secondary').tap();await expect(checkbox).toBeChecked();
 await hold();await dialog.locator('.primary').tap();await picker.locator('.modal-head button').tap();
 await expect(row.locator('.journal-quantity-restore')).toBeVisible();await expect(checkbox).toBeChecked();
 await hold();await dialog.locator('.primary').tap();await picker.locator('.search input').fill('Egg journal test');
 await picker.screenshot({path:shots+'replacement-picker.png',scale:'css'});
 await picker.locator('[data-ingredient-id="'+f.egg.id+'"]').tap();await expect(identity).toHaveText('Egg journal test');
 await expect(checkbox).not.toBeChecked();await expect(row.locator('.journal-quantity-restore')).toHaveCount(0);
 await expect(mode.locator('.journal-check-row')).toHaveCount(2);await expect(mode.locator('.journal-update')).toBeEnabled();
 await mode.screenshot({path:shots+'replaced-'+origin+'.png',scale:'css'});
 const state=await read(page,f.recipe.id);expect(state.session.version).toBe(4);expect(state.recipe!.lines[0].ingredientId).toBe('milk');
 expect(state.meals).toHaveLength(0);
 if(origin==='meal'){
  await mode.locator('[data-confirm-preparation]').tap();await expect(mode).toHaveCount(0);
  await meal.locator('.add-food-footer .primary').tap();await expect(meal).toHaveCount(0);
  const saved=await page.evaluate(async()=> (await import('/src/domain.ts')).foodLogs.toArray());
  expect(saved).toHaveLength(1);expect(saved[0].lines[0]).toMatchObject({lineId:'milk',ingredientId:f.egg.id});
 }else{
  await mode.locator('.journal-add-storage').tap();await expect(page.locator('.storage-make-modal')).toContainText('Egg journal test');
  await page.locator('.storage-make-modal .recipe-editor-footer button').first().tap();
  await mode.locator('.journal-update').tap();await page.locator('.journal-update-confirm .primary').tap();
  await expect(mode.locator('.journal-update')).toHaveCount(0);await expect(identity).toHaveText('Egg journal test');
  expect((await read(page,f.recipe.id)).recipe!.lines[0]).toMatchObject({ingredientId:f.egg.id,lineId:'milk',groupId:'filling'});
 }
});
