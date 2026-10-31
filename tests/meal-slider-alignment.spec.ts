import {chooseSavedRecipe} from './recipe-picker-helper';
import {test,expect} from '@playwright/test';

for(const width of [320,375,390,430,1440])test(`consumption slider spans its scale and maps pointer positions correctly at ${width}px`,async({browser},testInfo)=>{
 const context=await browser.newContext({viewport:{width,height:1000},isMobile:width<600,hasTouch:width<600});const page=await context.newPage();
 try{
 await page.goto('/today');await expect(page.locator('.meal-card')).toBeVisible();const id=await page.evaluate(async()=>{const d=await import('/src/domain.ts');const recipe={...d.stamp(),name:'Synthetic slider alignment',servings:1,lines:[{ingredientId:'synthetic',name:'Synthetic ingredient',quantity:100,unit:'g',nutrition:{calories:600,protein:30,carbs:60,fat:20}}],instructions:'',stickyNote:''};await d.recipes.put(recipe);return recipe.id});await page.locator('#today-tab-food').click();await page.locator('.meal-card .section-heading .primary').click();const modal=page.locator('.add-food-modal');await chooseSavedRecipe(modal,id);const slider=modal.getByRole('slider'),control=modal.locator('.recipe-consumption-control');await expect(slider).toHaveValue('100');await expect(slider).toHaveAttribute('min','0');await expect(slider).toHaveAttribute('max','100');await expect(slider).toHaveAttribute('step','5');await page.evaluate(()=>document.fonts.ready.then(()=>undefined));
 const geometry=await control.evaluate(el=>{const input=el.querySelector('input')!,scale=el.querySelector('.recipe-consumption-scale')!,a=el.getBoundingClientRect(),b=input.getBoundingClientRect(),c=scale.getBoundingClientRect();return{controlWidth:a.width,sliderWidth:b.width,sliderLeft:b.left,sliderRight:b.right,scaleLeft:c.left,scaleRight:c.right,maxWidth:getComputedStyle(input).maxWidth}});
 expect(geometry.sliderWidth).toBeCloseTo(geometry.controlWidth,0);expect(geometry.sliderLeft).toBeCloseTo(geometry.scaleLeft,0);expect(geometry.sliderRight).toBeCloseTo(geometry.scaleRight,0);
 const labels=await control.locator('.recipe-consumption-scale').evaluate(el=>{const a=el.getBoundingClientRect(),spans=[...el.children];return spans.map((span,index)=>{const range=document.createRange();range.selectNodeContents(span);const b=range.getBoundingClientRect();return index===0?b.left-a.left:index===1?(b.left+b.right-a.left-a.right)/2:b.right-a.right})});for(const offset of labels)expect(Math.abs(offset)).toBeLessThanOrEqual(1);
 expect(await modal.evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(false);await slider.scrollIntoViewIfNeeded();
 for(const percent of [0,50,100]){
  const box=(await slider.boundingBox())!,x=percent===0?box.x+1:percent===100?box.x+box.width-1:box.x+box.width/2;await page.mouse.click(x,box.y+box.height/2);await expect(slider).toHaveValue(String(percent));await expect(control.locator('.recipe-consumption-value')).toHaveText(percent+'%');await expect(modal.locator('.meal-nutrition-preview strong').first()).toHaveText((600*percent/100)+' kcal');
  if(width===390||width===1440){await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));await control.screenshot({path:`work/screenshots/meal-slider-${testInfo.project.name||testInfo.config.projects[0].use.browserName}-${width}-${percent}.png`});}
 }
 await slider.press('ArrowLeft');await expect(slider).toHaveValue('95');expect(await page.evaluate(async()=>{const d=await import('/src/domain.ts');return d.foodLogs.count()})).toBe(0);
 }finally{await context.close()}
});
