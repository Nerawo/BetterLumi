import { test, expect, type Page } from '@playwright/test';
const output='./work/screenshots/';
async function seed(page:Page){
 await page.goto('/recipes');
 return page.evaluate(async()=>{
  const d=await import('/src/domain.ts'),c=await import('/src/categories.ts');
  const breakfast={...d.stamp(),name:'早餐'},dinner={...d.stamp(),name:'晚餐'},quick={...d.stamp(),name:'快速'};await c.categories.bulkPut([breakfast,dinner,quick]);
  const a={...d.stamp(),name:'燕麦',nameZh:'',brand:'',basis:'100g',servingGrams:null,calories:400,protein:10,carbs:70,fat:8},b={...d.stamp(),name:'酸奶',nameZh:'',brand:'',basis:'100g',servingGrams:null,calories:200,protein:20,carbs:10,fat:4};await d.db.ingredients.bulkPut([a,b]);
  const r={...d.stamp(),name:'晨间燕麦',categoryIds:[breakfast.id,'preserved-unknown'],category:'旧分类',servings:2,lines:[{ingredientId:a.id,name:a.name,quantity:100,unit:'g',nutrition:{calories:400,protein:10,carbs:70,fat:8}}],instructions:'原有步骤',stickyNote:'原有便签'};
  await d.recipes.bulkPut([r,{...r,...d.stamp(),name:'晚间餐食',categoryIds:[dinner.id]}]);return {recipe:r,breakfast:breakfast.id,dinner:dinner.id,quick:quick.id,a:a.id,b:b.id};
 });
}
test('detail category chips save multiple changes immediately and filtering stays reactive',async({page})=>{
 await page.setViewportSize({width:390,height:844});const ids=await seed(page);await page.getByRole('tab',{name:'早餐',exact:true}).click();await page.getByRole('link',{name:'晨间燕麦',exact:true}).click();
 const detail=page.locator('.recipe-detail-modal'),picker=detail.locator('.detail-category-row');await expect(picker.locator('.recipe-category-chip')).toHaveText(['早餐']);
 await picker.getByRole('button',{name:'选择分类',exact:true}).click();await picker.getByLabel('晚餐',{exact:true}).check();await expect(picker.getByLabel('晚餐',{exact:true})).toBeChecked();
 await expect(picker.locator('.category-picker-panel')).toBeVisible();await picker.getByLabel('早餐',{exact:true}).uncheck();await picker.getByLabel('快速',{exact:true}).check();
 await expect(picker.locator('.recipe-category-chip')).toHaveCount(2);await expect(page.locator('.recipe-grid .recipe-card')).toHaveCount(0);
 await page.screenshot({path:output+'食谱更新-详情分类-390px.png'});
 await page.keyboard.press('Escape');await expect(picker.locator('.category-picker-panel')).toHaveCount(0);await expect(detail).toBeVisible();
 const saved=await page.evaluate(async id=>{const d=await import('/src/domain.ts');return d.recipes.get(id)},ids.recipe.id);
 expect(saved!.categoryIds).toEqual(expect.arrayContaining([ids.dinner,ids.quick,'preserved-unknown']));expect(saved!.categoryIds).not.toContain(ids.breakfast);expect(saved!.lines).toEqual(ids.recipe.lines);expect(saved!.instructions).toBe('原有步骤');
 await detail.locator('>.modal-head button').click();await page.getByRole('tab',{name:'晚餐',exact:true}).click();await expect(page.locator('.recipe-card')).toHaveCount(2);await page.getByRole('tab',{name:'快速',exact:true}).click();await expect(page.locator('.recipe-card')).toHaveCount(1);
 await page.goto('/recipes/'+ids.recipe.id);await page.reload();await expect(page.locator('.detail-category-row .recipe-category-chip')).toHaveCount(2);
});
for(const width of [390,430])test(`full editorial recipe editor keeps every change after save and reopen at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:844});const ids=await seed(page);await page.goto('/recipes/'+ids.recipe.id);await page.locator('.recipe-detail-modal').getByRole('button',{name:'编辑食谱',exact:true}).click();
 const editor=page.locator('.recipe-editor-modal');await expect(editor).toBeVisible();await expect(editor.locator('.recipe-editor-footer .primary')).toBeInViewport();await page.screenshot({path:output+`食谱更新-编辑器-${width}px.png`});
 await editor.locator('input[name=name]').fill('更新燕麦');await expect(editor.locator('input[name=servings]')).toHaveCount(0);
 await editor.getByRole('button',{name:'选择分类',exact:true}).click();await editor.getByLabel('快速',{exact:true}).check();await editor.getByLabel('早餐',{exact:true}).uncheck();await editor.locator('.category-picker-done').click();
 const image=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=200;canvas.height=120;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#a7b3a2';ctx.fillRect(0,0,200,120);return canvas.toDataURL('image/png')});
 await editor.locator('input[type=file]').setInputFiles({name:'recipe.png',mimeType:'image/png',buffer:Buffer.from(image.split(',')[1],'base64')});await expect(editor.locator('.photo-field img')).toHaveAttribute('src',image);
 await editor.locator('.recipe-line input').fill('80');await editor.locator('.ingredient-replace-toggle').click();await editor.locator('.replace-select').selectOption(ids.b);await expect(editor.locator('.recipe-line')).toContainText('酸奶');
 await expect(editor.locator('.nutrition-strip > div').first()).toContainText('160');
 await editor.locator('textarea[name=instructions]').fill('1. 拌匀\n2. 装碗');await editor.locator('textarea[name=stickyNote]').fill('冷藏后更好吃');
 await editor.locator('.recipe-editor-nutrition').scrollIntoViewIfNeeded();expect(await editor.evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);await expect(editor.locator('.recipe-editor-footer .primary')).toBeInViewport();await page.screenshot({path:output+`食谱更新-编辑器内容-${width}px.png`});
 await editor.locator('.recipe-editor-footer .primary').click();await expect(editor).toHaveCount(0);await expect(page.locator('.recipe-detail-modal > .modal-head h2')).toHaveText('更新燕麦');
 await page.reload();await page.locator('.recipe-detail-modal').getByRole('button',{name:'编辑食谱',exact:true}).click();await expect(editor.locator('input[name=name]')).toHaveValue('更新燕麦');await expect(editor.locator('.recipe-line input')).toHaveValue('80');await expect(editor.locator('input[name=servings]')).toHaveCount(0);await expect(editor.locator('textarea[name=instructions]')).toHaveValue('1. 拌匀\n2. 装碗');await expect(editor.locator('textarea[name=stickyNote]')).toHaveValue('冷藏后更好吃');await expect(editor.locator('.photo-field img')).toHaveAttribute('src',image);
 await editor.getByRole('button',{name:'选择分类',exact:true}).click();await expect(editor.getByLabel('快速',{exact:true})).toBeChecked();await expect(editor.getByLabel('早餐',{exact:true})).not.toBeChecked();await page.keyboard.press('Escape');await expect(editor).toBeVisible();
 const saved=await page.evaluate(async id=>{const d=await import('/src/domain.ts');return d.recipes.get(id)},ids.recipe.id);expect(saved!.categoryIds).toEqual(['preserved-unknown',ids.quick]);expect(saved!.lines[0].ingredientId).toBe(ids.b);expect(saved!.category).toBe('旧分类');expect(saved!.lines[0].nutrition.calories).toBe(160);
});
