import {expect,test,type Page,type Locator} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

test.use({browserName:'webkit',channel:'',isMobile:true,hasTouch:true,deviceScaleFactor:3,viewport:{width:390,height:844}});
const folder='work/screenshots/family-recipe-range';
const products=['review-a','review-b','review-c'];
const recipeName='测试酸奶碗';

async function seed(page:Page){
 await page.goto('/#/recipes');await expect(page.locator('.recipe-fab')).toBeVisible();
 await page.evaluate(async products=>{
  const {db,stamp}=await import('/src/domain.ts');
  const {saveFamily}=await import('/src/families.ts');
  const food=(id:string,name:string,calories:number,protein:number,carbs:number,fat:number)=>({...stamp(),id,name,nameZh:'',brand:'',basis:'100g' as const,
   referenceUnit:'g' as const,referenceAmount:100,servingGrams:null,calories,protein,carbs,fat});
  await db.settings.bulkPut([{key:'language',value:'zh'},{key:'theme',value:'lavender'}]);
  await db.ingredients.bulkPut([food(products[0],'Fage 0% Greek Yogurt',59,10,4,0),food(products[1],'Chobani Whole Milk Greek Yogurt',88,8,5,4),
   food(products[2],'Siggi’s Skyr',73,11,6,1),food('milk-low','低脂牛奶',40,3,4,1),food('milk-high','全脂牛奶',65,4,5,4)]);
  for(const [id,name,memberIds,inUseIds] of [['review-yogurt','酸奶',products,products],['review-milk','牛奶',['milk-low','milk-high'],[]],
   ['review-long','极窄屏幕用于检查换行的长名称纯天然发酵酸奶 Family',products,products]] as const){
   await saveFamily({...stamp(),id,name,alternateName:'',memberIds:[...memberIds],inUseIds:[...inUseIds]});
  }
 },products);
 await page.reload();await expect(page.locator('html')).toHaveAttribute('lang','zh');
}
async function shot(page:Page,name:string,region?:Locator){
 await mkdir(folder,{recursive:true});await page.evaluate(()=>document.fonts.ready);
 await (region??page).screenshot({path:`${folder}/${name}.png`,scale:'device'});
}
async function addFamily(page:Page,id:string){
 await page.locator('.recipe-editor-modal .ingredient-add-trigger').tap();
 await page.locator(`[data-family-option=${id}]`).tap();
}
async function setActive(page:Page,ids:string[]){
 await page.evaluate(async ids=>{const {db}=await import('/src/domain.ts');await db.ingredientFamilies.update('review-yogurt',{inUseIds:ids})},ids);
}

