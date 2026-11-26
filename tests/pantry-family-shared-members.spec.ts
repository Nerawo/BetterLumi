import {expect,test,type Locator,type Page} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

const screenshots='work/screenshots/pantry-family-shared';
const referenceShots='work/screenshots/pantry-family-reference';
const dairy='betterlumi:ingredient-tag:dairy-eggs';
test.use({browserName:'webkit',channel:'',isMobile:true,hasTouch:true,deviceScaleFactor:3,viewport:{width:390,height:844}});

async function capture(page:Page,name:string,element?:Locator){
 await mkdir(screenshots,{recursive:true});
 await page.evaluate(()=>document.fonts.ready);
 await (element??page).screenshot({path:`${screenshots}/${name}.png`,scale:'device'});
}

async function seed(page:Page,language:'zh'|'en'='zh',includeFamily=false){
 await page.goto('/#/pantry');
 await expect(page.locator('.pantry-fab')).toBeVisible();
 await page.evaluate(async({language,includeFamily,dairy})=>{
  const {db,stamp}=await import('/src/domain.ts');
  const {saveFamily}=await import('/src/families.ts');
  await db.settings.bulkPut([{key:'theme',value:'misty'},{key:'language',value:language}]);
  await db.table('ingredientTags').put({...stamp(),id:'shared-protein',name:'高蛋白'});
  const ingredient=(id:string,name:string,brand:string,calories:number,tagIds:string[]=[])=>({
   ...stamp(),id,name,nameZh:'',brand,basis:'100g' as const,servingGrams:null,calories,protein:8,carbs:5,fat:3,tagIds
  });
  await db.ingredients.bulkPut([
   ingredient('shared-fage','Fage 0% Greek Yogurt','',59,['shared-protein']),
   ingredient('shared-chobani','Chobani Whole Milk Greek Yogurt Naturally Strained Unsweetened','Chobani Dairy',88),
   ingredient('shared-egg','鸡蛋 Egg','',148)
  ]);
  if(includeFamily)await saveFamily({...stamp(),id:'shared-yogurt',name:language==='zh'?'酸奶':'Yogurt',alternateName:language==='zh'?'Yogurt':'酸奶',
   memberIds:['shared-fage','shared-chobani'],inUseIds:['shared-fage']},[dairy]);
 },{language,includeFamily,dairy});
 await page.reload();
 await expect(page.locator('html')).toHaveAttribute('lang',language);
}

