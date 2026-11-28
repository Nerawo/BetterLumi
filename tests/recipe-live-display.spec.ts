import {expect,test} from '@playwright/test';

test.use({browserName:'webkit',channel:'',isMobile:true,hasTouch:true,viewport:{width:390,height:844}});
test('a pantry rename updates the open template, editor and cooking rows while preserving saved meals',async({page})=>{
 await page.goto('/recipes');await expect(page.locator('.recipe-fab')).toBeVisible();
 const ids=await page.evaluate(async()=>{
   const d=await import('/src/domain.ts');
   const {saveFamily,familyCatalog,familySnapshot}=await import('/src/families.ts');
   const item={...d.stamp(),name:'testq',nameZh:'',brand:'Original brand',basis:'100g' as const,referenceUnit:'g' as const,referenceAmount:100,servingGrams:null,calories:60,protein:8,carbs:4,fat:2};
   await d.db.ingredients.put(item);
   const family={...d.stamp(),name:'牛奶',alternateName:'',memberIds:[item.id],inUseIds:[item.id]};
   await saveFamily(family);
   const concrete={lineId:'concrete',ingredientId:item.id,name:item.name,quantity:100,unit:'g',nutrition:d.ingredientNutrition(item,100,'g')};
   const slot={source:'family' as const,lineId:'slot',familyId:family.id,name:family.name,unit:'g' as const,quantity:100};
   const recipe={...d.stamp(),name:'qqq rename',servings:1,instructions:'',stickyNote:'',lines:[concrete,slot]};
   await d.recipes.put(recipe);
   const snapshot=familySnapshot(slot,{kind:'user',item},familyCatalog([family],[item],{}),'en');
   const meal={...d.stamp(),source:'recipe' as const,sourceId:recipe.id,date:d.localDate(),category:'lunch',name:recipe.name,quantity:1,unit:'serving',nutrition:d.sumNutrition([concrete.nutrition,snapshot.nutrition]),lines:[concrete,snapshot],cookingNote:''};
   await d.foodLogs.put(meal);
   return {item:item.id,family:family.id,recipe:recipe.id,meal};
 });
 await page.goto('/recipes/'+ids.recipe);
 const detail=page.locator('.journal-recipe-detail'),names=detail.locator('.detail-ingredients li strong');
 await expect(names).toHaveText(['testq','牛奶']);
 await page.evaluate(async ids=>{
   const d=await import('/src/domain.ts');await d.db.ingredients.update(ids.item,{name:'test2',brand:'Current brand',calories:75});await d.db.ingredientFamilies.update(ids.family,{name:'鲜奶'});
 },ids);
 await expect(names).toHaveText(['test2','鲜奶']);await expect(detail.locator('.hero-nutrition')).toContainText('150');
 await page.goto('/recipes');
 await page.locator('.recipe-list-row').filter({hasText:'qqq rename'}).locator('.actions button').first().click();
 const editor=page.locator('.recipe-editor-modal');
 await expect(editor.locator('.draft-ingredient-name strong')).toHaveText(['test2','鲜奶']);
 await expect(editor).toContainText('Current brand');await expect(editor).not.toContainText('Original brand');
 await editor.locator('.recipe-editor-footer .primary').tap();await expect(editor).toHaveCount(0);
 await page.evaluate(async()=>{const d=await import('/src/domain.ts');await d.restoreAll(JSON.parse(JSON.stringify(await d.exportAll())))});
 await page.goto('/recipes/'+ids.recipe);await page.reload();await expect(names).toHaveText(['test2','鲜奶']);
 await detail.locator('.start-cooking').tap();
 const cooking=page.locator('.cooking-mode');
 await expect(cooking.getByRole('checkbox',{name:'test2',exact:true})).toBeVisible();
 await expect(cooking.getByRole('checkbox',{name:'鲜奶',exact:true})).toBeVisible();
 expect(await page.evaluate(async id=>{const d=await import('/src/domain.ts');return d.foodLogs.get(id)},ids.meal.id)).toEqual(ids.meal);
 await page.goto('/recipes/'+ids.recipe);
 await page.evaluate(async id=>{const d=await import('/src/domain.ts');await d.db.ingredients.update(id,{deletedAt:new Date().toISOString()})},ids.item);
 await expect(names).toHaveText(['testq','鲜奶']);
});