test('derives template ranges and snapshots actual choices in the meal editor',async({page})=>{
 test.setTimeout(120000);
 await seed(page);await page.locator('.recipe-fab').tap();
 const editor=page.locator('.recipe-editor-modal'),range=editor.locator('.recipe-editor-nutrition');
 await editor.locator('[name=name]').fill(recipeName);
 await addFamily(page,'review-yogurt');
 await expect(editor.locator('.draft-family-trigger')).toHaveCount(0);
 await expect(range.locator('.recipe-nutrition-value')).toHaveText(['59–88 kcal','8–11 g','4–6 g','0–4 g']);
 await shot(page,'01-create-with-range');await shot(page,'02-four-nutrients',range);
 const amount=editor.locator('.draft-amount input');
 await amount.fill('200');await amount.press('Enter');await expect(range).toContainText('118–176 kcal');
 await amount.fill('100');await amount.press('Enter');
 await editor.locator('.recipe-editor-footer .primary').tap();await expect(editor).toHaveCount(0);
 const card=page.locator('.recipe-list-row').filter({hasText:recipeName});
 await expect(card.locator('.recipe-metadata')).toContainText('59–88 kcal');await shot(page,'03-recipe-card');
 await page.evaluate(async()=>{const {db}=await import('/src/domain.ts');await db.ingredients.update('review-a',{calories:55})});
 await expect(card.locator('.recipe-metadata')).toContainText('55–88 kcal');
 await page.evaluate(async()=>{const {db}=await import('/src/domain.ts');await db.ingredients.update('review-a',{calories:59})});
 await setActive(page,[products[0]]);await expect(card.locator('.recipe-metadata')).toContainText('59 kcal');
 await setActive(page,products);await expect(card.locator('.recipe-metadata')).toContainText('59–88 kcal');
 const href=(await card.locator('a').getAttribute('href'))!;
 const meal=page.locator('.add-food-modal'),trigger=meal.locator('.draft-family-trigger'),preview=meal.locator('.meal-nutrition-preview');
 const openMeal=async()=>{await page.goto(href);await page.locator('.journal-add-meal').tap();await expect(meal).toBeVisible()};
 const save=meal.locator('.add-food-footer .primary');
 const choose=async(name:RegExp)=>{await trigger.tap();await meal.locator('.draft-family-options').getByRole('button',{name}).tap()};
 await openMeal();await expect(trigger).toContainText('请选择');await expect(preview).toContainText('59–88 kcal');
 await trigger.scrollIntoViewIfNeeded();await shot(page,'04-meal-choices-collapsed');
 await save.tap();await expect(trigger).toHaveAttribute('aria-invalid','true');
 expect(await page.evaluate(async()=>(await import('/src/domain.ts')).foodLogs.count())).toBe(0);
 await trigger.tap();await expect(meal.locator('.draft-family-option-name')).toHaveText(['Fage 0% Greek Yogurt','Chobani Whole Milk Greek Yogurt','Siggi’s Skyr']);
 await expect(meal.locator('.draft-family-options small')).toHaveText(['59 kcal / 100 g','88 kcal / 100 g','73 kcal / 100 g']);
 await expect(page.locator('.family-resolver')).toHaveCount(0);await shot(page,'05-meal-inline-options',meal.locator('.meal-advanced'));
 await meal.locator('.draft-family-options').getByRole('button',{name:/Fage/}).tap();
 await expect(preview).toContainText('59 kcal');await shot(page,'06-meal-exact-value');
 await choose(/Chobani/);await expect(preview).toContainText('88 kcal');
 await choose(/Fage/);await save.tap();await expect(meal).toHaveCount(0);
 await setActive(page,[]);await openMeal();await expect(preview).toContainText('59–88 kcal');
 await trigger.tap();await expect(meal.locator('.draft-family-options button')).toHaveCount(3);await shot(page,'07-zero-in-use',meal.locator('.meal-advanced'));
 await meal.locator('.draft-family-options').getByRole('button',{name:/Chobani/}).tap();await save.tap();await expect(meal).toHaveCount(0);
 await setActive(page,[products[0]]);await openMeal();await expect(preview).toContainText('59 kcal');
 await expect(meal.locator('.draft-family-member-label')).toHaveText('Fage 0% Greek Yogurt');await expect(trigger).toHaveCount(0);
 await shot(page,'08-one-in-use-automatic');await meal.locator('.add-food-footer button').first().tap();
 await page.evaluate(async()=>{const {db}=await import('/src/domain.ts');await db.ingredients.update('review-a',{calories:200});await db.ingredientFamilies.update('review-yogurt',{inUseIds:['review-b']})});
 const data=await page.evaluate(async()=>{
  const d=await import('/src/domain.ts');const backup=await d.exportAll();await d.restoreAll(backup);
  return {recipe:(await d.recipes.toArray())[0],logs:await d.foodLogs.toArray(),version:backup.version};
 });
 expect(data.recipe.lines[0]).toMatchObject({source:'family',familyId:'review-yogurt',quantity:100,unit:'g'});
 expect(data.recipe.lines[0]).not.toHaveProperty('nutrition');
 expect(data.logs.map(log=>[log.lines[0].ingredientId,log.nutrition.calories]).sort()).toEqual([[products[0],59],[products[1],88]]);
 expect(data.version).toBe(21);
});

