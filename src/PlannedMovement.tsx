import {ExerciseJournalRow} from "./ExerciseJournalRow";
import {NumberUnit} from "./NumberUnit";
import {confirmDelete} from "./DeleteConfirmation";
import {ChevronDown,Trash2} from "lucide-react";
import {useEffect,useRef,useState} from "react";
import {useLiveQuery} from "dexie-react-hooks";
import {useTranslation} from "react-i18next";
import {exercisePlans,exerciseOccurrences,completeExerciseOccurrence,deleteActivity} from "./exercise-plans";
import {scheduledExercise,occurrenceId} from "./exercise-schedule";
import {exercisePlanSummary} from "./exercise-plan-summary";
import {db,localDate} from "./db";
import {round} from "./domain";
import {ExerciseNotes} from "./ExerciseNotes";
import type {Notice} from "./ui";
import type {ActivityDraft} from "./Activity";
export function PlannedMovement({date,open,notice}:{date:string;open:(draft:ActivityDraft)=>void;notice:Notice}) {
 const {t}=useTranslation(),locks=useRef(new Set<string>()),[pending,setPending]=useState<Record<string,boolean>>({});
 const plans=useLiveQuery(()=>exercisePlans.filter(p=>!p.deletedAt).toArray())??[];
 const checks=useLiveQuery(()=>exerciseOccurrences.where("date").equals(date).filter(c=>!c.deletedAt).toArray(),[date])??[];
 const activities=useLiveQuery(()=>db.activities.where("date").equals(date).filter(a=>!a.deletedAt).toArray(),[date])??[];
 const [optimistic,setOptimistic]=useState<Record<string,boolean>>({});
 useEffect(()=>{setOptimistic(old=>{const entries=Object.entries(old),remaining=entries.filter(([id,value])=>checks.find(c=>c.id===id)?.completed!==value);return remaining.length===entries.length?old:Object.fromEntries(remaining)})},[checks]);
 const scheduled=plans.filter(plan=>scheduledExercise(plan,date)||checks.some(c=>c.planId===plan.id&&c.completed)||plan.exercises.some(e=>activities.some(a=>a.planOccurrenceId===occurrenceId(plan.id,date,e.id))));

 const [expanded,setExpanded]=useState<Record<string,boolean>>({});
 const eligible=plans.filter(plan=>scheduledExercise(plan,date));
 const isCompleted=(key:string)=>optimistic[key]??checks.find(c=>c.id===key)?.completed??false;
 const completed=eligible.filter(plan=>plan.exercises.length>0&&plan.exercises.every(item=>isCompleted(occurrenceId(plan.id,date,item.id)))).length;
 const {minutes,burned,partial,hasEstimates}=exercisePlanSummary(eligible,date,activities,isCompleted);
 const durationText=(value:ReturnType<typeof exercisePlanSummary>["minutes"],incomplete:boolean)=>value.value===null?null:<><NumberUnit value={round(value.value)} unit={t("minutes")}/>{incomplete&&" · "+t("partialData")}</>;
 return <details className="planned-movement">
 <summary className="exercise-disclosure-heading daily-plans-heading" data-testid="daily-plans-summary"><strong className="exercise-group-heading">{t("todayPlan")}</strong><span className="daily-plans-summary exercise-disclosure-stats"><span className="daily-completion">{completed}/{eligible.length}</span>{burned.value!==null&&<span className="summary-stat">{hasEstimates&&t("estimatedShort")+" "}<NumberUnit value={round(burned.value)} unit="kcal"/></span>}{minutes.value!==null&&<span className="summary-stat"><NumberUnit value={round(minutes.value)} unit={t("minutes")}/></span>}{partial&&<small className="summary-coverage">{t("partialData")}</small>}</span><ChevronDown size={16}/></summary>
 {!scheduled.length&&<p className="muted text-small">{t("noScheduledExercise")}</p>}
 {scheduled.map(plan=>{const expansionKey=date+":"+plan.id,items=plan.exercises,planSummary=exercisePlanSummary([plan],date,activities,isCompleted),summaryMinutes=planSummary.minutes,done=items.filter(item=>isCompleted(occurrenceId(plan.id,date,item.id))).length;
 return <details className="daily-plan-group" data-daily-plan={plan.id} key={plan.id} open={!!expanded[expansionKey]}>
 <summary onClick={event=>{event.preventDefault();setExpanded(previous=>({...previous,[expansionKey]:!previous[expansionKey]}))}}><strong>{plan.name}</strong><span className="daily-plan-summary">{done}/{items.length}{summaryMinutes.value!==null&&<> · {durationText(summaryMinutes,planSummary.partial)}</>}{!scheduledExercise(plan,date)&&<> · {t("planNotScheduled")}</>}</span><ChevronDown size={14}/></summary>
 {plan.notes&&<ExerciseNotes text={plan.notes} notice={notice}/>} {items.map(exercise=>{
  const key=occurrenceId(plan.id,date,exercise.id),linked=activities.find(a=>a.planOccurrenceId===key),values=linked??exercise;
  const metadata=[...(values.duration!=null?[{value:values.duration,unit:t("minutes")}]:[]),...(linked?(linked.caloriesBurned!=null?[{value:linked.caloriesBurned,unit:"kcal"}]:[]):(exercise.estimatedCalories!=null?[{value:exercise.estimatedCalories,unit:"kcal",prefix:t("estimatedShort")}]:[])),...(values.distance!=null?[{value:values.distance,unit:"km"}]:[])];
  return <ExerciseJournalRow className="planned-movement-row" key={key} occurrence={key} name={<label className="planned-exercise-label" htmlFor={"complete-"+key}>{exercise.name}</label>} values={values} notice={notice} items={metadata} actions={<>
   <label className="exercise-completion"><input id={"complete-"+key} aria-label={exercise.name} type="checkbox" checked={isCompleted(key)} disabled={date>localDate()||pending[key]} onChange={async event=>{const value=event.target.checked;if(locks.current.has(key))return;setOptimistic(old=>({...old,[key]:value}));locks.current.add(key);setPending(old=>({...old,[key]:true}));try{await completeExerciseOccurrence(plan.id,exercise.id,date,value)}catch{setOptimistic(old=>{const next={...old};delete next[key];return next});notice(t("failedMessage"))}finally{locks.current.delete(key);setPending(old=>({...old,[key]:false}))}}}/></label>
   <button type="button" className="text-link" disabled={date>localDate()||pending[key]} onClick={()=>open({date,item:linked,plannedKey:key,prefill:{name:exercise.name,duration:exercise.duration,distance:exercise.distance,caloriesBurned:exercise.estimatedCalories??null,notes:[plan.notes,exercise.notes].filter(Boolean).join(" · "),trainingTags:exercise.trainingTags,bodyParts:exercise.bodyParts}})}>{t(linked?"edit":"logShort")}</button>
   {linked&&<button type="button" className="icon-button" aria-label={t("delete")} onClick={async()=>{await confirmDelete("exercise",linked.name,async()=>{await deleteActivity(linked.id)})}}><Trash2 size={16}/></button>}
  </>}/>;
 })}</details>})}
 </details>;
}
