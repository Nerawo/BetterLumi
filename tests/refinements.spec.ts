import {openPersonalGoalEditor} from './current-ui';
import {jumpToDate} from "./date-jump";
import {test,expect,type Page} from '@playwright/test';
const output='./work/screenshots/';
test.use({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
async function seed(page:Page){
 await page.clock.install({time:new Date('2026-10-18T12:00:00-04:00')});await page.goto('/today');
 return page.evaluate(async()=>{
  const d=await import('/src/domain.ts'),p=await import('/src/exercise-plans.ts'),g=await import('/src/goals.ts');
  await g.goalTable.put({...d.stamp(),startDate:'2026-01-01',endDate:null,calorieMin:1500,calorieMax:1800,exerciseMinutes:30,exerciseKcal:null});
  await d.foodLogs.put({...d.stamp(),date:'2026-10-18',name:'早餐燕麦',category:'breakfast',source:'quick',sourceId:null,quantity:1,unit:'entry',nutrition:{calories:420,protein:15,carbs:50,fat:10},lines:[],cookingNote:''});
  const plans=['晨间训练','晚间训练'].map(name=>({...d.stamp(),name,notes:'保持原有备注',enabled:true,schedule:'daily',days:[],dates:[],exercises:[{id:crypto.randomUUID(),name:'步行',duration:20,distance:1,notes:''},{id:crypto.randomUUID(),name:'拉伸',duration:10,distance:null,notes:''}]}));await p.exercisePlans.bulkPut(plans);
  await d.db.supplements.bulkPut(['维生素','鱼油'].map(name=>({...d.stamp(),name,dosage:1,unit:'粒',schedule:'daily',days:[]})));
  await d.db.ingredients.bulkPut(Array.from({length:30},(_,index)=>({...d.stamp(),name:'食材 '+index,nameZh:'',brand:'',basis:'100g',servingGrams:null,calories:100+index,protein:null,carbs:null,fat:null})));
  const recipe={...d.stamp(),name:'燕麦食谱',servings:1,categoryIds:[],lines:[],instructions:'步骤保留',stickyNote:'便签保留'};await d.recipes.put(recipe);return recipe.id;
 });
}
for(const width of [390,430])test(`calendar centers, stays in place and loads local fonts at ${width}`,async({page})=>{
 await page.setViewportSize({width,height:844});await seed(page);await expect(page.locator('.meal-row')).toHaveCount(1);
 expect(await page.evaluate(()=>{const calendar=document.querySelector('.compact-calendar')!,overview=document.querySelector('.today-progress')!,records=document.querySelector('.today-layout')!;return overview.compareDocumentPosition(calendar)&Node.DOCUMENT_POSITION_FOLLOWING&&calendar.compareDocumentPosition(records)&Node.DOCUMENT_POSITION_FOLLOWING})).toBeTruthy();
 const calendar=page.locator('.compact-calendar');await calendar.evaluate(e=>window.scrollTo({top:e.getBoundingClientRect().top+window.scrollY-100,behavior:'instant'}));
 const centered=()=>page.locator('.calendar-grid button[data-date]').evaluateAll(nodes=>nodes.every(node=>{const a=node.getBoundingClientRect(),b=node.querySelector('.calendar-date-number')!.getBoundingClientRect();return Math.abs(a.x+a.width/2-b.x-b.width/2)<.2&&Math.abs(a.y+a.height/2-b.y-b.height/2)<.2}));
 expect(await centered()).toBe(true);const before=(await calendar.boundingBox())!.y;
 await page.locator('[data-date="2026-10-17"]').click();await expect(page.locator(`[data-date="${'2026-10-17'}"]`)).toHaveAttribute('aria-pressed','true');await expect(page.locator('.meal-row')).toHaveCount(0);await expect(calendar).toBeInViewport();
 await page.getByRole('button',{name:'下一周',exact:true}).click();await expect(calendar).toBeInViewport();
 await page.getByRole('button',{name:'展开整月',exact:true}).click();await expect(calendar).toBeInViewport();expect(await centered()).toBe(true);
 await page.getByRole('button',{name:'下个月',exact:true}).click();await expect(calendar).toBeInViewport();expect(await centered()).toBe(true);
 await page.getByRole('button',{name:'收起为周历',exact:true}).click();await expect(calendar).toBeInViewport();
 await page.evaluate(async()=>{await document.fonts.load('500 14px "Nunito Sans"','Food');await document.fonts.load('500 14px "Noto Sans SC"','今日餐桌')});
 expect(await page.evaluate(()=>[...document.fonts].some(f=>f.family==='Noto Sans SC'&&f.status==='loaded')&&[...document.fonts].some(f=>f.family==='Nunito Sans'&&f.status==='loaded'))).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await jumpToDate(page,'2026-10-18');await page.screenshot({path:output+`交互精修-日历-${width}.png`,animations:"disabled"});
});
test('independent plan disclosure and derived per-date completion survive reload with linked actual logs',async({page})=>{
 await seed(page);await page.locator('#today-tab-activity').click();await page.locator('.planned-movement > summary').click();const plans=page.locator('.daily-plan-group');await expect(plans).toHaveCount(2);await expect(plans.first()).not.toHaveAttribute('open','');
 await plans.first().locator('summary').click();await expect(plans.last()).not.toHaveAttribute('open','');await plans.first().locator('input').first().check();await expect(plans.first().locator(':scope > summary')).toContainText('1/2');await expect(plans.first().locator(':scope > summary')).toContainText('1/2');
 await plans.first().locator('input').last().check();await expect(plans.first().locator(':scope > summary')).toContainText('2/2');await plans.last().locator('summary').click();await expect(plans.first()).toHaveAttribute('open','');
 await page.reload();await page.locator('#today-tab-activity').click();await page.locator('.planned-movement > summary').click();await expect(plans.first().locator(':scope > summary')).toContainText('2/2');await plans.first().locator('summary').click();await expect(plans.first().locator('input').first()).toBeChecked();await plans.first().locator('input').last().uncheck();await expect(plans.first().locator(':scope > summary')).toContainText('1/2');
 await jumpToDate(page,'2026-10-17');await expect(plans.first().locator(':scope > summary')).toContainText('0/2');await jumpToDate(page,'2026-10-18');await expect(plans.first().locator(':scope > summary')).toContainText('1/2');
 expect(await page.evaluate(async()=>{const d=await import('/src/domain.ts');return d.db.activities.filter(a=>!a.deletedAt).count()})).toBe(1);await expect(page.getByTestId('exercise-progress').locator('.movement-duration')).toHaveText('20分钟');
 await plans.first().screenshot({path:output+'交互精修-运动计划.png'});
});
test('supplement compact status, collapse, date persistence and management access',async({page})=>{
 await seed(page);await page.locator('#today-tab-supplements').click();const section=page.locator('.supplement-section'),toggle=section.locator('.supplement-count'),status=section.locator('.supplement-status').first();await expect(status).toContainText('未确认');await status.click();await section.getByRole('menuitemradio',{name:'已服用',exact:true}).click();await expect(toggle).toContainText('1/2');await expect.poll(()=>page.evaluate(async()=>{const d=await import('/src/domain.ts');return (await d.db.checks.toArray())[0]?.status})).toBe('taken');await page.reload();await expect(status).toContainText('已服用');
 await status.click();await section.getByRole('menuitemradio',{name:'已跳过',exact:true}).click();await expect(toggle).toContainText('0/2');await jumpToDate(page,'2026-10-17');await expect(status).toContainText('未确认');await jumpToDate(page,'2026-10-18');await expect(status).toContainText('已跳过');await status.click();await section.getByRole('menuitemradio',{name:'未确认',exact:true}).click();await expect(status).toContainText('未确认');
 await section.locator(".supplement-chevron").click();await expect(section.locator('.supplement-row')).toHaveCount(0);await section.getByRole('button',{name:'管理补充剂',exact:true}).click();await expect(page.locator('.supplement-manager')).toBeVisible();await page.keyboard.press('Escape');await expect(section.locator('.supplement-chevron')).toHaveAttribute('aria-expanded','false');await section.locator('.supplement-heading .primary').click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await section.locator(".supplement-chevron").click();await section.screenshot({path:output+'交互精修-补剂.png'});
});
test('create or reuse normalized categories in detail picker and keep recipe fields',async({page})=>{
 const id=await seed(page);await page.goto('/recipes/'+id);const picker=page.locator('.detail-category-row');await picker.getByRole('button',{name:'选择分类',exact:true}).click();await picker.locator('.category-add-chip').click();await expect(picker.getByLabel('分类名称',{exact:true})).toBeFocused();await picker.getByLabel('分类名称',{exact:true}).fill('  Quick   Meals  ');await picker.getByRole('button',{name:'创建并添加',exact:true}).click();await expect(picker.locator('.recipe-category-chip')).toHaveText('Quick Meals');
 await picker.locator('.category-add-chip').click();await picker.getByLabel('分类名称',{exact:true}).fill('quick meals');await picker.getByLabel('分类名称',{exact:true}).press('Enter');await expect(picker.locator('.recipe-category-chip')).toHaveCount(1);
 expect(await page.evaluate(async()=>{const c=await import('/src/categories.ts');return c.categories.count()})).toBe(1);await page.reload();await expect(picker.locator('.recipe-category-chip')).toHaveText('Quick Meals');
 await picker.getByRole('button',{name:'选择分类',exact:true}).click();await picker.getByRole('checkbox',{name:'Quick Meals',exact:true}).uncheck();await expect(picker.locator('.recipe-category-chip')).toHaveCount(0);await picker.getByRole('checkbox',{name:'Quick Meals',exact:true}).check();await page.keyboard.press('Escape');await page.screenshot({path:output+'交互精修-分类.png'});
 const recipe=await page.evaluate(async id=>{const d=await import('/src/domain.ts');return d.recipes.get(id)},id);expect(recipe!.instructions).toBe('步骤保留');expect(recipe!.stickyNote).toBe('便签保留');await page.goto('/recipes');await expect(page.getByRole('tab',{name:'Quick Meals',exact:true})).toBeVisible();await page.getByRole('tab',{name:'Quick Meals',exact:true}).click();await expect(page.locator('.recipe-card')).toHaveCount(1);
});
for(const width of [390,430])test(`localized editable dates and fixed Pantry FAB at ${width}`,async({page})=>{
 await page.setViewportSize({width,height:844});await seed(page);await openPersonalGoalEditor(page);const dialog=page.locator('.goal-editor-inline .nutrition-goal-controls');await expect(dialog.locator('[name=nutritionStartDate]')).toHaveValue('2026-01-01');await expect(dialog.locator('.localized-date-value').first()).toHaveText('2026年1月1日');await expect(dialog.locator('.localized-date-value').last()).toHaveText('选择日期');await dialog.locator('[name=nutritionEndDate]').fill('2026-11-01');await expect(dialog.locator('.localized-date-value').last()).toHaveText('2026年11月1日');await page.locator('.goal-editor-inline .form-actions button').first().click();
 await page.evaluate(async()=>{const i=(await import('/src/locale.ts')).default;await i.changeLanguage('en')});await expect(page.locator('#today-progress-heading time')).toHaveText('Oct 18, 2026');await expect(page.locator('.weekday').last()).toHaveText('Sun');await openPersonalGoalEditor(page);await expect(page.locator('.goal-editor-inline .nutrition-goal-controls .localized-date-value').first()).toHaveText('Jan 1, 2026');await page.locator('.goal-editor-inline .form-actions button').first().click();
 await page.goto('/pantry');const fab=page.locator('.pantry-fab');await expect(fab).toBeVisible();expect(await page.locator('.search button').count()).toBe(0);const bounds=await fab.boundingBox(),nav=await page.locator('.mobile-nav').boundingBox();expect(bounds!.y+bounds!.height).toBeLessThan(nav!.y);await page.evaluate(()=>window.scrollTo({top:900,behavior:'instant'}));await expect(fab).toBeInViewport();expect(await fab.boundingBox()).toEqual(bounds);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:output+`交互精修-食材FAB-${width}.png`});await fab.click();await expect(page.getByRole('dialog')).toBeVisible();
});
