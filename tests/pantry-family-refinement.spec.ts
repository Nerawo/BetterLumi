import {test,expect,type Page,type Locator} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';

const folder='work/screenshots/pantry-refinement';
test.use({browserName:'webkit',channel:'',isMobile:true,hasTouch:true,deviceScaleFactor:3,viewport:{width:390,height:844}});
async function photo(page:Page,name:string){
 await mkdir(folder,{recursive:true});await page.evaluate(()=>document.fonts.ready.then(()=>true));
 await page.screenshot({path:folder+'/'+name+'.png',scale:'device',caret:'initial'});
}
async function sample(page:Page){
 await page.goto('/#/pantry');
 await page.evaluate(async()=>{
  const {db,stamp}=await import('/src/domain.ts');
  const {builtInFoods}=await import('/src/data/builtInFoods.ts');
  // Keep the searchable example isolated in this test browser profile.
  for(const food of builtInFoods.filter(item=>JSON.stringify(item).includes('酸奶')))
   await db.settings.put({key:'ingredientPreference:'+food.id,value:JSON.stringify({version:1,units:[],preferred:'g',archived:true})});
  await db.settings.bulkPut([{key:'language',value:'zh'},{key:'theme',value:'misty'}]);
  for(const [index,name] of ['Fage 0% Greek Yogurt','Chobani Whole Milk Greek Yogurt Naturally Strained','Siggi’s Skyr','Trader Joe’s Greek Yogurt','原味酸奶'].entries()){
   await db.ingredients.put({...stamp(),id:'review-'+index,name,nameZh:'',brand:'',basis:'100g',referenceUnit:'g',referenceAmount:100,servingGrams:null,calories:59+index*4,protein:8,carbs:5,fat:3,tagIds:['breakfast']});
  }
  await db.table('ingredientTags').put({...stamp(),id:'breakfast',name:'早餐'});
  await db.table('recipeCategories').put({...stamp(),id:'dessert',name:'甜品'});
 });await page.reload();await expect(page.locator('.pantry-fab')).toBeVisible();
}
async function navigation(page:Page){
 const nav=page.locator('.collection-navigation:visible').first();await expect(nav.locator('[aria-selected=false]').first()).toBeVisible();
 return nav.evaluate(el=>{
  const rect=(s:Element)=>s.getBoundingClientRect();
  const box=rect(el),selected=el.querySelector('[aria-selected=true]')!,other=el.querySelector('[aria-selected=false]')!;
  const mid=(r:DOMRect)=>r.top+r.height/2;
  const textCenter=(element:Element)=>{const r=document.createRange();r.selectNodeContents(element);return mid(r.getBoundingClientRect())};
  const host=el.closest('.page-pantry,#recipes-library-panel')!;
  return {nav:mid(box),pill:mid(rect(selected)),other:mid(rect(other)),selectedText:textCenter(selected),unselectedText:textCenter(other),
   height:box.height,above:box.top-rect(host.querySelector('.search')!).bottom,below:rect(host.querySelector('.directory-summary-row')!).top-box.bottom};
 });
}
async function measure(page:Page){
 const m=await navigation(page);
 expect(m.pill).toBe(m.nav);expect(m.other).toBe(m.nav);
 expect(m.unselectedText).toBe(m.selectedText);expect(Math.abs(m.nav-m.selectedText)).toBeLessThanOrEqual(1.5);
 expect(Math.abs(m.above-m.below)).toBeLessThanOrEqual(1);
 return m;
}
test('Family journal picker, independent tags, unique counts and shared row geometry',async({page})=>{
 test.setTimeout(120000);await sample(page);
 const family=page.locator('.pantry-family'),editor=page.locator('.family-editor'),picker=page.locator('.family-member-picker');
 await page.locator('.pantry-fab').tap();await page.locator('.family-create-action').tap();await photo(page,'02-create');
 await editor.locator('[name=familyName]').fill('酸奶');await editor.locator('[name=familyAlias]').fill('Yogurt');
 const chips=editor.locator('.ingredient-tag-choices');
 await chips.getByRole('button',{name:'早餐',exact:true}).tap();await chips.getByRole('button',{name:/蛋奶/}).tap();await photo(page,'04-family-tags');
 for(let index=0;index<4;index++){
  await editor.locator('.family-add-member').tap();
  for(let i=0;i<index;i++)await expect(picker.locator('[data-member-option=review-'+i+']')).toHaveCount(0);
  await picker.getByRole('searchbox').fill(['Fage','Chobani','Siggi','Trader'][index]);
  const option=picker.locator('[data-member-option=review-'+index+']');await expect(option.locator('strong')).toBeVisible();
  expect(await option.evaluate(el=>Math.abs(el.querySelector('strong')!.getBoundingClientRect().left-el.getBoundingClientRect().left))).toBeLessThan(2);
  if(index===1)await photo(page,'01-member-picker');
  await option.tap();
 }
 await editor.locator('.family-dot').first().tap();await editor.locator('.recipe-editor-footer .primary').tap();
 const category=page.getByRole('tab',{name:'早餐',exact:true});
 await category.tap();await expect(family).toBeVisible();
 const count=page.locator('.directory-summary-row .muted').first();
 await expect(count).toHaveText('5 项食材 · 1 个 Family');await photo(page,'05-collapsed');await photo(page,'11-family-category');
 await family.locator('.family-heading').tap();await expect(family.locator('.family-child')).toHaveCount(4);
 const paint=async(el:Locator)=>el.evaluate(n=>getComputedStyle(n,'::before').backgroundColor);
 expect(new Set(await Promise.all([paint(family.locator('.family-parent')),paint(family.locator('[data-in-use=true]')),paint(family.locator('[data-in-use=false]').first())])) .size).toBe(3);
 await photo(page,'06-expanded');await photo(page,'07-active');await family.locator('.family-dot').nth(1).tap();
 await expect(family.locator('[data-in-use=true]')).toHaveCount(2);await photo(page,'08-multiple');await page.locator('[data-user-food-id=review-4]').evaluate(el=>el.scrollIntoView({block:'center'}));await photo(page,'09-row-comparison');
 const search=page.locator('.page-pantry > .search input');await search.fill('酸奶');await expect(count).toHaveText('5 项食材 · 1 个 Family');
 await page.getByRole('tab').first().tap();await expect(count).toHaveText('5 项食材 · 1 个 Family');await search.evaluate(el=>el.scrollIntoView({block:'center'}));await photo(page,'10-search');
 const rowsByWidth=[];
 for(const width of [320,375,390,430]){
  await page.setViewportSize({width,height:844});
  const box=async(el:Locator)=>(await el.boundingBox())!.height;
  const standalone=await box(page.locator('[data-user-food-id=review-4]')),member=await box(family.locator('[data-user-food-id=review-0]'));
  rowsByWidth.push({width,standalone,member});expect(member).toBe(standalone);
  const long=family.locator('[data-user-food-id=review-1] .ingredient-name');
  await expect(long).toHaveCSS('white-space','nowrap');await expect(long).toHaveCSS('text-overflow','ellipsis');
  if(width===320)await photo(page,'21-320-long-name');
 }
 await writeFile(folder+'/row-heights.json',JSON.stringify(rowsByWidth,null,2));
 await page.setViewportSize({width:390,height:844});await family.locator('.family-action-trigger').tap();await family.getByRole('menuitem').tap();
 await expect(chips.locator('[aria-pressed=true]')).toHaveCount(2);await photo(page,'03-edit');
 await chips.getByRole('button',{name:/蛋奶/}).tap();await editor.locator('.recipe-editor-footer .primary').tap();await expect(editor).toHaveCount(0);
 expect(await page.evaluate(async()=>((await (await import('/src/domain.ts')).db.ingredients.get('review-0'))?.tagIds))).toEqual(['breakfast']);
});
test('shared directory nav and two-field sorting',async({page})=>{
 await sample(page);const measures=[];
 for(const route of ['pantry','recipes']){
  await page.goto('/#/'+route);await expect(page.getByRole('tab').first()).toBeVisible();
  for(const width of [320,375,390,430]){
   await page.setViewportSize({width,height:844});measures.push({route,width,...await measure(page)});
  }
  await page.setViewportSize({width:390,height:844});await photo(page,route==='pantry'?'13-pantry-nav':'12-recipes-nav');
  const trigger=page.locator('.pantry-sort-trigger'),menu=page.locator('.pantry-sort-menu');
  for(const [field,dir] of [['name','down'],['name','up'],['calories','up'],['calories','down'],['name','up']]){
   await trigger.tap();await expect(menu.getByRole('menuitemradio')).toHaveCount(2);
   const active=menu.locator('[aria-checked=true]'),inactive=menu.locator('[aria-checked=false]');
   expect(await active.locator('svg').evaluate(e=>getComputedStyle(e).color)).not.toBe(await inactive.locator('svg').evaluate(e=>getComputedStyle(e).color));
   if(field==='name'&&dir==='down')await photo(page,route==='pantry'?'18-sort-name':'20-recipes-sort');
   if(field==='calories'&&dir==='down'&&route==='pantry')await photo(page,'19-sort-calories');
   await menu.locator('[data-sort='+field+']').tap();await expect(trigger.locator('.lucide-arrow-'+dir)).toHaveCount(1);
  }
 }
 await writeFile(folder+'/category-centers.json',JSON.stringify(measures,null,2));
});
test('ordered tags persist on release with edge scrolling and scoped controls',async({page})=>{
 await sample(page);await page.evaluate(async()=>{const {db,stamp}=await import('/src/domain.ts');for(let i=0;i<25;i++)await db.table('ingredientTags').put({...stamp(),name:'早餐 '+(i+1)})});
 const open=()=>page.locator('.collection-navigation > button').tap();await open();
 const list=page.locator('.managed-category-list'),rows=list.locator('[data-category-id]'),first=rows.first(),handle=first.locator('.collection-drag-handle');
 const id=await first.getAttribute('data-category-id');await expect(first.locator('.actions button')).toHaveCount(0);
 await expect(list.locator('[data-category-id=breakfast] .actions button')).toHaveCount(2);await photo(page,'14-manage-tags');
 const r=(await handle.boundingBox())!,s=(await list.boundingBox())!,x=r.x+r.width/2,y=r.y+r.height/2;
 expect(r.width).toBeGreaterThanOrEqual(44);expect(r.height).toBeGreaterThanOrEqual(44);
 await page.mouse.move(x+60,y);await page.mouse.down();await page.mouse.move(x+60,y+50);await expect(list.locator('.is-dragging')).toHaveCount(0);await page.mouse.up();
 await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x,y+80,{steps:6});await expect(list.locator('.is-dragging')).toHaveCount(1);await photo(page,'15-dragging');
 await page.mouse.move(x,s.y+s.height-5,{steps:5});await expect.poll(()=>list.evaluate(el=>el.scrollTop)).toBeGreaterThan(60);await page.mouse.up();
 await expect.poll(()=>rows.evaluateAll((els,id)=>els.findIndex(el=>el.getAttribute('data-category-id')===id),id)).toBeGreaterThan(2);
 const after=await rows.evaluateAll(els=>els.map(el=>el.getAttribute('data-category-id')));expect(after.indexOf(id)).toBeGreaterThan(2);
 await page.locator('.ingredient-tag-manager .modal-head button').tap();await open();await expect.poll(()=>rows.evaluateAll(els=>els.map(el=>el.getAttribute('data-category-id')))).toEqual(after);
});
test('edit ingredient manages several serving units through its draft',async({page})=>{
 await sample(page);const row=page.locator('[data-user-food-id=review-4]');await expect(row.locator('.pantry-unit-options')).toHaveCount(0);
 const edit=()=>row.locator('.ingredient-name').tap();await edit();
 const unit=page.locator('.journal-conversion');
 const editor=page.locator('.ingredient-journal'),section=editor.locator('.journal-serving-units'),save=editor.locator('.form-actions .primary');
 for(const [name,qty,g] of [['块','7','32'],['杯','1','150']]){
  await section.locator('.ingredient-unit-add').tap();await unit.locator('[name=conversionName]').fill(name);
  await unit.locator('[name=conversionQuantity]').fill(qty);await unit.locator('[name=conversionAmount]').fill(g);await unit.locator('[name=conversionAmount]').press('Enter');
 }
 await photo(page,'17-custom-unit');await section.locator('.journal-unit-summary').last().tap();
 await section.locator('.draft-unit-trigger').tap();await editor.getByRole('menuitemradio').filter({hasText:'块'}).tap();
 await photo(page,'16-serving-units');await save.tap();await expect(editor).toHaveCount(0);
 await edit();await expect(section.locator('.draft-unit-trigger')).toContainText('块');await expect(section.locator('.journal-unit-summary')).toHaveCount(2);
 await section.locator('.journal-unit-summary').first().tap();await unit.locator('[name=conversionAmount]').fill('35');await unit.locator('[name=conversionAmount]').press('Enter');
 await section.locator('.journal-unit-summary').last().tap();await unit.locator('.clear-conversion').tap();await page.locator('.delete-destructive').tap();await save.tap();await expect(editor).toHaveCount(0);
 const pref=await page.evaluate(async()=>JSON.parse((await (await import('/src/domain.ts')).db.settings.get('ingredientPreference:review-4'))!.value));
 expect(pref).toMatchObject({units:[{name:'块',quantity:7,amount:35,unit:'g'}],preferred:'块'});
});

