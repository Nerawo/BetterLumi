import {selectIngredientDefinition} from './current-ui';
import {test,expect,type Page,type Locator} from '@playwright/test';
test.use({isMobile:true,hasTouch:true,viewport:{width:390,height:844}});
async function viewport(page:Page,height:number,offsetTop=0){await page.evaluate(({height,offsetTop})=>{
 let v=(window as any).__testVisualViewport;if(!v){v=new EventTarget();Object.assign(v,{width:innerWidth,height:innerHeight,offsetTop:0,offsetLeft:0,scale:1});Object.defineProperty(window,'visualViewport',{configurable:true,value:v});(window as any).__testVisualViewport=v}
 Object.assign(v,{height,offsetTop});v.dispatchEvent(new Event('resize'));v.dispatchEvent(new Event('scroll'));
 },{height,offsetTop})}
async function visibleInBody(field:Locator,body:Locator){await expect.poll(async()=>{const f=await field.boundingBox(),b=await body.boundingBox();return !!f&&!!b&&f.y>=b.y+10&&f.y+f.height<=b.y+b.height-10}).toBe(true)}
for(const edit of [false,true])test(`ingredient ${edit?'edit':'add'} simulated keyboard uses internal scrolling`,async({page})=>{
 await page.goto('/pantry');await expect(page.locator('.pantry-fab')).toBeVisible();
 const saved=await page.evaluate(async()=>{const d=await import('/src/domain.ts');const item={...d.stamp(),name:'Synthetic liquid',nameZh:'',brand:'',basis:'100g',referenceAmount:222,referenceUnit:'mL',servingGrams:null,calories:111,protein:4,carbs:12,fat:3,consumptionUnit:{quantity:1,name:'can',amount:222,unit:'mL'}};await d.db.ingredients.put(item);return item});
 await viewport(page,844);if(edit)await page.locator('[data-user-food-id="'+saved.id+'"] .ingredient-name').click();else {await page.locator('.pantry-fab').click();await page.locator('.pantry-add-ingredient').click()}
 const parent=page.locator('.pantry-editor-modal'),editor=parent.locator('.journal-conversion'),body=parent.locator('.pantry-editor-body');
 await parent.locator(edit?'.journal-unit-summary':'.ingredient-unit-add').click();
 const pageY=await page.evaluate(()=>scrollY);const initialBox=await parent.boundingBox();
 await editor.locator('[name=conversionAmount]').focus();await viewport(page,280,70);
 await visibleInBody(editor.locator('[name=conversionAmount]'),body);
 for(const name of ['conversionName','conversionQuantity','conversionAmount']){
  const field=editor.locator('[name='+name+']');await field.focus();await visibleInBody(field,body);await expect(field).toBeFocused();
 }
 const box=await parent.boundingBox();expect(box).toEqual(initialBox);
 await expect(parent.locator('.modal-head')).toBeVisible();await expect(parent.locator('.form-actions')).toBeVisible();
 expect(await page.evaluate(()=>scrollY)).toBe(pageY);
 await viewport(page,844);await parent.locator('.modal-head button').click();
 expect(await page.evaluate(async id=>{const d=await import('/src/domain.ts');return d.db.ingredients.get(id)},saved.id)).toEqual(saved);
});
test('an authored conversion stays in its recorded base until explicitly revised',async({page})=>{
 await page.goto('/pantry');await page.locator('.pantry-fab').click();await page.locator('.pantry-add-ingredient').click();
 const parent=page.locator('.pantry-editor-modal'),modal=parent.locator('.journal-conversion');
 const units=parent.locator('.journal-serving-units'),base=modal.locator('[data-conversion-unit]');
 await parent.locator('[name=name]').fill('Synthetic can');await parent.locator('[name=referenceAmount]').fill('222');await parent.locator('[name=calories]').fill('111');
 await units.locator('.ingredient-unit-add').click();await expect(base).toHaveAttribute('data-conversion-unit','g');
 await selectIngredientDefinition(parent,'referenceUnit','mL');await expect(base).toHaveAttribute('data-conversion-unit','mL');
 await modal.locator('[name=conversionName]').fill('can');await modal.locator('[name=conversionAmount]').fill('222');
 await selectIngredientDefinition(parent,'referenceUnit','g');await parent.locator('.form-actions .primary').click();await expect(parent).toBeVisible();
 await expect(base).toHaveAttribute('data-conversion-unit','mL');
 await expect(modal.locator('[name=conversionAmount]')).toHaveValue('222');await modal.locator('.serving-unit-repair').click();
 await expect(base).toHaveAttribute('data-conversion-unit','g');
 await selectIngredientDefinition(parent,'referenceUnit','mL');
 await expect(base).toHaveAttribute('data-conversion-unit','g');await modal.locator('.serving-unit-repair').click();
 await expect(parent.locator('[name=calories]')).toHaveValue('111');await parent.locator('.form-actions .primary').click();await expect(parent).toHaveCount(0);
 const saved=await page.evaluate(async()=>{const d=await import('/src/domain.ts');return(await d.db.ingredients.toArray()).find(i=>i.name==='Synthetic can')!});
 expect(saved).toMatchObject({referenceAmount:222,referenceUnit:'mL',calories:111,consumptionUnit:{quantity:1,name:'can',amount:222,unit:'mL'}});
 await page.reload();await page.locator('[data-user-food-id="'+saved.id+'"] .ingredient-name').click();
 await units.locator('.journal-unit-summary').click();await expect(base).toHaveAttribute('data-conversion-unit','mL');
 await parent.locator('.form-actions .primary').click();await expect(parent).toHaveCount(0);
 const after=await page.evaluate(async id=>{const d=await import('/src/domain.ts');return d.db.ingredients.get(id)},saved.id);for(const key of ['referenceAmount','referenceUnit','consumptionUnit','calories','protein','carbs','fat'] as const)expect(after![key]).toEqual(saved[key]);
});
test('shared recipe modal reveals focused text fields inside its own scroll area',async({page})=>{
 await page.goto('/recipes');await viewport(page,844);await page.locator('.recipe-fab').click();const modal=page.locator('.recipe-editor-modal'),body=modal.locator('.recipe-editor-scroll');const pageY=await page.evaluate(()=>scrollY);await modal.locator('.draft-method-toggle').click();await viewport(page,350,65);for(const name of ['instructions','name','stickyNote']){const field=modal.locator('[name='+name+']');await field.focus();await visibleInBody(field,body)}expect(await page.evaluate(()=>scrollY)).toBe(pageY);await viewport(page,844);await modal.locator('.modal-head button').click();
});
