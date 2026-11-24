import {test,expect} from '@playwright/test';
test.use({browserName:'webkit',channel:'',isMobile:true,hasTouch:true,viewport:{width:390,height:844}});
for(const width of [320,375,390,430])for(const language of ['zh','en'])test(`nutrition-only Today ${width} ${language}`,async({page})=>{
 await page.setViewportSize({width,height:844});await page.goto('/today');await expect(page.locator('#today-tab-food')).toBeVisible();
 const before=await page.evaluate(async language=>{const d=await import('/src/domain.ts');await d.db.settings.put({key:'language',value:language});await d.db.activities.put({...d.stamp(),date:d.localDate(),type:'other',name:'Legacy movement',duration:60,distance:null,caloriesBurned:500,notes:''});const p=await import('/src/exercise-plans.ts');await p.exercisePlans.put({...d.stamp(),name:'Legacy plan',enabled:true,schedule:'daily',days:[],dates:[],notes:'',exercises:[]});sessionStorage.setItem('betterlumi.page-session.v1',JSON.stringify({route:'/today',tab:'activity',todayDate:d.localDate(),scrollY:0}));return (await d.exportAll()).tables},language);await page.reload();
 await expect(page.locator('.today-tab-bar [role=tab]')).toHaveCount(5);await expect(page.locator('#today-tab-food')).toHaveAttribute('aria-selected','true');await expect(page.locator('#today-tab-activity,[data-ring=exercise],[data-testid=exercise-progress]')).toHaveCount(0);
 await page.locator('#today-tab-more').click();await expect(page.locator('.exercise-goal-controls,.current-exercise-targets')).toHaveCount(0);
 await page.locator('#today-tab-calculator').click();await expect(page.locator('#today-panel-calculator')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const after=await page.evaluate(async()=>{const d=await import('/src/domain.ts');return (await d.exportAll()).tables});expect(after).toEqual(before);
 await page.reload();await expect(page.locator('#today-tab-calculator')).toHaveAttribute('aria-selected','true');
});

test('calculator assumptions change estimates without creating movement records or silently applying goals',async({page})=>{
 await page.goto('/today');await page.locator('#today-tab-food').waitFor();await page.evaluate(async()=>{const d=await import('/src/domain.ts');await d.db.settings.bulkPut([{key:'heightCm',value:'175'},{key:'healthGoalCalculatorDraft',value:JSON.stringify({version:1,value:{age:30,targetWeight:70,duration:20,durationUnit:'weeks',weightUnit:'kg',sex:'male',activity:'light',excluded:false,exerciseEnabled:true,exerciseMinutes:150}})}]);await d.weights.put({...d.stamp(),date:d.localDate(),kg:75,notes:''})});await page.reload();await page.locator('#today-tab-calculator').click();const section=page.locator('.calculator-input-section');if(!await section.evaluate(e=>(e as HTMLDetailsElement).open))await section.locator(':scope > summary').click();
 const before=await page.evaluate(async()=>{const d=await import('/src/domain.ts');return (await d.exportAll()).tables});const old=await page.locator('[data-testid=planner-exercise-calories]').textContent();await page.locator('[name=exerciseMinutes]').fill('300');await expect(page.locator('[data-testid=planner-exercise-calories]')).not.toHaveText(old!);
 await expect(page.locator('.energy-estimate-breakdown')).toBeVisible();
 await expect.poll(async()=>page.evaluate(async()=>JSON.parse((await (await import('/src/domain.ts')).db.settings.get('healthGoalCalculatorDraft'))!.value).value.exerciseMinutes)).toBe(300);
 for(const theme of ['misty','apricot','lavender','olive']){await page.evaluate(async theme=>{const {applyTheme}=await import('/src/themes.ts');applyTheme(theme)},theme);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)}
 const after=await page.evaluate(async()=>{const d=await import('/src/domain.ts');return (await d.exportAll()).tables});for(const table of Object.keys(before))if(table!=='settings')expect(after[table]).toEqual(before[table]);
 await page.screenshot({path:'work/screenshots/exercise-retirement-calculator.png'});
});

test('remaining library and Food Storage entry points still load',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/recipes');await expect(page.locator('.recipe-fab')).toBeVisible();await page.locator('#recipes-storage-tab').click();await page.locator('.storage-make-trigger').click();await expect(page.locator('.storage-make-modal input[name=batchName]')).toBeVisible();await expect(page.locator('.storage-make-modal .form-actions')).toBeVisible();await page.locator('.storage-make-modal .modal-head button').click();await page.goto('/pantry');await expect(page.locator('.pantry-fab')).toBeVisible();await page.goto('/weight');await expect(page.locator('main')).toBeVisible();expect(errors).toEqual([]);
});
