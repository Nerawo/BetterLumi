import {test,expect} from '@playwright/test';
import {chooseSavedRecipe} from './recipe-picker-helper';

for(const flow of ['quick to B','keep A','A to B','reselect A','A to B to A','cancel'] as const)
test('meal source selection: '+flow,async({page})=>{
 await page.goto('/today');
 await expect(page.locator('.meal-card')).toBeVisible();
 const {meal,recipeId,originalId}=await page.evaluate(async flow=>{
   const d=await import('/src/domain.ts');
   const item={...d.stamp(),name:'Test yogurt',nameZh:'',brand:'',basis:'100g' as const,servingGrams:null,calories:60,protein:8,carbs:4,fat:1};
   await d.db.ingredients.put(item);
   const recipe={...d.stamp(),name:'Test yogurt bowl',servings:1,categoryIds:[],instructions:'',stickyNote:'',
     lines:[{lineId:'yogurt',ingredientId:item.id,name:item.name,quantity:100,unit:'g',nutrition:d.ingredientNutrition(item,100,'g')}]};
   await d.recipes.put(recipe);
   const original={...recipe,...d.stamp(),name:'Original recipe A'};
   await d.recipes.put(original);
   const meal={...d.stamp(),name:'Original quick meal',date:d.localDate(),category:'lunch' as const,source:flow==='quick to B'?'quick' as const:'recipe' as const,
     sourceId:flow==='quick to B'?null:original.id,quantity:1,unit:flow==='quick to B'?'entry':'serving',nutrition:{calories:175,protein:9,carbs:13,fat:7},lines:flow==='quick to B'?[]:[{...original.lines[0],nutrition:{calories:175,protein:9,carbs:13,fat:7}}],cookingNote:''};
   await d.foodLogs.put(meal);
   await d.db.ingredients.update(item.id,{calories:55,protein:7,carbs:3,fat:2});
   return {meal,recipeId:recipe.id,originalId:original.id};
 },flow);
 await page.locator('.meal-row').filter({hasText:'Original quick meal'}).getByRole('button',{name:/编辑|edit/i}).click();
 const editor=page.getByRole('dialog');
 if(flow==='quick to B')await editor.getByRole('button',{name:'已存食谱',exact:true}).click();
 if(['quick to B','A to B','A to B to A','cancel'].includes(flow))await chooseSavedRecipe(editor,recipeId);
 if(flow==='reselect A'||flow==='A to B to A')await chooseSavedRecipe(editor,originalId);
 const expected=flow==='keep A'?meal.nutrition:{calories:55,protein:7,carbs:3,fat:2};
 await expect(editor.locator('.meal-nutrition-preview strong')).toHaveText(Object.values(expected).map((v,i)=>v+(i?' g':' kcal')));
 await editor.getByRole('button',{name:flow==='cancel'?'取消':'保存记录',exact:true}).click();
 await expect(editor).toHaveCount(0);
 const saved=await page.evaluate(async id=>(await import('/src/domain.ts')).foodLogs.get(id),meal.id);
 if(flow==='cancel'){expect(saved).toEqual(meal);return}
 const selectedId=flow==='A to B'||flow==='quick to B'?recipeId:originalId;
 expect(saved).toMatchObject({source:'recipe',sourceId:selectedId,nutrition:expected,...(flow==='keep A'?{}:{baseNutrition:expected}),lines:[{quantity:100,unit:'g',nutrition:expected}]});
});
for(const [width,language] of [[390,'zh'],[430,'en'],[1440,'en']] as const)test(`yield, cooking and independent meal snapshot ${width} ${language}`,async({page})=>{
 await page.setViewportSize({width,height:844});await page.goto('/today');const saved=await page.evaluate(async language=>{const d=await import('/src/domain.ts');await d.db.settings.put({key:'language',value:language});const recipe={...d.stamp(),name:'Synthetic yield recipe',servings:6,lines:[{ingredientId:'test-reference',name:'Synthetic ingredient',quantity:480,unit:'g',nutrition:{calories:1800,protein:60,carbs:300,fat:40}}],instructions:'Cook.',stickyNote:''};await d.recipes.put(recipe);const old={...d.stamp(),date:d.localDate(),category:'lunch',source:'recipe',sourceId:recipe.id,name:'Historical snapshot',quantity:1,unit:'recipe',nutrition:{calories:137,protein:null,carbs:0,fat:4},lines:[],cookingNote:''};await d.foodLogs.put(old);return {recipe,old}},language);
 await page.goto('/recipes/'+saved.recipe.id);const detail=page.locator('.recipe-detail-modal');await expect(detail.locator('.hero-nutrition')).toContainText('300');const input=detail.locator('.recipe-yield-detail input');await input.fill('');await expect(input).toHaveValue('');await input.fill('3');await expect(detail.locator('.detail-ingredients')).toContainText('240');await expect(detail.locator('.hero-nutrition')).toContainText('900');expect(await page.evaluate(async id=>(await (await import('/src/domain.ts')).recipes.get(id)),saved.recipe.id)).toEqual(saved.recipe);
 await detail.locator('.recipe-detail-actions .journal-add-meal').click();const meal=page.locator('.add-food-modal');await expect(meal.locator('[name=consumedServings]')).toHaveValue('1');await meal.locator('[name=consumedServings]').fill('1.5');await expect(meal.locator('.meal-nutrition-preview')).toContainText('450');await meal.locator('.add-food-footer .primary').click();await expect(meal).toHaveCount(0);
 const log=await page.evaluate(async()=>{const d=await import('/src/domain.ts');return (await d.foodLogs.toArray()).find(l=>l.name==='Synthetic yield recipe')});expect(log?.nutrition.calories).toBe(450);expect(log?.lines[0].quantity).toBe(120);
 await page.evaluate(async id=>{const d=await import('/src/domain.ts');await d.recipes.update(id,{servings:2})},saved.recipe.id);await page.reload();expect(await page.evaluate(async id=>(await (await import('/src/domain.ts')).foodLogs.get(id)),saved.old.id)).toEqual(saved.old);expect(await page.evaluate(async id=>(await (await import('/src/domain.ts')).foodLogs.get(id)),log!.id)).toEqual(log);
 await page.goto('/recipes/'+saved.recipe.id);await detail.getByRole('button',{name:language==='zh'?'编辑食谱':'Edit Recipe',exact:true}).click();const editor=page.locator('.recipe-editor-modal');await editor.locator('[name=servings]').fill('');await expect(editor.locator('[name=servings]')).toHaveValue('');await editor.locator('[name=servings]').fill('4');await editor.locator('.recipe-editor-footer .primary').click();await expect(editor).toHaveCount(0);expect(await page.evaluate(async id=>(await (await import('/src/domain.ts')).recipes.get(id))?.servings,saved.recipe.id)).toBe(4);expect(await detail.evaluate(e=>e.scrollWidth>e.clientWidth)).toBe(false);
});
test('servings scale the editable meal ingredients exactly once; manual ingredient edits remain actual amounts',async({page})=>{
 await page.goto('/today');const id=await page.evaluate(async()=>{const d=await import('/src/domain.ts');const ingredient={...d.stamp(),name:'Fictional oats',nameZh:'',brand:'',basis:'100g',servingGrams:null,calories:375,protein:12.5,carbs:62.5,fat:8};await d.db.ingredients.put(ingredient);const recipe={...d.stamp(),name:'Fictional six-serving batch',servings:6,lines:[{ingredientId:ingredient.id,name:ingredient.name,quantity:480,unit:'g',nutrition:{calories:1800,protein:60,carbs:300,fat:38.4}}],instructions:'Cook',stickyNote:''};await d.recipes.put(recipe);return recipe.id});await page.goto('/recipes/'+id);await page.locator('.recipe-detail-actions .journal-add-meal').click();const meal=page.locator('.add-food-modal');await meal.locator('[name=consumedServings]').fill('');await expect(meal.locator('[name=consumedServings]')).toHaveValue('');await meal.locator('[name=consumedServings]').fill('2');await meal.locator('.meal-advanced > summary').click();await expect(meal.locator('.recipe-line input')).toHaveValue('160');await meal.locator('.recipe-line input').fill('80');await meal.locator('.recipe-line input').press('Enter');await expect(meal.locator('.meal-nutrition-preview')).toContainText('300');await meal.getByRole('slider').press('Home');for(let value=0;value<50;value+=5)await meal.getByRole('slider').press('ArrowRight');await expect(meal.locator('.meal-nutrition-preview')).toContainText('150');await meal.locator('.add-food-footer .primary').click();const result=await page.evaluate(async id=>{const d=await import('/src/domain.ts');return {log:(await d.foodLogs.toArray())[0],recipe:await d.recipes.get(id)}},id);expect(result.log.quantity).toBe(2);expect(result.log.lines[0].quantity).toBe(80);expect(result.log.nutrition.calories).toBe(150);expect(result.recipe?.lines[0].quantity).toBe(480);
});
