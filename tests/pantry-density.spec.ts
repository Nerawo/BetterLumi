import {expect,test} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

test.use({browserName:'webkit',channel:'',isMobile:true,hasTouch:true,deviceScaleFactor:3,viewport:{width:390,height:844}});

test('Pantry uses one density for standalone and nested ingredients and retains touch targets',async({page})=>{
 const folder='work/screenshots/family-density';
 await mkdir(folder,{recursive:true});
 await page.goto('/#/pantry');
 await expect(page.locator('.pantry-fab')).toBeVisible();
 await page.evaluate(async()=>{
  const {db,stamp}=await import('/src/domain.ts');
  const {saveFamily}=await import('/src/families.ts');
  const names=['巧克力','番茄','菠菜','草莓','杏仁','燕麦','全脂牛奶','鸡蛋','原味全脂希腊酸奶','苹果','胡萝卜','蓝莓','西兰花','小麦'];
  const tag='density-review';
  await db.settings.bulkPut([{key:'language',value:'zh'},{key:'theme',value:'lavender'}]);
  await db.table('ingredientTags').put({...stamp(),id:tag,name:'密度对照'});
  const items=names.map((name,index)=>({...stamp(),id:'density-'+index,name,nameZh:'',brand:index===0?'Meiji':'',basis:'100g' as const,
   servingGrams:null,calories:[563,19,22,33][index]??100+index*5,protein:8,carbs:5,fat:3,tagIds:[tag]}));
  await db.ingredients.bulkPut(items);
  await saveFamily({...stamp(),id:'density-family',name:'酸奶',alternateName:'',memberIds:items.slice(0,4).map(item=>item.id),inUseIds:['density-0','density-1']},[tag]);
 });
 await page.reload();
 const list=page.locator('.pantry-list'),family=list.locator('.pantry-family'),heading=family.locator('.family-heading');
 const standalone=list.locator(':scope > .pantry-row'),member=family.locator('.family-child .pantry-row');
 await page.getByRole('tab',{name:'密度对照',exact:true}).tap();
 await expect(standalone).toHaveCount(10);
 await expect(heading).toHaveAttribute('aria-expanded','false');
 await page.evaluate(()=>document.fonts.ready);
 await page.screenshot({path:`${folder}/05-pantry-after.png`,scale:'device'});
 console.log(`Pantry standalone row at 390px: ${(await standalone.first().boundingBox())!.height} CSS px`);
 await heading.tap();await expect(member).toHaveCount(4);
 await member.last().evaluate(row=>{
  const bottom=document.querySelector('.pantry-fab')!.getBoundingClientRect().top;
  window.scrollBy({top:Math.max(0,row.getBoundingClientRect().bottom-bottom+80),behavior:'instant'});
 });
 await page.screenshot({path:`${folder}/06-pantry-expanded-and-standalone.png`,scale:'device'});
 for(const width of [320,375,390,430]){
  await page.setViewportSize({width,height:844});
  const plain=(await standalone.first().boundingBox())!,nested=(await member.first().boundingBox())!;
  expect(nested.height).toBe(plain.height);
  const dot=(await member.first().locator('.family-dot').boundingBox())!;
  expect(dot.width).toBeGreaterThanOrEqual(44);expect(dot.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
 await standalone.last().scrollIntoViewIfNeeded();
 await expect(standalone.last()).toBeInViewport();
});
