import {expect,test,type Locator} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {chooseSavedRecipe} from './recipe-picker-helper';
test.use({browserName:'webkit',channel:'',isMobile:true,hasTouch:true});
async function measureAmount(phrase:Locator){
 const metrics=await phrase.evaluate(el=>{
  const input=el.querySelector('input')!,ink=el.querySelector('.journal-amount-ink')!.getBoundingClientRect();
  return {actual:ink.width,expected:56,right:ink.right,anchor:el.getBoundingClientRect().right,height:input.offsetHeight};
 });
 expect(metrics.actual).toBe(metrics.expected);
 expect(Math.abs(metrics.anchor-metrics.right)).toBeLessThan(1);
 return metrics;
}
async function exerciseInk(phrase:Locator){
 const input=phrase.locator('input');
 await input.focus();const initial=await input.inputValue();
 for(const value of ['0','1','10','25','80','150','999','1000','2.7','19.6','66.7','150.5','12345.6']){
  await input.fill(value);const active=await measureAmount(phrase);
  if(value!=='12345.6'){
   const layout=await input.evaluate(el=>{const field=el as HTMLInputElement,style=getComputedStyle(el),ctx=document.createElement('canvas').getContext('2d')!;ctx.font=style.fontSize+' '+style.fontFamily;return {fits:field.clientWidth>=ctx.measureText(field.value).width,border:style.borderWidth,outline:style.outlineStyle,shadow:style.boxShadow}});
   expect(layout).toEqual({fits:true,border:'0px',outline:'none',shadow:'none'});
  }
  await input.blur();const resting=await measureAmount(phrase);
  expect(resting.height).toBe(active.height);expect(resting.right).toBe(active.right);
 }
 await input.fill(initial);await input.blur();
}
for(const [index,width] of [320,375,390,430].entries())for(const language of ['zh','en']){
 test('meal journal '+width+' '+language,async({page})=>{
  await page.setViewportSize({width,height:844});await page.goto('/today');
  const fixture=await page.evaluate(async({language,index})=>{
   const d=await import('/src/domain.ts'),{FoodStorage,copyRecipeForBatch}=await import('/src/food-storage.ts');
   await d.db.settings.bulkPut([{key:'language',value:language},{key:'theme',value:['olive','lavender','misty','apricot'][index]}]);
   const food={...d.stamp(),name:'全脂牛奶 · Milk',brand:'',basis:'100g' as const,referenceAmount:100,referenceUnit:'mL' as const,servingGrams:null,calories:60,protein:3,carbs:5,fat:3,consumptionUnit:{quantity:1,amount:100,name:'杯',unit:'mL' as const}};
   await d.db.ingredients.put(food);
   const recipe={...d.stamp(),name:'奶香宽面 · Creamy tagliatelle',servings:2,instructions:'Bake.',stickyNote:'',lines:[{lineId:'milk',ingredientId:food.id,name:food.name,quantity:200,unit:'mL',nutrition:d.ingredientNutrition(food,200,'mL')}]};
   await d.recipes.put(recipe);
   const batch=d.stamp().id;await new FoodStorage().makeBatch({operationId:d.stamp().id,id:batch,name:'早餐布丁 · Bread pudding',preparedOn:d.localDate(),cookedYieldGrams:200,ingredients:copyRecipeForBatch(recipe)});
   return {recipe,food,batch};
  },{language,index});
  await page.reload();await page.locator('.meal-card .section-heading .primary').tap();
  const modal=page.locator('.meal-journal'),tabs=modal.locator('.source-tabs button'),form=modal.locator('form:visible');
  const shot=async(name:string)=>{if(width===390&&language==='zh'){await page.evaluate(()=>document.fonts.ready);await modal.screenshot({path:'work/screenshots/meal-refinement/'+name+'.png',scale:'css'})}};
  const pick=async(value:string)=>{await modal.locator('.draft-unit-menu [data-unit="'+value+'"]').tap()};
  await expect(form.locator(".meal-basics h3,.meal-start-cooking,.meal-nutrition-preview")).toHaveCount(0);await shot("empty-recipe");await shot("compact-extras");
  const basics=form.locator('.meal-basics');
  await expect(basics.locator('.localized-date-value')).toHaveCSS('color',await basics.locator('.draft-unit-trigger').evaluate(el=>getComputedStyle(el).color));
  await chooseSavedRecipe(modal,fixture.recipe.id);
  await modal.locator('[name=consumedServings]').fill('1.25');await modal.locator('[name=consumedServings]').press('Tab');
  await expect(form.locator('.meal-nutrition-preview strong').first()).toHaveText('75 kcal');
  await shot('recipe');await shot('servings');
  await form.locator('.meal-basics .draft-unit-trigger').tap();await shot('meal-type');await pick('lunch');
  await form.locator('.meal-advanced > summary').tap();await shot('adjust');
  const identity=form.locator('.draft-ingredient-name').first();
  const touch={pointerType:'touch',pointerId:11,isPrimary:true,button:0};
  const multiAmount=form.locator('.draft-amount').first();
  await exerciseInk(multiAmount);
  expect(await multiAmount.locator('.journal-amount-ink').evaluate(el=>getComputedStyle(el).borderBottomStyle)).toBe('dotted');
  if(width===390&&language==='zh')await multiAmount.screenshot({path:'work/screenshots/meal-cooking-actions/multiple-unit.png',scale:'css'});
  await identity.dispatchEvent('pointerdown',touch);
  const confirmation=page.locator('.draft-confirmation');
  await expect(confirmation).toBeVisible();
  await identity.dispatchEvent('pointerup',touch);
  await expect(page.locator('.ingredient-picker-modal')).toHaveCount(0);
  await confirmation.locator('.primary').tap();
  const replacement=page.locator('.ingredient-picker-modal');
  await replacement.locator('.modal-head button').tap();
  await expect(identity).toContainText(fixture.food.name);
  await form.locator('.draft-amount .draft-unit-trigger').tap();await shot('unit');await pick('杯');const adjusted=form.locator('.draft-amount input');await expect(adjusted).toHaveValue('1.3');await adjusted.focus();await expect(adjusted).toHaveValue('1.3');await adjusted.blur();
  await form.locator('.meal-advanced > summary').tap();await tabs.nth(1).tap();
  await expect(form.locator(".meal-pantry-amount,.meal-nutrition-preview")).toHaveCount(0);await shot("empty-library");
  await form.locator('.ingredient-pick-trigger').tap();await page.locator('[data-ingredient-id="'+fixture.food.id+'"]').tap();await shot('library');await shot('quantity');
  const label=form.locator('.meal-quantity-label');
  await expect(label).toHaveCSS('white-space','nowrap');
  await expect(form.locator('.ingredient-pick-trigger')).toHaveCSS('justify-content','flex-start');
  await form.locator('.meal-quantity-phrase .draft-unit-trigger').tap();await shot('pantry-unit');await page.keyboard.press('Escape');
  await tabs.nth(2).tap();await form.locator('.storage-fields > .meal-basic-row .draft-unit-trigger').tap();await pick(fixture.batch);await shot('storage');
  await tabs.nth(3).tap();await form.locator('.nutrition-fields input').first().fill('275');await shot('quick');
  await tabs.first().tap();await expect(form.locator('.meal-pencil')).toHaveCount(0);
  const noteTrigger=form.locator('.unified-sticky-notes > button');await noteTrigger.tap();
  const note=page.locator('.sticky-note-editor');await note.locator('textarea').fill('下次多烤一分钟。');await note.locator('.primary').tap();
  await form.locator('input[type=file]').setInputFiles({name:'tagliatelle.webp',mimeType:'image/webp',buffer:await readFile('public/images/recipes/tagliatelle-ragu-bolognese.webp')});
  await expect(form.locator('.photo-field img')).toBeVisible();await noteTrigger.scrollIntoViewIfNeeded();await shot('extras');
  await form.locator('.add-food-scroll').evaluate(el=>el.scrollTop=0);await shot('add');
  if(width===390&&language==='zh')await page.screenshot({path:'work/screenshots/meal-refinement/full-390.png',scale:'css'});
  expect(await modal.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  const start=form.locator('.meal-start-cooking'),mode=page.locator('.cooking-mode');
  const slider=form.getByRole('slider');await slider.press('Home');for(let n=0;n<10;n++)await slider.press('ArrowRight');
  await expect(slider).toHaveValue('50');
  const mealDay=await form.locator('[name=date]').inputValue();
  await start.tap();await expect(mode.locator('.journal-serving-stepper input')).toHaveValue('1.25');
  await expect(mode.locator('[data-confirm-preparation]')).toHaveText(language==='zh'?'确认制作':'Confirm Preparation');
  await expect(mode.locator('.journal-add-storage')).toHaveCount(0);
  await mode.locator('.modal-head button').tap();await expect(mode).toHaveCount(0);
  await expect(form.locator('.photo-field img')).toBeVisible();
  await expect(form.locator('.note-text')).toContainText('下次多烤一分钟');
  await start.tap();const quantity=mode.locator('.journal-quantity-trigger').first();
  await quantity.tap();const amount=mode.locator('.journal-quantity-edit input');await expect(amount).toHaveValue('1.3');
  await amount.fill('1.625');await mode.locator('.journal-quantity-edit input').press('Enter');await expect(quantity).toBeEnabled();
  await mode.locator('.journal-footer .primary').tap();await expect(mode).toHaveCount(0);await expect(modal).toHaveCount(1);
  await expect(form.locator('[name=date]')).toHaveValue(mealDay);await expect(form.locator('[name=category]')).toHaveValue('lunch');await expect(slider).toHaveValue('50');
  await expect(form.locator('.meal-nutrition-preview strong').first()).toHaveText('49 kcal');
  expect(await page.evaluate(async()=> (await import('/src/domain.ts')).foodLogs.count())).toBe(0);
  await form.locator('.add-food-footer .primary').tap();await expect(modal).toHaveCount(0);
  await page.locator('.meal-row').filter({hasText:fixture.recipe.name}).locator('.actions button').first().tap();
  await expect(form.locator('.meal-start-cooking')).toHaveCount(0);await shot('edit');
  const adjustments=form.locator('.meal-advanced');
  if(!await adjustments.evaluate(el=>el.hasAttribute('open')))await adjustments.locator(':scope > summary').tap();
  await exerciseInk(form.locator('.meal-lines .draft-amount').first());
  expect(await form.locator('.meal-lines .journal-amount-ink').first().evaluate(el=>getComputedStyle(el).borderBottomStyle)).toBe('dotted');
  await expect(form.locator('.meal-lines .reference-info-trigger')).toHaveCount(0);
  await form.locator('.add-food-footer button').first().tap();
  const data=await page.evaluate(async id=>{const d=await import('/src/domain.ts');return{meals:await d.foodLogs.toArray(),recipe:await d.recipes.get(id)}},fixture.recipe.id);
  expect(data.recipe).toEqual(fixture.recipe);expect(data.meals.filter(m=>m.name===fixture.recipe.name)).toHaveLength(1);
  expect(data.meals.find(m=>m.name===fixture.recipe.name)).toMatchObject({category:'lunch',consumptionPercent:50,nutrition:{calories:48.75},lines:[{lineId:'milk',quantity:1.625,unit:'杯'}]});
 });
}

test('actual ingredient set returns to the same draft and deducts stock only on meal save',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/today');
 const fixture=await page.evaluate(async()=>{
  const d=await import('/src/domain.ts'),{FoodStorage}=await import('/src/food-storage.ts'),{storedRecipeLine}=await import('/src/recipe-storage.ts');
  const n={calories:100,protein:10,carbs:12,fat:3};
  const food={...d.stamp(),name:'Whole corn',brand:'',referenceAmount:100,basis:'100g' as const,servingGrams:null,...n};
  await d.db.ingredients.put(food);
  const line={lineId:'corn',ingredientId:food.id,name:food.name,quantity:100,unit:'g',nutrition:n};
  const batchId=d.stamp().id;await new FoodStorage().makeBatch({operationId:d.stamp().id,id:batchId,name:'Corn soup',preparedOn:d.localDate(),cookedYieldGrams:400,ingredients:[{source:'pantry',line}]});
  const r={...d.stamp(),name:'Soup lunch',servings:1,lines:[line,storedRecipeLine((await d.db.foodBatches.get(batchId))!)],instructions:'Warm',stickyNote:''};
  await d.recipes.put(r);return {id:r.id,batchId,foodId:food.id,transactions:await d.db.inventoryTransactions.count()};
 });
 await page.reload();await page.locator('.meal-card .section-heading .primary').tap();
 const modal=page.locator('.meal-journal');await chooseSavedRecipe(modal,fixture.id);
 await modal.locator('.meal-start-cooking').tap();const mode=page.locator('.cooking-mode');
 const row=mode.locator('.journal-check-row').first();await row.press('Delete');await page.locator('.journal-remove-confirm .primary').tap();
 await expect(mode.locator('.journal-check-row')).toHaveCount(1);
 await mode.locator('.journal-ingredient-add').tap();await page.locator('[data-ingredient-id="'+fixture.foodId+'"]').tap();
 await expect(mode.locator('.journal-check-row')).toHaveCount(2);
 await mode.locator('.journal-footer .primary').tap();await expect(mode).toHaveCount(0);
 const state=()=>page.evaluate(async id=>{const d=await import('/src/domain.ts');return {stock:(await d.db.foodBatches.get(id))!.remainingQuantity,transactions:await d.db.inventoryTransactions.count(),meals:await d.foodLogs.toArray()}},fixture.batchId);
 expect(await state()).toEqual({stock:400,transactions:fixture.transactions,meals:[]});
 await modal.locator('.add-food-footer .primary').tap();await expect(modal).toHaveCount(0);
 const saved=await state();expect(saved.stock).toBe(300);expect(saved.meals).toHaveLength(1);
 expect(saved.meals[0].lines.map(l=>l.ingredientId)).toEqual([fixture.batchId,fixture.foodId]);
 expect(saved.meals[0].lines[1].lineId).not.toBe('corn');
 await page.evaluate(async id=>{const d=await import('/src/domain.ts');await d.foodLogs.update(id,{name:'Family lunch'})},saved.meals[0].id);
 await page.locator('.meal-row').filter({hasText:'Family lunch'}).locator('.actions button').first().tap();
 await expect(modal.locator('.recipe-selection-trigger')).toContainText('Family lunch');await expect(modal.locator('.meal-start-cooking,.meal-pencil')).toHaveCount(0);
 await modal.locator('.add-food-footer .primary').tap();await expect(modal).toHaveCount(0);
 const edited=await state();expect(edited.meals).toHaveLength(1);expect(edited.meals[0].name).toBe('Family lunch');expect(edited.stock).toBe(300);
});

