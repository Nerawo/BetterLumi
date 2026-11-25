import {test,expect} from '@playwright/test';
test.use({browserName:'webkit',channel:'',hasTouch:true,isMobile:true});
 for(const width of [320,375,390,430])test('handle auto-scroll and Escape cancel '+width,async({page})=>{
   await page.setViewportSize({width,height:740});await page.goto('/recipes');
   await page.evaluate(async()=>{
     const d=await import('/src/domain.ts');
     const lines=Array.from({length:24},(_,i)=>({lineId:'line-'+i,ingredientId:'source-'+i,name:'Ingredient '+i+' · 长名称',unit:'g',quantity:10,nutrition:{calories:5,protein:0,carbs:1,fat:0}}));
     await d.recipes.put({...d.stamp(),name:'Scroll test',servings:1,lines,instructions:'',stickyNote:''});
   });
   await page.locator('.recipe-list-row').filter({hasText:'Scroll test'}).locator('.actions button').first().tap();
   const editor=page.locator('.journal-recipe-editor'),body=editor.locator('.recipe-editor-scroll'),grip=editor.locator('.draft-grip').first();
   await grip.scrollIntoViewIfNeeded();const origin=await body.evaluate(el=>el.scrollTop);
   const a=(await grip.boundingBox())!,bounds=(await body.boundingBox())!;
   await page.mouse.move(a.x+10,a.y+10);await page.mouse.down();await page.mouse.move(a.x+10,bounds.y+bounds.height-12,{steps:12});
   await expect.poll(()=>body.evaluate(el=>el.scrollTop)).toBeGreaterThan(origin+50);
   await page.keyboard.press('Escape');await page.mouse.up();
   await expect(editor.locator('[data-insertion]')).toHaveCount(0);
   expect(await editor.locator('.draft-row-shell').evaluateAll(rows=>rows.map(r=>r.getAttribute('data-line-id')))).toEqual(Array.from({length:24},(_,i)=>'line-'+i));
 });

test('holding brand metadata asks before replacing an ingredient in WebKit',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/recipes');
  await page.evaluate(async()=>{
    const d=await import('/src/domain.ts');
    await d.db.ingredients.put({...d.stamp(),name:'巧克力',brand:'Meiji',basis:'100g',servingGrams:null,calories:50,protein:1,carbs:5,fat:2});
  });
  await page.locator('.recipe-fab').tap();
  await page.locator('.ingredient-add-trigger').tap();
  const picker=page.locator('.ingredient-picker-modal');
  await picker.locator('.ingredient-picker-result').filter({hasText:'Meiji'}).tap();
  const metadata=page.locator('.draft-source').filter({hasText:'Meiji'});
  const pointer={pointerType:'touch',pointerId:11,isPrimary:true,button:0};
  await metadata.dispatchEvent('pointerdown',pointer);
  const confirm=page.locator('.draft-confirmation');
  await expect(confirm).toBeVisible();
  await metadata.dispatchEvent('pointerup',pointer);
  await expect(confirm.locator('p')).toContainText('巧克力');
  await expect(picker).toHaveCount(0);
  await confirm.locator('.primary').tap();
  await expect(confirm).toHaveCount(0);
  await expect(picker).toBeVisible();
  await picker.locator('.modal-head button').tap();
  await expect(metadata).toBeVisible();
});
