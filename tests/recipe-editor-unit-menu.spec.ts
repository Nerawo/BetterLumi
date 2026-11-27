import {expect,test} from '@playwright/test';

test.use({browserName:'webkit',channel:'',isMobile:true,hasTouch:true,viewport:{width:390,height:844}});
const captures='work/screenshots/recipe-unit-validation';

for(const mode of ['create','edit'])for(const language of ['zh','en']){
  test(`ingredient-specific unit menu, ${mode}, ${language}`,async({page})=>{
    test.setTimeout(100000);
    await page.goto('/recipes');
    const fixture=await page.evaluate(async({mode,language})=>{
      const d=await import('/src/domain.ts');
      await d.db.settings.put({key:'language',value:language});
      const base={...d.stamp(),name:'巧克力 · Chocolate',brand:'Meiji',basis:'100g' as const,
        referenceAmount:32,referenceUnit:'g' as const,servingGrams:null,calories:160,protein:2,carbs:18,fat:9};
      const chocolate={...base,consumptionUnit:{quantity:7,name:'块',amount:32,unit:'g' as const}};
      const flour={...base,...d.stamp(),name:'面粉 · Flour',brand:'',referenceAmount:100};
      const milk={...flour,...d.stamp(),name:'牛奶 · Milk',referenceUnit:'mL' as const};
      const foods=[chocolate,flour,milk];
      await d.db.ingredients.bulkPut(foods);
      const lines=foods.map(food=>({lineId:d.stamp().id,ingredientId:food.id,name:food.name,quantity:food.referenceAmount,
        unit:food.referenceUnit,nutrition:d.ingredientNutrition(food,food.referenceAmount,food.referenceUnit)}));
      const recipe={...d.stamp(),name:'巧克力面糊 · Chocolate batter',servings:1,instructions:'',stickyNote:'',lines};
      if(mode==='edit')await d.recipes.put(recipe);
      return recipe;
    },{mode,language});
    await page.reload();
    const editor=page.locator('.journal-recipe-editor');
    const open=async()=>{
      if(mode==='edit')await page.locator('.recipe-list-row').filter({hasText:fixture.name}).locator('.actions button').first().tap();
      else{
        await page.locator('.recipe-fab').tap();
        await editor.locator('[name=name]').fill(fixture.name);
        for(const food of fixture.lines){
          await editor.locator('.ingredient-add-trigger').tap();
          await page.locator('[data-ingredient-id="'+food.ingredientId+'"]').tap();
        }
      }
    };
    await open();
    const rows=editor.locator('.draft-row-shell'),unit=rows.first().locator('.draft-unit-trigger'),menu=editor.getByRole('menu');
    for(const [index,id] of ['g','mL'].entries()){
      const row=rows.nth(index+1),fixed=row.locator('span.draft-unit-text');
      await expect(fixed).toHaveAttribute('data-unit',id);
      await expect(row.locator('.draft-unit-trigger')).toHaveCount(0);
      await fixed.tap();await expect(menu).toHaveCount(0);
      await row.locator('input').fill('50.5');await row.locator('input').press('Enter');
      await expect(row.locator('input')).toHaveValue('50.5');
    }
    for(const [width,theme] of [[320,'misty'],[375,'apricot'],[390,'lavender'],[430,'olive']] as const){
      await page.setViewportSize({width,height:490});
      await page.evaluate(async theme=>(await import('/src/themes.ts')).applyTheme(theme),theme);
      await unit.evaluate(el=>{
        const scroll=el.closest('.recipe-editor-scroll')!;
        scroll.scrollTop+=el.getBoundingClientRect().bottom-scroll.getBoundingClientRect().bottom+8;
      });
      await unit.tap();
      const choices=menu.getByRole('menuitemradio');
      await expect(choices).toHaveCount(2);
      await expect(choices.first()).toHaveAttribute('data-unit','g');
      await expect(choices.last()).toHaveAttribute('data-unit','块');
      await expect(choices.first()).toHaveAttribute('aria-checked','true');
      await expect(menu).not.toContainText('✓');
      await expect(menu.locator('select,svg')).toHaveCount(0);
      const [first,second]=await choices.evaluateAll(els=>els.map(el=>el.getBoundingClientRect().toJSON()));
      expect(first.x).toBe(second.x);expect(second.y).toBeGreaterThanOrEqual(first.bottom);
      expect(first.height).toBeGreaterThanOrEqual(44);
      const box=(await menu.boundingBox())!,anchor=(await unit.boundingBox())!,modal=(await editor.boundingBox())!;
      expect(box.y+box.height).toBeLessThanOrEqual(anchor.y+1);
      expect(box.x).toBeGreaterThanOrEqual(modal.x);expect(box.x+box.width).toBeLessThanOrEqual(modal.x+modal.width);
      const colors=await choices.evaluateAll(els=>els.map(el=>[getComputedStyle(el).color,getComputedStyle(el).backgroundColor]));
      expect(colors[0][0]).not.toBe(colors[1][0]);expect(colors[0][1]).not.toBe(colors[1][1]);
      await page.keyboard.press('ArrowDown');await expect(choices.last()).toBeFocused();
      await page.keyboard.press('Escape');await expect(unit).toBeFocused();
      await unit.tap();await editor.locator('.modal-head h2').tap();
      await expect(menu).toHaveCount(0);await expect(unit).toHaveAttribute('data-unit','g');
    }
    await page.setViewportSize({width:390,height:844});
    await page.evaluate(async()=>(await import('/src/themes.ts')).applyTheme('lavender'));
    const convert=async()=>{await unit.tap();await menu.locator('[data-unit="块"]').tap();await expect(rows.first().locator('input')).toHaveValue('7')};
    await convert();
    await rows.first().locator('input').fill('3');await rows.first().locator('input').press('Enter');
    await unit.tap();await menu.locator('[data-unit=g]').tap();
    expect(await rows.first().locator('input').inputValue()).toBe('13.7');
    const amountBounds=(await rows.first().locator('.draft-amount').boundingBox())!;
    const unitBounds=(await unit.boundingBox())!;
    expect(unitBounds.width).toBeGreaterThan(0);
    expect(unitBounds.x+unitBounds.width).toBeLessThanOrEqual(amountBounds.x+amountBounds.width+1);
    await rows.first().locator('input').fill('32');await rows.first().locator('input').press('Enter');
    await convert();await unit.tap();
    const selected=menu.getByRole('menuitemradio',{checked:true});
    await expect(selected).toHaveText('块');
    if(language==='zh'){
      await page.evaluate(()=>document.fonts.ready);
      await editor.screenshot({path:captures+'/'+mode+'.png',scale:'css'});
      if(mode==='edit'){
        await menu.screenshot({path:captures+'/selected.png',scale:'css'});
        await page.screenshot({path:captures+'/vertical.png',scale:'css'});
      }
    }
    await page.keyboard.press('Escape');
    if(language==='zh'&&mode==='edit')await rows.nth(1).screenshot({path:captures+'/single.png',scale:'css'});
    await editor.locator('.recipe-editor-footer button').first().tap();
    const read=()=>page.evaluate(async()=>(await import('/src/domain.ts')).recipes.toArray());
    expect(await read()).toEqual(mode==='edit'?[fixture]:[]);
    await open();await convert();
    await editor.locator('.recipe-editor-footer .primary').tap();await expect(editor).toHaveCount(0);
    const [saved]=await read();expect(saved.lines[0]).toMatchObject({unit:'块',quantity:7,nutrition:fixture.lines[0].nutrition});
    if(mode==='edit')expect(saved.lines[0].lineId).toBe(fixture.lines[0].lineId);
  });
}

