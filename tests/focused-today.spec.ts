import {test,expect} from '@playwright/test';
const output='./work/screenshots/';
test.use({isMobile:true,hasTouch:true});
for(const width of [390,430]) for(const lang of ['zh','en'])test(`Stable overview, compact schedule and independent to-dos ${width} ${lang}`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.clock.install({time:new Date('2026-10-18T12:00:00-04:00')});await page.goto('/today');
 const seed=await page.evaluate(async lang=>{
  const d=await import('/src/domain.ts'),g=await import('/src/goals.ts'),p=await import('/src/exercise-plans.ts');
  await d.db.settings.put({key:'language',value:lang});
  const goal={...d.stamp(),startDate:'2026-10-12',endDate:'2026-10-14',calorieMin:1500,calorieMax:1900,exerciseMinutes:30,exerciseKcal:200};
  const weekly={...goal,...d.stamp(),startDate:'2026-10-15',endDate:'2026-10-18',exerciseMode:'weekly',nutritionGoals:Object.fromEntries(['calories','protein','carbs','fat'].map(key=>[key,{mode:'weekly',min:0,max:2000}]))};
  await g.goalTable.bulkPut([goal,weekly]);
  const food={...d.stamp(),date:'2026-10-13',name:'食物',category:'lunch',source:'quick',sourceId:null,quantity:1,unit:'entry',lines:[],nutrition:{calories:600,protein:30,carbs:40,fat:20},cookingNote:''};
  const partial={...food,...d.stamp(),date:'2026-10-14',nutrition:{calories:200,protein:null,carbs:0,fat:null}};
  const unknown={...food,...d.stamp(),date:'2026-10-14',nutrition:{calories:null,protein:null,carbs:null,fat:null}};
  const zero={...food,...d.stamp(),date:'2026-10-16',nutrition:{calories:0,protein:0,carbs:0,fat:0}};
  await d.foodLogs.bulkPut([food,partial,unknown,zero]);
  const activity={...d.stamp(),date:'2026-10-13',name:'Walk',duration:30,distance:2,caloriesBurned:120,notes:'',tags:[]};
  const unknownActivity={...activity,...d.stamp(),date:'2026-10-14',duration:null,caloriesBurned:null};await d.db.activities.bulkPut([activity,unknownActivity]);
  const plan={...d.stamp(),name:'每周舒展与户外步行 Weekly walking',enabled:true,schedule:'daily',days:[],dates:[],notes:'',exercises:[{id:'exercise',name:'Walk',duration:30,distance:2,estimatedCalories:120,notes:''}]};await p.exercisePlans.put(plan);
  const old={...d.stamp(),title:'旧日程 Legacy reminder',notes:'历史备注',date:'2026-10-18',kind:'activity'},done={...d.stamp(),title:'已完成提醒',notes:'原备注',date:'2026-10-18',kind:'supplement',completed:true};await d.plans.bulkPut([old,done]);
  return {old,done,plan,goal,weekly,food,activity};
 },lang);
 await page.reload();const overview=page.locator('.today-progress'),food=page.getByTestId('food-progress'),exercise=page.getByTestId('exercise-progress');
 await expect(overview).toBeVisible();await page.locator('.compact-calendar .calendar-controls button').last().click();
 await expect(exercise).toHaveCount(0);
 for(const [date,value] of [['2026-10-13','600'],['2026-10-14','200'],['2026-10-16','0']]){
  await page.locator('[data-date="'+date+'"]').click();
  await expect(food.locator('.calorie-reading')).toHaveText(value+'kcal');
  expect(await overview.evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
 }
 await page.locator('[data-date="2026-10-18"]').click();await page.locator('#today-tab-more').click();const utility=page.locator('.other-daily-plans');await utility.locator('summary').click();await expect(utility.locator('summary')).toContainText(lang==='zh'?'待办与备忘':'To-Dos & Notes');
 const legacy=page.locator(`[data-todo-id="${seed.old.id}"]`),done=page.locator(`[data-todo-id="${seed.done.id}"]`);await expect(done.locator('input')).toBeChecked();await expect(legacy).toHaveCount(0);await done.locator('input').uncheck();await expect(done.locator('input')).not.toBeChecked();
 await utility.getByRole('button',{name:lang==='zh'?'添加':'Add',exact:true}).click();const dialog=page.locator('.todo-editor-modal');await expect(dialog).toHaveAttribute('aria-label',lang==='zh'?'添加待办':'Add To-Do');await expect(dialog.locator('select')).toHaveCount(0);await expect(dialog.locator('[name=date]')).toHaveValue('2026-10-18');await dialog.locator('[name=title]').fill('预约检查');await dialog.locator('[name=notes]').fill('携带资料');await dialog.locator('.primary').click();await expect(dialog).toHaveCount(0);
 const created=utility.locator('.todo-row').filter({hasText:'预约检查'});await expect(created).toHaveCount(1);await created.locator('input').check();await created.getByRole('button',{name:lang==='zh'?'编辑':'Edit',exact:true}).click();await expect(dialog).toHaveAttribute('aria-label',lang==='zh'?'编辑待办':'Edit To-Do');await dialog.locator('[name=title]').fill('预约复查');await dialog.locator('.primary').click();await expect(dialog).toHaveCount(0);
 await page.reload();await page.locator('.other-daily-plans summary').click();await expect(legacy).toHaveCount(0);await expect(done.locator('input')).not.toBeChecked();const saved=utility.locator('.todo-row').filter({hasText:'预约复查'});await expect(saved.locator('input')).toBeChecked();await expect(saved).toContainText('携带资料');
 await utility.scrollIntoViewIfNeeded();await page.screenshot({path:output+`本轮细化-待办-${width}-${lang}.png`});
 const snapshot=await page.evaluate(async id=>{const d=await import('/src/domain.ts');return {legacy:await d.plans.get(id),activities:await d.db.activities.toArray(),food:await d.foodLogs.toArray(),checks:await d.db.checks.count(),version:d.db.verno}},seed.old.id);
 expect(snapshot.legacy).toEqual(seed.old);expect(snapshot.activities).toHaveLength(2);expect(snapshot.food).toHaveLength(4);expect(snapshot.checks).toBe(0);expect(snapshot.version).toBe(8);expect(snapshot.activities[0].id===seed.activity.id||snapshot.activities[1].id===seed.activity.id).toBe(true);
 await saved.locator('input').uncheck();await page.addLocatorHandler(page.locator('.delete-confirmation-modal'),async dialog=>{await dialog.locator('.delete-destructive').click()},{times:1});await saved.getByRole('button',{name:lang==='zh'?'删除':'Delete',exact:true}).click();await expect(saved).toHaveCount(0);
 await page.goto('/today?date=2026-10-17');await page.locator('#today-tab-more').click();await page.locator('.other-daily-plans summary').click();await utility.getByRole('button',{name:lang==='zh'?'添加':'Add',exact:true}).click();await expect(dialog.locator('[name=date]')).toHaveValue('2026-10-17');await dialog.locator('[name=title]').fill('历史待办');await dialog.locator('.primary').click();await expect(dialog).toHaveCount(0);await page.reload();await page.locator('#today-tab-more').click();await page.locator('.other-daily-plans summary').click();await expect(utility).toContainText('历史待办');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.goto('/today?date=2026-10-19');await expect(food.locator('.progress-number')).toHaveText(lang==='zh'?'未记录':'Not recorded');
});
