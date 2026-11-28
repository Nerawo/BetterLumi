import {test,expect,type Page} from '@playwright/test';
test.use({browserName:'webkit',channel:'',isMobile:true,hasTouch:true});
async function seed(page:Page,language='zh',empty=false){
 await page.goto('/recipes');await expect(page.locator('.recipe-fab')).toBeVisible();
 const recipe=await page.evaluate(async({language,empty})=>{
  const d=await import('/src/domain.ts'),{FoodStorage}=await import('/src/food-storage.ts'),{storedRecipeLine}=await import('/src/recipe-storage.ts');await d.db.settings.put({key:'language',value:language});
  const milk={lineId:'milk',ingredientId:'milk',name:language==='zh'?'豆奶':'Soy milk',quantity:130,unit:'mL',nutrition:{calories:70,protein:6,carbs:3,fat:2},groupId:'filling'},id=d.stamp().id;
  await new FoodStorage().makeBatch({operationId:d.stamp().id,id,name:'Prepared sauce',preparedOn:d.localDate(),cookedYieldGrams:500,ingredients:[{source:'pantry',line:{...milk,unit:'g'}}]});
  const r={...d.stamp(),name:language==='zh'?'制作模式做法测试':'Method editing preparation',servings:2,ingredientGroups:[{id:'filling',name:language==='zh'?'内馅':'Filling'}],lines:[milk,{...storedRecipeLine((await d.db.foodBatches.get(id))!),lineId:'sauce',groupId:'filling'}],instructions:empty?'':language==='zh'?'1. 混合食材。\n2. 轻轻拌匀，保持原有文字。':'1. Mix the ingredients.\n2. Stir gently; keep the original text.',stickyNote:'Keep notes',categoryIds:[],photo:''};await d.recipes.put(r);return r;
 },{language,empty});await page.reload();await page.locator('.recipe-list-row').filter({hasText:recipe.name}).locator('h3 a').tap();await page.locator('.start-cooking').tap();await expect(page.locator('.cooking-mode .journal-check-row')).toHaveCount(2);return recipe;
}
async function snapshot(page:Page){return page.evaluate(async()=>{const d=await import('/src/domain.ts');return (await d.exportAll()).tables})}
for(const width of [320,375,390,430])for(const language of ['zh','en'])test(`Method editing only ${width} ${language}`,async({page})=>{
 await page.setViewportSize({width,height:844});const recipe=await seed(page,language),mode=page.locator('.cooking-mode'),first=mode.locator('.journal-check-row').first(),section=mode.locator('.journal-method-section'),edit=section.locator('.journal-method-edit-trigger'),editor=section.locator('.journal-method-editor'),input=editor.locator('textarea');
 await expect(edit).toBeVisible();const heading=await section.locator('.journal-method-heading').evaluate(e=>{const a=e.querySelector('h3')!.getBoundingClientRect(),b=e.querySelector('button')!.getBoundingClientRect();return {beside:b.left>=a.right-1,touch:b.width>=40&&b.height>=40}});expect(heading).toEqual({beside:true,touch:true});await expect(mode.locator('.journal-method .journal-method-edit-trigger')).toHaveCount(0);
 await mode.locator('.journal-serving-stepper input').fill('4');await mode.locator('.journal-serving-stepper input').blur();await expect(mode.locator('.journal-footer .primary')).toBeEnabled();await first.locator('input[type=checkbox]').check();await expect(first.locator('input[type=checkbox]')).toBeEnabled();await first.locator('.journal-quantity-trigger').tap();await first.locator('.journal-quantity-edit input').fill('150.125');await first.locator('.journal-quantity-edit input').press('Enter');await expect(first.locator('.journal-quantity-restore')).toBeVisible();
 const before=await snapshot(page),sessionRow=before.settings.find((r:any)=>r.key==='cooking-session:v1:'+recipe.id) as {value:string},session=JSON.parse(sessionRow.value);
 await edit.tap();await expect(input).toBeFocused();await expect(input).toHaveValue(recipe.instructions);await expect(page.locator('.recipe-editor-modal')).toHaveCount(0);await expect(section.locator('.journal-method')).toHaveCount(0);await expect(mode.locator('textarea')).toHaveCount(1);
 const containment=()=>input.evaluate(e=>{const a=e.getBoundingClientRect(),b=e.closest('section')!.getBoundingClientRect();return a.left>=b.left-1&&a.right<=b.right+1});expect(await containment()).toBe(true);expect(await input.evaluate(e=>{const s=getComputedStyle(e);return {border:s.borderWidth,outline:s.outlineWidth,shadow:s.boxShadow,font:s.fontFamily}})).toMatchObject({border:'0px',outline:'0px',shadow:'none',font:expect.stringContaining('JournalHand')});
 await input.fill('Unsaved Method');await input.blur();expect(await snapshot(page)).toEqual(before);await expect(section.locator('.journal-method-heading button')).toHaveCount(1);await expect(section.locator('.journal-method-confirm')).toHaveText('');await expect(mode.locator('.journal-footer .primary')).toBeDisabled();page.once('dialog',dialog=>dialog.dismiss());await mode.locator('.modal-head button').tap();await expect(input).toHaveValue('Unsaved Method');await expect(mode).toBeVisible();expect(await snapshot(page)).toEqual(before);
 const instructions=language==='zh'?'1. 慢慢拌匀，保留本次做法。\n\n2. 冷藏后制作。':'1. Stir slowly; use this saved method.\n\n2. Chill before cooking.';await input.fill(instructions);
 if(width===390&&language==='zh')await mode.screenshot({path:'work/screenshots/method-edit-390.png'});
 await page.setViewportSize({width,height:430});await input.focus();await expect(input).toBeInViewport();expect(await containment()).toBe(true);for(const button of await section.locator('.journal-method-confirm').all()){await expect(button).toBeInViewport();expect(await button.evaluate(e=>e.getBoundingClientRect().bottom<=e.closest('.cooking-mode')!.querySelector('.journal-footer')!.getBoundingClientRect().top)).toBe(true)}await expect.poll(async()=>{const a=await input.boundingBox(),b=await mode.locator('.journal-footer').boundingBox();return !!a&&!!b&&a.y+a.height<=b.y}).toBe(true);if(width===390&&language==='zh')await mode.screenshot({path:'work/screenshots/method-keyboard-390.png'});
 await page.setViewportSize({width,height:844});await section.locator('.journal-method-confirm').last().tap();await expect(editor).toHaveCount(0);await expect(mode).toBeVisible();await expect(section.locator('.journal-method')).toHaveText(instructions);await expect(first.locator('input[type=checkbox]')).toBeChecked();await expect(first.locator('.journal-quantity-trigger')).toContainText('150');await expect(mode.locator('.journal-serving-stepper input')).toHaveValue('4');
 const after=await snapshot(page),saved=(after.recipeCards as any[]).find(r=>r.id===recipe.id);expect(saved).toEqual({...recipe,instructions,revision:recipe.revision+1,updatedAt:expect.any(String)});const updatedSession=JSON.parse((after.settings.find((r:any)=>r.key==='cooking-session:v1:'+recipe.id) as {value:string}).value);expect(updatedSession).toEqual({...session,recipeRevision:saved.revision});for(const key of Object.keys(before).filter(k=>!['settings','recipeCards'].includes(k)))expect(after[key]).toEqual(before[key]);
 for(const theme of ['misty','apricot','lavender','olive']){await page.evaluate(async theme=>(await import('/src/themes.ts')).applyTheme(theme),theme);expect(await mode.evaluate(e=>e.scrollWidth>e.clientWidth)).toBe(false)}
 if(width===390&&language==='zh')await mode.screenshot({path:'work/screenshots/method-saved-390.png'});if(width===320&&language==='zh')await mode.screenshot({path:'work/screenshots/method-saved-320.png'});
 await mode.locator('.modal-head button').tap();const detail=page.locator('.journal-recipe-detail');await expect(detail.locator('.journal-method')).toHaveText(instructions);await detail.locator('.start-cooking').tap();await expect(mode.locator('.journal-method')).toHaveText(instructions);await expect(first.locator('input[type=checkbox]')).toBeChecked();await expect(mode.locator('.journal-serving-stepper input')).toHaveValue('4');
});

