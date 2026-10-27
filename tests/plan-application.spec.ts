import {test,expect,type Page} from '@playwright/test';

// Synthetic profiles only. Exercise and nutritional targets must commit together.
async function seed(page:Page,language:string,scheme:string){
 await page.goto('/today');await expect(page.locator('#today-tab-calculator')).toBeVisible();
 const fixture=await page.evaluate(async({language,scheme})=>{
  const d=await import('/src/domain.ts'),g=await import('/src/goals.ts'),m=await import('/src/macro-planner.ts');
  const weight=56,baseline=(10*weight+6.25*166-5*48-161)*1.2,targetWeight=weight-(baseline+420/7-1184)*12/1100;
  await d.db.settings.bulkPut([{key:'language',value:language},{key:'heightCm',value:'166'},{key:'healthGoalCalculatorDraft',value:JSON.stringify({version:1,value:{age:48,targetWeight,duration:12,durationUnit:'weeks',weightUnit:'kg',activity:'sedentary',sex:'female',excluded:false,exerciseEnabled:true,exerciseMinutes:150,nutritionPlan:scheme}})}]);
  const weightRow={...d.stamp(),date:d.localDate(),kg:weight};await d.weights.add(weightRow);
  const off={mode:'off',min:null,max:null},old={...d.stamp(),startDate:'2020-01-01',endDate:null,nutritionEnabled:false,exerciseEnabled:false,calorieMin:null,calorieMax:null,exerciseMinutes:null,exerciseKcal:null,nutritionGoals:{calories:off,protein:off,carbs:off,fat:off}};await g.goalTable.put(old);
  return {old,weightRow,macros:m.calculateMacroPlan(weight,1184,scheme as 'balanced'|'highProtein')!};
 },{language,scheme});
 await page.reload();await page.locator('#today-tab-calculator').click();await page.locator('.calculator-input-section>summary').click();return fixture;
}
for(const [scheme,language] of [['balanced','zh'],['highProtein','en']])test(`below-reference plan fully applies and persists ${scheme} ${language}`,async({page,context})=>{
 await page.setViewportSize({width:390,height:844});const fixture=await seed(page,language,scheme),p=page.locator('.health-calculator-inline');
 await page.emulateMedia({reducedMotion:'reduce'});await expect(p.getByTestId('planner-intake')).toContainText('1,184');await expect(p.locator('.calculator-theory-warning>summary')).toContainText(language==='zh'?'当前计划有健康参考提醒':'Health advisories for this plan');await expect(p.locator('.calculator-macro-cautions')).toBeVisible();
 const buttons=p.locator('.calculator-macro-options button');await buttons.nth(scheme==='balanced'?1:0).click();expect(await page.evaluate(async()=>{const g=await import('/src/goals.ts');return g.goalTable.toArray()})).toEqual([fixture.old]);await buttons.nth(scheme==='balanced'?0:1).click();
 await p.locator('.planner-live-summary>.form-actions .primary').click();const dialog=page.locator('.calculator-risk-modal');await expect(dialog).toBeVisible();await expect(dialog.getByTestId('risk-theoretical')).toContainText('1,184');
 for(const key of ['protein','carbs','fat'] as const){await expect(dialog.getByTestId('risk-'+key)).toHaveText(Math.round(fixture.macros[key])+' g');await expect(p.getByTestId('macro-'+key)).toHaveText(Math.round(fixture.macros[key])+'g')}
 await expect(dialog).toContainText('1,200');await expect(dialog).not.toContainText(language==='zh'?'仅保留估算':'Estimate only');expect(await dialog.evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(false);
 expect(await page.evaluate(async()=>{const g=await import('/src/goals.ts');return g.goalTable.count()})).toBe(1);
 await dialog.locator('.primary').click();await expect(dialog).toHaveCount(0);await expect(p.locator('.calculator-input-section')).not.toHaveAttribute('open');await expect(p.locator('.calculator-save-feedback')).toHaveText(language==='zh'?'✓ 已成功更新个人目标':'✓ Personal goals updated successfully');await expect(page.locator('.toast')).toHaveCount(0);await expect(page.locator('#today-tab-calculator')).toHaveAttribute('aria-selected','true');await expect(p.locator('.calculator-input-section>summary')).toBeFocused();await expect(p.locator('.calculator-input-section>summary')).toBeInViewport();
 await p.locator('.calculator-input-section>summary').click();await expect(p.locator('.calculator-save-feedback')).toHaveCount(0);await expect(p.locator('.calculator-macro-options [aria-pressed=true]')).toHaveText(language==='zh'?'均衡方案':'High Protein');await expect(p.locator('[name=currentWeight]')).toHaveValue('56');await expect(p.locator('[name=duration]')).toHaveValue('12');
 const saved=await page.evaluate(async()=>{const d=await import('/src/domain.ts'),g=await import('/src/goals.ts');return {rows:await g.goalTable.toArray(),current:g.activeGoal(await g.goalTable.toArray(),d.localDate()),weights:await d.weights.toArray()}});
 expect(saved.rows).toHaveLength(3);expect(saved.rows.find(row=>row.id===fixture.old.id)).toEqual(fixture.old);expect(saved.weights).toEqual([fixture.weightRow]);expect(saved.current).toMatchObject({nutritionEnabled:true,exerciseEnabled:true,calorieMin:1134,calorieMax:1234,exerciseMinutes:150,exerciseKcal:420,exerciseMode:'weekly',nutritionTargets:{calories:1184,protein:fixture.macros.protein,carbs:fixture.macros.carbs,fat:fixture.macros.fat}});
 for(const key of ['calories','protein','carbs','fat'] as const)expect(saved.current!.nutritionGoals![key].mode).toBe('daily');
 await expect(page.getByTestId('food-progress').locator('.macro-goal-ring')).toHaveCount(3);await page.locator('#today-tab-more').click();await expect(page.getByTestId('current-calorie-target')).toContainText('1,184');await expect(page.getByTestId('current-goals').locator('.current-goal-macros')).toContainText(String(Number(fixture.macros.protein.toFixed(6))));
 await page.reload();await expect(page.getByTestId('current-calorie-target')).toContainText('1,184');expect(await page.evaluate(async()=>{const g=await import('/src/goals.ts');return g.goalTable.toArray()})).toEqual(saved.rows);
 const reopened=await context.newPage();await reopened.goto('/today');await expect(reopened.getByTestId('food-progress').locator('.macro-goal-ring')).toHaveCount(3);expect(await reopened.evaluate(async()=>{const g=await import('/src/goals.ts');return g.goalTable.toArray()})).toEqual(saved.rows);await reopened.close();
});
test('exercise write failure rolls back nutrition without reporting success',async({page})=>{
 const fixture=await seed(page,'en','highProtein');await page.evaluate(async()=>{const g=await import('/src/goals.ts');g.goalTable.hook('creating',(_key,row)=>{if(row.scope==='exercise')throw Error('Synthetic exercise write failure')})});
 await page.locator('.planner-live-summary>.form-actions .primary').click();const dialog=page.locator('.calculator-risk-modal');await dialog.locator('.primary').click();await expect(dialog.locator('[role=alert]')).toBeVisible();await expect(dialog).toBeVisible();await expect(page.locator('.toast')).toHaveCount(0);await expect(page.locator('.calculator-input-section')).toHaveAttribute('open');await expect(page.locator('.calculator-save-feedback')).toHaveCount(0);expect(await page.evaluate(async()=>{const g=await import('/src/goals.ts');return g.goalTable.toArray()})).toEqual([fixture.old]);
});
for(const professional of [false,true])test(`successful ${professional?'professional':'ordinary'} application collapses without resetting inputs`,async({page})=>{
 await page.setViewportSize({width:390,height:844});await seed(page,'en','highProtein');const p=page.locator('.health-calculator-inline');
 await p.locator('[name=duration]').fill('40');
 if(professional){await p.locator('.calculator-special-settings>summary').click();await p.locator('[name=specialOrProfessionalGuidance]').check();await p.locator('[name=professionalKcal]').fill('1050')}
 const target=await p.locator('[name=targetWeight]').inputValue();await p.locator('.planner-live-summary>.form-actions .primary').click();
 if(professional)await page.locator('.calculator-risk-modal .primary').click();else await expect(page.locator('.calculator-risk-modal')).toHaveCount(0);
 await expect(p.locator('.calculator-input-section')).not.toHaveAttribute('open');await expect(p.locator('.calculator-save-feedback')).toHaveText('✓ Personal goals updated successfully');await expect(page.locator('.toast')).toHaveCount(0);await expect(p.locator('.calculator-input-section>summary')).toBeFocused();await expect(p.locator('.calculator-input-section>summary')).toBeInViewport();
 const saved=await page.evaluate(async()=>{const d=await import('/src/domain.ts'),g=await import('/src/goals.ts');return g.activeGoal(await g.goalTable.toArray(),d.localDate())});expect(saved?.evaluationCalorieTarget??saved?.nutritionTargets?.calories).toBeGreaterThan(0);if(professional){expect(saved?.evaluationCalorieTarget).toBe(1050);for(const nutrient of ['protein','carbs','fat'] as const)expect(saved?.nutritionGoals?.[nutrient].mode).toBe('off')}
 await p.locator('.calculator-input-section>summary').click();await expect(p.locator('.calculator-save-feedback')).toHaveCount(0);await expect(p.locator('[name=duration]')).toHaveValue('40');await expect(p.locator('[name=targetWeight]')).toHaveValue(target);if(professional)await expect(p.locator('[name=professionalKcal]')).toHaveValue('1050');else await expect(p.locator('.calculator-macro-options [aria-pressed=true]')).toHaveText('High Protein');
});
