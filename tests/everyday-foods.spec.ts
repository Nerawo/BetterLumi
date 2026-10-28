import {test,expect} from '@playwright/test';
test.use({isMobile:true,hasTouch:true});

for(const language of ['zh','en'])for(const width of [320,375,390,430])test(`everyday names, original sources and mobile food discovery ${language} ${width}`,async({page})=>{
 await page.setViewportSize({width,height:844});await page.goto('/pantry');await expect(page.locator('[data-reference-id]')).toHaveCount(202);
 await page.evaluate(async lang=>{const d=await import('/src/domain.ts');await d.db.settings.put({key:'language',value:lang});await d.db.ingredients.put({...d.stamp(),name:'A very long custom ingredient name that must wrap inside its own column without pushing calories off screen',nameZh:'',brand:'',basis:'100g',servingGrams:null,calories:999.25,protein:12.5,carbs:34.5,fat:2.5})},language);await page.reload();
 const pantry=page.locator('.page-pantry'),search=pantry.locator('> .search input');
 await expect(pantry.locator('[data-reference-id="builtin-gala-apple-raw"] .ingredient-name')).toHaveText(language==='zh'?'苹果':'Apple');
 await page.evaluate(()=>document.fonts.ready.then(()=>undefined));
 const problems=await pantry.locator('.pantry-row').evaluateAll(rows=>rows.flatMap(row=>{
  const name=row.querySelector('h3')!.getBoundingClientRect(),energy=row.querySelector('.ingredient-energy')!.getBoundingClientRect(),bounds=row.getBoundingClientRect();
  return energy.right>innerWidth+1||energy.right>bounds.right+1||name.right>energy.left+1?[{id:row.getAttribute('data-reference-id'),nameRight:name.right,energyLeft:energy.left,energyRight:energy.right,width:innerWidth}]:[];
 }));expect(problems).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 const nav=page.locator('.mobile-nav');await expect(nav).toBeVisible();expect(await nav.evaluate(el=>el.getBoundingClientRect().right)).toBeLessThanOrEqual(width);
 const tabs=pantry.locator('.ingredient-tag-bar');await tabs.getByRole('tab').nth(2).click();await expect(page.locator('[data-reference-id]')).toHaveCount(32);await tabs.getByRole('tab').first().click();
 await search.fill(language==='zh'?'梨':'pear');const pear=pantry.locator('[data-reference-id="betterlumi:food:usda-fdc-746773"]');await expect(pear.locator('.ingredient-name')).toHaveText(language==='zh'?'梨':'Pear');await expect(pear.locator('.pantry-source-line')).not.toContainText('带皮');await pear.locator('.reference-info-trigger').click();
 const source=page.locator('.reference-source-modal');await expect(source).toContainText(/Bartlett/i);await expect(source).toContainText('746773');await expect(source).toContainText('Foundation Foods');await expect(page.locator('.ingredient-management-modal')).toHaveCount(0);await source.locator('.modal-head button').click();await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve())));
 await search.fill(language==='zh'?'米饭':'white rice');const riceRows=pantry.locator('[data-reference-id]');await expect(riceRows.first()).toHaveAttribute('data-reference-id','builtin-white-rice-cooked');await expect(pantry.locator('[data-reference-id="betterlumi:food:usda-fdc-168930"]')).toHaveCount(0);
 await search.fill(language==='zh'?'中粒':'medium grain');await expect(pantry.locator('[data-reference-id="betterlumi:food:usda-fdc-168930"]')).toHaveCount(1);
 await page.goto('/recipes');await page.locator('.recipe-fab').click();const editor=page.locator('.recipe-editor-modal');await editor.locator('[name=name]').fill('Everyday pear recipe');await editor.locator('.ingredient-add-trigger').click();
 const picker=page.locator('.ingredient-picker-modal');await picker.locator('input[type=search]').fill(language==='zh'?'梨':'pear');await expect(picker.locator('[data-reference-id]').first()).toHaveAttribute('data-reference-id','betterlumi:food:usda-fdc-746773');const result=picker.locator('[data-reference-id="betterlumi:food:usda-fdc-746773"]');await result.locator('.reference-info-trigger').click();await expect(page.locator('.reference-source-modal')).toContainText(/Bartlett/i);await expect(editor.locator('.recipe-line')).toHaveCount(0);await page.locator('.reference-source-modal .modal-head button').click();
 expect(await picker.evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(false);await result.locator('.ingredient-picker-result').click();await expect(editor.locator('.recipe-line')).toContainText(language==='zh'?'梨':'Pear');await editor.locator('.recipe-line input').fill('37.5');await editor.locator('.form-actions .primary').click();await expect(editor).toHaveCount(0);
 const recipe=await page.evaluate(async()=>{const d=await import('/src/domain.ts');return(await d.recipes.toArray()).find(r=>r.name==='Everyday pear recipe')!});expect(recipe.lines[0]).toMatchObject({ingredientId:'betterlumi:food:usda-fdc-746773',quantity:37.5,unit:'g'});expect(recipe.lines[0].nutrition.calories).toBe(21.375);
});