test('shows additive ranges for multiple Families and permits saving an unavailable conversion',async({page})=>{
 await seed(page);await page.locator('.recipe-fab').tap();
 const editor=page.locator('.recipe-editor-modal'),range=editor.locator('.recipe-editor-nutrition');
 await editor.locator('[name=name]').fill('多 Family 范围');
 await addFamily(page,'review-yogurt');await addFamily(page,'review-milk');
 await expect(range).toContainText('99–153 kcal');await shot(page,'09-multiple-family-ranges');
 await addFamily(page,'review-long');await page.setViewportSize({width:320,height:844});
 await expect(range).toContainText('158–241 kcal');
 expect(await editor.locator('.recipe-editor-scroll').evaluate(node=>node.scrollWidth<=node.clientWidth)).toBe(true);
 await shot(page,'10-320-long-family-name');
 await editor.locator('.draft-unit-trigger').first().tap();await editor.getByRole('menuitemradio',{name:'mL',exact:true}).tap();
 await expect(range).toContainText('营养暂不可计算');
 await editor.locator('.recipe-editor-footer .primary').tap();await expect(editor).toHaveCount(0);
});
test('Recipe quantity avoids only the covered pixels and Done restores the journal',async({page})=>{
 await seed(page);
 await page.evaluate(()=>{
  const viewport=Object.assign(new EventTarget(),{height:innerHeight,offsetTop:0,scale:1,width:innerWidth});
  Object.defineProperty(window,'visualViewport',{value:viewport,configurable:true});
 });
 await page.locator('.recipe-fab').tap();await addFamily(page,'review-yogurt');
 const editor=page.locator('.recipe-editor-modal'),amount=editor.locator('.draft-amount input'),body=editor.locator('.recipe-editor-scroll');
 const keyboard=async(height:number)=>page.evaluate(async height=>{
  Object.assign(visualViewport!,{height});visualViewport!.dispatchEvent(new Event('resize'));
  await new Promise<void>(done=>requestAnimationFrame(()=>requestAnimationFrame(()=>done())));
 },height);
 await amount.evaluate(el=>el.scrollIntoView({block:'center'}));
 const geom=()=>editor.evaluate(d=>[d,d.querySelector('.modal-head')!,d.querySelector('.recipe-editor-scroll')!,d.querySelector('footer,.recipe-editor-footer')!].map(el=>{
  const {top,height}=el.getBoundingClientRect();return {top,height};
 }));
 const shell=await geom(),getScroll=()=>body.evaluate(el=>el.scrollTop),origin=await getScroll(),pageY=await page.evaluate(()=>scrollY);
 const fieldBottom=await amount.evaluate(el=>el.getBoundingClientRect().bottom);
 await amount.tap();
 await keyboard(fieldBottom+30);
 expect(await getScroll()).toBe(origin);expect(await geom()).toEqual(shell);
 await keyboard(fieldBottom-64);
 expect(await getScroll()-origin).toBeCloseTo(80,0);
 expect(await geom()).toEqual(shell);expect(await page.evaluate(()=>scrollY)).toBe(pageY);
 await amount.fill('125');await amount.press('Enter');
 await keyboard(844);
 expect(await getScroll()).toBeCloseTo(origin,0);await expect(amount).toHaveValue('125');await expect(editor).toBeVisible();
 await amount.tap();await keyboard(fieldBottom-64);
 const manual=await body.evaluate(el=>{el.dispatchEvent(new Event('touchmove',{bubbles:true}));el.scrollTop-=32;return el.scrollTop});
 await amount.blur();await keyboard(844);expect(await getScroll()).toBe(manual);expect(await geom()).toEqual(shell);
 console.log('Recipe 390px geometry',JSON.stringify(shell),'initial scroll',origin,'keyboard clearance',16);
});
