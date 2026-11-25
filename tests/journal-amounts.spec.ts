import {expect,test} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';

test.use({browserName:'webkit',channel:'',isMobile:true,hasTouch:true});
test('journal amount ink, focus geometry and lossless confirmation',async({page})=>{
  const folder='work/screenshots/journal-amounts';
  await mkdir(folder,{recursive:true});
  await page.setViewportSize({width:390,height:844});
  await page.goto('/recipes');
  const fixture=await page.evaluate(async()=>{
    const d=await import('/src/domain.ts');
    const amounts=[1,10,25,400/6,150.5,0.7*28];
    const units=['块','g','g','g','mL','g'];
    const names=['巧克力','白糖','黄油','燕麦','牛奶','可可粉'];
    const lines=[];
    for(const [index,quantity] of amounts.entries()){
      const unit=units[index];
      const item={...d.stamp(),name:names[index],brand:'',basis:'100g' as const,referenceAmount:100,
        referenceUnit:unit==='mL'?'mL' as const:'g' as const,servingGrams:null,calories:100,carbs:10,protein:2,fat:3,
        ...(index===0?{consumptionUnit:{quantity:1,name:'块',amount:10,unit:'g' as const}}:{})};
      await d.db.ingredients.put(item);
      lines.push({lineId:item.id,ingredientId:item.id,name:item.name,quantity,unit,nutrition:d.ingredientNutrition(item,quantity,unit)});
    }
    const recipe={...d.stamp(),name:'巧克力燕麦',servings:1,lines,instructions:'混合食材。',stickyNote:''};
    await d.recipes.put(recipe);return recipe;
  });
  await page.goto('/recipes/'+fixture.id);
  await page.locator('.recipe-edit-trigger').tap();
  const editor=page.locator('.recipe-editor-modal'),rows=editor.locator('.draft-ingredient');
  const readings=[];
  for(const [index,label] of ['1 块','10 克','25 克','66.7 克','150.5 mL','19.6 克'].entries()){
    const row=rows.nth(index),field=row.locator('.draft-amount input'),ink=row.locator('.journal-amount-ink');
    await field.scrollIntoViewIfNeeded();
    const before=(await row.boundingBox())!,normal=(await ink.boundingBox())!;
    await row.screenshot({path:folder+'/amount-'+index+'.png',scale:'css'});
    await field.tap();await expect(field).toHaveValue(label.split(' ')[0]);
    const after=(await row.boundingBox())!,active=(await ink.boundingBox())!;
    expect(active).toEqual(normal);expect(before).toEqual(after);expect(active.width).toBe(56);
    const style=await field.evaluate(el=>{const s=getComputedStyle(el);return [s.borderWidth,s.backgroundColor,s.outlineStyle,s.boxShadow]});
    expect(style).toEqual(['0px','rgba(0, 0, 0, 0)','none','none']);
    await expect(row.locator('.draft-quantity-actions button')).toHaveCount(0);
    if(index===0){await field.fill('1e308');await field.press('Enter');await expect(field).toHaveValue('1');await field.tap()}
    if(index===5){
      await row.screenshot({path:folder+'/inline-19.6.png',scale:'css'});
      await field.fill('110');await field.press('Escape');await expect(field).toHaveValue('19.6');
      await field.tap();
    }
    await field.fill('');await row.locator('.draft-ingredient-name').tap();await expect(field).toHaveValue(label.split(' ')[0]);
    await field.fill('-1');await field.press('Enter');await expect(field).toHaveValue(label.split(' ')[0]);
    readings.push({amount:label,normal:normal.width,editing:active.width,rowHeight:after.height});
  }
  await writeFile(folder+'/measurements.json',JSON.stringify(readings,null,2));
  await editor.locator('.recipe-editor-footer .primary').tap();
  await expect(editor).toHaveCount(0);
  const saved=await page.evaluate(async id=>(await import('/src/domain.ts')).recipes.get(id),fixture.id);
  expect(saved!.lines).toEqual(fixture.lines);
  await page.locator('.start-cooking').tap();
  const last=page.locator('.cooking-mode .journal-check-row').last();
  await last.locator('.journal-quantity-trigger').tap();
  await expect(last.locator('.journal-quantity-edit input')).toHaveValue('19.6');
  await last.locator('.journal-quantity-edit input').press('Enter');
  await expect(last.locator('.journal-quantity-edit')).toHaveCount(0);
  await expect(last.locator('.journal-quantity-restore')).toHaveCount(0);
  await last.locator('.journal-quantity-trigger').tap();
  await last.locator('.journal-quantity-edit input').fill('150.5');
  await last.locator('input[type=checkbox]').tap();
  await expect(last.locator('input[type=checkbox]')).toBeChecked();
  await expect.poll(()=>page.evaluate(async id=>{
    const db=(await import('/src/domain.ts')).db;
    const session=JSON.parse((await db.settings.get('cooking-session:v1:'+id))!.value);
    return [session.quantityOverrides?.[0]?.quantity,session.checked[0]];
  },fixture.id)).toEqual([150.5,fixture.lines.at(-1)!.lineId]);
});
