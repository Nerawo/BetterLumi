import {openPersonalGoalEditor} from './current-ui';
import {test,expect} from '@playwright/test';
const keys=['protein','carbs','fat'] as const;
const states=[[],['protein'],['carbs'],['fat'],['protein','carbs'],['carbs','fat'],[...keys]];
const out='./work/screenshots/';
for(const width of [320,390,430])for(const language of ['zh','en'])test(`fixed macro positions ${width} ${language}`,async({page},info)=>{
 test.setTimeout(90000);await page.setViewportSize({width,height:844});await page.goto('/today?date=2026-10-19');await expect(page.locator('#today-tab-more')).toBeVisible();
 const original=await page.evaluate(async language=>{const d=await import('/src/domain.ts'),{goalTable}=await import('/src/goals.ts');await d.db.settings.put({key:'language',value:language});const g={...d.stamp(),startDate:'2026-10-01',endDate:null,calorieMin:null,calorieMax:null,exerciseMinutes:null,exerciseKcal:null,nutritionGoals:{calories:{mode:'off',min:null,max:null},protein:{mode:'off',min:70,max:90},carbs:{mode:'off',min:85,max:115},fat:{mode:'off',min:15,max:25}}};await goalTable.put(g);return g},language);
 await page.reload();await expect(page.locator('html')).toHaveAttribute('lang',language);await openPersonalGoalEditor(page);const form=page.locator('.goal-editor-inline'),toggle=form.locator('.advanced-nutrition-toggle'),grid=form.locator('.goal-macro-grid');await toggle.click();await expect(toggle.locator('small')).toHaveCount(0);await expect(toggle).toHaveText(language==='en'?'Detailed Nutrition Planning':'详细营养规划');
 const initial=await grid.locator('[data-goal-metric]').evaluateAll(rows=>rows.map(e=>{const b=e.getBoundingClientRect();return {x:b.x,width:b.width}}));
 for(const enabled of states){
  for(const key of keys)await grid.locator(`[data-goal-metric=${key}] input[type=checkbox]`).setChecked(enabled.includes(key));
  const boxes=[];
  for(const key of keys){const row=grid.locator(`[data-goal-metric=${key}]`),box=(await row.boundingBox())!;boxes.push(box);expect(Math.abs(box.x-initial[keys.indexOf(key)].x)).toBeLessThan(1);expect(Math.abs(box.width-initial[keys.indexOf(key)].width)).toBeLessThan(1);const input=row.locator('input[type=number]');await expect(input).toHaveCount(enabled.includes(key)?1:0);const heading=(await row.locator('.nutrition-goal-heading').boundingBox())!,check=(await row.locator('input[type=checkbox]').boundingBox())!;expect(Math.abs(check.y+check.height/2-heading.y-heading.height/2)).toBeLessThan(1);
   if(enabled.includes(key)){await expect(input).toHaveValue(key==='protein'?'80':key==='carbs'?'100':'20');const field=(await input.boundingBox())!;expect(field.y-(heading.y+heading.height)).toBeGreaterThanOrEqual(0);expect(field.y-(heading.y+heading.height)).toBeLessThanOrEqual(4);expect(field.height).toBeGreaterThanOrEqual(44);expect(box.height).toBeLessThanOrEqual(92);const unit=(await row.locator('.goal-input-unit').boundingBox())!;expect(unit.x).toBeGreaterThanOrEqual(field.x+field.width)}else expect(box.height).toBeLessThanOrEqual(44);
  }
  const [p,c,f]=boxes;expect(p.y).toBe(c.y);expect(c.x).toBeGreaterThan(p.x+p.width);expect(f.x).toBe(p.x);expect(f.y-Math.max(p.y+p.height,c.y+c.height)).toBeGreaterThanOrEqual(0);expect(f.y-Math.max(p.y+p.height,c.y+c.height)).toBeLessThanOrEqual(4);expect(await grid.evaluate(e=>e.scrollWidth>e.clientWidth)).toBe(false);expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  if(enabled.join(',')==='carbs,fat'){await grid.scrollIntoViewIfNeeded();await page.screenshot({path:out+`macro-grid-mixed-${width}-${language}-${info.project.name}.png`})}
 }
 await grid.locator('[name=proteinTarget]').fill('123');await grid.locator('[data-goal-metric=protein] input[type=checkbox]').uncheck();await grid.locator('[data-goal-metric=protein] input[type=checkbox]').check();await expect(grid.locator('[name=proteinTarget]')).toHaveValue('123');await toggle.click();await toggle.click();await expect(grid.locator('[name=proteinTarget]')).toHaveValue('123');await expect(toggle.locator('small')).toHaveCount(0);expect(await page.evaluate(async()=>{const {goalTable}=await import('/src/goals.ts');return goalTable.toArray()})).toEqual([original]);
});