test('specialized rice remains editable through historical Meals and Recipes without changing snapshots or preferences',async({page})=>{
 await page.setViewportSize({width:320,height:844});await page.goto('/pantry');await expect(page.locator('[data-reference-id]')).toHaveCount(202);
 const saved=await page.evaluate(async()=>{
  const d=await import('/src/domain.ts'),f=await import('/src/data/builtInFoods.ts'),u=await import('/src/household-units.ts');
  const rice=f.builtInFoods.find(f=>f.fdcIdSnapshot==='168930')!,unit=u.builtInHouseholdUnits(rice.id)[0];
  const preference={version:1,units:[{quantity:1,name:'scoop',amount:177,unit:'g'}],preferred:unit.name,archived:true};
  await d.db.settings.put({key:'ingredientPreference:'+rice.id,value:JSON.stringify(preference)});
  const nutrition={calories:499.125,protein:12.345,carbs:34.567,fat:2.789};
  const line={ingredientId:rice.id,name:rice.nameEn,quantity:.5,unit:unit.name,nutrition};
  const recipe={...d.stamp(),name:'Historical specialized rice',servings:1,lines:[line],instructions:'Keep',stickyNote:''};
  const meal={...d.stamp(),date:d.localDate(),category:'lunch',name:'Historical specialized rice',source:'pantry',sourceId:rice.id,quantity:.5,unit:unit.name,nutrition,baseNutrition:nutrition,consumptionPercent:100,lines:[],cookingNote:''};
  await d.recipes.put(recipe);await d.foodLogs.put(meal);return{recipe,meal,preference,unit:unit.name,foodId:rice.id};
 });
 await page.goto('/today');await page.locator('#today-tab-food').click();await page.locator('.meal-row').filter({hasText:saved.meal.name}).locator('.actions button').first().click();const meal=page.locator('.add-food-modal');await expect(meal.locator('.meal-amounts select')).toHaveValue(saved.unit);await expect(meal.locator('.meal-amounts input').first()).toHaveValue('0.5');await meal.locator('.modal-head button').click();
 await page.goto('/recipes');await page.locator('.recipe-list-row').filter({hasText:saved.recipe.name}).locator('.actions button').first().click();const recipe=page.locator('.recipe-editor-modal');await expect(recipe.locator('.recipe-line select')).toHaveValue(saved.unit);await expect(recipe.locator('.recipe-line input')).toHaveValue('0.5');await recipe.locator('.modal-head button').click();
 const after=await page.evaluate(async ids=>{const d=await import('/src/domain.ts');return{recipe:await d.recipes.get(ids.recipe.id),meal:await d.foodLogs.get(ids.meal.id),preference:JSON.parse((await d.db.settings.get('ingredientPreference:'+ids.foodId))!.value)}},saved);
 expect(after).toEqual({recipe:saved.recipe,meal:saved.meal,preference:saved.preference});
});
