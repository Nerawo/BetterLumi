import {test,expect,type Locator} from '@playwright/test';
import {mkdirSync} from 'node:fs';
test.use({isMobile:true,hasTouch:true,viewport:{width:390,height:844}});
const folder='work/screenshots/recipe-journal-final';

for(const mode of ['create','edit'])for(const language of ['zh','en'])test('touch editing, grouping and draft identity '+mode+' '+language,async({page,context})=>{
  test.setTimeout(90000);page.setDefaultTimeout(12000);
  await page.goto('/recipes');
  const recipe=await page.evaluate(async ({language,mode})=>{
    const d=await import('/src/domain.ts');
    await d.db.settings.put({key:'language',value:language});
    const lines=[];
    for(const [i,name] of ['胡萝卜 · Carrot','菠菜 · Spinach','Milk','Cream'].entries()){
      const item={...d.stamp(),name,brand:'Garden',basis:'100g',servingGrams:null,consumptionUnit:{quantity:1,name:'scoop',unit:'g',amount:20},calories:40,protein:1,carbs:3,fat:2};
      await d.db.ingredients.put(item);
      lines.push({lineId:'line-'+i,ingredientId:item.id,name,quantity:100,unit:'g',nutrition:{calories:40,protein:1,carbs:3,fat:2}});
    }
    const recipe={...d.stamp(),name:'蔬菜浓汤 · Garden soup',servings:2,lines,instructions:'Simmer gently.',stickyNote:''};
    if(mode==='edit')await d.recipes.put(recipe);return recipe;
  },{language,mode});
  await page.reload();
  const editor=page.locator('.journal-recipe-editor'),section=editor.locator('.journal-group-editor');
  let ids:string[]=[];
  const open=async()=>{
    if(mode==='edit')await page.locator('.recipe-list-row').filter({hasText:recipe.name}).locator('.actions button').first().tap();
    else{
      await page.locator('.recipe-fab').tap();await editor.locator('[name=name]').fill(recipe.name);
      for(const line of recipe.lines){
        await editor.locator('.ingredient-add-trigger').tap();
        await page.locator('[data-ingredient-id="'+line.ingredientId+'"]').tap();
      }
    }
    ids=await editor.locator('[data-line-id]').evaluateAll(rows=>rows.map(row=>row.getAttribute('data-line-id')!));
  };
  await open();
  const shell=(i:number)=>editor.locator('[data-line-id="'+ids[i]+'"]');
  const client=await context.newCDPSession(page);
  const touch=(type:'touchStart'|'touchMove'|'touchEnd',x=0,y=0)=>client.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y}]});
  const point=async(el:Locator)=>{const box=(await el.boundingBox())!;return {x:box.x+box.width/2,y:box.y+box.height/2}};
  const shot=async(name:string,target:Locator=section)=>{if(mode==='edit'&&language==='zh'){mkdirSync(folder,{recursive:true});await target.screenshot({path:folder+'/'+name+'.png',scale:'css'})}};
  const scroll=editor.locator('.recipe-editor-scroll');
  const anchor=async()=>scroll.evaluate(el=>{const top=el.querySelector('.journal-group-editor')!.getBoundingClientRect().top-el.getBoundingClientRect().top;el.scrollTop+=top-40});
  await anchor();await shot('touch-flat');
  const drag=async(i:number,to:Locator,capture?:string)=>{
    await anchor();const a=await point(shell(i).locator('.draft-grip')),b=await point(to);
    await touch('touchStart',a.x,a.y);await touch('touchMove',a.x,a.y+10);await touch('touchMove',b.x,b.y+3);
    await expect(section.locator('[data-insertion]')).toHaveCount(1);
    if(capture)await shot(capture,editor);
    await touch('touchEnd');
  };
  await drag(0,shell(1),'touch-drag');await expect(section.locator('.draft-ingredient-name strong').first()).toHaveText(recipe.lines[1].name);
  const group=async(name:string)=>{await editor.locator('.journal-add-group').tap();const input=editor.locator('.journal-group-edit input');await input.fill(name);await input.press('Enter');return section.locator('[data-group-id]').filter({has:page.getByRole('heading',{name,exact:true})})};
  await editor.locator('.draft-group-switch').tap();await expect(editor.locator('.draft-group-switch')).toHaveAttribute('aria-pressed','true');const A=await group('蔬菜'),B=await group('调味');
  await drag(1,A.locator('.ingredient-add-trigger'),'touch-cross-group-drag');await drag(0,A.locator('.ingredient-add-trigger'));
  await drag(1,shell(0));await expect(A.locator('.draft-ingredient-name strong')).toHaveText([recipe.lines[0].name,recipe.lines[1].name]);
  await drag(1,B.locator('.ingredient-add-trigger'));await expect(B.locator('.draft-row-shell')).toHaveCount(1);
  await drag(0,section.locator('[data-group-id=""] .ingredient-add-trigger'));await expect(A.locator('.draft-row-shell')).toHaveCount(0);
  await anchor();await shot('touch-grouped');
  const name=shell(0).locator('.draft-ingredient-name');
  const swipe=async(i:number)=>{await anchor();const p=await point(shell(i).locator('.draft-ingredient-name'));await touch('touchStart',p.x,p.y);await touch('touchMove',p.x-26,p.y+1);if(i===0)await shot('swipe-partial',shell(i));await touch('touchMove',p.x-60,p.y+2);await touch('touchEnd');await expect(shell(i).locator('.draft-remove')).toBeVisible()};
  await swipe(0);await shot('touch-swipe-delete');
  const revealedBounds=(await shell(0).boundingBox())!,identityBounds=(await name.boundingBox())!;
  const deleteBounds=(await shell(0).locator('.draft-remove').boundingBox())!,amountBounds=(await shell(0).locator('.draft-amount').boundingBox())!;
  expect(identityBounds.x).toBeGreaterThanOrEqual(revealedBounds.x);
  expect(amountBounds.x+amountBounds.width).toBeLessThanOrEqual(deleteBounds.x);
  expect(deleteBounds.height).toBeCloseTo(revealedBounds.height);expect(deleteBounds.width).toBe(78);
  await swipe(2);await expect(shell(0).locator('.draft-remove:visible')).toHaveCount(0);
  await editor.locator('.draft-heading-row h3').first().tap();await expect(editor.locator('.draft-remove:visible')).toHaveCount(0);
  const dialog=page.locator('.draft-confirmation');
  await swipe(2);await shell(2).locator('.draft-remove').tap();await dialog.locator('.secondary').tap();await expect(shell(2)).toHaveCount(1);
  await swipe(2);await shell(2).locator('.draft-remove').tap();await dialog.locator('.primary').tap();await expect(shell(2)).toHaveCount(0);
  await anchor();const before=await scroll.evaluate(el=>el.scrollTop);let p=await point(name);await touch('touchStart',p.x,p.y);
  for(let dy=12;dy<=72;dy+=12)await touch('touchMove',p.x+1,p.y-dy);
  await touch('touchEnd');await expect.poll(()=>scroll.evaluate(el=>el.scrollTop)).toBeGreaterThan(before);await expect(page.locator('.ingredient-picker-modal')).toHaveCount(0);
  await expect(editor.locator('.draft-remove:visible')).toHaveCount(0);
  await expect(dialog).toHaveCount(0);
  const hold=async()=>{
    const identity=shell(0).locator('.draft-ingredient-name strong');await identity.scrollIntoViewIfNeeded();p=await point(identity);expect(await identity.evaluate((el,pos)=>el.contains(document.elementFromPoint(pos.x,pos.y)),p)).toBe(true);await touch('touchStart',p.x,p.y);
    await expect(dialog).toBeVisible();await touch('touchEnd');
    await expect(dialog.locator('p')).toContainText(recipe.lines[0].name);
    await expect(page.locator('.ingredient-picker-modal')).toHaveCount(0);
  };
  const replace=async()=>{await hold();await dialog.locator('.primary').tap();await expect(dialog).toHaveCount(0);await expect(page.locator('.ingredient-picker-modal')).toBeVisible()};
  for(const dismiss of ['.secondary','.modal-head button']){
    await hold();await shot('replace-confirmation',dialog);await dialog.locator(dismiss).tap();
    await expect(dialog).toHaveCount(0);await expect(page.locator('.ingredient-picker-modal')).toHaveCount(0);
    await expect(name).toContainText(recipe.lines[0].name);
  }
  await replace();await shot('touch-replace',page.locator('.ingredient-picker-modal'));await page.locator('.ingredient-picker-modal .modal-head button').tap();
  await replace();await page.locator('[data-ingredient-id="'+recipe.lines[3].ingredientId+'"]').tap();await expect(name).toContainText('Cream');
  await shell(0).locator('.draft-unit-trigger').tap();const select=editor.locator('.draft-unit-menu');await expect(select).toBeVisible();await shot('touch-unit',editor);
  await page.keyboard.press('Escape');await expect(shell(0).locator('.draft-unit-trigger')).toContainText(/克|g/);
  await shell(0).locator('.draft-unit-trigger').tap();await select.locator('[data-unit=scoop]').tap();await expect(shell(0).locator('.draft-unit-trigger')).toHaveText('scoop');
  const input=shell(0).locator('.draft-amount input'),height=(await shell(0).boundingBox())!.height;
  await input.tap();await input.fill('32.125');await shot('touch-quantity',section);await input.press('Enter');
  expect((await shell(0).boundingBox())!.height).toBe(height);
  await editor.locator('.recipe-editor-footer button').first().tap();
  const savedRecipes=()=>page.evaluate(async(name)=>(await (await import('/src/domain.ts')).recipes.toArray()).filter(r=>r.name===name),recipe.name);
  expect(await savedRecipes()).toEqual(mode==='edit'?[recipe]:[]);
  await open();await editor.locator('.draft-group-switch').tap();const kept=await group('Sauce');
  await drag(0,kept.locator('.ingredient-add-trigger'));await drag(1,kept.locator('.ingredient-add-trigger'));await drag(0,shell(1));
  const id=await kept.getAttribute('data-group-id');
  await replace();await page.locator('[data-ingredient-id="'+recipe.lines[3].ingredientId+'"]').tap();
  await editor.locator('.recipe-editor-footer .primary').tap();await expect(editor).toHaveCount(0);
  const recipes=await savedRecipes();expect(recipes).toHaveLength(1);
  expect(recipes[0].lines.filter(l=>l.groupId===id).map(l=>l.lineId)).toEqual([ids[1],ids[0]]);
  expect(recipes[0].lines.find(l=>l.lineId===ids[0])?.ingredientId).toBe(recipe.lines[3].ingredientId);
});


test.describe('fine pointer and keyboard',()=>{
 test.use({hasTouch:false,isMobile:false,viewport:{width:430,height:844}});
 test('desktop menu offers the same draft operations',async({page})=>{
   await page.goto('/recipes');await page.locator('.recipe-fab').click();
   const editor=page.locator('.journal-recipe-editor');
   await editor.locator('.ingredient-add-trigger').click();await page.locator('.ingredient-picker-result').first().click();
   await editor.locator('.draft-group-switch').click();
   const row=editor.locator('.draft-row-shell'),menu=row.locator('details');
   await expect(menu.locator('summary')).toBeVisible();
   await row.locator('.draft-grip').press('Enter');
   await expect(menu).toHaveAttribute('open','');
   await expect(menu.locator('[data-panel=group]')).toBeVisible();
   await expect(menu.locator('.ingredient-replace-toggle')).toBeVisible();
   await expect(menu.locator('.draft-delete')).toBeVisible();
   mkdirSync(folder,{recursive:true});await menu.locator(':scope > div').screenshot({path:folder+'/desktop-fallback.png',scale:'css'});
   await page.keyboard.press('Escape');await expect(menu).not.toHaveAttribute('open','');
 });
});