test('shared membership works through the picker, pantry, independent In Use, removal and Family deletion',async({page})=>{
 test.setTimeout(120000);
 await seed(page);
 const editor=page.locator('.family-editor'),picker=page.locator('.family-member-picker');
 const list=page.locator('.pantry-list'),search=page.locator('.page-pantry > .search input');
 const tag=(name:string|RegExp)=>page.getByRole('tab',{name});
 const count=page.locator('.directory-summary-row > span').first();
 const family=(name:string)=>list.locator('.pantry-family').filter({has:page.getByRole('button',{name,exact:true})});
 const yogurt=family('酸奶'),breakfast=family('早餐');
 const fage='[data-user-food-id=shared-fage]';
 const member=(group:Locator)=>group.locator(fage);
 const dot=(group:Locator)=>member(group).locator('.family-dot');
 const save=async()=>{await editor.locator('.recipe-editor-footer .primary').tap();await expect(editor).toHaveCount(0)};
 const add=async(id:string,query:string)=>{
  await editor.locator('.family-add-member').tap();
  await picker.getByRole('searchbox').fill(query);
  await picker.locator('[data-member-option='+id+']').tap();
 };
 const create=async(name:string)=>{
  await page.locator('.pantry-fab').tap();await page.locator('.family-create-action').tap();
  await editor.locator('[name=familyName]').fill(name);
 };
 const edit=async(group:Locator)=>{
  await group.locator('.family-action-trigger').tap();
  await group.getByRole('menuitem').tap();
 };

 await create('酸奶');
 await editor.getByRole('button',{name:/蛋奶/}).tap();
 await add('shared-fage','Fage');
 await add('shared-chobani','Chobani');
 await editor.locator('.family-member-editor').filter({hasText:'Fage'}).locator('.family-dot').tap();
 await save();

 await create('早餐');
 await add('shared-fage','Fage');
 await add('shared-egg','Egg');
 await editor.locator('.family-add-member').tap();
 await picker.getByRole('searchbox').fill('Fage');
 await expect(picker.locator('[data-member-option=shared-fage]')).toHaveCount(0);
 await picker.locator('.modal-head button').tap();
 await save();

 await search.fill('Fage');
 await expect(yogurt.locator('.family-heading')).toHaveAttribute('aria-expanded','true');
 await expect(breakfast.locator('.family-heading')).toHaveAttribute('aria-expanded','true');
 await expect(list.locator(fage)).toHaveCount(2);
 await expect(list.locator(':scope > '+fage)).toHaveCount(0);
 await expect(count).toHaveText('1 项食材 · 2 个 Family');
 await expect(dot(yogurt)).toHaveAttribute('aria-pressed','true');
 await expect(dot(breakfast)).toHaveAttribute('aria-pressed','false');
 await capture(page,'07-different-in-use');
 await dot(breakfast).tap();
 await expect(dot(breakfast)).toHaveAttribute('aria-pressed','true');
 await expect(dot(yogurt)).toHaveAttribute('aria-pressed','true');
 await capture(page,'06-shared-member-two-families');
 await dot(yogurt).tap();
 await expect(dot(yogurt)).toHaveAttribute('aria-pressed','false');
 await expect(dot(breakfast)).toHaveAttribute('aria-pressed','true');

 await search.fill('');
 await tag('高蛋白').tap();
 await expect(list.locator(':scope > '+fage)).toBeVisible();
 await expect(list.locator('.pantry-family')).toHaveCount(0);
 await expect(count).toHaveText('1 项食材');
 await capture(page,'09-member-only-tag');

 await tag(/蛋奶/).tap();
 await expect(breakfast).toHaveCount(0);
 await expect(yogurt.locator('.family-heading')).toHaveAttribute('aria-expanded','false');
 await expect(count).toHaveText('5 项食材 · 1 个 Family');
 await expect(yogurt.locator('.family-parent')).not.toContainText('蛋奶');
 await page.setViewportSize({width:390,height:1090});
 await page.evaluate(()=>window.scrollTo(0,0));
 await capture(page,'01-family-before-ingredients');
 await yogurt.locator('.family-heading').tap();
 await expect(yogurt.locator('.family-child')).toHaveCount(2);
 await expect(member(yogurt)).toBeVisible();
 await expect(yogurt.locator('[data-user-food-id=shared-chobani]')).toBeVisible();
 await expect(count).toHaveText('5 项食材 · 1 个 Family');
 await capture(page,'08-dairy-full-family');
 await capture(page,'02-expanded-no-in-use',yogurt);
 await dot(yogurt).tap();
 await expect(dot(yogurt)).toHaveAttribute('aria-pressed','true');
 await expect(member(yogurt)).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
 await capture(page,'03-expanded-one-in-use',yogurt);
 await capture(page,'05-hierarchy-rail',yogurt.locator('.family-children'));
 await dot(yogurt).tap();
 await expect(dot(yogurt)).toHaveAttribute('aria-pressed','false');
 const chobani=yogurt.locator('[data-user-food-id=shared-chobani] .family-dot');
 await chobani.tap();
 await expect(chobani).toHaveAttribute('aria-pressed','true');
 await capture(page,'12-full-hierarchy');
 await dot(yogurt).tap();
 await expect(yogurt.locator('.family-dot[aria-pressed=true]')).toHaveCount(2);
 await capture(page,'04-expanded-multiple-in-use',yogurt);

 await edit(yogurt);
 await editor.locator('.family-member-editor').filter({hasText:'Fage'}).getByRole('button',{name:/移除/}).tap();
 await save();
 await expect(yogurt.locator(fage)).toHaveCount(0);
 await tag('全部').tap();
 await search.fill('Fage');
 await expect(breakfast.locator(fage)).toBeVisible();
 await expect(dot(breakfast)).toHaveAttribute('aria-pressed','true');
 await expect(yogurt).toHaveCount(0);
 await search.fill('');
 await tag(/蛋奶/).tap();
 await edit(yogurt);
 await editor.locator('.family-delete').tap();
 await page.locator('.delete-destructive').tap();
 await expect(editor).toHaveCount(0);
 await expect(yogurt).toHaveCount(0);
 await tag('高蛋白').tap();
 await expect(list.locator(':scope > '+fage)).toContainText('高蛋白');
 await tag('全部').tap();
 await search.fill('Fage');
 await expect(breakfast.locator(fage)).toBeVisible();
 await expect(dot(breakfast)).toHaveAttribute('aria-pressed','true');
 await expect(count).toHaveText('1 项食材 · 1 个 Family');
});