for(const lang of ['zh','en'])test('directory geometry and state contrast across all themes in '+lang,async({page})=>{
 test.setTimeout(150000);await sample(page);
 await page.evaluate(async lang=>{
  const {stamp,db}=await import('/src/domain.ts');await db.settings.put({key:'language',value:lang});
  await db.ingredientFamilies.put({...stamp(),id:'geometry',name:'酸奶',alternateName:'Yogurt',memberIds:['review-0','review-1'],inUseIds:['review-0']});
 },lang);
 for(const theme of ['olive','apricot','misty','lavender']){
  await page.evaluate(async theme=>{const {db}=await import('/src/domain.ts');await db.settings.put({key:'theme',value:theme})},theme);
  await page.goto('/#/pantry');await page.reload();await expect(page.locator('html')).toHaveAttribute('lang',new RegExp(lang));
  const family=page.locator('.pantry-family');await family.locator('.family-heading').tap();
  const paint=(el:Locator)=>el.evaluate(node=>getComputedStyle(node,'::before').backgroundColor);
  expect(new Set(await Promise.all([paint(family.locator('.family-parent')),paint(family.locator('[data-in-use=true]')),paint(family.locator('[data-in-use=false]'))])).size).toBe(3);
  for(const width of [320,375,390,430]){
   await page.setViewportSize({width,height:844});await measure(page);
   const a=await page.locator('[data-user-food-id=review-4]').boundingBox(),b=await family.locator('[data-user-food-id=review-0]').boundingBox();
   expect(b!.height).toBe(a!.height);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.goto('/#/recipes');for(const width of [320,375,390,430]){await page.setViewportSize({width,height:844});await measure(page)}
 }
});
