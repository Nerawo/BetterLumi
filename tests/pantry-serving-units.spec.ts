import {expect,test,type Page,type Locator} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

test.use({browserName:'webkit',channel:'',isMobile:true,hasTouch:true,deviceScaleFactor:3,viewport:{width:390,height:844}});
const folder='work/screenshots/pantry-serving-units';
const dairy='betterlumi:ingredient-tag:dairy-eggs';

async function capture(page:Page,name:string,region?:Locator){
 await mkdir(folder,{recursive:true});
 await page.evaluate(()=>document.fonts.ready);
 await (region??page).screenshot({path:folder+'/'+name+'.png',scale:'device'});
}
async function setup(page:Page, withFourMembers=false){
 await page.goto('/#/pantry');
 await expect(page.locator('.pantry-fab')).toBeVisible();
 await page.evaluate(async ({dairy,withFourMembers})=>{
  const {db,stamp}=await import('/src/domain.ts');
  const {saveFamily}=await import('/src/families.ts');
  const make=(id:string,name:string,tagIds:string[])=>({...stamp(),id,name,nameZh:'',brand:id==='cocoa'?'Meiji':'',basis:'100g' as const,
   servingGrams:null,calories:id==='cocoa'?563:73,protein:8,carbs:id==='cocoa'?37:6,fat:id==='cocoa'?40:2,tagIds});
  await db.settings.bulkPut([{key:'language',value:'zh'},{key:'theme',value:'misty'}]);
  await db.table('ingredientTags').put({...stamp(),id:'cacao-tag',name:'可可'});
  const unit={name:'块',quantity:7,amount:32,unit:'g' as const};
  const otherMembers=withFourMembers?[make('tomato','番茄',[]),make('spinach','菠菜',[]),make('strawberry','草莓',[])]:[make('vanilla','香草酸奶',[])];
  await db.ingredients.bulkPut([{...make('cocoa','巧克力',['cacao-tag']),consumptionUnit:unit},...otherMembers]);
  await db.settings.put({key:'ingredientPreference:cocoa',value:JSON.stringify({version:1,preferred:'块',units:[unit],archived:false})});
  await saveFamily({...stamp(),id:'test-family',name:'酸奶',alternateName:'Yogurt',
   memberIds:['cocoa',...otherMembers.map(member=>member.id)],inUseIds:withFourMembers?['cocoa','tomato','spinach']:['cocoa']},[dairy]);
 },{dairy,withFourMembers});
 await page.reload();
 await expect(page.locator('html')).toHaveAttribute('lang','zh');
}

test('a Family tag includes the full Family and counts all four concrete members',async({page})=>{
 await setup(page,true);
 const tag=page.getByRole('tab',{name:/蛋奶/});
 const family=page.locator('[data-family-id=test-family]');
 const toggle=family.getByRole('button',{name:/酸奶/}).first();
 const members=family.locator('.family-child');
 const count=page.locator('.directory-summary-row > span').first();
 await tag.tap();
 await expect(tag).toHaveAttribute('aria-selected','true');
 await expect(toggle).toHaveAttribute('aria-expanded','false');
 await expect(family.locator('.ingredient-energy')).toContainText('4 种');
 await expect(family.locator('.family-summary')).toHaveText('巧克力 · 番茄 · 菠菜');
 await expect(family.locator('.family-parent')).not.toContainText('蛋奶');
 await expect(page.locator('.pantry-list > .pantry-row')).toHaveCount(3);
 await expect(count).toHaveText('7 项食材 · 1 个 Family');
 await toggle.tap();
 await expect(toggle).toHaveAttribute('aria-expanded','true');
 await expect(members.locator('[data-user-food-id]')).toHaveCount(4);
 await expect(members.locator('.ingredient-name')).toHaveText(['巧克力 Meiji','番茄','菠菜','草莓']);
 await expect(count).toHaveText('7 项食材 · 1 个 Family');
 await mkdir(folder,{recursive:true});
 // Keep the phone width while capturing the entire list above the fixed navigation.
 await page.setViewportSize({width:390,height:1225});
 await page.evaluate(async()=>{await document.fonts.ready;window.scrollTo(0,0)});
 await expect(members.last()).toBeInViewport({ratio:1});
 await page.screenshot({path:folder+'/16-dairy-complete-family.png',scale:'device'});
 await page.setViewportSize({width:390,height:844});
 await toggle.tap();
 await expect(members).toHaveCount(0);
 await expect(count).toHaveText('7 项食材 · 1 个 Family');
 // Text search still finds a matching member even though its own tag differs.
 await page.locator('.page-pantry > .search input').fill('巧克力');
 await expect(members.locator('.ingredient-name')).toHaveText(['巧克力 Meiji']);
 await expect(count).toHaveText('1 项食材 · 1 个 Family');
});

