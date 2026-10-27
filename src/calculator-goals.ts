import {calculateMacroPlan} from './macro-planner';
import {weightInKg} from './calculator-model';
import {professionalCalorieTarget,specialCircumstances} from './professional-guidance';
import {saveCalculatorDraft,validCalculatorDraft,type CalculatorDraft} from './calculator-settings';
import {planInteractively,type PlannerSettings} from './interactive-planner';
import type {PlanAssessmentInput} from './goal-plan-assessment';
import {db,localDate} from './domain';
import {goalTable,resolvedGoal,saveGoalVersion} from './goals';
import {configuredNutritionGoals,type Goal} from './goal-model';
import {acceptableRange,currentTolerances,parseToleranceEvents} from './goal-tolerance-model';
import {calculateHealthGoal,calculatorTarget,type CalculatorInput,type CalculatorTarget} from './health-calculator';
import {heightSettingKey,parseHeightCm} from './bmi-profile';
import {validLocalDate} from './routing';
import type {RecordBase} from './db';

/** Re-evaluate at the persistence boundary. UI eligibility is never authority. */
export async function applyInteractiveGoals(input:PlanAssessmentInput,settings:PlannerSettings,section:'nutrition'|'exercise'|'maintenance',date=localDate()){
 const result=planInteractively(input,settings);
 if(!validLocalDate(date))throw Error('Invalid effective date');
 if(section==='maintenance'){
  if(result.conservativeTarget===null||input.heightCm===null)throw Error('No conservative calorie target');
  return saveCalculatorCalories(input.heightCm,result.conservativeTarget,date);
 }
 if(section==='nutrition'){
  if(!result.nutritionApplicable||result.targetKcal===null||input.heightCm===null)throw Error('No valid calorie target');
  return saveCalculatorCalories(input.heightCm,result.targetKcal,date);
 }
 if(!result.exerciseApplicable||result.exerciseKcal===null||result.exerciseMinutes===null)throw Error('No valid exercise target');
 await saveGoalVersion({scope:'exercise',startDate:date,endDate:null,exercisePeriod:{startDate:date,endDate:null},nutritionEnabled:false,exerciseEnabled:true,exerciseMode:'weekly',calorieMin:null,calorieMax:null,exerciseMinutes:result.exerciseMinutes,exerciseKcal:Math.round(result.exerciseKcal)});
 return {target:result.exerciseMinutes,min:result.exerciseMinutes,max:result.exerciseMinutes,date};
}

/** Explicit confirmation appends only a calorie-scoped version. It cannot
 * re-enable, reschedule or otherwise override exercise/macronutrient goals. */
export async function applyCalculatorGoals(input:CalculatorInput,kind:CalculatorTarget='plan',date=localDate(),_legacyConfirmation?:unknown){
  const result=calculateHealthGoal(input),target=calculatorTarget(result,kind);
  if(target===null||!Number.isFinite(target)||target<=0||!validLocalDate(date))throw Error('No valid calorie target');
  return saveCalculatorCalories(input.heightCm,target,date);
}

async function saveCalculatorCalories(height:number|null,target:number,date:string,source:'automatic'|'professional'='automatic'){
  // Legacy acknowledgements cannot bypass the current individual plan screening.
  return db.transaction('rw',goalTable,db.settings,async()=>{
    // Guidance never changes body data or the recorded weight source.
    if(height!==null&&parseHeightCm((await db.settings.get(heightSettingKey))?.value)!==height)throw Error('Calculator inputs changed');
    const events=parseToleranceEvents((await db.settings.get('goalTolerances'))?.value),tolerances=currentTolerances(events);
    const previous=resolvedGoal(await goalTable.toArray(),date),configs=configuredNutritionGoals(previous);
    const range=acceptableRange(target,tolerances.calories),mode=previous?.nutritionFrequency??(configs.calories.mode==='off'?'daily':configs.calories.mode);
    const value:Omit<Goal,keyof RecordBase>={
      scope:'calories',calorieSource:source,startDate:date,endDate:null,nutritionPeriod:{startDate:date,endDate:null},
      nutritionEnabled:true,exerciseEnabled:false,nutritionFrequency:mode,
      nutritionGoals:{calories:{mode,...range},protein:{mode:'off',min:null,max:null},carbs:{mode:'off',min:null,max:null},fat:{mode:'off',min:null,max:null}},
      nutritionTargets:{calories:target,protein:null,carbs:null,fat:null},nutritionTolerances:tolerances,nutritionToleranceRevision:events.at(-1)?.id,
      calorieMin:range.min,calorieMax:range.max,exerciseMinutes:null,exerciseKcal:null,
    };
    await saveGoalVersion(value);
    return {target,min:range.min!,max:range.max!,date};
  });
}


/** One atomic operation across nutrition/exercise versions and the planning draft.
 * A repeated click with the same plan and unchanged goal history is a no-op. */
