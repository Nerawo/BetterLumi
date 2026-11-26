import {openPersonalGoalEditor} from './current-ui';
import {test,expect} from '@playwright/test';
test.use({browserName:'webkit',channel:'',isMobile:true,hasTouch:true});
for(const width of [390,430])for(const language of ['zh','en'])test('Goal masters preserve settings and independent overview flow '+width+' '+language,async({page})=>{
 await page.setViewportSize({width,height:844});await page.clock.setFixedTime(new Date('2026-10-19T12:00:00-04:00'));await page.goto('/today');
 const baseline=await page.evaluate(async language=>{
  const d=await import('/src/domain.ts'),g=await import('/src/goals.ts');await d.db.settings.bulkPut([{key:'language',value:language},{key:'theme',value:'apricot'}]);
  const old={...d.stamp(),startDate:'2026-10-01',endDate:null,calorieMin:1000,calorieMax:1200,exerciseMode:'weekly',exerciseMinutes:600,exerciseKcal:2500,nutritionGoals:{calories:{mode:'weekly',min:1000,max:1200},protein:{mode:'daily',min:80,max:null},carbs:{mode:'daily',min:10,max:100},fat:{mode:'off',min:null,max:null}}};await g.goalTable.put(old);
  await d.foodLogs.put({...d.stamp(),date:'2026-10-19',name:'Lunch',source:'quick',sourceId:null,category:'lunch',quantity:1,unit:'entry',lines:[],cookingNote:'',nutrition:{calories:132,protein:12,carbs:20,fat:5}});
  for(const [date,duration,caloriesBurned] of [['2026-10-19',430,1150],['2026-10-20',70,null]] as const)await d.db.activities.put({...d.stamp(),date,name:'Actual',type:'other',duration,caloriesBurned,distance:null,notes:''});return {old,backup:await d.exportAll()};
 },language);await page.reload();const food=page.getByTestId('food-progress');
 await expect(food.locator('.calorie-reading')).toHaveText('132kcal');
 await expect(page.getByTestId('exercise-progress')).toHaveCount(0);
 const editor=await openPersonalGoalEditor(page);
 const enabled=editor.getByRole('checkbox',{name:language==='zh'?'启用营养目标':'Enable nutrition goals',exact:true});
 const target=editor.locator('[name=caloriesTarget]');
 await expect(target).toHaveValue('1100');
 await enabled.uncheck();
 await expect(editor.locator('.nutrition-goal-fields')).toBeHidden();
 await expect(food.locator('[data-goal-metric=calories]')).toHaveCount(1);
 await editor.locator('.form-actions button').first().click();
 await openPersonalGoalEditor(page);
 await expect(enabled).toBeChecked();
 await editor.locator('[name=nutritionStartDate]').fill('2026-10-19');
 for(const on of [false,true]){
  await enabled.setChecked(on);
  if(on)await expect(target).toHaveValue('1100');
  await editor.locator('.form-actions .primary').click();
  await expect(editor).toHaveCount(0);
  await expect(food.locator('[data-goal-metric=calories]')).toHaveCount(on?1:0);
  if(!on){
   const disabled=await page.evaluate(async()=>{
    const {exportAll,restoreAll}=await import('/src/domain.ts');
    const backup=await exportAll();
    await restoreAll(JSON.parse(JSON.stringify(backup)));
    return {version:backup.version,goal:(backup.tables.goals as import('../src/goal-model').Goal[]).find(row=>row.nutritionOnly)};
   });
   expect(disabled.version).toBe(20);
   expect(disabled.goal).toMatchObject({nutritionEnabled:false,nutritionGoals:baseline.old.nutritionGoals});
  }
  await page.reload();await openPersonalGoalEditor(page);
  await expect(enabled).toBeChecked({checked:on});
 }
 await editor.locator('.advanced-nutrition-toggle').click();
 await expect(editor.locator('[name=proteinTarget]')).toHaveValue('80');
 const review=await page.evaluate(async()=>{const g=await import('/src/goals.ts');const rows=await g.goalTable.toArray();return {rows,current:g.activeGoal(rows,'2026-10-19')};});
 expect(review.rows).toHaveLength(2);
 await expect(editor.locator('[name=carbsTarget]')).toHaveValue('55');
 expect(review.current!.nutritionGoals).toEqual(baseline.old.nutritionGoals);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const after=await page.evaluate(async()=>{const d=await import('/src/domain.ts');return d.exportAll()});for(const [key,rows]of Object.entries(baseline.backup.tables))if(key!=='goals')expect(after.tables[key as keyof typeof after.tables]).toEqual(rows);expect(after.tables.goals.find((g:{id:string})=>g.id===baseline.old.id)).toEqual(baseline.old);
});

test('manual switch preserves saved targets, switches, dates and tolerance revision through restore',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/today');
 const saved=await page.evaluate(async()=>{
  const {db,stamp,localDate}=await import('/src/domain.ts');
  const {goalTable}=await import('/src/goals.ts');
  const startDate=localDate();
  const goal={...stamp(),startDate,endDate:null,nutritionPeriod:{startDate,endDate:null},
   nutritionOnly:true,nutritionEnabled:true,exerciseEnabled:false,exerciseMinutes:null,exerciseKcal:null,
   nutritionFrequency:'weekly' as const,nutritionToleranceRevision:'earlier',nutritionTolerances:{calories:7,protein:2,carbs:1,fat:3},
   nutritionTargets:{calories:1500,protein:81.5,carbs:null,fat:40},calorieMin:1493,calorieMax:1507,
   nutritionGoals:{calories:{mode:'weekly' as const,min:1493,max:1507},protein:{mode:'weekly' as const,min:79.5,max:83.5},
    carbs:{mode:'off' as const,min:null,max:null},fat:{mode:'off' as const,min:37,max:43}}};
  await goalTable.add(goal);
  await db.settings.put({key:'language',value:'en'});
  return goal;
 });
 await page.reload();
 for(const enabled of [false,true]){
  const editor=await openPersonalGoalEditor(page);
  const master=editor.getByRole('checkbox',{name:'Enable nutrition goals',exact:true});
  await expect(master).toBeChecked({checked:!enabled});
  await master.setChecked(enabled);
  if(enabled){
   await expect(editor.locator('[name=caloriesTarget]')).toHaveValue('1500');
   await editor.locator('.advanced-nutrition-toggle').click();
   await expect(editor.locator('[name=proteinTarget]')).toHaveValue('81.5');
   await expect(editor.locator('[data-goal-metric=fat] input[type=checkbox]')).not.toBeChecked();
  }
  await editor.locator('.form-actions .primary').click();
  await expect(editor).toHaveCount(0);
  const row=await page.evaluate(async id=>{
   const {exportAll,restoreAll}=await import('/src/domain.ts');
   const {goalTable}=await import('/src/goals.ts');
   const backup=await exportAll();
   await restoreAll(JSON.parse(JSON.stringify(backup)));
   return goalTable.get(id);
  },saved.id);
  expect(row).toEqual({...saved,nutritionEnabled:enabled,revision:saved.revision+(enabled?2:1),updatedAt:expect.any(String)});
  await page.reload();
 }
});