test('Pantry sorts Families first in every direction, including tagged and searched results',async({page})=>{
 test.setTimeout(60000);
 await page.goto('/#/pantry');
 await page.evaluate(async()=>{
  const {db,stamp}=await import('/src/domain.ts');
  const {saveFamily}=await import('/src/families.ts');
  const tag='sort-test-tag';
  const item=(id:string,name:string,calories:number,tagIds:string[]=[])=>({...stamp(),id,name,nameZh:'',brand:'',
   basis:'100g' as const,servingGrams:null,calories,protein:1,carbs:1,fat:1,tagIds});
  await db.settings.put({key:'language',value:'en'});
  await db.table('ingredientTags').put({...stamp(),id:tag,name:'Test Produce'});
  await db.ingredients.bulkPut([
   item('sort-shared','Shared Orchard QA',200),item('sort-second','Second Orchard QA',3),
   item('sort-bravo','Bravo Orchard QA',90,[tag]),item('sort-exact','Orchard QA',10,[tag]),
  ]);
  await saveFamily({...stamp(),id:'sort-zulu',name:'Zulu Orchard QA',alternateName:'',
   memberIds:['sort-shared','sort-second'],inUseIds:['sort-second']},[tag]);
  await saveFamily({...stamp(),id:'sort-alpha',name:'Alpha Orchard QA',alternateName:'',
   memberIds:['sort-shared'],inUseIds:['sort-shared']},[tag]);
 });
 await page.reload();
 await expect(page.locator('html')).toHaveAttribute('lang','en');
 const list=page.locator('.pantry-list');
 const rows=list.locator(':scope > :is([data-family-id],[data-user-food-id^=sort-])');
 const ids=()=>rows.evaluateAll(nodes=>nodes.map(row=>row.getAttribute('data-family-id')??row.getAttribute('data-user-food-id')));
 const sortButton=page.locator('.pantry-sort-trigger');
 const sortBy=async(field:'name'|'calories',direction:'up'|'down')=>{
  const label=field==='name'?'Name':'Calories';
  const requested=new RegExp(`${label} ${direction==='up'?'↑':'↓'}$`);
  for(let attempt=0;attempt<2&&!requested.test((await sortButton.getAttribute('aria-label'))!);attempt++){
   await sortButton.tap();await page.locator(`[data-sort=${field}]`).tap();
  }
  await expect(sortButton).toHaveAttribute('aria-label',requested);
 };
 const orders=[
  ['name','up',['sort-alpha','sort-zulu','sort-bravo','sort-exact']],
  ['name','down',['sort-zulu','sort-alpha','sort-exact','sort-bravo']],
  ['calories','up',['sort-alpha','sort-zulu','sort-exact','sort-bravo']],
  ['calories','down',['sort-alpha','sort-zulu','sort-bravo','sort-exact']],
 ] as const;
 const verifyOrder=async()=>{
  for(const [field,direction,order] of orders){
   await sortBy(field,direction);
   await expect.poll(ids).toEqual(order);
   await expect(list.locator(':scope > .pantry-row ~ .pantry-family')).toHaveCount(0);
  }
 };
 await verifyOrder();
 await page.getByRole('tab',{name:'Test Produce',exact:true}).tap();
 await expect(list.locator(':scope > *')).toHaveCount(4);
 for(const heading of await list.locator('.family-heading').all())await heading.tap();
 await verifyOrder();
 const search=page.locator('.page-pantry > .search input');
 await search.fill('Orchard QA');
 await verifyOrder();
 await page.getByRole('tab',{name:'All',exact:true}).tap();
 await verifyOrder();
 await expect(list.locator('[data-user-food-id=sort-shared]')).toHaveCount(2);
 await expect(list.locator(':scope > [data-user-food-id=sort-shared]')).toHaveCount(0);
 await expect(list.locator('[data-family-id=sort-zulu] .family-child .ingredient-name')).toHaveText(['Shared Orchard QA','Second Orchard QA']);
 await expect(list.locator('[data-family-id=sort-alpha] .family-child .ingredient-name')).toHaveText(['Shared Orchard QA']);
 await expect(page.locator('.directory-summary-row > span').first()).toHaveText('4 ingredients · 2 Families');
});

