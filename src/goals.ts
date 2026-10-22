import {evaluateToleranceGoal} from './goal-tolerance-model';
import { db, stamp, type FoodLog } from "./domain";
import type { Activity, RecordBase, Supplement } from "./db";
import { validLocalDate } from "./routing";
export {nutritionGoals} from "./goal-model";
export type {Goal,NutritionGoal,NutritionGoals} from "./goal-model";
import {exerciseGoalsEnabled,nutritionGoals,validGoalConfig,goalPeriod,periodApplies,type GoalSection,type GoalPeriod,type Goal} from "./goal-model";
import {dailyAggregation,type NutritionMetric,nutritionMetrics} from "./aggregation";
export interface RecipeNote extends RecordBase {
  recipeId: string;
  text: string;
}
export const goalTable = db.table<Goal>("goals");
export const recipeNotes = db.table<RecipeNote>("recipeNotes");
export function isScheduled(s: Supplement, date: string) {
  const day = new Date(date + "T12:00:00").getDay();
  return (
    s.schedule === "daily" ||
    (s.schedule === "weekdays" && day >= 1 && day <= 5) ||
    (s.schedule === "custom" && (s.days ?? []).includes(day))
  );
}
export function goalVersionOrder(a:Goal,b:Goal){
 return b.startDate.localeCompare(a.startDate)||b.revision-a.revision||b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id);
}
/** Resolve each goal family against its own period; legacy rows share their original dates. */
function selectSectionVersion(goals:Goal[],start:string,end:string,section:GoalSection){
 const candidates=goals.filter(g=>!g.deletedAt&&periodApplies(goalPeriod(g,section),start,end));
 const revisionOrder=(a:Goal,b:Goal)=>b.revision-a.revision||b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id);
 const unrestricted=candidates.filter(g=>goalPeriod(g,section).unrestricted).sort(revisionOrder)[0];
 // A newer applicable dated version can supersede an unrestricted baseline even
 // when backdated. Among dated versions keep the established start-date ordering.
 const dated=candidates.filter(g=>!goalPeriod(g,section).unrestricted&&(!unrestricted||revisionOrder(g,unrestricted)<0));
 return dated.sort((a,b)=>goalPeriod(b,section).startDate.localeCompare(goalPeriod(a,section).startDate)||revisionOrder(a,b))[0]??unrestricted??null;
}
export function sectionGoal(goals:Goal[],start:string,end:string,section:GoalSection){return selectSectionVersion(goals.filter(goal=>section==='nutrition'?!goal.scope:goal.scope!=='calories'),start,end,section)}
/** Compose a read-only view; never persist or rewrite these resolved versions. */
export function resolvedGoal(goals:Goal[],start:string,end=start):Goal|null {
 const nutrition=evaluateToleranceGoal(sectionGoal(goals,start,end,'nutrition'),end),exercise=sectionGoal(goals,start,end,'exercise');
 const latest=selectSectionVersion(goals.filter(goal=>goal.scope!=='exercise'),start,end,'nutrition'),calories=latest?.scope==='calories'?evaluateToleranceGoal(latest,end):null;
 if(!calories&&nutrition===exercise)return nutrition;
 const base=[nutrition,exercise,calories].filter((g):g is Goal=>g!==null).sort((a,b)=>b.revision-a.revision||goalVersionOrder(a,b))[0];if(!base)return null;
 const result:Goal={...base,scope:undefined,evaluationCalorieTarget:nutrition?.nutritionTargets?.calories??null,nutritionTargets:nutrition?.nutritionTargets,nutritionTolerances:nutrition?.nutritionTolerances,nutritionToleranceRevision:nutrition?.nutritionToleranceRevision,evaluationToleranceEvents:nutrition?.evaluationToleranceEvents,nutritionFrequency:nutrition?.nutritionFrequency,nutritionGoals:nutrition?.nutritionGoals,calorieMin:nutrition?.calorieMin??null,calorieMax:nutrition?.calorieMax??null,nutritionEnabled:nutrition?nutrition.nutritionEnabled!==false:false,nutritionPeriod:nutrition?goalPeriod(nutrition,'nutrition'):undefined,exerciseMode:exercise?.exerciseMode,exerciseMinutes:exercise?.exerciseMinutes??null,exerciseKcal:exercise?.exerciseKcal??null,exerciseEnabled:exercise?exercise.exerciseEnabled!==false:false,exercisePeriod:exercise?goalPeriod(exercise,'exercise'):undefined};
 if(!calories)return result;
 const configs=nutritionGoals(nutrition),config=nutritionGoals(calories).calories;
 // Resolve non-calorie goals from their own original versions and periods.
 // A calculator version must not extend, enable or supersede those references.
 return {...result,evaluationCalorieTarget:calories.nutritionTargets?.calories??null,nutritionEnabled:true,nutritionGoals:{...configs,calories:config},calorieMin:config.min,calorieMax:config.max,nutritionPeriod:goalPeriod(calories,'nutrition'),nutritionFrequency:nutrition?nutrition.nutritionFrequency:calories.nutritionFrequency,
   nutritionTargets:nutrition&&!nutrition.nutritionTargets?undefined:{...(nutrition?.nutritionTargets??{calories:null,protein:null,carbs:null,fat:null}),calories:calories.nutritionTargets?.calories??null},
   nutritionTolerances:{...(nutrition?.nutritionTolerances??calories.nutritionTolerances!),calories:calories.nutritionTolerances!.calories},nutritionToleranceRevision:calories.nutritionToleranceRevision};
}
export function activeGoal(goals:Goal[],date:string){return resolvedGoal(goals,date);}
export type GoalStatus = "below" | "within" | "above" | null;
export function goalStatus(
  goals: Goal[],
  date: string,
  logs: FoodLog[],
  activities: Activity[],
) {
  const goal = activeGoal(goals, date);
  const daily=dailyAggregation(date,logs,activities),configs=nutritionGoals(goal);
  const nutritionStatuses=Object.fromEntries(nutritionMetrics.map(metric=>[metric,configs[metric].mode==="daily"&&daily.nutrients[metric].complete?rangeStatus(daily.nutrients[metric].value,configs[metric].min,configs[metric].max):null])) as Record<NutritionMetric,GoalStatus>;
  const intake=daily.nutrition.calories,minutes=daily.minutes.value,burned=daily.burned.value;
  let exerciseStatus:GoalStatus=null;
  if(goal&&exerciseGoalsEnabled(goal)&&(goal.exerciseMode??"daily")==="daily") {
   const results=[goal.exerciseMinutes===null?null:{complete:daily.minutes.complete,value:minutes,target:goal.exerciseMinutes},goal.exerciseKcal===null?null:{complete:daily.burned.complete,value:burned,target:goal.exerciseKcal}].filter(v=>v!==null);
   if(results.length&&results.every(v=>v.complete))exerciseStatus=results.every(v=>v.value!==null&&v.value>=v.target)?"within":"below";
  }
  return {goal,intake,minutes,burned,foodStatus:nutritionStatuses.calories,exerciseStatus,nutritionStatuses,daily};
}
export function rangeStatus(value:number|null,min:number|null,max:number|null):GoalStatus {
 if(value===null||(min===null&&max===null))return null;
 return min!==null&&value<min?"below":max!==null&&value>max?"above":"within";
}
export interface GoalEditContext {id:string;revision:number}
type GoalValues=Omit<Goal,keyof RecordBase>;
function sameGoalDates(a:GoalValues,b:GoalValues){return (['nutrition','exercise'] as const).every(section=>{const key=section==='nutrition'?'nutritionPeriod':'exercisePeriod',before:GoalPeriod=a[key]??a,after:GoalPeriod=b[key]??b;return !!before.unrestricted===!!after.unrestricted&&(before.unrestricted||before.startDate===after.startDate)})}
/** Match both families, never merge or rewrite duplicate/overlapping history. */
export function goalEditContext(goals:Goal[],value:GoalValues):GoalEditContext|undefined{
 const match=goals.filter(goal=>!goal.deletedAt&&!goal.scope&&sameGoalDates(goal,value)).sort((a,b)=>b.revision-a.revision||b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id))[0];
 return match?{id:match.id,revision:match.revision}:undefined;
}
/** Only the explicitly edited record can be updated; default callers append. */
export async function saveGoalVersion(value: Omit<Goal, keyof RecordBase>,edit?:GoalEditContext) {
  if (
    !validLocalDate(value.startDate) ||
    (value.endDate !== null && !validLocalDate(value.endDate))
  )
    throw Error("Invalid effective dates");
  if (value.endDate && value.endDate < value.startDate)
    throw Error("Invalid effective dates");
  if(!validGoalConfig(value))throw Error("Invalid goal");
  const {evaluationToleranceEvents,evaluationCalorieTarget,...storedValue}=value;
  await db.transaction("rw", goalTable, async () => {
    const all = await goalTable.toArray();
    const revision=Math.max(0, ...all.map((g) => g.revision)) + 1;
    const existing=edit?all.find(goal=>goal.id===edit.id):undefined;
    if(edit&&(!existing||existing.deletedAt||existing.revision!==edit.revision))throw Error('Goal changed');
    if(existing&&sameGoalDates(existing,value)){
      const preserveAnchor=(section:GoalSection)=>{const period=goalPeriod({...existing,...storedValue},section);return period.unrestricted?{...period,startDate:goalPeriod(existing,section).startDate}:period};
      await goalTable.put({...existing,...storedValue,id:existing.id,createdAt:existing.createdAt,updatedAt:new Date().toISOString(),revision,startDate:existing.startDate,nutritionPeriod:preserveAnchor('nutrition'),exercisePeriod:preserveAnchor('exercise')});
      return;
    }
    await goalTable.add({
      ...stamp(),
      ...storedValue,
      revision,
    });
  });
}