for(const kind of ['back','navigation'])test(`unsaved Method protects ${kind} without a persistent draft`,async({page})=>{
 await page.setViewportSize({width:430,height:844});await page.addInitScript(()=>Object.defineProperty(navigator,'standalone',{value:true}));const recipe=await seed(page,'en'),mode=page.locator('.cooking-mode');await mode.locator('input[type=checkbox]').first().check();await expect(mode.locator('input[type=checkbox]').first()).toBeEnabled();await mode.locator('.journal-method-edit-trigger').tap();await mode.locator('textarea').fill('Unsaved Method must remain until explicitly confirmed');const before=await snapshot(page);
 const navigate=async()=>{if(kind==='back')await page.goBack();else await page.evaluate(async()=>(await import('/src/routing.ts')).navigate('/pantry'))};
 page.once('dialog',async dialog=>{expect(dialog.message()).toContain('unsaved Method');await dialog.dismiss()});await navigate();await expect(mode).toBeVisible();await expect(mode.locator('textarea')).toHaveValue('Unsaved Method must remain until explicitly confirmed');expect(await snapshot(page)).toEqual(before);
 page.once('dialog',dialog=>dialog.accept());await navigate();await expect(mode).toHaveCount(0);await expect.poll(async()=>page.evaluate(async id=>(await(await import('/src/domain.ts')).db.settings.get('cooking-session:v1:'+id)),recipe.id)).toEqual(before.settings.find(r=>r.key==='cooking-session:v1:'+recipe.id));expect(await page.evaluate(async id=>(await(await import('/src/domain.ts')).recipes.get(id))!.instructions,recipe.id)).toBe(recipe.instructions);
});

