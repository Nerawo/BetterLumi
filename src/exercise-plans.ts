import { db, stamp, localDate, type Activity, type ExercisePlan, type ExerciseOccurrence } from "./db";
import { validExercisePlan, occurrenceId, scheduledExercise } from "./exercise-schedule";
export const exercisePlans = db.table<ExercisePlan>("exercisePlans");
export const exerciseOccurrences = db.table<ExerciseOccurrence>("exerciseOccurrences");
export async function saveExercisePlan(plan: ExercisePlan) {
 if (!validExercisePlan(plan)) throw Error("Invalid exercise plan");
 await exercisePlans.put(plan);
}
const revised=<T extends {revision:number;updatedAt:string}>(row:T):T=>({...row,revision:row.revision+1,updatedAt:new Date().toISOString()});
export async function completeExerciseOccurrence(planId:string,exerciseId:string,date:string,completed:boolean) {
 if(date>localDate())throw Error("Future completion");
 await db.transaction("rw",[exercisePlans,exerciseOccurrences,db.activities],async()=>{
  const plan=await exercisePlans.get(planId),id=occurrenceId(planId,date,exerciseId),old=await exerciseOccurrences.get(id);
  const exercise=plan?.exercises.find(e=>e.id===exerciseId);
  if(!plan||!exercise||(completed&&!scheduledExercise(plan,date)))throw Error("Unscheduled exercise");
  let activityId=old?.activityId??null;
  const actual=activityId?await db.activities.get(activityId):undefined;
  if(completed) {
   // Existing historical checkmarks are deliberately never backfilled on read or repeated check.
   if(!old?.completed&&!(actual&&!actual.deletedAt&&actual.planOccurrenceId===id)) {
    const base=plannedActivityId(id);activityId=base;let suffix=0,previous:Activity|undefined;
    while((previous=await db.activities.get(activityId))&&!(previous.deletedAt&&previous.planGenerated&&!previous.planEdited))activityId=base+":generated:"+(++suffix);
    await db.activities.put({...previous?revised(previous):stamp(),id:activityId,date,type:"other",name:exercise.name,trainingTags:[...(exercise.trainingTags??[])],bodyParts:[...(exercise.bodyParts??[])],duration:exercise.duration,distance:exercise.distance,caloriesBurned:exercise.estimatedCalories??null,notes:[plan.notes,exercise.notes].filter(Boolean).join(" · "),planOccurrenceId:id,planGenerated:true,planEdited:false,deletedAt:null});
   }
  } else {
   if(actual&&!actual.deletedAt&&actual.planOccurrenceId===id)await db.activities.put({...revised(actual),planOccurrenceId:null,...(actual.planGenerated&&!actual.planEdited?{deletedAt:new Date().toISOString()}:{})});
   activityId=null;
  }
  await exerciseOccurrences.put({...old?revised(old):stamp(),id,planId,exerciseId,date,completed,activityId,deletedAt:null});
 });
}
export async function deleteActivity(id:string) {
 await db.transaction("rw",[db.activities,exerciseOccurrences],async()=>{
  const actual=await db.activities.get(id);if(!actual||actual.deletedAt)return;
  if(actual.planOccurrenceId){const check=await exerciseOccurrences.get(actual.planOccurrenceId);if(check?.activityId===id)await exerciseOccurrences.put({...revised(check),completed:false,activityId:null})}
  await db.activities.put({...revised(actual),deletedAt:new Date().toISOString(),planOccurrenceId:null});
 });
}
export async function saveActivity(value:Activity,plannedKey?:string,creating=false) {
 await db.transaction("rw",[db.activities,exerciseOccurrences,exercisePlans],async()=>{
  const latest=await db.activities.get(value.id);
  const previousKey=latest?.planOccurrenceId;
  const key=plannedKey??previousKey;
  let next={...value,planOccurrenceId:previousKey??null,planGenerated:latest?.planGenerated??false,planEdited:true};
  if(previousKey){const check=await exerciseOccurrences.get(previousKey);if(check&&check.date!==value.date){await exerciseOccurrences.put({...revised(check),completed:false,activityId:null});next.planOccurrenceId=null}}
  if(key){const check=await exerciseOccurrences.get(key);
   if(check&&check.date===value.date){const linked=check.activityId?await db.activities.get(check.activityId):undefined;if(linked&&!linked.deletedAt&&linked.id!==value.id)throw Error("PLAN_ACTUAL_EXISTS");if(creating&&linked&&!linked.deletedAt)throw Error("PLAN_ACTUAL_EXISTS");next.planOccurrenceId=key;await exerciseOccurrences.put({...revised(check),completed:true,activityId:value.id})}
   else if(!check&&plannedKey){const plan=(await exercisePlans.toArray()).find(p=>p.exercises.some(e=>occurrenceId(p.id,value.date,e.id)===key));const exercise=plan?.exercises.find(e=>occurrenceId(plan.id,value.date,e.id)===key);if(!plan||!exercise||!scheduledExercise(plan,value.date))throw Error("Unscheduled exercise");next.planOccurrenceId=key;await exerciseOccurrences.put({...stamp(),id:key,planId:plan.id,exerciseId:exercise.id,date:value.date,completed:true,activityId:value.id})}
  }
  await db.activities.put(next);
 });
}

export const plannedActivityId=(key:string)=>"planned-actual:"+key;
export function planWeekdays(plan:ExercisePlan) { return plan.schedule==="daily"?[1,2,3,4,5,6,0]:plan.schedule==="weekdays"?[1,2,3,4,5]:plan.schedule==="custom"?[...plan.days]:[]; }
/** Update recurrence only. Occurrences and actual logs are deliberately not written. */
export async function togglePlanWeekday(id:string,day:number,expectedRevision:number) {
 if(!Number.isInteger(day)||day<0||day>6)throw Error("Invalid weekday");
 return db.transaction("rw",exercisePlans,async()=>{
  const plan=await exercisePlans.get(id);
  if(!plan||plan.deletedAt||plan.schedule==="dates"||plan.revision!==expectedRevision)throw Error("Plan changed");
  const current=planWeekdays(plan),days=[1,2,3,4,5,6,0].filter(value=>value===day?!current.includes(day):current.includes(value));
  if(!days.length)throw Error("At least one weekday is required");
  const next={...plan,schedule:"custom" as const,days,updatedAt:new Date().toISOString(),revision:plan.revision+1};
  await saveExercisePlan(next);return next;
 });
}