test('a member-only tag shows the concrete ingredient without its Family or siblings',async({page})=>{
 await setup(page,true);
 const tag=page.getByRole('tab',{name:'可可',exact:true});
 const list=page.locator('.pantry-list');
 await tag.tap();
 await expect(tag).toHaveAttribute('aria-selected','true');
 await expect(list.locator(':scope > *')).toHaveCount(1);
 await expect(list.locator(':scope > [data-user-food-id=cocoa]')).toContainText('巧克力');
 await expect(list.locator('.pantry-family,[data-user-food-id=tomato],[data-user-food-id=spinach],[data-user-food-id=strawberry]')).toHaveCount(0);
 await expect(page.locator('.directory-summary-row > span').first()).toHaveText('1 项食材');
 await capture(page,'17-cacao-chocolate-only');
 await page.getByRole('tab',{name:'全部',exact:true}).tap();
 await page.locator('.page-pantry > .search input').fill('巧克力');
 await expect(list.locator('.pantry-family [data-user-food-id=cocoa]')).toBeVisible();
});

test('tag identity, tinted header bounds and a single edit entry for concrete ingredients',async({page})=>{
 await setup(page);
 const family=page.locator('[data-family-id=test-family]'),header=family.locator('.family-parent');
 const chocolate=page.locator('[data-user-food-id=cocoa]'),count=page.locator('.directory-summary-row > span').first();
 const tab=(name:string|RegExp)=>page.getByRole('tab',{name});
 const search=page.locator('.page-pantry > .search input');
 await tab(/蛋奶/).tap();
 await expect(header).toBeVisible();
 await expect(header).not.toContainText('蛋奶');
 await expect(header.locator('.family-summary')).toHaveText('巧克力');
 await expect(chocolate).toHaveCount(0);
 await header.scrollIntoViewIfNeeded();
 await capture(page,'01-dairy-family');
 await tab('可可').tap();
 await expect(family).toHaveCount(0);
 await expect(chocolate).toBeVisible();
 await expect(count).toHaveText('1 项食材');
 await capture(page,'02-cacao-concrete');
 await expect(chocolate.locator('.actions button,svg.lucide-pencil')).toHaveCount(0);
 await capture(page,'06-no-pencil',chocolate);
 await chocolate.locator('.macro-summary').tap();
 const ingredient=page.locator('.ingredient-journal');
 await expect(ingredient.locator('[name=name]')).toHaveValue('巧克力');
 await ingredient.locator('.modal-head button').tap();
 await search.fill('巧克力');
 await expect(chocolate).toBeVisible();
 await expect(family).toHaveCount(0);
 await tab('全部').tap();
 await expect(family.locator('[data-user-food-id=cocoa]')).toBeVisible();
 await search.fill('酸奶');
 const toggle=family.locator('.family-heading');
 await expect(toggle).toHaveAttribute('aria-expanded','true');
 await toggle.tap();
 await capture(page,'03-collapsed');
 await toggle.tap();
 const tint=await header.evaluate(row=>{
  const style=getComputedStyle(row,'::before');
  return {horizontal:[style.insetInlineStart,style.insetInlineEnd],vertical:[style.insetBlockStart,style.insetBlockEnd],radius:style.borderRadius,background:style.backgroundColor};
 });
 expect(tint).toMatchObject({horizontal:['-6px','-6px'],vertical:['4px','4px'],radius:'8px'});
 const memberPaint=await family.locator('.family-child').evaluateAll(rows=>rows.map(row=>({
  background:getComputedStyle(row).backgroundColor,rail:getComputedStyle(row,'::before').backgroundColor,
 })));
 expect(new Set(memberPaint.map(p=>p.background)).size).toBe(1);
 expect(tint.background).not.toBe(memberPaint[0].background);
 expect(new Set(memberPaint.map(p=>p.rail)).size).toBe(2);
 await expect(family.locator('.actions button')).toHaveCount(2);
 await capture(page,'04-expanded');
 await capture(page,'05-active-member',family.locator('.family-child[data-in-use=true]'));
 const dot=chocolate.locator('.family-dot');
 await dot.tap();
 await expect(dot).toHaveAttribute('aria-pressed','false');
 await expect(ingredient).toHaveCount(0);
 await expect(toggle).toHaveAttribute('aria-expanded','true');
 await chocolate.locator('.ingredient-name').tap();
 await expect(ingredient.locator('[name=name]')).toHaveValue('巧克力');
});