test('shared cooking footers and precise journal display',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/today');
 const id='builtin-recipe-tagliatelle-ragu-bolognese';
 const shots='work/screenshots/meal-cooking-actions/';
 await page.locator('.meal-card .section-heading .primary').tap();
 const meal=page.locator('.meal-journal'),mode=page.locator('.cooking-mode');
 await chooseSavedRecipe(meal,id);await meal.screenshot({path:shots+'start.png',scale:'css'});
 await meal.locator('.meal-advanced > summary').tap();
 const rows=meal.locator('.draft-row-shell'),beef=rows.nth(1).locator('input[type=number]');
 await expect(beef).toHaveValue('66.7');await expect(rows.nth(7).locator('input[type=number]')).toHaveValue('2.7');
 await expect(rows.nth(8).locator('input[type=number]')).toHaveValue('6.8');await expect(rows.first().locator('input[type=number]')).toHaveValue('80');
 await expect(meal.locator('.meal-lines .reference-origin,.meal-lines .reference-info-trigger')).toHaveCount(0);
 await beef.focus();const exact=400*(1/6);await expect(beef).toHaveValue('66.7');await beef.blur();await expect(beef).toHaveValue('66.7');
 const fixedAmount=meal.locator('.draft-amount:has(.draft-unit-text)').first();
 await exerciseInk(fixedAmount);
 expect(await fixedAmount.locator('.journal-amount-ink').evaluate(el=>getComputedStyle(el).borderBottomStyle)).toBe('dotted');
 await fixedAmount.screenshot({path:shots+'fixed-unit.png',scale:'css'});
 await rows.first().scrollIntoViewIfNeeded();await meal.screenshot({path:shots+'adjust.png',scale:'css'});await rows.nth(1).screenshot({path:shots+'precision.png',scale:'css'});
 await meal.locator('.meal-start-cooking').tap();await expect(mode.locator('.journal-add-storage')).toHaveCount(0);
 await expect(mode.locator('[data-confirm-preparation] svg')).toHaveCount(0);
 await mode.screenshot({path:shots+'confirm.png',scale:'css'});await mode.locator('[data-confirm-preparation]').tap();
 await meal.locator('.add-food-footer .primary').tap();await expect(meal).toHaveCount(0);
 const log=await page.evaluate(async()=> (await (await import('/src/domain.ts')).foodLogs.toArray())[0]);
 expect(log.lines[1].quantity).toBe(Number(exact));
 await page.locator('.meal-row').filter({hasText:log.name}).locator('.actions button').first().tap();
 await meal.locator('.meal-advanced > summary').tap();
 await exerciseInk(meal.locator('.draft-amount:has(.draft-unit-text)').first());
 await meal.locator('.add-food-footer button').first().tap();
 await page.goto('/recipes/'+id);await page.locator('.start-cooking').tap();
 await expect(mode.locator('.journal-add-storage')).toBeEnabled();await mode.screenshot({path:shots+'independent.png',scale:'css'});
 const row=mode.locator('.journal-check-row').filter({hasText:/胡萝卜|Carrot/i}).first(),label=row.locator('.journal-line-name');
 await row.scrollIntoViewIfNeeded();
 const touch={pointerType:'touch',pointerId:5,isPrimary:true,button:0,clientY:20};
 const geometry=()=>row.evaluate(el=>{
   const r=el.getBoundingClientRect(),name=el.querySelector('.journal-line-name')!.getBoundingClientRect();
   const section=el.closest('section')!, next=el.parentElement!.nextElementSibling!.getBoundingClientRect();
   return {width:r.width,height:r.height,top:r.top,nameHeight:name.height,nextTop:next.top,divider:section.getBoundingClientRect().left};
 });
 const before=await geometry();
 await mode.screenshot({path:shots+'before-swipe.png',scale:'css'});
 await label.dispatchEvent('pointerdown',{...touch,clientX:100});
 await label.dispatchEvent('pointermove',{...touch,clientX:76});
 expect(await geometry()).toEqual(before);
 await expect(row.locator('..')).toHaveCSS('overflow-x','hidden');
 expect(await row.evaluate(el=>new DOMMatrix(getComputedStyle(el).transform).m41)).toBe(-24);
 await mode.screenshot({path:shots+'partial-swipe.png',scale:'css'});
 await label.dispatchEvent('pointermove',{...touch,clientX:20});
 await label.dispatchEvent('pointerup',{...touch,clientX:20});
 await expect(row.locator('..').locator('.draft-remove')).toBeVisible();
 expect(await geometry()).toEqual(before);
 console.log('Cooking swipe geometry at 390px',before);
 await mode.screenshot({path:shots+'swipe.png',scale:'css'});
});

