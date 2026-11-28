import {test,expect,type Page,type Locator} from '@playwright/test';
for(const scenario of ['save three times','50 to 75','50 to 25','100 to 50','zero unavailable','modern base','changed Pantry','Backup 20','cancel'] as const)
test('historical Pantry meal snapshot: '+scenario,async({page})=>{
 await page.goto('/today');
 await expect(page.locator('.meal-card')).toBeVisible();
 const saved=await page.evaluate(async scenario=>{
   const d=await import('/src/domain.ts');
   const item={...d.stamp(),name:'Historical oats',nameZh:'',brand:'',basis:'100g' as const,servingGrams:null,calories:200,protein:10,carbs:20,fat:4};
   await d.db.ingredients.put(item);
   const meal={...d.stamp(),date:d.localDate(),category:'lunch' as const,name:item.name,source:'pantry' as const,sourceId:item.id,
     quantity:100,unit:'g',consumptionPercent:scenario==='100 to 50'?100:scenario==='zero unavailable'?0:50,
     nutrition:scenario==='zero unavailable'?{calories:0,protein:0,carbs:0,fat:0}:{calories:100,protein:5,carbs:10,fat:2},
     ...(scenario==='modern base'?{baseNutrition:{calories:200,protein:10,carbs:20,fat:4}}:{}),lines:[],cookingNote:''};
   await d.foodLogs.put(meal);
   if(scenario==='changed Pantry')await d.db.ingredients.update(item.id,{calories:999,protein:20,carbs:32,fat:21});
   if(scenario==='Backup 20'){
     const backup=JSON.parse(JSON.stringify(await d.exportAll()));
     if(backup.version!==21)throw Error('Expected Backup 21');
     await d.foodLogs.delete(meal.id);
     await d.restoreAll(backup);
   }
   return meal;
 },scenario);
 const target=scenario==='50 to 25'?25:scenario==='100 to 50'?50:75;
 for(let i=0;i<(scenario==='save three times'?3:1);i++){
   await page.locator('.meal-row').filter({hasText:saved.name}).getByRole('button',{name:/编辑|edit/i}).click();
   const editor=page.getByRole('dialog');
   if(scenario!=='save three times'&&scenario!=='Backup 20'){
     const slider=editor.getByRole('slider');
     await slider.press('Home');
     for(let percent=0;percent<target;percent+=5)await slider.press('ArrowRight');
     await expect(slider).toHaveValue(String(target));
   }
   if(scenario!=='cancel')await editor.getByRole('button',{name:/^(保存记录|Save Record)$/i}).click();
   if(scenario==='zero unavailable'||scenario==='cancel'){
     await expect(editor).toBeVisible();
     await editor.getByRole('button',{name:/^(取消|Cancel)$/i}).click();
   }
   await expect(editor).toHaveCount(0);
   const stored=await page.evaluate(async id=>(await import('/src/domain.ts')).foodLogs.get(id),saved.id);
   if(scenario==='zero unavailable'||scenario==='cancel')expect(stored).toEqual(saved);
   else{
     const unchanged=scenario==='save three times'||scenario==='Backup 20';
     const ratio=unchanged?1:target/saved.consumptionPercent;
     expect(stored?.nutrition).toEqual(Object.fromEntries(Object.entries(saved.nutrition).map(([k,v])=>[k,v*ratio])));
     expect(stored?.consumptionPercent).toBe(unchanged?saved.consumptionPercent:target);
     expect(stored?.baseNutrition).toEqual(saved.baseNutrition);
   }
 }
});
for(const source of ['pantry','quick','recipe'] as const)
for(const [from,to,restore,hasBase] of [[undefined,50,false,false],[undefined,50,true,false],[50,50,false,false],[50,50,true,false],[25,75,true,false],[100,50,false,false],[50,50,true,true]] as const)
test(`historical ${source} meal ${from} → 0 → ${to}, restore ${restore}, modern ${hasBase}`,async({page})=>{
 await page.goto('/today');await expect(page.locator('.meal-card')).toBeVisible();
 const saved=await page.evaluate(async ({from,hasBase,source,restore})=>{
  const d=await import('/src/domain.ts');
  const item={...d.stamp(),name:'Recorded oats',nameZh:'',brand:'',basis:'100g' as const,servingGrams:null,calories:200,protein:10,carbs:20,fat:4};
  await d.db.ingredients.put(item);
  const recipe={...d.stamp(),name:'Original recipe',instructions:'',stickyNote:'',lines:[{ingredientId:item.id,name:item.name,quantity:100,unit:'g',nutrition:d.ingredientNutrition(item,100,'g')}]};
  if(source==='recipe'&&restore)await d.recipes.put(recipe);
  const meal={...d.stamp(),name:item.name,date:d.localDate(),category:'lunch' as const,source,
    sourceId:source==='pantry'?item.id:source==='recipe'?recipe.id:null,quantity:source==='pantry'?100:1,
    unit:source==='pantry'?'g':source==='recipe'?'serving':'entry',...(from===undefined?{}:{consumptionPercent:from}),lines:[],cookingNote:'',
    nutrition:from===undefined?{calories:137,protein:8,carbs:0,fat:4}:d.scaleNutrition(d.ingredientNutrition(item,100,'g'),from/100),
    ...(hasBase?{baseNutrition:d.ingredientNutrition(item,100,'g')}:{})};
  await d.foodLogs.put(meal);
  await d.db.ingredients.update(item.id,{calories:300,protein:15,carbs:30,fat:6});
  if(source==='recipe'&&restore)await d.recipes.update(recipe.id,{lines:recipe.lines.map(l=>({...l,quantity:200}))});
  return meal;
 },{from,hasBase,source,restore});
 const edit=()=>page.locator('.meal-row').filter({hasText:'Recorded oats'}).getByRole('button',{name:'编辑',exact:true}).click();
 const modal=page.locator('.add-food-modal'),slider=modal.getByRole('slider'),save=modal.getByRole('button',{name:'保存记录'});
 const read=()=>page.evaluate(async id=>(await import('/src/domain.ts')).foodLogs.get(id),saved.id);
 await edit();await expect(slider).toHaveValue(String(from??100));await slider.press('Home');await modal.getByRole('button',{name:'取消',exact:true}).click();expect(await read()).toEqual(saved);
 if(from===25||from===undefined){
  await edit();await slider.press('Home');
  await page.evaluate(async()=>{
   const {foodLogs}=await import('/src/domain.ts');
   function reject(){foodLogs.hook('updating').unsubscribe(reject);throw Error('Injected historical meal write failure')}
   foodLogs.hook('updating',reject);
  });
  await save.click();await expect(modal.locator('.food-status')).toBeVisible();
  expect(await read()).toEqual(saved);await modal.getByRole('button',{name:'取消',exact:true}).click();
 }
 for(const percent of [0,to,0,to]){
  await edit();await slider.press('Home');for(let i=0;i<percent;i+=5)await slider.press('ArrowRight');
  await expect(slider).toHaveValue(String(percent));await save.click();await expect(modal).toHaveCount(0);
  if(restore)await page.evaluate(async()=>{const d=await import('/src/domain.ts');await d.restoreAll(await d.exportAll())});
  const base=from===undefined?{calories:137,protein:8,carbs:0,fat:4}:{calories:200,protein:10,carbs:20,fat:4};
  expect(await read()).toMatchObject({consumptionPercent:percent,baseNutrition:base,
    nutrition:{calories:base.calories*percent/100,protein:base.protein*percent/100,carbs:base.carbs*percent/100,fat:base.fat*percent/100}});
 }
});
for(const source of ['quick','recipe'] as const)test(`historical ${source} without a positive portion cannot infer its base`,async({page})=>{
 await page.goto('/today');
 await expect(page.locator('.meal-card')).toBeVisible();
 const original=await page.evaluate(async source=>{
  const d=await import('/src/domain.ts');
  const meal={...d.stamp(),name:'Original zero',date:d.localDate(),category:'lunch' as const,source,sourceId:null,
   quantity:1,unit:source==='recipe'?'serving':'entry',consumptionPercent:0,
   nutrition:{calories:0,protein:0,carbs:0,fat:0},lines:[],cookingNote:''};
  await d.foodLogs.put(meal);
  return meal;
 },source);
 await page.locator('.meal-row').filter({hasText:original.name}).getByRole('button',{name:'编辑',exact:true}).click();
 const editor=page.locator('.add-food-modal');
 await editor.getByRole('slider').press('ArrowRight');
 await editor.getByRole('button',{name:'保存记录'}).click();
 await expect(editor.locator('.food-status')).toBeVisible();
 expect(await page.evaluate(async id=>(await import('/src/domain.ts')).foodLogs.get(id),original.id)).toEqual(original);
});
test.use({isMobile:true,hasTouch:true});
async function language(page:Page,lang:string){await page.goto('/today');await expect(page.locator('#today-tab-more')).toBeVisible();await page.evaluate(async lang=>{const d=await import('/src/domain.ts');await d.db.settings.put({key:'language',value:lang})},lang);await page.reload()}
async function addUnit(editor:Locator,name:string,amount:string){await editor.locator('.ingredient-unit-add').click();await editor.locator('[name=unitName]').fill(name);await editor.locator('[name=unitAmount]').fill(amount);await editor.locator('.ingredient-unit-done').click()}
for(const lang of ['zh','en'])test('reference units, historical snapshots, archive and restore '+lang,async({page})=>{
 await page.setViewportSize({width:lang==='zh'?320:390,height:844});await language(page,lang);await page.goto('/pantry');const row=page.locator('[data-reference-id]').first(),id=(await row.getAttribute('data-reference-id'))!;await row.locator('.ingredient-name').click();const editor=page.locator('.ingredient-management-modal');await expect(editor.locator('.nutrition-fields,[name=name]')).toHaveCount(0);await expect(editor.locator('.ingredient-unit-editor')).toHaveCount(0);await addUnit(editor,'piece','55');await addUnit(editor,'pair','110');await editor.locator('[data-unit="piece"] .ingredient-unit-choice').click();await editor.locator('.form-actions .primary').click();await expect(editor).toHaveCount(0);await page.reload();await page.locator('[data-reference-id="'+id+'"] .ingredient-name').click();await expect(editor.locator('.ingredient-unit-item[data-custom]')).toHaveCount(2);await expect(editor.locator('[data-unit="piece"] .ingredient-unit-choice')).toHaveAttribute('aria-pressed','true');expect(await editor.evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(false);await editor.screenshot({path:'work/screenshots/ingredient-units-'+lang+'.png'});await editor.locator('.modal-head button').click();
 await page.goto('/recipes');await page.locator('.recipe-fab').click();const recipe=page.locator('.recipe-editor-modal');await recipe.locator('[name=name]').fill('Synthetic units recipe');await recipe.locator('.ingredient-add-trigger').click();await page.locator('.ingredient-picker-modal [data-reference-id="'+id+'"] .ingredient-picker-result').click();await expect(recipe.locator('.draft-unit-trigger')).toHaveAttribute('data-unit','piece');await recipe.locator('.recipe-line input').fill('2');await recipe.locator('.form-actions .primary').click();await expect(recipe).toHaveCount(0);const original=await page.evaluate(async()=>{const d=await import('/src/domain.ts');return(await d.recipes.toArray()).find(r=>r.name==='Synthetic units recipe')!});expect(original.lines[0]).toMatchObject({ingredientId:id,unit:'piece',quantity:2});
 await page.goto('/today');await page.locator('.meal-card .section-heading .primary').click();const meal=page.locator('.add-food-modal');await meal.locator('.source-tabs button').nth(1).click();await meal.locator('.ingredient-pick-trigger').click();await page.locator('.ingredient-picker-modal [data-reference-id="'+id+'"] .ingredient-picker-result').click();await expect(meal.locator('.meal-amounts [data-unit]')).toHaveAttribute('data-unit','piece');await meal.locator('.meal-amounts input').first().fill('0.5');await meal.locator('.form-actions .primary').click();await expect(meal).toHaveCount(0);
 const oldLogs=await page.evaluate(async()=>{const d=await import('/src/domain.ts');return d.foodLogs.toArray()});expect(oldLogs[0]).toMatchObject({sourceId:id,quantity:.5,unit:'piece'});
 await page.goto('/pantry');await page.locator('[data-reference-id="'+id+'"] .ingredient-name').click();await editor.locator('[data-unit=piece] .ingredient-unit-options > button').click();await editor.locator('[data-unit=piece] .ingredient-unit-menu button').first().click();await editor.locator('[name=unitAmount]').fill('60');await editor.locator('.ingredient-unit-done').click();await editor.locator('[data-unit=pair] .ingredient-unit-options > button').click();await editor.locator('[data-unit=pair] .ingredient-unit-menu button').last().click();await editor.locator('.form-actions .primary').click();await expect(editor).toHaveCount(0);expect(await page.evaluate(async id=>{const d=await import('/src/domain.ts');return d.recipes.get(id)},original.id)).toEqual(original);expect(await page.evaluate(async()=>{const d=await import('/src/domain.ts');return d.foodLogs.toArray()})).toEqual(oldLogs);
 await page.locator('[data-reference-id="'+id+'"] .ingredient-name').click();page.once('dialog',d=>d.accept());await editor.getByRole('button',{name:lang==='zh'?'移至食材仓库':'Move to Archive',exact:true}).click();await expect(editor).toHaveCount(0);await expect(page.locator('[data-reference-id="'+id+'"]')).toHaveCount(0);await page.goto('/recipes');await page.locator('.recipe-list-row').filter({hasText:'Synthetic units recipe'}).locator('.actions button').first().click();await expect(recipe.locator('.recipe-line')).toHaveCount(1);await recipe.locator('.ingredient-add-trigger').click();await expect(page.locator('.ingredient-picker-modal [data-reference-id="'+id+'"]')).toHaveCount(0);await page.keyboard.press('Escape');await page.keyboard.press('Escape');
 await page.goto('/more');await page.locator('[data-setting=ingredientArchive]').click();const archive=page.locator('.ingredient-archive');await expect(archive.locator('.archive-row')).toHaveCount(1);await archive.locator('.archive-row button').click();await expect(archive.locator('.archive-row')).toHaveCount(0);await page.goto('/pantry');await expect(page.locator('[data-reference-id="'+id+'"]')).toHaveCount(1);expect(await page.evaluate(async id=>{const d=await import('/src/domain.ts');return d.recipes.get(id)},original.id)).toEqual(original);
});
for(const lang of ['zh','en'])test('compact supplements preserve schedules and independent daily check-ins '+lang,async({page})=>{
 await page.setViewportSize({width:320,height:844});await language(page,lang);await page.locator('#today-tab-supplements').click();const card=page.locator('.supplement-section');await expect(page.locator('#today-tab-supplements .supplement-count')).toHaveCount(0);await card.locator('.section-heading .primary').click();await page.locator('.supplement-manager > .text-link').click();const modal=page.locator('.supplement-editor');await modal.locator('[name=name]').fill('Synthetic supplement');await modal.locator('[name=dosage]').fill('2');await modal.locator('[name=unit]').fill('capsule');const dose=await modal.locator('[name=dosage]').boundingBox(),unit=await modal.locator('[name=unit]').boundingBox();expect(dose!.y).toBe(unit!.y);expect(await modal.evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(false);await modal.locator('.supplement-schedule-options button').last().click();await expect(modal.locator('.weekday-toggles input')).toHaveCount(7);await modal.locator('.supplement-schedule-options button').first().click();await modal.screenshot({path:'work/screenshots/supplement-editor-'+lang+'.png'});await modal.locator('.form-actions .primary').click();await expect(modal).toHaveCount(0);await expect(page.locator('#today-tab-supplements .supplement-count')).toHaveText('0/1');const saved=await page.evaluate(async()=>{const d=await import('/src/domain.ts');const s=(await d.db.supplements.toArray())[0];await d.db.checks.put({...d.stamp(),id:s.id+':2020-01-02',supplementId:s.id,date:'2020-01-02',status:'skipped'});return s});
 const states=card.locator('.supplement-status-segments');await expect(states.getByRole('button')).toHaveCount(3);await states.locator('[data-status=taken]').click();await expect(page.locator('#today-tab-supplements .supplement-count')).toHaveText('1/1');await expect(states.locator('[data-status=taken]')).toHaveAttribute('aria-pressed','true');await expect(card.getByRole('menu')).toHaveCount(0);await page.reload();await expect(states.locator('[data-status=taken]')).toHaveAttribute('aria-pressed','true');await states.locator('[data-status=skipped]').click();await expect(page.locator('#today-tab-supplements .supplement-count')).toHaveText('0/1');await states.locator('[data-status=unconfirmed]').click();const historical=await page.evaluate(async id=>{const d=await import('/src/domain.ts');return d.db.checks.get(id+':2020-01-02')},saved.id);expect(historical!.status).toBe('skipped');expect(await page.evaluate(async id=>{const d=await import('/src/domain.ts');return d.db.supplements.get(id)},saved.id)).toEqual(saved);
 await card.locator('.section-heading .primary').click();await page.locator('.supplement-manager .actions button').first().click();await expect(modal.locator('[name=dosage]')).toHaveValue('2');await modal.locator('[name=dosage]').fill('3');await modal.locator('.form-actions .primary').click();await expect(modal).toHaveCount(0);await card.locator('.section-heading .primary').click();await page.locator('.supplement-manager .actions button').last().click();await page.locator('.delete-destructive').click();await expect(card.locator('.supplement-row')).toHaveCount(0);await expect(page.locator('#today-tab-supplements .supplement-count')).toHaveCount(0);expect(await page.evaluate(async id=>{const d=await import('/src/domain.ts');return d.db.checks.get(id+':2020-01-02')},saved.id)).toEqual(historical);expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});
test('custom ingredients keep nutrition editing, multiple units and identity across archive/restore',async({page})=>{
 await page.setViewportSize({width:390,height:844});await language(page,'en');const original=await page.evaluate(async()=>{const d=await import('/src/domain.ts');const item={...d.stamp(),name:'Synthetic custom liquid',nameZh:'',brand:'',basis:'100g',referenceAmount:222,referenceUnit:'mL',servingGrams:null,calories:111,protein:4,carbs:12,fat:3,consumptionUnit:{quantity:1,name:'can',amount:222,unit:'mL'}};await d.db.ingredients.put(item);return item});await page.goto('/pantry');const row=page.locator('[data-user-food-id="'+original.id+'"]');await row.locator('.ingredient-name').click();const manager=page.locator('.ingredient-journal'),unitEditor=page.locator('.journal-conversion');
 await expect(manager.locator('.journal-unit-summary')).toHaveCount(1);
 await manager.locator('.ingredient-unit-add').click();await unitEditor.locator('[name=conversionName]').fill('bottle');await unitEditor.locator('[name=conversionAmount]').fill('444');await unitEditor.locator('[name=conversionAmount]').press('Enter');
 await manager.locator('.journal-serving-units .draft-unit-trigger').click();await manager.getByRole('menuitemradio').filter({hasText:'bottle'}).click();await manager.locator('.form-actions .primary').click();await expect(manager).toHaveCount(0);
 await row.locator('.ingredient-name').click();const editor=manager;await expect(editor.locator('.nutrition-fields input').first()).toHaveValue('111');await editor.locator('.journal-unit-summary').first().click();await unitEditor.locator('[name=conversionAmount]').fill('250');await unitEditor.locator('[name=conversionAmount]').press('Enter');await editor.locator('.form-actions .primary').click();await expect(editor).toHaveCount(0);const saved=await page.evaluate(async id=>{const d=await import('/src/domain.ts'),p=await import('/src/ingredient-preferences.ts');return{item:await d.db.ingredients.get(id),preferences:p.ingredientPreferenceRows(await d.db.settings.toArray())[id]}},original.id);expect(saved.preferences).toMatchObject({preferred:'bottle',units:[{name:'can',amount:250},{name:'bottle',amount:444}]});expect(saved.item).toMatchObject({id:original.id,calories:111,protein:4,carbs:12,fat:3});
 await row.locator('.ingredient-name').click();page.once('dialog',d=>d.accept());await manager.getByRole('button',{name:'Move to Archive',exact:true}).click();await expect(manager).toHaveCount(0);await expect(row).toHaveCount(0);await page.goto('/more');await page.locator('[data-setting=ingredientArchive]').click();const archive=page.locator('.ingredient-archive');await archive.locator('input').fill('Synthetic custom');await expect(archive.locator('.archive-row')).toHaveCount(1);await archive.locator('.archive-row button').click();await expect(archive.locator('.archive-row')).toHaveCount(0);await page.goto('/pantry');await expect(row).toHaveCount(1);expect(await page.evaluate(async id=>{const d=await import('/src/domain.ts');return d.db.ingredients.get(id)},original.id)).toEqual(saved.item);
});
test('editing old meals and recipes retains removed-unit snapshots despite changed preferences',async({page})=>{
 await language(page,'en');const before=await page.evaluate(async()=>{const d=await import('/src/domain.ts'),refs=await import('/src/data/builtInFoods.ts'),p=await import('/src/ingredient-preferences.ts');const choice={kind:'built-in' as const,item:refs.builtInFoods[0]},pref={version:1 as const,units:[{quantity:1,name:'piece',amount:55,unit:'g' as const}],preferred:'piece',archived:false};const nutrition=p.personalNutrition(choice,2,'piece',pref),line={ingredientId:choice.item.id,name:'Historical reference',quantity:2,unit:'piece',nutrition};const recipe={...d.stamp(),name:'Historical recipe',servings:1,lines:[line],instructions:'Preserve',stickyNote:''};await d.recipes.put(recipe);const log={...d.stamp(),date:d.localDate(),category:'breakfast',name:'Historical reference',source:'pantry',sourceId:choice.item.id,quantity:2,unit:'piece',nutrition,lines:[],cookingNote:''};await d.foodLogs.put(log);await p.saveIngredientPreference(choice,{...pref,units:[],preferred:'g',archived:true});return {recipe,log}});await page.reload();await page.locator('.meal-row').filter({hasText:'Historical reference'}).locator('.actions button').first().click();const meal=page.locator('.add-food-modal');await expect(meal.locator('.meal-amounts [data-unit]')).toHaveAttribute('data-unit','piece');await expect(meal.locator('.meal-amounts input').first()).toHaveValue('2');await meal.locator('.form-actions .primary').click();await expect(meal).toHaveCount(0);const saved=await page.evaluate(async id=>{const d=await import('/src/domain.ts');return d.foodLogs.get(id)},before.log.id);expect(saved).toMatchObject({nutrition:before.log.nutrition,quantity:2,unit:'piece',sourceId:before.log.sourceId});await page.goto('/recipes');await page.locator('.recipe-list-row').filter({hasText:'Historical recipe'}).locator('.actions button').first().click();const recipe=page.locator('.recipe-editor-modal');await expect(recipe.getByRole('status')).toContainText(/review/i);await expect(recipe.locator('.recipe-line')).toContainText('piece');await recipe.locator('.form-actions .primary').click();await expect(recipe).toHaveCount(0);
 const storedLines=()=>page.evaluate(async id=>(await (await import('/src/domain.ts')).recipes.get(id))!.lines,before.recipe.id);
 const lines=await storedLines();
 expect(lines).toEqual(before.recipe.lines.map(line=>({...line,lineId:expect.stringMatching(/^[\da-f-]{36}$/i)})));
 await page.locator('.recipe-list-row').filter({hasText:'Historical recipe'}).locator('.actions button').first().click();
 await recipe.locator('.recipe-editor-footer .primary').click();await expect(recipe).toHaveCount(0);
 expect(await storedLines()).toEqual(lines);
});
test('empty historical supplement dates use date-neutral wording and seven days fit narrow screens',async({page})=>{
 await page.setViewportSize({width:320,height:844});await language(page,'en');await page.goto('/today?date=2020-01-04');await page.locator('#today-tab-supplements').click();const card=page.locator('.supplement-section');await expect(page.locator('#today-tab-supplements .supplement-count')).toHaveCount(0);await expect(card).toContainText('No supplements scheduled for this date.');await card.locator('.section-heading .primary').click();await page.locator('.supplement-manager > .text-link').click();const modal=page.locator('.supplement-editor');await modal.locator('.supplement-schedule-options button').last().click();const days=await modal.locator('.weekday-toggles label').evaluateAll(nodes=>nodes.map(el=>el.getBoundingClientRect().top));expect(days).toHaveLength(7);expect(new Set(days).size).toBe(1);expect(await modal.evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(false);await modal.locator('.modal-head button').click();
});