test('disclosed defaults and relationship editor with safe removal and backup',async({page})=>{
 await setup(page);
 await page.getByRole('tab',{name:'可可'}).tap();
 const open=()=>page.locator('[data-user-food-id=cocoa] .ingredient-name').tap();
 const ingredient=page.locator('.ingredient-journal'),units=ingredient.locator('.journal-serving-units');
 const unit=units.locator('.journal-conversion'),picker=ingredient.getByRole('menu'),confirm=page.locator('.delete-confirmation-modal');
 const defaultRow=units.locator('.serving-unit-default button');
 await open();await units.locator('.ingredient-unit-add').scrollIntoViewIfNeeded();
 await expect(units.locator('.serving-unit-base')).toContainText('克 (g)');
 await expect(units.locator('.serving-unit-base button,.serving-unit-base svg')).toHaveCount(0);
 await expect(defaultRow.locator('svg')).toHaveCount(1);
 const settings=units.locator('.serving-unit-settings');
 const equalColumns=()=>settings.evaluate(element=>{
  const [left,right]=Array.from(element.children);
  const position=(column:Element,selector:string)=>column.querySelector(selector)!.getBoundingClientRect().top;
  return Math.abs(left.getBoundingClientRect().width-right.getBoundingClientRect().width)<1&&
   position(left,'.ingredient-field-label')===position(right,'.ingredient-field-label')&&
   position(left,'.serving-unit-value')===position(right,'.serving-unit-value');
 });
 expect(await equalColumns()).toBe(true);
 const arrow=await defaultRow.locator('svg').boundingBox();
 const column=await defaultRow.boundingBox();
 expect(Math.abs(arrow!.x+arrow!.width-column!.x-column!.width)).toBeLessThanOrEqual(1);
 await capture(page,'18-inline-units-collapsed',units);
 await capture(page,'08-default-disclosure',defaultRow);
 await defaultRow.tap();
 await expect(picker.getByRole('menuitemradio')).toHaveCount(2);
 await expect(picker.getByRole('menuitemradio',{name:'块'})).toHaveAttribute('aria-checked','true');
 const anchor=(await defaultRow.boundingBox())!,menu=(await picker.boundingBox())!;
 expect(menu.y-anchor.y-anchor.height).toBeCloseTo(2,0);
 expect(menu.x).toBeCloseTo(anchor.x,0);
 expect(menu.width).toBeCloseTo(anchor.width,0);
 await capture(page,'09-default-picker');await picker.getByRole('menuitemradio',{name:'克 (g)'}).tap();
 await expect(defaultRow).toContainText('克 (g)');
 const summary=units.locator('.journal-unit-summary').first();
 await expect(summary.locator('svg')).toHaveCount(1);await capture(page,'10-custom-unit-row',summary);
 const rowCenters=await summary.locator(':scope > *').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return r.y+r.height/2}));
 expect(Math.max(...rowCenters)-Math.min(...rowCenters)).toBeLessThan(1);
 await summary.tap();await expect(summary).toHaveAttribute('aria-expanded','true');
 await expect(summary.locator('.lucide-chevron-down')).toBeVisible();
 await expect(page.locator('dialog[open]')).toHaveCount(1);
 await capture(page,'19-inline-unit-expanded',units);
 await capture(page,'12-relation',unit.locator('.serving-unit-equation'));
 await expect(unit.locator('.serving-unit-equation')).toContainText('块=g');
 await expect(unit.locator('[name=conversionQuantity]')).toHaveValue('7');
 await expect(unit.locator('[name=conversionAmount]')).toHaveValue('32');
 const equationFits=()=>unit.locator('.serving-unit-relation').evaluate(el=>{
  const label=el.firstElementChild!.getBoundingClientRect(),equation=el.lastElementChild!;
  const centers=[...equation.children].map(node=>{const r=node.getBoundingClientRect();return r.y+r.height/2});
  return Math.abs(label.y+label.height/2-centers[0])<1&&Math.max(...centers)-Math.min(...centers)<1&&equation.scrollWidth<=equation.clientWidth;
 });
 expect(await equationFits()).toBe(true);
 await page.setViewportSize({width:320,height:844});expect(await equalColumns()).toBe(true);await capture(page,'15-320-relation',units);
 expect(await equationFits()).toBe(true);
 await page.setViewportSize({width:390,height:844});
 await unit.locator('[name=conversionAmount]').fill('33.125');await summary.tap();
 await expect(unit).toHaveCount(0);
 await expect(summary).toContainText('33.125 g');
 await defaultRow.tap();await picker.getByRole('menuitemradio',{name:'块'}).tap();
 await units.locator('.ingredient-unit-add').tap();await expect(unit.locator('[name=conversionName]')).toHaveValue('');
 await expect(unit.locator('[name=conversionQuantity]')).toHaveValue('1');
 await expect(unit.locator('[name=conversionAmount]')).toHaveValue('');
 await expect(page.locator('dialog[open]')).toHaveCount(1);
 await capture(page,'13-add-unit',units);
 await ingredient.locator('.form-actions .primary').tap();await expect(ingredient.getByRole('alert')).toBeVisible();
 await unit.locator('[name=conversionName]').fill('杯');await unit.locator('[name=conversionAmount]').fill('240');
 await unit.locator('[name=conversionAmount]').press('Enter');
 await expect(units.locator('.journal-unit-summary')).toHaveCount(2);
 await ingredient.locator('.form-actions .primary').tap();await expect(ingredient).toHaveCount(0);
 const restore=()=>page.evaluate(async()=>{
  const {exportAll,restoreAll,db}=await import('/src/domain.ts');const backup=await exportAll();
  await restoreAll(JSON.parse(JSON.stringify(backup)));
  return {version:backup.version,preference:JSON.parse((await db.settings.get('ingredientPreference:cocoa'))!.value)};
 });
 expect(await restore()).toMatchObject({version:20,preference:{preferred:'块',units:[{name:'块',quantity:7,amount:33.125},{name:'杯',amount:240}]}});
 await open();await summary.tap();await unit.locator('.clear-conversion').tap();
 await expect(confirm.locator('.delete-warning')).toContainText('默认食用单位将恢复为 克 (g)');
 await capture(page,'14-delete-default');
 await confirm.locator('.delete-dialog-actions button').first().tap();
 await expect(unit).toBeVisible();await unit.locator('.clear-conversion').tap();await confirm.locator('.delete-destructive').tap();
 await expect(unit).toHaveCount(0);await expect(defaultRow).toContainText('克 (g)');
 await units.locator('.ingredient-unit-add').tap();await unit.locator('[name=conversionName]').fill('不保存');
 await unit.locator('[name=conversionAmount]').fill('1');await unit.locator('[name=conversionAmount]').press('Enter');
 await ingredient.locator('.form-actions button').first().tap();await expect(ingredient).toHaveCount(0);
 expect(await restore()).toMatchObject({version:20,preference:{preferred:'块',units:[{name:'块',quantity:7,amount:33.125},{name:'杯',amount:240}]}});
 await open();await summary.tap();await unit.locator('.clear-conversion').tap();await confirm.locator('.delete-destructive').tap();
 await expect(unit).toHaveCount(0);await expect(defaultRow).toContainText('克 (g)');
 await ingredient.locator('.form-actions .primary').tap();await expect(ingredient).toHaveCount(0);
 expect(await restore()).toMatchObject({version:20,preference:{preferred:'g',units:[{name:'杯',amount:240}]}});
});

