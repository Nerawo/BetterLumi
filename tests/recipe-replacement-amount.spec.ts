import {expect,test} from '@playwright/test';

test.use({browserName:'webkit',channel:'',isMobile:true,hasTouch:true,viewport:{width:390,height:844}});

for(const [from,to,unit,quantity] of [
 ['food','family','mL',120],['food','family','g',75],
 ['family','food','mL',120],['family','food','g',75],
 ['food','food','mL',120],['family','family','mL',120],
 ['food','family','piece',2],['food','incompatible','mL',120],
] as const){
 test(`replace ${from} with ${to} preserving ${quantity} ${unit}`,async({page})=>{
  test.setTimeout(120000);
  await page.goto('/#/recipes',{waitUntil:'domcontentloaded'});
  await expect(page.locator('.recipe-fab')).toBeVisible();
  const original=await page.evaluate(async({from,to,unit,quantity})=>{
   const d=await import('/src/domain.ts');
   const {saveFamily}=await import('/src/families.ts');
   const food=(id:string,referenceUnit:'g'|'mL',calories:number)=>({...d.stamp(),id,name:id,brand:'',basis:'100g' as const,
    referenceUnit,referenceAmount:100,servingGrams:null,calories,protein:5,carbs:10,fat:2});
   const source=food('Original',unit==='mL'?'mL':'g',50);
   const target=food('Replacement',to==='incompatible'?'g':source.referenceUnit,80);
   const other=food('Other unit',target.referenceUnit==='g'?'mL':'g',10);
   await d.db.ingredients.bulkPut([{...source,consumptionUnit:{name:'piece',quantity:1,amount:10,unit:source.referenceUnit}},target,other]);
   for(const [id,member] of [['Source family',source],['Target family',target]] as const){
    await saveFamily({...d.stamp(),id,name:id,alternateName:'',memberIds:[member.id,other.id],inUseIds:[member.id]});
   }
   const base={lineId:'stable',groupId:'group',quantity,unit};
   const line=from==='food'?{...base,ingredientId:source.id,name:source.name,nutrition:d.ingredientNutrition(source,quantity,unit)}:
    {...base,source:'family' as const,familyId:'Source family',name:'Source family',unit:unit as 'g'|'mL'};
   await d.recipes.put({...d.stamp(),id:'replacement',name:'Replacement regression',servings:1,instructions:'',stickyNote:'',
    ingredientGroups:[{id:'group',name:'Mix'}],lines:[line]});
   return line;
  },{from,to,unit,quantity});
  await page.reload({waitUntil:'domcontentloaded'});
  const card=page.locator('.recipe-list-row').filter({hasText:'Replacement regression'});
  const open=()=>card.locator('.actions button').first().tap();
  const editor=page.locator('.journal-recipe-editor'),row=editor.locator('[data-line-id="stable"]');
  const pick=async()=>{await row.locator('.journal-context-menu summary').press('Enter');await row.locator('.ingredient-replace-toggle').first().tap()};
  const picker=page.locator('.ingredient-picker-modal');
  const saved=()=>page.evaluate(async()=>(await (await import('/src/domain.ts')).recipes.get('replacement')).lines[0]);
  await open();await pick();await picker.locator('.modal-head button').tap();
  await expect(row.locator('strong').first()).toHaveText(original.name);
  expect(await saved()).toEqual(original);
  await pick();
  await picker.locator(to==='family'?'[data-family-option="Target family"]':'[data-ingredient-id="Replacement"]').tap();
  const amount=row.locator('.draft-amount input'),measure=row.locator('.draft-amount [data-unit]').first();
  await expect(amount).toHaveValue(String(quantity));await expect(measure).toHaveAttribute('data-unit',unit);
  const save=editor.locator('.recipe-editor-footer .primary');
  if(unit==='piece'){
   await expect(row.locator('.draft-unit-warning')).toBeVisible();await expect(save).toBeDisabled();
   expect(await saved()).toEqual(original);
   await measure.tap();await editor.getByRole('menuitemradio').filter({hasText:/克|^g$/}).tap();
   await expect(amount).toHaveValue(String(quantity));await expect(save).toBeEnabled();return;
  }
  if(to==='incompatible')await expect(row.locator('.draft-unit-warning')).toBeVisible();
  else await expect(editor.locator('.recipe-nutrition-value').first()).toContainText(String(quantity*0.8));
  await save.tap();await expect(editor).toHaveCount(0);
  expect(await saved()).toMatchObject({lineId:'stable',groupId:'group',quantity,unit,...(to==='family'?{source:'family',familyId:'Target family'}:{ingredientId:'Replacement'})});
  await open();await expect(amount).toHaveValue(String(quantity));await expect(measure).toHaveAttribute('data-unit',unit);
  await editor.locator('.modal-head button').tap();
  if(to!=='incompatible'){
   await card.locator('a').first().tap();await page.locator('.start-cooking').tap();
   const cooking=page.locator('.journal-check-row');
   await expect(cooking.locator('.journal-quantity-trigger')).toHaveText(String(quantity));
   await expect(cooking.locator('.cooking-unit-choice')).toHaveText(unit==='mL'?'mL':/克|^g$/);
  }
 });
}
