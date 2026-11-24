import {test,expect} from '@playwright/test';
test.use({browserName:'webkit',channel:'',isMobile:true,hasTouch:true});
for(const width of [320,375,390,430])for(const language of ['zh','en'])test(`cooking journal ${width} ${language}`,async({page})=>{
 await page.setViewportSize({width,height:844});await page.goto('/recipes');await expect(page.locator('.recipe-fab')).toBeVisible();
 const f=await page.evaluate(async language=>{
  const d=await import('/src/domain.ts'),{FoodStorage}=await import('/src/food-storage.ts'),{storedRecipeLine}=await import('/src/recipe-storage.ts');
  await d.db.settings.put({key:'language',value:language});
  const item={...d.stamp(),name:'Egg',nameZh:'鸡蛋',brand:'',basis:'100g',servingGrams:null,calories:70,protein:6,carbs:0,fat:5};await d.db.ingredients.put(item);
  const line={ingredientId:item.id,name:'Egg',quantity:100,unit:'g',nutrition:{calories:70,protein:6,carbs:0,fat:5}};
  const storage=new FoodStorage(),batchId=d.stamp().id;await storage.makeBatch({operationId:d.stamp().id,id:batchId,name:'Prepared sauce',preparedOn:d.localDate(),ingredients:[{source:'pantry',line}],cookedYieldGrams:400});
  const recipe={...d.stamp(),name:'Cooking journal',servings:2,lines:[line,{...line},storedRecipeLine((await d.db.foodBatches.get(batchId))!)],instructions:'1. Prepare the ingredients.\n2. Stir gently and serve.',stickyNote:'Keep original note'};await d.recipes.put(recipe);return {id:recipe.id,batchId};
 },language);await page.reload();
 const row=page.locator('.recipe-list-row').filter({hasText:'Cooking journal'});await row.locator('.actions button').first().tap();const editor=page.locator('.recipe-editor-modal');
 // Group creation, rename, ordering and assignment stay local until save.
 await editor.locator('.journal-group-editor > button').tap();await editor.locator('.journal-group-edit input').fill('Sauce');await editor.locator('.journal-group-editor > button').tap();await editor.locator('.journal-group-edit input').last().fill('Topping');
 await editor.locator('.journal-group-edit').last().locator('summary').tap();await editor.locator('.journal-group-edit').last().locator('button').first().tap();await expect(editor.locator('.journal-group-edit input').first()).toHaveValue('Topping');
 await editor.locator('.journal-line-menu summary').first().tap();const sauce=await editor.locator('.journal-line-menu select').first().locator('option').filter({hasText:'Sauce'}).getAttribute('value');await editor.locator('.journal-line-menu select').first().selectOption(sauce!);
 expect(await page.evaluate(async id=>(await(await import('/src/domain.ts')).recipes.get(id))!.ingredientGroups,f.id)).toBeUndefined();
 if(width===390&&language==='zh')await editor.screenshot({path:'work/screenshots/cooking-groups-editor-390.png'});
 await editor.locator('.recipe-editor-footer .primary').tap();await expect(editor).toHaveCount(0);
 const before=await page.evaluate(async()=>{const d=await import('/src/domain.ts');const b=await d.exportAll();delete b.tables.settings;return b.tables});
 await row.locator('h3 a').tap();const detail=page.locator('.recipe-detail-modal');await expect(detail.locator('.detail-ingredients > li strong')).toHaveCount(3);await expect(detail.locator('.detail-ingredients')).toContainText('Sauce');await expect(detail.locator('.recipe-method')).toContainText('Stir gently');
 if(width===390&&language==='zh')await detail.screenshot({path:'work/screenshots/cooking-recipe-overview-390.png'});
 await detail.locator('.start-cooking').tap();let mode=page.locator('.cooking-mode');await expect(mode.locator('.journal-check-row')).toHaveCount(3);await expect(mode.locator('.journal-check-row').first()).toBeVisible();await expect(mode.locator('.journal-footer .primary')).toBeVisible();
 const check=mode.locator('input[type=checkbox]');await check.first().check();await expect(check.first()).toBeEnabled();await expect(mode.locator('[role=status]').first()).toContainText('1 / 3');
 await mode.locator('.modal-head button').tap();await detail.locator('.start-cooking').tap();mode=page.locator('.cooking-mode');await expect(mode.locator('input[type=checkbox]').first()).toBeChecked();
 await page.reload();await page.locator('.start-cooking').tap();mode=page.locator('.cooking-mode');await expect(mode.locator('input[type=checkbox]').first()).toBeChecked();
 const serving=mode.locator('.journal-session-controls input');page.once('dialog',d=>d.dismiss());await serving.fill('4');await serving.blur();await expect(serving).toHaveValue('2');await expect(mode.locator('input[type=checkbox]').first()).toBeChecked();
 page.once('dialog',d=>d.accept());await serving.fill('4');await serving.blur();await expect(mode.locator('input[type=checkbox]:checked')).toHaveCount(0);await expect(serving).toBeEnabled();await expect(mode.locator('.journal-check-row small').first()).toContainText('200');
 for(const theme of ['misty','apricot','lavender','olive']){await page.evaluate(async theme=>(await import('/src/themes.ts')).applyTheme(theme),theme);expect(await mode.evaluate(e=>e.scrollWidth>e.clientWidth)).toBe(false)}
 await page.evaluate(async()=>{(await import('/src/themes.ts')).applyTheme('misty')});
 if([320,390].includes(width)&&language==='zh'){await page.evaluate(()=>document.fonts.ready);await mode.screenshot({path:`work/screenshots/cooking-journal-${width}.png`})}
 // Keyboard-like viewport resize must retain body scrolling and footer.
 await page.setViewportSize({width,height:460});await serving.tap();await expect(serving).toBeInViewport();await expect(mode.locator('.journal-footer .primary')).toBeInViewport();await page.setViewportSize({width,height:844});
 await mode.locator('input[type=checkbox]').first().check();await expect(mode.locator('input[type=checkbox]').first()).toBeEnabled();page.once('dialog',d=>d.accept());await mode.locator('.journal-footer button').first().tap();await expect(mode.locator('input[type=checkbox]:checked')).toHaveCount(0);
 await mode.locator('.journal-footer .primary').tap();await expect(page.locator('.add-food-modal')).toBeVisible();await page.locator('.add-food-footer button').first().click();await expect(mode).toBeVisible();await expect(mode.locator('input[type=checkbox]:checked')).toHaveCount(0);await expect(mode.locator('.journal-session-controls input')).toHaveValue('4');await mode.locator('.modal-head button').click();await detail.locator('.start-cooking').click();await expect(mode.locator('.journal-session-controls input')).toHaveValue('4');
 expect(await page.evaluate(async()=>{const b=await(await import('/src/domain.ts')).exportAll();delete b.tables.settings;return b.tables})).toEqual(before);
 await mode.locator('.modal-head button').tap();await detail.locator('.modal-head button').tap();
 // Removing a group never removes ingredients; cancel does not persist metadata changes.
 await row.locator('.actions button').first().tap();await editor.locator('.journal-group-edit').filter({has:page.locator('input[value="Sauce"]')}).locator('summary').tap();await editor.locator('.journal-group-edit').filter({has:page.locator('input[value="Sauce"]')}).locator('button').last().tap();await expect(editor.locator('.recipe-line')).toHaveCount(3);await editor.locator('.recipe-editor-footer button').first().tap();
 expect(await page.evaluate(async id=>(await(await import('/src/domain.ts')).recipes.get(id))!.ingredientGroups!.length,f.id)).toBe(2);
});

