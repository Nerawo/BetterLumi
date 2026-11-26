import {test,expect,type Page} from '@playwright/test';
const out='./work/screenshots/';
test.use({isMobile:true,hasTouch:true});
async function seed(page:Page){await page.clock.install({time:new Date('2026-10-18T12:00:00-04:00')});await page.goto('/today');return page.evaluate(async()=>{
 const d=await import('/src/domain.ts'),p=await import('/src/exercise-plans.ts'),s=await import('/src/exercise-schedule.ts');
 const plan={...d.stamp(),name:'日常训练',schedule:'daily',days:[],dates:[],enabled:true,notes:'原计划备注',exercises:[{id:'walk',name:'散步',duration:40,distance:2,notes:'慢走'},{id:'yoga',name:'瑜伽',duration:20,distance:null,notes:''},{id:'run',name:'跑步',duration:30,distance:3,notes:''}]};await p.exercisePlans.put(plan);
 const records=[{...d.stamp(),id:p.plannedActivityId(s.occurrenceId(plan.id,'2026-10-18','walk')),date:'2026-10-18',name:'散步',type:'other',duration:45,distance:2,caloriesBurned:220,notes:''},{...d.stamp(),id:p.plannedActivityId(s.occurrenceId(plan.id,'2026-10-18','yoga')),date:'2026-10-18',name:'瑜伽',type:'other',duration:12,distance:null,caloriesBurned:null,notes:''},{...d.stamp(),date:'2026-10-18',name:'独立骑车',type:'other',duration:10,distance:3,caloriesBurned:99,notes:''}];await d.db.activities.bulkPut(records);await p.saveActivity(records[0],plan.id+':2026-10-18:walk',true);await p.saveActivity(records[1],plan.id+':2026-10-18:yoga',true);
 const supplement={...d.stamp(),name:'维生素',dosage:1,unit:'粒',schedule:'daily',days:[]};await d.db.supplements.put(supplement);const history={...d.stamp(),id:supplement.id+':2026-10-17',supplementId:supplement.id,date:'2026-10-17',status:'skipped'};await d.db.checks.put(history);return {plan,records,supplement,history};
})}
for(const width of [390,430])test('Independent supplement history '+width,async({page})=>{
 await page.setViewportSize({width,height:844});const ids=await seed(page);


 await page.locator('#today-tab-supplements').click();const supplement=page.locator('.supplement-section'),status=supplement.locator('.supplement-status-segments');await expect(supplement.locator('.supplement-chevron')).toHaveCount(0);await expect(supplement.locator('#supplement-entries')).toBeVisible();await status.locator('[data-status=taken]').click();await expect(status.locator('[data-status=taken]')).toHaveAttribute('aria-pressed','true');await expect(page.locator('#today-tab-supplements .supplement-count')).toHaveText('1/1');await status.locator('[data-status=taken]').focus();await expect(status.locator('[data-status=taken]')).toBeFocused();await status.locator('[data-status=taken]').press('Enter');await expect(supplement.getByRole('menu')).toHaveCount(0);await supplement.getByRole('button',{name:'管理补充剂',exact:true}).click();await expect(page.locator('.supplement-manager')).toContainText('1 粒');await page.keyboard.press('Escape');


});


test('supplement statuses can be skipped and reset',async({page})=>{
 await page.setViewportSize({width:390,height:844});await seed(page);
 await page.locator('#today-tab-supplements').click();const status=page.locator('.supplement-status-segments');await status.locator('[data-status=skipped]').click();await expect(status.locator('[data-status=skipped]')).toHaveAttribute('aria-pressed','true');await status.locator('[data-status=unconfirmed]').click();await expect(status.locator('[data-status=unconfirmed]')).toHaveAttribute('aria-pressed','true');

});