test('Family reference comparison at 390px with four members and a shared ingredient',async({page})=>{
 await page.goto('/#/pantry');
 await expect(page.locator('.pantry-fab')).toBeVisible();
 await page.evaluate(async dairy=>{
  const {db,stamp}=await import('/src/domain.ts');
  const {saveFamily}=await import('/src/families.ts');
  const chocolate={...stamp(),id:'reference-chocolate',name:'巧克力',nameZh:'',brand:'Meiji',basis:'100g' as const,
   referenceUnit:'g' as const,servingGrams:null,calories:563,protein:9.4,carbs:53.1,fat:37.5};
  await db.settings.bulkPut([{key:'language',value:'zh'},{key:'theme',value:'lavender'}]);
  await db.ingredients.put(chocolate);
  await saveFamily({...stamp(),id:'reference-yogurt',name:'酸奶',alternateName:'',
   memberIds:[chocolate.id,'builtin-roma-tomato-raw','builtin-spinach-raw','builtin-strawberry-raw'],inUseIds:[chocolate.id]},[dairy]);
  await saveFamily({...stamp(),id:'reference-breakfast',name:'早餐',alternateName:'',memberIds:[chocolate.id],inUseIds:[]});
 },dairy);
 await page.reload();
 await expect(page.locator('html')).toHaveAttribute('lang','zh');
 await mkdir(referenceShots,{recursive:true});
 const shot=async(name:string)=>{
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:`${referenceShots}/${name}.png`,scale:'device'});
 };
 const family=page.locator('[data-family-id=reference-yogurt]');
 const heading=family.locator('.family-heading');
 const members=family.locator('.family-child');
 await page.getByRole('tab',{name:/蛋奶/}).tap();
 await expect(family.locator('.ingredient-energy')).toContainText('4 种');
 await expect(heading).toHaveAttribute('aria-expanded','false');
 await expect(page.locator('.pantry-list > :first-child')).toHaveAttribute('data-family-id','reference-yogurt');
 await expect(family.locator('xpath=following-sibling::*[1]')).toHaveClass(/pantry-row/);
 await shot('01-390-collapsed-before-ingredients');
 await heading.tap();
 await expect(members).toHaveCount(4);
 await members.last().evaluate(row=>{
  const footerTop=Math.min(...['.mobile-nav','.pantry-fab'].map(selector=>document.querySelector(selector)!.getBoundingClientRect().top));
  window.scrollBy({top:Math.max(0,row.getBoundingClientRect().bottom-footerTop+8),behavior:'instant'});
 });
 await expect(members.last()).toBeInViewport({ratio:1});
 await expect(family.locator('.family-dot[aria-pressed=true]')).toHaveCount(1);
 await shot('02-390-expanded-family');
 await members.nth(1).locator('.family-dot').tap();
 await expect(family.locator('.family-dot[aria-pressed=true]')).toHaveCount(2);
 await expect(family.locator('.family-summary')).toHaveText(/巧克力 · (罗马)?番茄/);
 await shot('03-390-expanded-multiple-in-use');
 await page.getByRole('tab',{name:'全部',exact:true}).tap();
 await page.locator('.page-pantry > .search input').fill('巧克力');
 const chocolate=page.locator('[data-user-food-id=reference-chocolate]');
 await expect(chocolate).toHaveCount(2);
 await expect(family.locator('.family-dot')).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('[data-family-id=reference-breakfast] .family-dot')).toHaveAttribute('aria-pressed','false');
 await expect(page.locator('.directory-summary-row > span').first()).toHaveText('1 项食材 · 2 个 Family');
 await page.locator('.page-pantry > .search input').blur();
 await page.evaluate(()=>window.scrollTo(0,0));
 await shot('04-390-shared-ingredient');
});

