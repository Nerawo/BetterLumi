import {NumberInput} from "./NumberInput";
import {newId} from "./ids";
import {ExerciseMetadataEditor} from "./ExerciseMetadata";
import {confirmDelete} from "./DeleteConfirmation";
import {WeeklyPlanSchedule} from "./WeeklyPlanSchedule";
import {WeekdayPicker} from "./WeekdayPicker";
import {formatLocalDate} from "./dates";
import {useEffect,useState} from "react";
import {flushSync} from "react-dom";
import {useLiveQuery} from "dexie-react-hooks";
import {useTranslation} from "react-i18next";
import {Plus,Trash2,ChevronDown,CalendarCheck2} from "lucide-react";
import {stamp,type ExercisePlan,type PlannedExercise} from "./db";
import {softDelete} from "./domain";
import {exercisePlans,saveExercisePlan} from "./exercise-plans";
import {Modal,changed,type Notice} from "./ui";
const emptyPlans:ExercisePlan[]=[];
export function ExercisePlans({notice}:{notice:Notice}) {
 const {t}=useTranslation();
 const plans=useLiveQuery(()=>exercisePlans.filter(p=>!p.deletedAt).toArray())??emptyPlans;
 const [pendingEnabled,setPendingEnabled]=useState<Record<string,boolean>>({});
 useEffect(()=>{setPendingEnabled(old=>Object.fromEntries(Object.entries(old).filter(([id,value])=>plans.find(p=>p.id===id)?.enabled!==value)))},[plans]);
 const [editing,setEditing]=useState<ExercisePlan|null|undefined>();
 return <section className="exercise-plans-section" aria-labelledby="exercise-plans-heading">
 <div className="section-heading"><h2 id="exercise-plans-heading"><CalendarCheck2 size={18}/>{t("exercisePlans")}</h2><button className="primary" onClick={()=>setEditing(null)}><Plus size={18}/>{t("newExercisePlan")}</button></div>
 <WeeklyPlanSchedule notice={notice} plans={plans.map(p=>({...p,enabled:pendingEnabled[p.id]??p.enabled}))}
   edit={setEditing} remove={async plan=>{await confirmDelete("exercisePlan",plan.name,async()=>{await softDelete(exercisePlans,plan.id)})}}
   setEnabled={async(plan,value)=>{setPendingEnabled(old=>({...old,[plan.id]:value}));try{await saveExercisePlan({...changed(plan),enabled:value})}catch{setPendingEnabled(old=>{const next={...old};delete next[plan.id];return next});notice(t("failedMessage"))}}}/>
 {!plans.length&&<p className="muted text-small">{t("noExercisePlans")}</p>}
 {editing!==undefined&&<ExercisePlanEditor key={editing?.id??"new"} item={editing} close={()=>setEditing(undefined)}/>}
 </section>;
}
function ExercisePlanEditor({item,close}:{item:ExercisePlan|null;close:()=>void}) {
 const {t,i18n}=useTranslation();
 const [schedule,setSchedule]=useState<ExercisePlan["schedule"]>(item?.schedule==="weekdays"?"custom":item?.schedule??"daily"),[days,setDays]=useState(item?.schedule==="weekdays"?[1,2,3,4,5]:item?.days??[1,2,3,4,5]);
 const dates=item?.dates??[];
 const blank=():PlannedExercise=>({id:newId(),name:"",duration:null,distance:null,notes:""});
 const [exercises,setExercises]=useState<PlannedExercise[]>(item?.exercises??[blank()]),[active,setActive]=useState<string|null>(item?.exercises[0]?.id??null),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 const update=(id:string,value:Partial<PlannedExercise>)=>setExercises(rows=>rows.map(row=>row.id===id?{...row,...value}:row));
 const reveal=(id:string)=>flushSync(()=>setActive(id));
 return <Modal title={t(item?"editExercisePlan":"newExercisePlan")} close={close} className="exercise-plan-editor exercise-editor"><form onSubmit={async event=>{
  event.preventDefault();const data=new FormData(event.currentTarget);setBusy(true);setError("");
  try{await saveExercisePlan({...item?changed(item):stamp(),name:String(data.get("name")).trim(),notes:String(data.get("notes")).trim(),enabled:data.get("enabled")==="on",schedule,days,dates:[...dates],exercises:exercises.map(exercise=>({...exercise,name:exercise.name.trim(),notes:exercise.notes.trim()}))});close()}catch{setError(t("invalidExercisePlan"))}finally{setBusy(false)}
 }}>
  <div className="plan-editor-scroll"><div className="plan-editor-basics"><label>{t("planName")}<input name="name" required defaultValue={item?.name}/></label>
  <label className="checkbox-label"><input name="enabled" type="checkbox" defaultChecked={item?.enabled??true}/>{t("enabled")}</label></div>
  {schedule==="dates"?<div className="legacy-plan-dates"><strong>{t("legacyDatePlan")}</strong><p>{dates.map(value=>formatLocalDate(value,i18n.language)).join(" · ")}</p><button type="button" className="text-link" onClick={()=>setSchedule("custom")}>{t("convertWeeklyPlan")}</button></div>:<><div className="plan-repeat"><span>{t("repeatSchedule")}</span><div role="group" aria-label={t("repeatSchedule")}>{(["daily","custom"] as const).map(key=><button type="button" key={key} aria-pressed={schedule===key} onClick={()=>setSchedule(key)}>{t("schedule"+key)}</button>)}</div></div>{schedule==="custom"&&<WeekdayPicker days={days} onChange={setDays}/>}</>}
  <h3 className="plan-items-heading">{t("plannedExercises")}<small>{exercises.length}</small></h3>
  <div className="planned-exercise-editor-list">{exercises.map((exercise,index)=><details className="planned-exercise-fields" key={exercise.id} open={active===exercise.id||(active===null&&index===0)}>
   <summary onClick={event=>{event.preventDefault();setActive(active===exercise.id||(active===null&&index===0)?"":exercise.id)}}><strong>{exercise.name||t("exerciseName")}</strong><small>{[exercise.duration!=null?exercise.duration+" "+t("minutes"):"",exercise.estimatedCalories!=null?exercise.estimatedCalories+" kcal":""].filter(Boolean).join(" · ")}</small><ChevronDown size={16}/></summary>
   <label>{t("exerciseName")}<input required value={exercise.name} onChange={e=>update(exercise.id,{name:e.target.value})} onInvalid={()=>reveal(exercise.id)}/></label>
   <div className="form-grid"><label>{t("targetDuration")}<NumberInput type="number" min="0.01" step="any" value={exercise.duration??""} onInvalid={()=>reveal(exercise.id)} onChange={e=>update(exercise.id,{duration:e.target.value===""?null:Number(e.target.value)})}/></label><label>{t("estimatedCalories")}<NumberInput type="number" min="0" step="any" value={exercise.estimatedCalories??""} onInvalid={()=>reveal(exercise.id)} onChange={e=>update(exercise.id,{estimatedCalories:e.target.value===""?null:Number(e.target.value)})}/></label></div>
   <div className="form-grid secondary-plan-fields"><label>{t("targetDistance")}<NumberInput type="number" min="0" step="any" value={exercise.distance??""} onInvalid={()=>reveal(exercise.id)} onChange={e=>update(exercise.id,{distance:e.target.value===""?null:Number(e.target.value)})}/></label><label>{t("notes")}<input value={exercise.notes} onChange={e=>update(exercise.id,{notes:e.target.value})}/></label></div>
   <ExerciseMetadataEditor value={exercise} onChange={value=>update(exercise.id,value)}/>
   <button type="button" className="text-link remove-plan-item" aria-label={t("delete")} onClick={()=>{setExercises(exercises.filter(row=>row.id!==exercise.id));if(active===exercise.id)setActive(null)}}><Trash2 size={16}/>{t("delete")}</button>
  </details>)}</div>
  <button type="button" className="text-link" onClick={()=>{const next=blank();setExercises([...exercises,next]);setActive(next.id)}}><Plus size={16}/>{t("addPlannedExercise")}</button>
  <label>{t("planDetails")}<textarea name="notes" rows={2} defaultValue={item?.notes}/></label>
  </div>{error&&<p role="alert">{error}</p>}<div className="form-actions"><button type="button" onClick={close}>{t("cancel")}</button><button className="primary" disabled={busy}>{t("savePlan")}</button></div>
 </form></Modal>;
}