test('live recipe reconciliation, long scrolling and wake lock lifecycle',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(()=>{
  (window as any).wakeEvents=[];
  Object.defineProperty(navigator,'wakeLock',{configurable:true,value:{request:async()=>{
   (window as any).wakeEvents.push('request');const sentinel={released:false,release:async()=>{sentinel.released=true;(window as any).wakeEvents.push('release')}};return sentinel;
  }}});
 });
 await page.goto('/recipes');await expect(page.locator('.recipe-fab')).toBeVisible();
 const id=await page.evaluate(async()=>{
  const d=await import('/src/domain.ts');const lines=Array.from({length:18},(_,i)=>({lineId:'line-'+i,ingredientId:'ingredient-'+i,name:i<2?'Repeated ingredient':'Long ingredient name '+i,quantity:100,unit:'g',nutrition:{calories:10,protein:0,carbs:0,fat:0}}));
  const r={...d.stamp(),name:'Long journal',servings:2,lines,instructions:Array.from({length:15},(_,i)=>(i+1)+'. Follow the original cooking instruction carefully.').join('\n'),stickyNote:''};await d.recipes.put(r);return r.id;
 });
 await page.locator('.recipe-list-row').filter({hasText:'Long journal'}).locator('h3 a').click();await page.locator('.start-cooking').tap();const mode=page.locator('.cooking-mode');await expect(mode.locator('.journal-check-row')).toHaveCount(18);
 const first=mode.locator('.journal-check-row').filter({has:page.locator('input')}).first();await first.locator('input').check();await expect(first.locator('input')).toBeEnabled();
 await page.evaluate(async id=>{const {recipes}=await import('/src/domain.ts');const r=(await recipes.get(id))!;await recipes.put({...r,revision:r.revision+1,ingredientGroups:[{id:'g',name:'New heading'}],lines:[...r.lines].reverse()})},id);
 await expect(mode.locator('.journal-check-row').last().locator('input')).toBeChecked();
 await page.evaluate(async id=>{const {recipes}=await import('/src/domain.ts');const r=(await recipes.get(id))!;await recipes.put({...r,revision:r.revision+1,lines:r.lines.map(l=>l.lineId==='line-0'?{...l,quantity:50}:l)})},id);
 await expect(mode.locator('input[type=checkbox]:checked')).toHaveCount(0);
 await mode.locator('.journal-check-row').last().scrollIntoViewIfNeeded();await expect(mode.locator('.journal-check-row').last()).toBeInViewport();await expect(mode.locator('.journal-footer .primary')).toBeInViewport();
 expect(await mode.locator('.journal-scroll').evaluate(e=>e.scrollTop>0&&e.scrollHeight>e.clientHeight)).toBe(true);
 await expect.poll(()=>page.evaluate(()=>(window as any).wakeEvents.includes('request'))).toBe(true);
 await mode.locator('.modal-head button').tap();await expect.poll(()=>page.evaluate(()=>(window as any).wakeEvents.includes('release'))).toBe(true);
 expect(await page.evaluate(async()=>{const d=await import('/src/domain.ts');return [await d.foodLogs.count(),await d.db.inventoryTransactions.count()]})).toEqual([0,0]);
});