for(const language of ['zh','en'] as const)test('Family hierarchy stays aligned at all four widths and themes in '+language,async({page})=>{
 await seed(page,language,true);
 await page.getByRole('tab',{name:/蛋奶|Dairy/}).tap();
 const family=page.locator('[data-family-id=shared-yogurt]'),header=family.locator('.family-parent');
 const list=page.locator('.pantry-list'),standalone=list.locator(':scope > .pantry-row').first();
 const inactive=family.locator('.family-child[data-in-use=false]'),active=family.locator('.family-child[data-in-use=true]');
 await family.locator('.family-heading').tap();
 await expect(inactive).toBeVisible();
 for(const theme of ['olive','apricot','misty','lavender']){
  await page.evaluate(async theme=>(await import('/src/themes.ts')).applyTheme(theme),theme);
  for(const width of [320,375,390,430]){
   await page.setViewportSize({width,height:844});
   const bounds=await Promise.all([header,standalone,active.locator('.pantry-row'),inactive.locator('.pantry-row')].map(el=>el.boundingBox()));
   const [parent,plain,selected,unselected]=bounds.map(rect=>rect!);
   expect(parent.x).toBe(plain.x);expect(parent.width).toBe(plain.width);
   expect(selected.x-parent.x).toBe(16);
   expect(selected.x+selected.width).toBe(parent.x+parent.width);
   expect(selected.height).toBe(plain.height);expect(unselected.height).toBe(selected.height);
   const energy=await Promise.all([standalone,active,inactive].map(row=>row.locator('.ingredient-energy').boundingBox()));
   expect(energy.map(box=>box!.x+box!.width)).toEqual(Array(3).fill(energy[0]!.x+energy[0]!.width));
   const markers=await family.locator('.family-child').evaluateAll(rows=>rows.map(row=>{
    const rail=getComputedStyle(row,'::before'),dot=row.querySelector('.family-dot')!;
    return {background:getComputedStyle(row.querySelector('.pantry-row')!).backgroundColor,width:rail.width,color:rail.backgroundColor,dotColor:getComputedStyle(dot).color,hit:dot.getBoundingClientRect().height,hitWidth:dot.getBoundingClientRect().width};
   }));
   expect(markers.map(marker=>marker.background)).toEqual(['rgba(0, 0, 0, 0)','rgba(0, 0, 0, 0)']);
   expect(markers[0].color).not.toBe(markers[0].dotColor);
   expect(markers[0].color).not.toBe(markers[1].color);
   expect(markers.map(marker=>marker.width)).toEqual(['1px','1px']);
   expect(markers.every(marker=>marker.hit>=44&&marker.hitWidth>=44)).toBe(true);
   const name=inactive.locator('.ingredient-name');
   await expect(name).toHaveCSS('white-space','nowrap');await expect(name).toHaveCSS('text-overflow','ellipsis');
   if(width===320){
    expect(await name.evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(true);
    if(language==='zh'&&theme==='misty')await capture(page,'10-320px-ellipsis',family);
   }
   if(language==='zh'&&width===390)await capture(page,'11-theme-'+theme,family);
  }
 }
});