export async function applyCalculatorPlan(draft:CalculatorDraft,input:PlanAssessmentInput,choice:'plan'|'eligible'|'professional'='plan',date=localDate()){
 if(!validCalculatorDraft(draft)||!validLocalDate(date)||!['plan','eligible','professional'].includes(choice))throw Error('Invalid plan');
 input={...input,excluded:specialCircumstances(draft).active};
 const result=planInteractively(input,draft);
 const professional=choice==='professional';
 const guidedTarget=professionalCalorieTarget(draft);
 if(professional&&guidedTarget===null)throw Error('Invalid professional target');
 const nutrition=true;
 const exercise=!!(draft.exerciseEnabled&&result.exerciseApplicable);
 const macros=!professional&&result.bodyValid&&!input.excluded?calculateMacroPlan(input.currentWeight===null?null:weightInKg(input.currentWeight,input.weightUnit),result.targetKcal,draft.nutritionPlan??'balanced'):null;
 // An automatic plan is all-or-nothing, including all three macro targets.
 // The legacy 'eligible' action must never silently degrade to exercise only.
 if(!professional&&(!result.nutritionApplicable||macros===null||(draft.exerciseEnabled&&!result.exerciseApplicable)))throw Error('No complete calculator plan');
 const outcome={nutrition:!!nutrition,exercise,duplicate:false};
 return db.transaction('rw',goalTable,db.settings,async()=>{
  const rows=await goalTable.toArray(),current=resolvedGoal(rows,date);
  const sameDateScope=(scope:'calories'|'exercise')=>rows.some(row=>!row.deletedAt&&row.scope===scope&&row.startDate===date&&row.endDate===null);
  const target=professional?guidedTarget:result.targetKcal;
  const tolerances=nutrition?currentTolerances(parseToleranceEvents((await db.settings.get('goalTolerances'))?.value)):currentTolerances([]);
  const range=acceptableRange(target,tolerances.calories),calories=configuredNutritionGoals(current).calories;
  const latestCalories=rows.filter(row=>!row.deletedAt&&row.scope==='calories'&&row.startDate===date&&row.endDate===null).sort((a,b)=>b.revision-a.revision)[0];
  const sameCalories=sameDateScope('calories')&&current?.nutritionEnabled!==false&&calories.mode!=='off'&&(latestCalories?.calorieSource??'automatic')===(professional?'professional':'automatic')&&latestCalories?.nutritionTargets?.calories===target&&calories.min===range.min&&calories.max===range.max;
  const frequency=current?.nutritionFrequency??(calories.mode==='off'?'daily':calories.mode);
  const targets=macros?{calories:target,protein:macros.protein,carbs:macros.carbs,fat:macros.fat}:null;
  const configs=configuredNutritionGoals(current);
  const matchingNutritionRow=rows.some(row=>!row.deletedAt&&row.nutritionOnly&&row.nutritionPeriod?.startDate===date&&row.nutritionPeriod.endDate===null);
  const sameNutrition=targets?matchingNutritionRow&&current?.nutritionEnabled!==false&&current?.nutritionFrequency===frequency&&(['calories','protein','carbs','fat'] as const).every(key=>{const expected=acceptableRange(targets[key],tolerances[key]);return current?.nutritionTargets?.[key]===targets[key]&&configs[key].mode===frequency&&configs[key].min===expected.min&&configs[key].max===expected.max}):sameCalories;
  const sameExercise=sameDateScope('exercise')&&current?.exerciseEnabled!==false&&current?.exerciseMode==='weekly'&&current.exerciseMinutes===result.exerciseMinutes&&current.exerciseKcal===Math.round(result.exerciseKcal??0);
  if(nutrition&&!sameNutrition){
   if(targets){
    if(input.heightCm!==null&&parseHeightCm((await db.settings.get(heightSettingKey))?.value)!==input.heightCm)throw Error('Calculator inputs changed');
    const events=parseToleranceEvents((await db.settings.get('goalTolerances'))?.value);
    const nutritionGoals=Object.fromEntries((['calories','protein','carbs','fat'] as const).map(key=>[key,{mode:frequency,...acceptableRange(targets[key],tolerances[key])}])) as NonNullable<Goal['nutritionGoals']>;
    // Additive nutrition-only metadata isolates this version from every exercise
    // period, including future dated goals and unrestricted baselines.
    await saveGoalVersion({nutritionOnly:true,startDate:date,endDate:null,nutritionPeriod:{startDate:date,endDate:null},nutritionEnabled:true,nutritionFrequency:frequency,nutritionTargets:targets,nutritionTolerances:tolerances,nutritionToleranceRevision:events.at(-1)?.id,nutritionGoals,calorieMin:range.min,calorieMax:range.max,exerciseEnabled:false,exerciseMinutes:null,exerciseKcal:null});
   }else if(professional)await saveCalculatorCalories(input.heightCm,target!,date,'professional');
  }
  if(exercise&&!sameExercise)await applyInteractiveGoals(input,draft,'exercise',date);
  await saveCalculatorDraft(draft);
  outcome.duplicate=(!nutrition||sameNutrition)&&(!exercise||sameExercise);
  return outcome;
 });
}