test('legacy unsupported unit stays intact until explicitly replaced in the draft',async({page})=>{
  await page.goto('/recipes');
  const original=await page.evaluate(async()=>{
    const d=await import('/src/domain.ts');
    const item={...d.stamp(),name:'Flour',brand:'',basis:'100g' as const,servingGrams:null,calories:350,protein:10,carbs:72,fat:1};
    await d.db.ingredients.put(item);
    const line={lineId:d.stamp().id,ingredientId:item.id,name:item.name,quantity:4,unit:'mL',nutrition:d.unknownNutrition()};
    const recipe={...d.stamp(),name:'Legacy',servings:1,lines:[line],instructions:'',stickyNote:''};
    await d.recipes.put(recipe);return recipe;
  });
  await page.reload();
  const edit=page.locator('.recipe-list-row .actions button').first(),editor=page.locator('.journal-recipe-editor');
  await edit.tap();await expect(editor.locator('.draft-unit-warning')).toContainText('mL');
  await expect(editor.locator('.draft-unit-trigger')).toHaveText('mL');
  await editor.locator('.recipe-editor-footer .primary').tap();await expect(editor).toHaveCount(0);
  const read=()=>page.evaluate(async id=>(await (await import('/src/domain.ts')).recipes.get(id))!.lines,original.id);
  expect(await read()).toEqual(original.lines);
  await edit.tap();await editor.locator('.draft-unit-warning button').tap();
  await page.locator('[data-ingredient-id="'+original.lines[0].ingredientId+'"]').tap();
  await expect(editor.locator('.draft-unit-warning')).toBeVisible();
  await editor.locator('.draft-unit-trigger').tap();await editor.getByRole('menuitemradio').tap();
  await expect(editor.locator('.draft-unit-warning')).toHaveCount(0);await expect(editor.locator('.draft-unit-text')).toHaveAttribute('data-unit','g');
  await editor.locator('.recipe-editor-footer button').first().tap();expect(await read()).toEqual(original.lines);
});
