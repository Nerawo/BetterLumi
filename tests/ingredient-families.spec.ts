import {test,expect,type Page,type Locator} from '@playwright/test';
test.use({browserName:'webkit',channel:'',isMobile:true,hasTouch:true,deviceScaleFactor:3});
async function seed(page:Page,width:number,language:string){
 await page.setViewportSize({width,height:844});await page.goto('/#/pantry');await expect(page.locator('.pantry-fab')).toBeVisible();
 await page.evaluate(async({width,language})=>{
  const {db,stamp}=await import('/src/domain.ts');
  await db.settings.bulkPut([{key:'language',value:language},{key:'theme',value:({320:'olive',375:'apricot',390:'misty',430:'lavender'})[width]}]);
  for(const [id,name,calories] of [['fage','Fage 0% Greek Yogurt',59],['chobani','Chobani Whole Milk Greek Yogurt',88],['siggi',"Siggi’s Skyr",73]]){
   await db.ingredients.put({...stamp(),id,name,nameZh:'',brand:id,basis:'100g',referenceUnit:'g',servingGrams:null,calories,protein:8,carbs:5,fat:3,tagIds:['betterlumi:ingredient-tag:dairy-eggs']});
  }
 },{width,language});await page.reload();
}
async function shot(page:Page,name:string,locator?:Locator){
 await page.evaluate(()=>document.fonts.ready.then(()=>true));
 const options={path:'work/screenshots/ingredient-family/'+name+'.png',scale:'device' as const};
 if(locator)await locator.screenshot(options);else await page.screenshot(options);
}
for(const width of [320,375,390,430])for(const language of ['zh','en']){
 test('family browsing '+width+' '+language,async({page})=>{
  await seed(page,width,language);
  await page.evaluate(async()=>{const {db}=await import('/src/domain.ts');await db.ingredients.update('chobani',{name:'Chobani Whole Milk Greek Yogurt Naturally Strained Unsweetened',brand:'Chobani Dairy',nameZh:'浓醇全脂希腊酸奶'});await db.ingredients.update('siggi',{name:'Skyr 冰岛酸奶',brand:'Siggi’s'});});
  await page.evaluate(async narrow=>{const d=await import('/src/domain.ts');await d.db.ingredientFamilies.put({...d.stamp(),id:'yogurt',name:narrow?'酸奶 · Plain and Greek strained yogurt for breakfast':'酸奶',alternateName:'Yogurt',memberIds:['fage','chobani','siggi'],inUseIds:['fage']});await d.db.settings.put({key:'familyTags:yogurt',value:JSON.stringify(['betterlumi:ingredient-tag:dairy-eggs'])})},width===320);
  await page.reload();
  await page.locator('.ingredient-tag-bar [role=tab]').filter({hasText:/蛋奶|dairy/i}).first().tap();
  const family=page.locator('.pantry-family'),toggle=family.locator('.family-heading');
  await expect(family).toContainText('Fage');await expect(page.locator('[data-user-food-id=fage]')).toHaveCount(0);
  const fab=page.locator('.pantry-fab'),menu=page.locator('.pantry-add-menu');
  await fab.tap();await expect(menu.getByRole('button')).toHaveCount(2);
  const rects=await Promise.all([menu,fab,page.locator('.mobile-nav')].map(el=>el.boundingBox()));
  expect(rects[0]!.y+rects[0]!.height).toBeLessThanOrEqual(rects[1]!.y);
  expect(rects[1]!.y+rects[1]!.height).toBeLessThanOrEqual(rects[2]!.y);
  for(const action of await menu.getByRole('button').all())expect((await action.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.locator('.page-pantry .search input').first().tap();await expect(menu).toHaveCount(0);
  const capture=width===390&&language==='zh';
  const header=family.locator('.family-parent');await header.evaluate(el=>el.scrollIntoView({block:'center'}));
  const before=await header.boundingBox();
  const comparison=before&&{x:Math.floor(before.x),y:Math.floor(before.y),width:Math.floor(before.width),height:240};
  if(capture&&comparison){
   await shot(page,'ux-06-collapsed',header);
   await page.screenshot({path:'work/screenshots/ingredient-family/ux-pair-collapsed.png',clip:comparison,scale:'device'});
  }
  if(capture){await family.scrollIntoViewIfNeeded();await shot(page,'01-collapsed');await shot(page,'03-one-in-use',family)}
  await toggle.tap();await expect(family.locator('[data-user-food-id=fage]')).toContainText('59 kcal / 100 g');
  expect(await header.boundingBox()).toEqual(before);
  if(capture&&comparison)await page.screenshot({path:'work/screenshots/ingredient-family/ux-pair-expanded.png',clip:comparison,scale:'device'});
  for(const identity of await family.locator('.family-child .ingredient-name').all()){
   expect(await identity.evaluate(el=>{
    const style=getComputedStyle(el);
    return style.whiteSpace==='nowrap'&&style.textOverflow==='ellipsis'&&el.clientHeight<parseFloat(style.lineHeight)*1.5;
   })).toBe(true);
  }
  const touch=await family.locator('.family-dot').first().boundingBox();
  expect(touch!.width).toBeGreaterThanOrEqual(44);expect(touch!.height).toBeGreaterThanOrEqual(44);
  if(capture){await shot(page,'ux-07-expanded',family);await shot(page,'ux-08-one-in-use',family);await shot(page,'02-expanded',family)}
  const dot=family.locator('.family-child').filter({hasText:'Chobani'}).locator('.family-dot');
  await dot.tap();await expect(dot).toHaveAttribute('aria-pressed','true');await expect(family.locator('.family-dot[aria-pressed=true]')).toHaveCount(2);
  if(width===320&&language==='zh')await shot(page,'ux-12-320-long-name',family);
  if(capture)await shot(page,'ux-09-multiple-in-use',family);
  if(capture){await shot(page,'06-member-control',family);await toggle.tap();await shot(page,'04-multiple',family);await toggle.tap()}
  await dot.tap();await expect(dot).toHaveAttribute('aria-pressed','false');await family.locator('.family-child').filter({hasText:'Fage'}).locator('.family-dot').tap();
  await expect(family.locator('.family-dot[aria-pressed=true]')).toHaveCount(0);
  if(capture)await shot(page,'ux-10-no-in-use',family);
  await toggle.tap();if(capture)await shot(page,'05-none',family);
 const list=page.locator('.pantry-list');
 const position=()=>list.evaluate(e=>Array.from(e.children).findIndex(row=>row.matches('.pantry-family')));
 expect(await position()).toBe(0);
 await page.locator('.pantry-sort-trigger').tap();await page.locator('[data-sort=name]').tap();
 expect(await position()).toBe(0);
 await page.locator('.page-pantry .search input').first().fill('Yogurt');
 await expect(toggle).toBeVisible();
  await page.locator('.page-pantry .search input').first().fill('siggi');
  await expect(family.locator('[data-user-food-id=siggi]')).toBeVisible();if(capture)await shot(page,'19-search');await expect(family.locator('[data-user-food-id=chobani]')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
}
test('create and resolve a family recipe and save a concrete meal snapshot',async({page})=>{
 test.setTimeout(120000);await page.setViewportSize({width:390,height:844});await page.goto('/#/pantry');
 if(!(await page.locator('html').getAttribute('lang'))?.startsWith('zh'))await page.locator('.language-toggle').tap();
 const fab=page.locator('.pantry-fab');
 await shot(page,'13-default');await fab.tap();await expect(page.locator('.family-create-action')).toBeInViewport();await page.locator('.pantry-add-menu').evaluate(async el=>{await Promise.all(el.getAnimations().map(a=>a.finished))});await shot(page,'14-add-menu');await fab.tap();
 const ids:string[]=[];
 for(const name of ['Fage 0% Greek Yogurt','Chobani Whole Milk Greek Yogurt']){
  await fab.tap();await page.locator('.pantry-add-ingredient').tap();
  const food=page.locator('.ingredient-journal');await food.locator('[name=name]').fill(name);
  const energy=food.locator('[name=calories]');await energy.fill(name.startsWith('Fage')?'59':'88');
  await food.locator('.form-actions .primary').tap();await expect(food).toHaveCount(0);
  ids.push((await page.locator('[data-user-food-id]').filter({hasText:name}).getAttribute('data-user-food-id'))!);
 }
 await page.locator('.pantry-fab').tap();await page.locator('.family-create-action').tap();const editor=page.locator('.family-editor');
 await shot(page,'15-empty-editor',editor);await editor.locator('[name=familyName]').fill('酸奶');await editor.locator('[name=familyAlias]').fill('Yogurt');
 for(const [i,id] of ids.entries()){
  await editor.getByRole('button',{name:'添加成员'}).tap();
  const memberPicker=page.locator('.family-member-picker');await memberPicker.locator('[type=search]').fill(i?'Chobani':'Fage');await shot(page,'16-add-member',memberPicker);await memberPicker.locator('[data-member-option="'+id+'"]').tap();await memberPicker.locator('.member-picker-footer .primary').tap();
  await editor.locator('.family-dot').last().tap();
 }
 await shot(page,'07-editor',editor);await editor.locator('.primary').tap();await expect(editor).toHaveCount(0);
 const row=page.locator('.pantry-family');await row.scrollIntoViewIfNeeded();await expect(row.locator('.family-heading')).toHaveAttribute('aria-expanded','false');
 await expect(page.locator('.pantry-list > :first-child')).toHaveClass('pantry-family');
 await expect(row.locator('xpath=following-sibling::*[1]')).toBeVisible();await shot(page,'17-family-first');
 await row.locator('.family-heading').tap();await row.locator('.family-dot').last().tap();await expect(row.locator('[aria-pressed=true]')).toHaveCount(1);await row.locator('.family-heading').tap();
 await expect(row.locator('.family-summary')).not.toContainText('Chobani');await shot(page,'18-updated-summary',row);
 await row.locator('.family-heading').tap();await row.locator('.family-dot').last().tap();await expect(row.locator('[aria-pressed=true]')).toHaveCount(2);
 await page.goto('/#/recipes');await page.locator('.recipe-fab').tap();
 const draft=page.locator('.journal-recipe-editor');await draft.locator('[name=name]').fill('酸奶早餐');
 await draft.locator('.ingredient-add-trigger').first().tap();
 const picker=page.locator('.ingredient-picker-modal');await picker.locator('input[type=search]').fill('Yogurt');
 await expect(picker.locator('[data-family-option]')).toHaveCount(1);await expect(picker.locator('[data-ingredient-id="'+ids[0]+'"]')).toBeVisible();
 await shot(page,'08-template-picker',picker);await picker.locator('[data-family-option]').tap();
 await expect(draft.locator('.recipe-editor-nutrition')).toContainText('59–88 kcal');
 await expect(draft.locator('.draft-family-trigger')).toHaveCount(0);
 await draft.locator('.recipe-editor-footer .primary').tap();await expect(draft).toHaveCount(0);
 await page.locator('.recipe-list-row h3 a').filter({hasText:'酸奶早餐'}).tap();
 const detail=page.locator('.recipe-detail-modal').first();await expect(detail.locator('.detail-ingredients')).toContainText('酸奶');
 await shot(page,'09-template',detail);await detail.locator('.start-cooking').tap();
 const setup=page.locator('.cooking-mode .journal-ingredients-section');await setup.locator('.draft-family-trigger').tap();
 await expect(setup.locator('.draft-family-options button')).toHaveCount(2);
 await shot(page,'10-resolution',setup);await setup.locator('.draft-family-options').getByRole('button',{name:'Fage 0% Greek Yogurt',exact:true}).tap();
 const mode=page.locator('.cooking-mode');await expect(mode.locator('.journal-family-choice .journal-line-name')).toHaveText('酸奶');
 await expect(mode.locator('.journal-update')).toHaveCount(0);await shot(page,'11-cooking',mode);
 await mode.locator('.draft-family-options').getByRole('button',{name:'Chobani Whole Milk Greek Yogurt',exact:true}).tap();
 await expect(mode.locator('.recipe-nutrition-strip')).toContainText('88 kcal');
 await mode.locator('.draft-family-options').getByRole('button',{name:'Fage 0% Greek Yogurt',exact:true}).tap();
 await expect(mode.locator('.recipe-nutrition-strip')).toContainText('59 kcal');
 await mode.locator('.journal-footer .primary').tap();const meal=page.locator('.add-food-modal');
 await meal.locator('.add-food-footer .primary').tap();await expect(meal).toHaveCount(0);
 const data=await page.evaluate(async()=>{const d=await import('/src/domain.ts');return {meals:await d.foodLogs.toArray(),recipes:await d.recipes.toArray(),stock:await d.db.inventoryTransactions.count()}});
 expect(data.meals).toHaveLength(1);expect(data.meals[0].lines[0]).toMatchObject({ingredientId:ids[0],nutrition:{calories:59}});
 expect(data.recipes[0].lines[0].source).toBe('family');expect(data.stock).toBe(0);
 await page.goto('/#/today');await page.locator('#today-tab-food').tap();const saved=page.locator('.meal-ingredients').filter({hasText:'Fage'});await expect(saved).toBeVisible();await saved.scrollIntoViewIfNeeded();await expect(page.locator('.toast')).toHaveCount(0,{timeout:15000});await shot(page,'12-saved-meal',page.locator('[data-food-log-id]').filter({has:saved}));
});

test('mixed-basis family stays browsable and a mass recipe uses only compatible members',async({page})=>{
 await seed(page,375,'en');
 await page.evaluate(async()=>{
  const {db,stamp}=await import('/src/domain.ts');
  await db.ingredients.update('chobani',{referenceUnit:'mL'});
  await db.ingredientFamilies.put({...stamp(),id:'mixed',name:'Breakfast choices',alternateName:'',memberIds:['fage','chobani'],inUseIds:['fage','chobani']});
 });
 await page.reload();const family=page.locator('.pantry-family');
 await family.locator('.family-heading').tap();
 await expect(family.locator('.family-dot[aria-pressed=true]')).toHaveCount(2);
 await page.goto('/#/recipes');await page.locator('.recipe-fab').tap();
 await page.locator('.ingredient-add-trigger').first().tap();
 const picker=page.locator('.ingredient-picker-modal');
 await picker.locator('input[type=search]').fill('Breakfast choices');
 await expect(picker.locator('.collection-empty')).toHaveCount(0);
 await picker.locator('[data-family-option=mixed]').tap();
 await expect(picker).toHaveCount(0);
 await expect(page.locator('.recipe-editor-nutrition')).toContainText('59 kcal');
});

for(const active of [0,1,2])test('Add Meal resolves '+active+' active members and retains the chosen preparation',async({page})=>{
 page.on('pageerror',error=>console.error(error.stack));
 await seed(page,390,'en');
 await page.evaluate(async active=>{
  const d=await import('/src/domain.ts');
  await d.db.ingredientFamilies.put({...d.stamp(),id:'yogurt',name:'Yogurt',alternateName:'酸奶',memberIds:['fage','chobani'],inUseIds:['fage','chobani'].slice(0,active)});
  await d.recipes.put({...d.stamp(),id:'breakfast',name:'Breakfast bowl',servings:2,instructions:'Stir',stickyNote:'',lines:[
   {source:'family',lineId:'yogurt-line',familyId:'yogurt',name:'Yogurt',quantity:200,unit:'g'},
   {lineId:'exact',ingredientId:'siggi',name:'Skyr',quantity:20,unit:'g',nutrition:{calories:14.6,protein:1.6,carbs:1,fat:.6}}
  ]});
 },active);
 await page.goto('/#/today');await page.locator('#today-tab-food').tap();await page.locator('.meal-card .section-heading .primary').tap();
 const modal=page.locator('.add-food-modal');
 const choose=async()=>{await modal.locator('.recipe-selection-trigger').tap();await page.locator('[data-recipe-id=breakfast]').tap()};
 await choose();
 if(active===2){
  await modal.locator('.draft-family-trigger').tap();
  await expect(modal.locator('.draft-family-options button')).toHaveCount(2);
  await modal.locator('.draft-family-options').getByRole('button',{name:'Chobani Whole Milk Greek Yogurt',exact:true}).tap();
 }
 await modal.locator('.meal-start-cooking').tap();
 if(active===0){
  const setup=page.locator('.cooking-mode .journal-ingredients-section');await setup.locator('.draft-family-trigger').tap();
  await setup.locator('.draft-family-options').getByRole('button',{name:'Chobani Whole Milk Greek Yogurt',exact:true}).tap();
 }
 const mode=page.locator('.cooking-mode'),name=active===1?'Fage 0% Greek Yogurt':'Chobani Whole Milk Greek Yogurt';
 await expect(mode.locator('.journal-family-choice .journal-line-name')).toHaveText('Yogurt');
 await mode.locator('.journal-quantity-trigger').first().tap();const amount=mode.locator('.journal-quantity-edit input');
 await amount.fill('125');await amount.press('Enter');await mode.locator('.journal-update').tap();
 await page.locator('.journal-update-confirm .primary').tap();await expect(mode.locator('.journal-update')).toHaveCount(0);
 await mode.locator('[data-confirm-preparation]').tap();await expect(mode).toHaveCount(0);
 expect(await page.evaluate(async()=>(await import('/src/domain.ts')).foodLogs.count())).toBe(0);
 await modal.locator('.add-food-footer .primary').tap();await expect(modal).toHaveCount(0);
 const state=await page.evaluate(async()=>{
  const d=await import('/src/domain.ts');return {r:await d.recipes.get('breakfast'),log:(await d.foodLogs.toArray())[0],tx:await d.db.inventoryTransactions.count()};
 });
 expect(state.r.lines[0]).toMatchObject({source:'family',familyId:'yogurt',quantity:250,unit:'g'});
 expect(state.r.lines[1].ingredientId).toBe('siggi');
 expect(state.log.lines[0]).toMatchObject({name,quantity:125,ingredientId:active===1?'fage':'chobani'});
 expect(state.log.nutrition.calories).toBeCloseTo((active===1?59:88)*1.25+7.3,12);
 expect(state.tx).toBe(0);
});

test('creates, edits, cancels deletion and deletes a Family from the real Pantry UI',async({page})=>{
 test.setTimeout(120000);
 await page.setViewportSize({width:390,height:844});
 await page.goto('/#/pantry');
 if(!(await page.locator('html').getAttribute('lang'))?.startsWith('zh'))await page.locator('.language-toggle').tap();
 await page.locator('.pantry-fab').tap();
 await page.locator('.family-create-action').tap();
 const editor=page.locator('.family-editor'),picker=page.locator('.family-member-picker');
 await expect(editor.getByRole('heading',{name:'基本信息',exact:true})).toBeVisible();
 await expect(editor.getByRole('heading',{name:'成员',exact:true})).toBeVisible();
 await expect(editor.locator('.family-delete')).toHaveCount(0);
 await shot(page,'ux-01-create-blank',editor);
 await editor.locator('[name=familyName]').fill('早餐备选');
 const addMember=editor.locator('.family-add-member');
 const chosen:string[]=[];
 for(let index=0;index<11;index++){
  await addMember.tap();
  const first=picker.locator('[data-member-option]').first();
  if(index===0)await picker.getByRole('searchbox').fill('鸡蛋');
  chosen.push((await first.getAttribute('data-member-option'))!);
  await first.tap();await picker.locator('.member-picker-footer .primary').tap();
  await expect(editor.locator('.family-member-editor')).toHaveCount(index+1);
 }
 await editor.locator('.family-dot').first().tap();
 await expect(editor.locator('.recipe-editor-footer .primary')).toBeInViewport();
 await shot(page,'ux-02-create-with-members',editor);
 await editor.locator('.recipe-editor-footer .primary').tap();
 const row=page.locator('.pantry-family').filter({hasText:'早餐备选'}),heading=row.locator('.family-heading'),trigger=row.locator('.family-action-trigger');
 await heading.tap();await expect(row.locator('.family-child')).toHaveCount(11);
 await row.locator('.family-dot').nth(1).tap();
 await expect(row.locator('[data-in-use=true]')).toHaveCount(2);
 await trigger.tap();await expect(heading).toHaveAttribute('aria-expanded','true');
 const menu=row.getByRole('menu');
 await expect(menu.getByRole('menuitem')).toBeVisible();
 await shot(page,'ux-05-family-action-menu');
 await menu.getByRole('menuitem').tap();
 await expect(editor.locator('[name=familyName]')).toHaveValue('早餐备选');
 await expect(editor.locator('.family-member-editor')).toHaveCount(11);
 await shot(page,'ux-03-edit',editor);
 await editor.locator('[name=familyAlias]').fill('Breakfast choices');
 await editor.locator('.recipe-editor-footer .primary').tap();
 await expect(heading).toContainText('Breakfast choices');
 await trigger.tap();await menu.getByRole('menuitem').tap();
 const remove=editor.locator('.family-delete');
 await remove.scrollIntoViewIfNeeded();await shot(page,'ux-04-delete-entry',editor);
 await remove.tap();
 const confirmation=page.locator('.delete-confirmation-modal');
 await expect(confirmation).toBeVisible();
 await shot(page,'ux-11-delete-confirmation',confirmation);
 await confirmation.locator('.delete-dialog-actions button').first().tap();
 await expect(confirmation).toHaveCount(0);
 await expect(editor.locator('.family-member-editor')).toHaveCount(11);
 await remove.tap();await confirmation.locator('.delete-destructive').tap();
 await expect(confirmation).toHaveCount(0);
 await expect(editor).toHaveCount(0);
 await expect(row).toHaveCount(0);
 for(const id of chosen)await expect(page.locator('.pantry-list > [data-reference-id="'+id+'"]')).toHaveCount(1);
});

test('a single draft member stays in the editor until Save and expands alone at 390 px',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/#/pantry');
 await page.locator('.pantry-fab').tap();
 await page.locator('.family-create-action').tap();
 const editor=page.locator('.family-editor');
 await editor.locator('[name=familyName]').fill('One pantry member');
 await editor.locator('.family-add-member').tap();
 await page.locator('.family-member-picker [data-member-option]').first().tap();await page.locator('.member-picker-footer .primary').tap();
 await expect(editor.locator('.family-member-editor')).toHaveCount(1);
 await expect(page.locator('.pantry-family')).toHaveCount(0);
 await editor.locator('.recipe-editor-footer .primary').tap();
 const row=page.locator('.pantry-family').filter({hasText:'One pantry member'});
 await row.locator('.family-heading').tap();
 await expect(row.locator('.family-child')).toHaveCount(1);
 await expect(row.locator('.family-dot')).toHaveAttribute('aria-pressed','false');
});
test('Family slots share the full cooking journal, destination guard and restored checklist',async({page,context})=>{
 await seed(page,390,'zh');
 await page.evaluate(async()=>{
  const d=await import('/src/domain.ts');
  const product={...d.stamp(),id:'chocolate',name:'巧克力',nameZh:'',brand:'',basis:'100g',referenceUnit:'g',calories:563,protein:9,carbs:53,fat:37,tagIds:[]};
  await d.db.ingredients.put(product);
  await d.db.ingredients.update('fage',{name:'Fage'});
  await d.db.ingredients.update('chobani',{name:'番茄'});
  await d.db.ingredients.update('siggi',{name:'菠菜'});
  const plain={lineId:'exact',ingredientId:product.id,name:product.name,unit:'g',quantity:10,nutrition:{calories:56.3,protein:.9,carbs:5.3,fat:3.7}};
  const recipe={...d.stamp(),id:'plain',name:'巧克力',instructions:'',servings:1,stickyNote:'',lines:[plain]};
  await d.recipes.put(recipe);
  for(const [id,name] of [['yogurt','酸奶'],['milk','牛奶']]){
   await d.db.ingredientFamilies.put({...d.stamp(),id,name,alternateName:'',memberIds:['fage','chobani','siggi'],inUseIds:id==='yogurt'?['fage','chobani','siggi']:[]});
  }
  await d.recipes.put({...recipe,id:'bowl',name:'酸奶碗',instructions:'加入酸奶，轻轻拌匀。',lines:[
   {source:'family',familyId:'yogurt',name:'酸奶',lineId:'y',quantity:100,unit:'g'},plain,
   {source:'family',familyId:'milk',name:'牛奶',lineId:'m',quantity:50,unit:'g'}
  ]});
 });
 const start=async(p:Page,name:string)=>{
  await p.goto('/#/recipes');await p.locator('.recipe-list-row h3').getByRole('link',{name,exact:true}).first().tap();
  await p.locator('.start-cooking').tap();
  const journal=p.locator('.cooking-mode');await expect(journal.locator('.journal-add-storage')).toBeVisible();
  await expect(journal.locator('.journal-check-row').first()).toBeVisible();return journal;
 };
 const capture=async(name:string)=>{await page.evaluate(()=>document.fonts.ready.then(()=>true));await page.screenshot({path:'work/screenshots/cooking-family-journal/'+name+'.png',scale:'device'})};
 const plain=await start(page,'巧克力');await capture('01-concrete');await plain.locator('.modal-head button').tap();
 await page.locator('.recipe-detail-modal .modal-head button').tap();
 const journal=await start(page,'酸奶碗'),rows=journal.locator('.journal-check-row');
 await expect(rows).toHaveCount(3);await expect(journal.locator('.journal-method-section')).toContainText('轻轻拌匀');
 await capture('02-family-journal');
 await rows.nth(0).locator('.draft-family-trigger').tap();await capture('03-inline-selector');await rows.nth(0).locator('.draft-family-trigger').tap();
 await journal.locator('.journal-footer .primary').tap();await expect(rows.nth(0).locator('[aria-invalid=true]')).toBeVisible();
 await capture('06-unresolved');await expect(page.locator('.add-food-modal')).toHaveCount(0);
 await journal.locator('.journal-add-storage').tap();await expect(rows.nth(0).locator('[aria-invalid=true]')).toBeVisible();
 await journal.locator('.journal-serving-stepper button').last().tap();
 await rows.nth(0).locator('input[type=checkbox]').check();await rows.nth(1).locator('input[type=checkbox]').check();
 await rows.nth(0).locator('.draft-family-trigger').tap();
 await rows.nth(0).getByRole('button',{name:'Fage',exact:true}).tap();await capture('05-method-and-mixed-lines');
 await expect(rows.nth(2).locator('[data-unresolved]')).toBeVisible();
 await rows.nth(2).locator('.draft-family-trigger').tap();
 await rows.nth(2).getByRole('button',{name:'番茄',exact:true}).tap();await capture('07-destinations');
 await rows.nth(0).locator('.journal-quantity-trigger').tap();const qty=rows.nth(0).locator('.journal-quantity-edit input');await qty.fill('120.056');await qty.press('Enter');
 await expect(journal.locator('.recipe-nutrition-strip')).toContainText('221');await capture('04-resolved');
 const original=await journal.elementHandle();
 const entry=await page.evaluate(()=>({href:location.href,state:history.state,length:history.length}));
 const session=()=>page.evaluate(async()=>(await (await import('/src/domain.ts')).db.settings.get('cooking-session:v1:bowl'))?.value);
 const savedSession=await session();
 expect(savedSession).toBeTruthy();
 await journal.locator('.journal-method-edit-trigger').tap();
 await journal.locator('textarea').fill('未保存的制作步骤');
 for(const action of ['back','back','close']){
  let confirmations=0;
  const stay=async(dialog:import('@playwright/test').Dialog)=>{confirmations++;await dialog.dismiss()};
  page.on('dialog',stay);
  if(action==='back')await page.goBack();else await journal.locator('.modal-head button').tap();
  await expect.poll(()=>page.evaluate(()=>({href:location.href,state:history.state,length:history.length}))).toEqual(entry);
  await expect(journal.locator('textarea')).toHaveValue('未保存的制作步骤');
  expect(await original!.evaluate(node=>node.isConnected)).toBe(true);
  await expect(rows.locator('input:checked')).toHaveCount(2);
  await expect(rows.first().locator('.journal-family-choice .journal-line-name')).toHaveText('酸奶');
  await expect(rows.first().locator('.journal-quantity-trigger')).toHaveText('120.1');
  await expect(journal.locator('.journal-serving-stepper input')).toHaveValue('1.5');
  expect(await session()).toEqual(savedSession);
  page.off('dialog',stay);
  expect(confirmations).toBe(1);
 }
 page.once('dialog',dialog=>dialog.accept());
 await journal.locator('.modal-head button').tap();
 const reopened=await context.newPage();await page.close();
 const restored=await start(reopened,'酸奶碗');
 await expect(restored.locator('.journal-check-row input:checked')).toHaveCount(2);
 await expect(restored.locator('.journal-serving-stepper input')).toHaveValue('1.5');
 await expect(restored.locator('.journal-family-choice .journal-line-name').first()).toHaveText('酸奶');
 await expect(restored.locator('.journal-family-choice .journal-line-name').last()).toHaveText('牛奶');
 for(const [index,member] of ['Fage','番茄'].entries()){
  const choice=restored.locator('.journal-family-choice').nth(index);await choice.locator('.draft-family-trigger').tap();
  await expect(choice.getByRole('button',{pressed:true})).toHaveText(member);
 }
 await expect(restored.locator('.journal-quantity-trigger').first()).toHaveText('120.1');
 await expect(restored.locator('.journal-method-section')).toContainText('轻轻拌匀');
});
for(const width of [390,320])test('Cooking shows one ingredient name and a compact member list at '+width,async({page})=>{
 await seed(page,width,'zh');
 const longName='Chobani Whole Milk Greek Yogurt 原味';
 await page.evaluate(async longName=>{
  const d=await import('/src/domain.ts');
  await d.db.ingredients.update('fage',{name:'番茄'});
  await d.db.ingredients.update('chobani',{name:longName});
  await d.db.ingredients.update('siggi',{name:'菠菜'});
  await d.db.ingredientFamilies.put({...d.stamp(),id:'review',name:'酸奶',alternateName:'',memberIds:['fage','chobani','siggi'],inUseIds:['fage','chobani','siggi']});
  await d.recipes.put({...d.stamp(),id:'review-bowl',name:'酸奶碗',instructions:'拌匀食材。',stickyNote:'',servings:1,lines:[
   {source:'family',familyId:'review',lineId:'slot',name:'酸奶',quantity:100,unit:'g'},
   {ingredientId:'siggi',lineId:'vegetable',name:'菠菜',quantity:100,unit:'g',nutrition:{calories:73,protein:8,carbs:5,fat:3}}
  ]});
 },longName);
 await page.goto('/#/recipes/review-bowl');await page.locator('.start-cooking').tap();
 const mode=page.locator('.cooking-mode'),rows=mode.locator('.journal-check-row'),family=rows.first(),normal=rows.last();
 const name=family.locator('.draft-family-trigger'),options=family.locator('.draft-family-options'),check=family.locator('input[type=checkbox]');
 const capture=async(state:string)=>{await expect(mode.locator('.journal-reset')).toBeEnabled();await page.evaluate(()=>document.fonts.ready.then(()=>true));await page.screenshot({path:`work/screenshots/cooking-family-names/${width}-${state}.png`,scale:'device'})};
 await expect(name).toHaveText('酸奶');await expect(name).toHaveAttribute('aria-expanded','false');
 await expect(check).toHaveAccessibleName('酸奶');
 const hit=await check.boundingBox();
 expect(hit!.height).toBeGreaterThanOrEqual(44);expect(hit!.width).toBeGreaterThanOrEqual(44);
 await check.tap({position:{x:3,y:3}});await expect(check).toBeChecked();
 await expect(name).toHaveAttribute('aria-expanded','false');await expect(family.locator('.journal-quantity-edit')).toHaveCount(0);
 await expect(check).toBeEnabled();await check.press('Space');await expect(check).not.toBeChecked();
 await capture('01-unresolved');
 await name.tap();await expect(options.locator('button')).toHaveText(['番茄',longName,'菠菜']);
 await expect(options.locator('[aria-pressed=true]')).toHaveCount(0);await capture('02-choices');
 for(const button of await options.getByRole('button').all()){
  const bounds=await button.boundingBox();expect(bounds!.height).toBe(44);expect(bounds!.width).toBeGreaterThanOrEqual(44);
 }
 await options.getByRole('button',{name:'番茄'}).tap();await expect(name).toHaveText('酸奶');
 await expect(check).not.toBeChecked();await expect(options.locator('[aria-pressed=true]')).toHaveText('番茄');
 await capture('03-selected-open');await name.tap();await expect(options).toHaveCount(0);await capture('04-selected');
 const type=(el:Element)=>{const s=getComputedStyle(el);return [s.fontFamily,s.fontSize,s.fontWeight,s.lineHeight,s.color]};
 expect(await name.locator('.journal-line-name').evaluate(type)).toEqual(await normal.locator('.journal-line-name').evaluate(type));
 expect(await family.locator('.journal-quantity').evaluate(type)).toEqual(await normal.locator('.journal-quantity').evaluate(type));
 await check.check();await name.tap();await options.getByRole('button',{name:longName}).tap();await name.tap();
 await expect(check).toBeChecked();await expect(name).toHaveText('酸奶');await expect(normal.locator('.journal-line-name')).toHaveText('菠菜');
 await name.tap();await expect(options.getByRole('button',{pressed:true})).toHaveText(longName);await name.tap();
 const trigger=await name.boundingBox(),amount=await family.locator('.journal-quantity').boundingBox();
 expect(trigger!.x+trigger!.width).toBeLessThanOrEqual(amount!.x+1);await capture('05-long-name');
});

test('Milk stays the cooking identity at 150 mL while same-name products remain distinct',async({page})=>{
 await seed(page,390,'zh');
 await page.evaluate(async()=>{
  const d=await import('/src/domain.ts');
  for(const [id,brand] of [['fage','SUPER NATURAL'],['chobani','Organic Valley']]){
   await d.db.ingredients.update(id,{name:'whole milk',brand,referenceUnit:'mL'});
  }
  await d.db.ingredientFamilies.put({...d.stamp(),id:'milk',name:'牛奶',alternateName:'Milk',memberIds:['fage','chobani'],inUseIds:['fage','chobani']});
  await d.recipes.put({...d.stamp(),id:'milk-recipe',name:'Milk test',servings:1,instructions:'',stickyNote:'',
   lines:[{source:'family',familyId:'milk',lineId:'milk-slot',name:'牛奶',quantity:150,unit:'mL'}]});
 });
 await page.goto('/#/recipes/milk-recipe');await page.locator('.start-cooking').tap();
 const mode=page.locator('.cooking-mode'),trigger=mode.getByRole('button',{name:'牛奶',exact:true}),checkbox=mode.getByRole('checkbox',{name:'牛奶'});
 await checkbox.check();await trigger.tap();
 for(const [product,calories] of [['SUPER NATURAL','89 kcal'],['Organic Valley','132 kcal']]){
  const option=mode.getByRole('button',{name:'whole milk / '+product,exact:true});
  await option.tap();await expect(option).toHaveAttribute('aria-pressed','true');
  await expect(trigger).toHaveText('牛奶');await expect(checkbox).toBeChecked();
  await expect(mode.locator('.recipe-nutrition-strip')).toContainText(calories);
 }
 await trigger.tap();await expect(mode.locator('.journal-quantity-trigger')).toHaveText('150');
 await expect(mode.locator('.cooking-unit-choice')).toHaveText('mL');await expect(trigger).toHaveText('牛奶');
});
