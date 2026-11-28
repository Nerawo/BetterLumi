import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

test.use({browserName:'webkit',channel:'',isMobile:true,hasTouch:true,deviceScaleFactor:3});
for(const language of ['zh','en'])for(const width of [390,320,375,430])test(`batch result modes and disclosure: ${language} ${width}`,async({page})=>{
 await page.setViewportSize({width,height:844});await page.goto('/recipes');
 await expect(page.locator('.recipe-fab')).toBeVisible();
 const id=await page.evaluate(async lang=>{
   const d=await import('/src/domain.ts');
   await d.db.settings.put({key:'language',value:lang});
   const lines=[];
   for(const [name,grams,kcal,p,c,f] of [
     ['宽面',480,358,12,72,1.5],['牛肉馅',500,240,20,0,17],['碎番茄',600,32,1.4,5,0.4],
     ['洋葱',150,40,1.1,9,0.1],['橄榄油',65,884,0,0,100],['帕玛森奶酪',60,392,36,3,26],
   ] as const){
     const item={...d.stamp(),name,brand:'',nameZh:'',basis:'100g' as const,servingGrams:null,calories:kcal,protein:p,carbs:c,fat:f};
     await d.db.ingredients.put(item);
     lines.push({lineId:d.stamp().id,name,ingredientId:item.id,quantity:grams,unit:'g',nutrition:d.ingredientNutrition(item,grams,'g')});
   }
   const recipe={...d.stamp(),name:lang==='zh'?'博洛尼亚肉酱宽面':'Tagliatelle Bolognese',servings:6,lines,instructions:'',stickyNote:''};
   await d.recipes.put(recipe);return recipe.id;
 },language);
 await page.goto('/recipes/'+id);await page.locator('.start-cooking').tap();await page.locator('.journal-add-storage').tap();
 const modal=page.locator('.storage-make-modal'),body=modal.locator('.storage-make-scroll'),tiles=modal.locator('.batch-mode-options button'),review=modal.locator('.batch-review'),footer=modal.locator('.recipe-editor-footer');
 const shot=async(name:string)=>{if(width===390&&language==='zh'){await mkdir('work/screenshots/batch-mode-review',{recursive:true});await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:'work/screenshots/batch-mode-review/'+name+'.png',scale:'device'})}};
 const top=()=>body.evaluate(el=>el.scrollTop=0);
 await expect(tiles.first()).toHaveAttribute('aria-pressed','true');await expect(review).not.toHaveAttribute('open','');
 const bounds=await tiles.evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return [r.y,r.width]}));
 expect(bounds.every(([y,w])=>y===bounds[0][0]&&Math.abs(w-bounds[0][1])<1)).toBe(true);
 await expect(modal.locator('.nutrition-missing')).toHaveCount(4);
 const weight=modal.locator('[name=cookedYieldGrams]');await weight.fill('1680');await weight.press('Enter');await top();await shot('01-weight');
 await tiles.nth(1).tap();const packed=modal.locator('#batch-packed-input');await expect(packed).toHaveValue('6');
 const totals=await modal.locator('.storage-batch-nutrition').first().innerText();
 expect(await packed.evaluate(el=>{const l=el.closest('.batch-setting')!.querySelector('label')!.getBoundingClientRect(),r=el.getBoundingClientRect();return l.top<r.bottom&&r.top<l.bottom})).toBe(true);
 await top();await shot('02-servings');const servingNutrition=modal.locator('.storage-batch-nutrition').last();const previous=await servingNutrition.innerText();await packed.fill('5');await packed.press('Enter');await expect(packed).not.toBeFocused();await expect(servingNutrition).not.toHaveText(previous);expect(await modal.locator('.storage-batch-nutrition').first().innerText()).toBe(totals);
 await tiles.last().tap();await expect(modal.locator('.storage-batch-nutrition')).toHaveCount(1);await expect(modal.locator('.batch-setting')).toContainText('100%');await top();await shot('03-ratio');
 await tiles.nth(1).tap();await top();await shot('04-collapsed');
 const footerBox=await footer.boundingBox();await review.locator(':scope > summary').tap();expect(await footer.boundingBox()).toEqual(footerBox);await expect(review.locator('.draft-ingredient')).toHaveCount(6);
 await body.evaluate(el=>el.scrollTop=el.scrollHeight);await expect(footer).toBeInViewport();await shot('05-expanded');
 expect(await modal.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 await review.locator(':scope > summary').tap();await expect(review).not.toHaveAttribute('open','');
});
