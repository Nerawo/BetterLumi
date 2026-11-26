import {test,expect} from '@playwright/test';

test('Recipe picker includes a tagged Family and its members, while a member-only tag or name can find the concrete product',async({page})=>{
 await page.goto('/#/recipes');await expect(page.locator('.recipe-fab')).toBeVisible();
 await page.evaluate(async()=>{
  const {db,stamp}=await import('/src/domain.ts'),{saveFamily}=await import('/src/families.ts');
  await db.table('ingredientTags').bulkPut(['Family tag','Member tag'].map(name=>({...stamp(),id:name,name})));
  const member=(id:string,tagIds:string[])=>({...stamp(),id,name:id,nameZh:'',brand:'',basis:'100g' as const,servingGrams:null,calories:50,protein:2,carbs:1,fat:1,tagIds});
  await db.ingredients.bulkPut([member('Member Alpha',['Member tag']),member('Member Beta',[])]);
  await saveFamily({...stamp(),id:'fixture-family',name:'Yogurt Family',alternateName:'',memberIds:['Member Alpha','Member Beta'],inUseIds:[]},['Family tag']);
 });
 await page.locator('.recipe-fab').click();await page.locator('.ingredient-add-trigger').click();
 const picker=page.locator('.ingredient-picker-modal'),family=picker.locator('[data-family-option="fixture-family"]');
 await picker.getByRole('tab',{name:'Family tag',exact:true}).click();
 await expect(family).toBeVisible();await expect(picker.locator('[data-ingredient-id]')).toHaveCount(2);
 await picker.getByRole('searchbox').fill('Member Beta');
 await expect(family).toBeVisible();await expect(picker.locator('[data-ingredient-id]')).toHaveCount(1);
 await picker.getByRole('searchbox').fill('');
 await picker.getByRole('tab',{name:'Member tag',exact:true}).click();
 await expect(family).toHaveCount(0);await expect(picker.locator('[data-ingredient-id]')).toHaveCount(1);
 await expect(picker.locator('[data-ingredient-id="Member Alpha"]')).toBeVisible();
 await picker.getByRole('tab').first().click();await picker.getByRole('searchbox').fill('Member Beta');
 await expect(picker.locator('[data-ingredient-id="Member Beta"]')).toBeVisible();
});
