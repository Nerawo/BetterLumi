import {test,expect} from '@playwright/test';

test.use({browserName:'webkit',channel:'',isMobile:true,hasTouch:true,viewport:{width:390,height:844}});
test('full yield, resumed preparation and generated Method context survive backup',async({page})=>{
 test.setTimeout(120000);
 await page.goto('/#/recipes',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.recipe-fab')).toBeVisible();
 const recipe=await page.evaluate(async()=>{
  const d=await import('/src/domain.ts');
  const egg={...d.stamp(),name:'Egg',nameZh:'鸡蛋',brand:'',basis:'100g' as const,servingGrams:null,calories:60,protein:6,carbs:1,fat:4,consumptionUnit:{quantity:1,name:'egg',amount:50,unit:'g' as const}};
  await d.db.ingredients.put(egg);
  await d.db.settings.put({key:'language',value:'zh'});
  const recipe={...d.stamp(),name:'Rice cake',servings:4,instructions:'烤箱180 30分钟\n空气炸锅150 30分钟',stickyNote:'',
   lines:[{ingredientId:egg.id,lineId:'egg',name:egg.name,quantity:1,unit:'egg',nutrition:d.ingredientNutrition(egg,1,'egg')}]};
  await d.recipes.put(recipe);
  return recipe;
 });
 await page.goto('/recipes/'+recipe.id);
 const detail=page.locator('.journal-recipe-detail'),mode=page.locator('.cooking-mode');
 const amount=mode.locator('.journal-serving-stepper input'),quantity=mode.locator('.journal-quantity-trigger');
 await expect(detail.locator('.recipe-serving-stepper input')).toHaveValue('4');
 await detail.locator('.start-cooking').tap();
 await expect(amount).toHaveValue('4');
 await expect(quantity).toHaveText('1');
 const context=(n:number)=>mode.getByText('【完整食谱为'+n+'份】',{exact:true});
 await expect(context(4)).toBeVisible();
 await mode.locator('.journal-method-edit-trigger').tap();
 await expect(mode.locator('textarea')).toHaveValue(recipe.instructions);
 await mode.locator('.journal-method-confirm').tap();
 for(const [n,display] of [[8,'2'],[1,'0.3'],[2,'0.5']] as const){
  await amount.fill(String(n));await amount.press('Enter');await expect(quantity).toHaveText(display);
  await expect.poll(()=>page.evaluate(async id=>JSON.parse((await (await import('/src/domain.ts')).db.settings.get('cooking-session:v1:'+id))!.value).servings,recipe.id)).toBe(n);
 }
 await mode.getByRole('checkbox').check();
 await mode.locator('.modal-head button').tap();
 await detail.locator('.start-cooking').tap();
 await expect(amount).toHaveValue('2');
 await expect(mode.getByRole('checkbox')).toBeChecked();
 await mode.locator('.modal-head button').tap();
 await page.evaluate(async id=>{
  const d=await import('/src/domain.ts');
  const backup=await d.exportAll();await d.restoreAll(backup);
  const recipe=(await d.recipes.get(id))!;
  await d.recipes.update(id,{servings:6,revision:recipe.revision+1});
 },recipe.id);
 await page.reload();
 await detail.locator('.start-cooking').tap();
 await expect(context(6)).toHaveCount(1);await expect(context(4)).toHaveCount(0);
 await expect(amount).toHaveValue('2');
 expect(await page.evaluate(async id=>(await (await import('/src/domain.ts')).recipes.get(id))!.instructions,recipe.id)).toBe(recipe.instructions);
});