test('Cooking resolves a saved serving conversion and keeps the amount equivalent',async({page})=>{
 await setup(page);
 await page.evaluate(async()=>{
  const {recipes,stamp}=await import('/src/domain.ts');
  await recipes.put({...stamp(),id:'unit-check-recipe',name:'Chocolate unit check',servings:1,instructions:'Mix',stickyNote:'',
   lines:[{lineId:'chocolate',ingredientId:'cocoa',name:'巧克力',quantity:32,unit:'g',
    nutrition:{calories:180.16,protein:2.56,carbs:11.84,fat:12.8}}]});
 });
 await page.goto('/#/recipes/unit-check-recipe');
 await page.locator('.start-cooking').tap();
 const mode=page.locator('.cooking-mode');
 await mode.locator('.cooking-unit-choice button').tap();
 await mode.getByRole('menuitemradio',{name:'块'}).tap();
 await expect(mode.locator('.cooking-unit-choice')).toHaveText('块');
 await expect(mode.locator('.journal-quantity-trigger')).toHaveText('7');
 await mode.locator('.cooking-unit-choice button').tap();
 await mode.getByRole('menuitemradio',{name:'克',exact:true}).tap();
 await expect(mode.locator('.journal-quantity-trigger')).toHaveText('32');
 await expect(mode.locator('.cooking-unit-choice')).toHaveText('克');
});
