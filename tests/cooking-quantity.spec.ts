import {test,expect} from '@playwright/test';
test.use({browserName:'webkit',channel:'',isMobile:true,hasTouch:true});
for(const width of [320,375,390,430])for(const language of ['zh','en'])test(`session quantity ${width} ${language}`,async({page})=>{
 await page.setViewportSize({width,height:844});await page.goto('/recipes');await expect(page.locator('.recipe-fab')).toBeVisible();
 const id=await page.evaluate(async language=>{
  const d=await import('/src/domain.ts'),{FoodStorage}=await import('/src/food-storage.ts'),{storedRecipeLine}=await import('/src/recipe-storage.ts');await d.db.settings.put({key:'language',value:language});
  const milk={lineId:'milk',ingredientId:'milk',name:'豆奶 Soy milk',quantity:130.125,unit:'mL',nutrition:{calories:56.123456,protein:4,carbs:5,fat:2}};
  const batchId=d.stamp().id;await new FoodStorage().makeBatch({operationId:d.stamp().id,id:batchId,name:'Prepared sauce',preparedOn:d.localDate(),cookedYieldGrams:400,ingredients:[{source:'pantry',line:{...milk,unit:'g'}}]});
  const r={...d.stamp(),name:'Session quantity journal',servings:2,lines:[milk,{...milk,lineId:'milk-again'}, {...storedRecipeLine((await d.db.foodBatches.get(batchId))!),lineId:'sauce'}],instructions:'1. Stir gently.\n保持原始做法。',stickyNote:''};await d.recipes.put(r);return r.id;
 },language);await page.reload();await page.locator('.recipe-list-row').filter({hasText:'Session quantity journal'}).locator('h3 a').click();await expect(page.locator('.journal-recipe-detail .detail-ingredients > li span').first()).toContainText('65');await page.locator('.start-cooking').click();const mode=page.locator('.cooking-mode'),rows=mode.locator('.journal-check-row'),first=rows.first();await expect(rows).toHaveCount(3);
 expect(await first.locator('.journal-line-name').evaluate(e=>getComputedStyle(e).fontFamily)).toContain('JournalHand');expect(await first.evaluate(e=>e.getBoundingClientRect().height)).toBeLessThanOrEqual(76);
 await expect(mode.locator('.journal-quantity-restore')).toHaveCount(0);
 const expectAmount=async(row:typeof first,value:string)=>{
  await expect(row.locator('.journal-quantity-trigger')).toHaveText(value);
  await expect(row.locator('.cooking-unit-choice')).toHaveText('mL');
 };
 const before=await page.evaluate(async()=>{const b=await(await import('/src/domain.ts')).exportAll();delete b.tables.settings;return b.tables});
 const edit=first.locator('.journal-quantity-edit'),trigger=first.locator('.journal-quantity-trigger');
 await trigger.click();await edit.locator('input').fill('150.125');await edit.locator('input').press('Escape');await expect(trigger).toContainText('130');
 await trigger.click();await edit.locator('input').fill('');await edit.locator('input').press('Enter');await expectAmount(first,'130');await expect(first.locator('.journal-quantity-restore')).toHaveCount(0);await trigger.tap();await edit.locator('input').fill('-1');await edit.locator('input').press('Enter');await expectAmount(first,'130');await expect(first.locator('.journal-quantity-restore')).toHaveCount(0);await trigger.tap();await edit.locator('input').fill('150.125');
 if(width===390&&language==='zh'){await page.evaluate(()=>document.fonts.ready);await mode.screenshot({path:'work/screenshots/cooking-quantity-edit-390.png'})}
 await edit.locator('input').press('Enter');await expectAmount(first,'150');await expect(first.locator('.journal-quantity')).toHaveClass(/is-overridden/);await expect(trigger).toBeEnabled();await expect(trigger).not.toContainText('*');await expect(first.locator('.journal-quantity-restore')).toHaveCount(1);await trigger.click();await expect(edit.locator('input')).toHaveValue('150.1');await edit.locator('input').press('Escape');
 await rows.nth(1).locator('.journal-quantity-trigger').click();await rows.nth(1).locator('.journal-quantity-edit input').fill('0');await rows.nth(1).locator('.journal-quantity-edit input').press('Enter');await expectAmount(rows.nth(1),'0');await expect(rows.nth(1).locator('.journal-quantity-restore')).toHaveCount(1);
 await first.locator('input[type=checkbox]').check();await expect(first.locator('input[type=checkbox]')).toBeEnabled();
 await mode.locator('.journal-reset').click();await page.locator('.journal-reset-confirm .primary').click();await expect(first.locator('input[type=checkbox]')).not.toBeChecked();await expectAmount(first,'130');await trigger.click();await edit.locator('input').fill('150.125');await edit.locator('input').press('Enter');
 await first.locator('input[type=checkbox]').check();await expect(first.locator('input[type=checkbox]')).toBeEnabled();await first.locator('.journal-quantity-restore').click();await expect(trigger).toContainText('130');await expect(first.locator('.journal-quantity-restore')).toHaveCount(0);await expect(first.locator('input[type=checkbox]')).toBeChecked();
 await trigger.click();await edit.locator('input').fill('150.125');await edit.locator('input').press('Enter');await expect(trigger).toBeEnabled();
 await mode.locator('.modal-head button').click();await page.locator('.start-cooking').click();await expectAmount(first,'130');await expect(first.locator('input[type=checkbox]')).not.toBeChecked();await page.reload();await page.locator('.start-cooking').click();await expectAmount(first,'130');await trigger.click();await edit.locator('input').fill('150.125');await edit.locator('input').press('Enter');await first.locator('input[type=checkbox]').check();await expect(first.locator('input[type=checkbox]')).toBeEnabled();
 const serving=mode.locator('.journal-session-controls input');page.once('dialog',d=>d.dismiss());await serving.fill('4');await serving.blur();await expect(serving).toHaveValue('2');await expectAmount(first,'150');await expect(first.locator('input[type=checkbox]')).toBeChecked();
 for(const theme of ['misty','apricot','lavender','olive']){await page.evaluate(async theme=>(await import('/src/themes.ts')).applyTheme(theme),theme);expect(await mode.evaluate(e=>e.scrollWidth>e.clientWidth)).toBe(false)}
 if(width===390&&language==='zh')await mode.screenshot({path:'work/screenshots/cooking-quantity-saved-390.png'});
 await trigger.click();await expect(edit.locator('input')).toHaveValue('150.1');await page.setViewportSize({width,height:460});await edit.locator('input').focus();await expect(edit.locator('input')).toBeInViewport();await expect(edit.locator('button')).toHaveCount(0);await edit.locator('input').press('Escape');await expect(edit).toHaveCount(0);await page.setViewportSize({width,height:844});
 page.once('dialog',d=>d.accept());await serving.fill('4');await serving.blur();await expect(serving).toHaveValue('4');await expect(mode.locator('.is-overridden')).toHaveCount(0);await expect(mode.locator('input[type=checkbox]:checked')).toHaveCount(0);await expect(trigger).toContainText('260');
 // Restore affects only settings; even mixed stored-food ingredients cause no inventory writes.
 expect(await page.evaluate(async()=>{const b=await(await import('/src/domain.ts')).exportAll();delete b.tables.settings;return b.tables})).toEqual(before);
 expect(await page.evaluate(async id=>(await(await import('/src/domain.ts')).recipes.get(id))!.lines[0].quantity,id)).toBe(130.125);
});