test('refresh protection is dirty-only and never persists unsaved Method text',async({page})=>{
 await page.setViewportSize({width:390,height:844});const recipe=await seed(page,'en'),mode=page.locator('.cooking-mode');const prevented=()=>page.evaluate(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented});await mode.locator('.journal-method-edit-trigger').tap();expect(await prevented()).toBe(false);await mode.locator('textarea').fill('Not saved on blur or reload');await mode.locator('textarea').blur();expect(await prevented()).toBe(true);expect(await page.evaluate(async id=>(await(await import('/src/domain.ts')).recipes.get(id))!.instructions,recipe.id)).toBe(recipe.instructions);page.once('dialog',dialog=>dialog.accept());await page.reload();await expect(page.locator('.journal-recipe-detail .journal-method')).toHaveText(recipe.instructions);await page.locator('.start-cooking').tap();await expect(mode.locator('.journal-method')).toHaveText(recipe.instructions);expect(await prevented()).toBe(false);
});

test('opening an unchanged Method buffer does not require discard confirmation',async({page})=>{
 await page.setViewportSize({width:390,height:844});await seed(page);const mode=page.locator('.cooking-mode');await mode.locator('.journal-method-edit-trigger').tap();await mode.locator('.modal-head button').tap();await expect(mode).toHaveCount(0);
});
test('empty Method can be added and cleared; failed save preserves draft and preparation for retry',async({page})=>{
 await page.setViewportSize({width:390,height:844});const recipe=await seed(page,'en',true),mode=page.locator('.cooking-mode'),section=mode.locator('.journal-method-section'),edit=section.locator('.journal-method-edit-trigger'),editor=section.locator('.journal-method-editor'),input=editor.locator('textarea');await expect(section.locator('.journal-method')).toHaveText('Not recorded');await expect(edit).toBeVisible();await edit.tap();await expect(input).toHaveValue('');await input.fill('1. Added method.');const before=await snapshot(page);
 await page.evaluate(async()=>{const {db}=await import('/src/domain.ts'),fail=()=>{throw Error('Injected method write failure')};db.settings.hook('updating',fail);(window as any).undoMethodFailure=()=>db.settings.hook('updating').unsubscribe(fail)});await section.locator('.journal-method-confirm').last().tap();await expect(editor.locator('[role=alert]')).toBeVisible();await expect(input).toHaveValue('1. Added method.');expect(await snapshot(page)).toEqual(before);await page.evaluate(()=>(window as any).undoMethodFailure());await section.locator('.journal-method-confirm').last().tap();await expect(section.locator('.journal-method')).toHaveText('1. Added method.');
 await edit.tap();await input.fill('');await section.locator('.journal-method-confirm').last().tap();await expect(section.locator('.journal-method')).toHaveText('Not recorded');await expect(edit).toBeVisible();expect(await page.evaluate(async id=>(await(await import('/src/domain.ts')).recipes.get(id))!.instructions,recipe.id)).toBe('');await edit.tap();await input.fill('Escape must protect this unsaved Method');page.once('dialog',dialog=>dialog.dismiss());await input.press('Escape');await expect(mode).toBeVisible();await expect(input).toHaveValue('Escape must protect this unsaved Method');page.once('dialog',dialog=>dialog.accept());await mode.locator('.modal-head button').tap();await expect(mode).toHaveCount(0);await expect(page.locator('.journal-recipe-detail .journal-method')).toHaveText('Not recorded');await page.locator('.start-cooking').tap();await expect(mode.locator('.journal-method')).toHaveText('Not recorded');
});



 test('Cancel preserves the original journal and clean Back leaves without a prompt',async({playwright,baseURL})=>{
  const browser=await playwright.chromium.launch({channel:'chrome'});
  try {
  const page=await browser.newPage({baseURL,hasTouch:true});
  await page.setViewportSize({width:390,height:844});
  await seed(page,'en');
  const mode=page.locator('.cooking-mode'),original=await mode.elementHandle();
  const url=page.url();
  await mode.locator('.journal-method-edit-trigger').click();
  const text=mode.locator('textarea'),method=await text.inputValue();
  await text.fill('Unsaved draft');
  let count=0;
  page.on('dialog',async d=>{count++;await d.dismiss()});
  await page.goBack();
  await expect(page).toHaveURL(url);
  await expect(text).toHaveValue('Unsaved draft');
  expect(await original!.evaluate(node=>node.isConnected)).toBe(true);
  await text.fill(method);
  await page.goBack();
  await expect(mode).toHaveCount(0);
  expect(count).toBe(1);
  } finally {await browser.close()}
 });