for(const origin of ['meal','recipes'])test('session unit picker and amount geometry '+origin,async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/today');
 const id=await page.evaluate(async()=>{
  const d=await import('/src/domain.ts'),base={basis:'100g' as const,referenceAmount:100,referenceUnit:'g' as const,brand:'',servingGrams:null,calories:100,protein:10,carbs:8,fat:1};
  const carrot={...d.stamp(),...base,name:'胡萝卜',consumptionUnit:{name:'个',quantity:1,amount:50,unit:'g' as const}},onion={...d.stamp(),...base,name:'洋葱'};
  await d.db.ingredients.bulkPut([carrot,onion]);
  const r={...d.stamp(),name:'蔬菜汤 · Vegetable soup',instructions:'切碎食材。',stickyNote:'',servings:1,lines:[carrot,onion].map((f,i)=>({lineId:f.id,ingredientId:f.id,name:f.name,quantity:i?80:150,unit:'g',nutrition:d.ingredientNutrition(f,i?80:150,'g')}))};
  await d.recipes.put(r);return r.id;
 });
 if(origin==='recipes'){await page.goto('/recipes/'+id);await page.locator('.start-cooking').tap()}
 else{await page.reload();await page.locator('.meal-card .section-heading .primary').tap();const meal=page.locator('.meal-journal');await chooseSavedRecipe(meal,id);await meal.locator('.meal-start-cooking').tap()}
 const mode=page.locator('.cooking-mode'),rows=mode.locator('.journal-check-row'),row=rows.first(),second=rows.nth(1);
 const shots='work/screenshots/amount-polish/';
 await expect(second.locator('.draft-unit-text')).toBeVisible();await expect(second.locator('.draft-unit-trigger')).toHaveCount(0);
 await mode.screenshot({path:shots+'normal.png',scale:'css'});await second.screenshot({path:shots+'single.png',scale:'css'});
 for(const width of [320,375,390,430]){
  await page.setViewportSize({width,height:844});const box=await row.boundingBox();const q=row.locator('.journal-quantity');
  const anchor=(await q.boundingBox())!;
  await row.locator('.journal-quantity-trigger').tap();const field=row.locator('.journal-quantity-edit input');
  for(const value of ['0','1','10','80','999','1000','2.7','19.6','66.7','150.5','150']){
   await field.fill(value);
   const dimensions=await field.evaluate(e=>{const el=e as HTMLInputElement,s=getComputedStyle(el),ctx=document.createElement('canvas').getContext('2d')!;ctx.font=s.fontSize+' '+s.fontFamily;return {width:el.clientWidth,text:ctx.measureText(el.value).width,edge:el.getBoundingClientRect().right,unit:el.closest('.journal-quantity')!.querySelector('.cooking-unit-choice')!.getBoundingClientRect().left}});
   expect(dimensions.width).toBeGreaterThanOrEqual(dimensions.text);
   expect(dimensions.unit).toBeGreaterThanOrEqual(dimensions.edge);await expect(row.locator('.journal-quantity-edit button')).toHaveCount(0);
   expect((await row.boundingBox())!.height).toBe(box!.height);
   expect((await q.boundingBox())!.x).toBe(anchor.x);
   expect(await q.locator('.journal-amount-ink').evaluate(e=>e.getBoundingClientRect().width)).toBe(56);
  }
  if(width===390)await mode.screenshot({path:shots+'editing.png',scale:'css'});
  await row.locator('.journal-quantity-edit input').press('Escape');
 }
 await page.setViewportSize({width:390,height:844});await row.locator('.journal-quantity-trigger').tap();await row.locator('.journal-quantity-edit input').fill('200');await second.locator('.journal-quantity-trigger').tap();
 await expect(second.locator('.journal-quantity-edit input')).toBeFocused();await expect(row.locator('.journal-quantity-trigger')).toHaveText('200');
 await second.locator('.journal-quantity-edit input').fill('1000');await row.locator('.journal-quantity-trigger').tap();await expect(second.locator('.journal-quantity-trigger')).toHaveText('1000');
 await row.locator('.journal-quantity-edit input').fill('250');await row.locator('.draft-unit-trigger').tap();
 const menu=mode.locator('.draft-unit-menu');await expect(menu.locator('button')).toHaveCount(2);await expect(menu).not.toContainText('✓');
 await mode.screenshot({path:shots+'units.png',scale:'css'});await menu.locator('[data-unit="个"]').tap();
 await expect(row.locator('.journal-quantity-trigger')).toHaveText('5');await expect(menu).toHaveCount(0);
 if(origin==='meal'){await mode.locator('[data-confirm-preparation]').tap();const meal=page.locator('.meal-journal');await meal.locator('.meal-advanced summary').first().tap();await expect(meal.locator('.draft-amount input').first()).toHaveValue('5')}
});
