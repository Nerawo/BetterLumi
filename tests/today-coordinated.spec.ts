import {jumpToDate} from "./date-jump";
import { test, expect, type Page } from '@playwright/test';
test.use({hasTouch:true});
const output='./work/screenshots/';
test.use({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
test.beforeEach(async({page})=>{await page.clock.install({time:new Date('2026-10-18T12:00:00-04:00')});await page.goto('/today')});
async function seedDaily(page:Page){return page.evaluate(async()=>{const d=await import('/src/domain.ts');const make=(date,name,duration,caloriesBurned)=>({...d.stamp(),date,name,type:'other',duration,caloriesBurned,distance:null,notes:''});const a=make('2026-10-17','十七日步行',200,200),b=make('2026-10-18','十八日步行',300,600),c=make('2026-10-18','十八日游泳',20,250);await d.db.activities.bulkPut([a,b,c]);for(const [date,calories]of[['2026-10-17',500],['2026-10-18',800]])await d.foodLogs.put({...d.stamp(),date,name:date+'餐食',category:'lunch',source:'quick',sourceId:null,quantity:1,unit:'entry',nutrition:{calories,protein:10,carbs:20,fat:5},lines:[],cookingNote:''});return a.id})}
test('selected day synchronizes the nutrition overview and meal list',async({page})=>{
 await seedDaily(page);
 const readings=page.getByTestId('food-progress').locator('.calorie-reading');
 for(const [date,total] of [['2026-10-18','800kcal'],['2026-10-17','500kcal'],['2026-10-19','未记录kcal']]){
  await jumpToDate(page,date);
  await expect(readings).toHaveText(total);
  const rows=page.locator('.meal-row');
  if(date==='2026-10-19')await expect(rows).toHaveCount(0);
  else await expect(rows).toHaveText(new RegExp(date+'餐食'));
 }
});
test('weekly calendar expands without changing selection and navigates month/year boundaries',async({page})=>{
 await seedDaily(page);const dates=page.locator('.calendar-grid [data-date]');await expect(dates).toHaveCount(7);await expect(page.locator('[data-date="2026-10-17"] [data-ring=food]')).toHaveCount(1);
 await jumpToDate(page,'2026-12-31');await expect(dates).toHaveCount(7);await expect(dates.first()).toHaveAttribute('data-date','2026-12-28');await expect(dates.last()).toHaveAttribute('data-date','2027-01-03');
 await page.getByRole('button',{name:'下一周',exact:true}).click();await expect(page.locator(`[data-date="${'2027-01-07'}"]`)).toHaveAttribute('aria-pressed','true');await page.getByRole('button',{name:'上一周',exact:true}).click();await page.getByRole('button',{name:'展开整月',exact:true}).click();await expect(dates).toHaveCount(31);await expect(page.locator(`[data-date="${'2026-12-31'}"]`)).toHaveAttribute('aria-pressed','true');await page.getByRole('button',{name:'下个月',exact:true}).click();await expect(page.locator(`[data-date="${'2027-01-31'}"]`)).toHaveAttribute('aria-pressed','true');await page.getByRole('button',{name:'收起为周历',exact:true}).click();await expect(dates).toHaveCount(7);await expect(page.locator('[data-date="2027-01-31"]')).toHaveAttribute('aria-pressed','true');await page.locator('.calendar-card').screenshot({path:output+'Today同步-周历.png'});
});
async function createPlan(page:Page,name:string,schedule:string,multiple=false){
 if(schedule==='dates'){await page.evaluate(async name=>{const d=await import('/src/domain.ts'),p=await import('/src/exercise-plans.ts');await p.exercisePlans.put({...d.stamp(),name,notes:'',enabled:true,schedule:'dates',days:[],dates:['2026-10-18','2026-10-20'],exercises:[{id:crypto.randomUUID(),name:name+'步行',duration:45,distance:2,notes:''}]})},name);return}

 await page.locator('#today-tab-activity').click();await page.getByRole('button',{name:'新建运动计划',exact:true}).click();const editor=page.locator('.exercise-plan-editor');await editor.locator('[name=name]').fill(name);await editor.locator('.plan-repeat button').nth(schedule==='daily'?0:1).click();if(schedule==='custom'){await editor.locator('.weekday-toggles input').nth(1).uncheck();await editor.locator('.weekday-toggles input').nth(3).uncheck()}
 if(schedule==='dates'){await editor.getByRole('button',{name:'添加日期',exact:true}).click();await editor.locator('.specific-dates input').last().fill('2026-10-20')}
 const rows=editor.locator('.planned-exercise-fields');await rows.first().getByLabel('运动名称',{exact:true}).fill(name+'步行');await rows.first().getByLabel('目标分钟（可选）',{exact:true}).fill('45');await rows.first().getByLabel('目标公里（可选）',{exact:true}).fill('2');if(multiple){await editor.getByRole('button',{name:'添加运动项目',exact:true}).click();await rows.last().getByLabel('运动名称',{exact:true}).fill('游泳');await rows.last().getByLabel('目标分钟（可选）',{exact:true}).fill('20')}
 await editor.getByRole('button',{name:'保存计划',exact:true}).click();await expect(editor).toHaveCount(0);
}

test('visible weight back button returns to More and origin, preserving filters, units and history',async({page})=>{
 await page.evaluate(async()=>{const d=await import('/src/domain.ts');await d.weights.bulkPut(Array.from({length:20},(_,n)=>({...d.stamp(),date:'2026-10-'+String(n+1).padStart(2,'0'),kg:70+n/10,notes:'Synthetic measurement'})))});
 await page.goto('/more');await page.locator('[data-setting=weight]').tap();await expect(page.locator('.secondary-back')).toBeVisible();await expect(page.locator('.secondary-back')).toContainText('返回');await page.getByRole('button',{name:'90D',exact:true}).click();await page.getByRole('button',{name:'lb',exact:true}).click();await page.screenshot({path:output+'体重日志-返回按钮.png'});await page.locator('.secondary-back').tap();await expect(page).toHaveURL(/\/more$/);await page.goForward();await expect(page.getByRole('button',{name:'90D',exact:true})).toHaveClass('selected');await expect(page.getByRole('button',{name:'lb',exact:true})).toHaveClass('selected');
 await page.clock.runFor(100);await page.evaluate(()=>window.scrollTo(0,250));await page.clock.runFor(100);await page.goBack();await expect(page).toHaveURL(/\/more$/);await page.goForward();await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(150);
 await page.goto('/today?date=2026-10-17');await page.locator('#today-tab-weight').click();await page.getByRole('button',{name:'查看体重日记',exact:true}).click();await page.locator('.secondary-back').click();await expect(page).toHaveURL(/\/today\?date=2026-10-17$/);await expect(page.locator(`[data-date="${'2026-10-17'}"]`)).toHaveAttribute('aria-pressed','true');
 await page.goto('/weight');await page.locator('.secondary-back').click();await expect(page).toHaveURL(/\/more$/);expect(await page.evaluate(async()=>{const d=await import('/src/domain.ts');return d.weights.count()})).toBe(20);
});
