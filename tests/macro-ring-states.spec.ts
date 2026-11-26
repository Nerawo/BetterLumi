import {test,expect} from '@playwright/test';
test.use({isMobile:true,hasTouch:true});
for(const [width,lang]of [[390,'zh'],[390,'en'],[430,'zh'],[430,'en']]as const)test(`Fixed macro positions, bounds, unknown values and measured zero ${width} ${lang}`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.clock.install({time:new Date('2026-10-18T12:00:00-04:00')});await page.goto('/today');
 const initial=await page.evaluate(async lang=>{const d=await import('/src/domain.ts'),g=await import('/src/goals.ts');await d.db.settings.put({key:'language',value:lang});const goal={...d.stamp(),startDate:'2026-10-01',endDate:null,calorieMin:null,calorieMax:null,exerciseMinutes:null,exerciseKcal:null,nutritionGoals:{calories:{mode:'daily',min:1500,max:1900},protein:{mode:'off',min:null,max:null},carbs:{mode:'daily',min:40,max:70},fat:{mode:'daily',min:null,max:20}}};await g.goalTable.put(goal);const log={...d.stamp(),date:'2026-10-18',name:'Test meal',source:'quick',sourceId:null,category:'lunch',quantity:1,unit:'entry',lines:[],cookingNote:'',nutrition:{calories:1700,protein:80,carbs:90,fat:30}};await d.foodLogs.put(log);return {goal,log}},lang);await page.reload();

 const food=page.getByTestId('food-progress');
 const rows=food.locator('[data-macro-slot]');
 await expect(rows).toHaveCount(3);
 expect(await rows.evaluateAll(elements=>elements.map(e=>e.getAttribute('data-macro-slot')))).toEqual(['protein','carbs','fat']);
 const carbs=food.locator('[data-macro-slot=carbs]'),fat=food.locator('[data-macro-slot=fat]');
 await expect(carbs.getByRole('progressbar')).toHaveAttribute('aria-valuenow','100');
 await expect(carbs).toHaveAttribute('data-status','above');
 await expect(fat).toHaveAttribute('data-upper-only','true');
 await expect(fat.getByRole('progressbar')).toHaveCount(0);
 await expect(food.locator('.calorie-reading')).toHaveText('1700kcal');
 const calorie=food.locator('[data-goal-metric=calories]');
 await expect(calorie).toContainText('1500–1900');
 await expect(calorie).toHaveAttribute('data-goal-mode','daily');
 await page.evaluate(async initial=>{const d=await import('/src/domain.ts');await d.foodLogs.put({...initial.log,nutrition:{...initial.log.nutrition,carbs:null,fat:0}})},initial);await expect(carbs).toHaveAttribute('data-status','unknown');await expect(carbs.getByRole('progressbar')).toHaveCount(0);await expect(carbs).not.toHaveAttribute('data-achieved','true');await expect(fat).toHaveAttribute('data-achieved','true');await expect(fat.locator('[data-nutrient=fat]')).toHaveText('0 g');
 await page.evaluate(async initial=>{const d=await import('/src/domain.ts'),g=await import('/src/goals.ts');await g.goalTable.put({...initial.goal,...d.stamp(),startDate:'2026-10-15',revision:2,nutritionGoals:{...initial.goal.nutritionGoals,calories:{mode:'weekly',min:1500,max:1900},carbs:{mode:'daily',min:0,max:0}}});await d.foodLogs.put({...initial.log,nutrition:{...initial.log.nutrition,carbs:0,fat:0}})},initial);await expect(carbs).toHaveAttribute('data-achieved','true');await expect(carbs.getByRole('progressbar')).toHaveAttribute('aria-valuenow','100');await expect(calorie).toHaveAttribute('data-goal-mode','weekly');await expect(calorie).toContainText('1/7');await expect(calorie).not.toHaveAttribute('data-achieved','true');
 for(const theme of ['misty','apricot','lavender','olive']){await page.evaluate(async theme=>{const d=await import('/src/domain.ts');await d.db.settings.put({key:'theme',value:theme})},theme);await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.theme)).toBe(theme);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)}
 expect(await page.evaluate(async id=>{const g=await import('/src/goals.ts');return g.goalTable.get(id)},initial.goal.id)).toEqual(initial.goal);
});
