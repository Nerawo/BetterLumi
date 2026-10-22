import {NumberLine} from "./NumberUnit";
import {ExerciseNotes} from "./ExerciseNotes";
import {Fragment,useEffect,useId,useRef,useState} from "react";
import {useTranslation} from "react-i18next";
import {ChevronDown} from "lucide-react";
import type {ExercisePlan} from "./db";
import {formatLocalDate} from "./dates";
import {planWeekdays,togglePlanWeekday} from "./exercise-plans";
import {Actions,type Notice} from "./ui";

export function WeeklyPlanSchedule({plans,notice,edit,remove,setEnabled}:{
 plans:ExercisePlan[];notice:Notice;edit:(plan:ExercisePlan)=>void;
 remove:(plan:ExercisePlan)=>Promise<void>;setEnabled:(plan:ExercisePlan,value:boolean)=>Promise<void>;
}) {
 const {t,i18n}=useTranslation(),order=[1,2,3,4,5,6,0],prefix=useId();
 const [pending,setPending]=useState<Record<string,ExercisePlan>>({});
 const [expanded,setExpanded]=useState<Record<string,boolean>>({});
 const locks=useRef(new Set<string>()),lastToggle=useRef(new Map<string,number>());
 useEffect(()=>{setPending(previous=>Object.fromEntries(Object.entries(previous).filter(([id,value])=>plans.find(plan=>plan.id===id)?.revision!==value.revision)))},[plans]);
 const weekday=(index:number)=>formatLocalDate("2026-10-"+(12+index),i18n.language,"weekday");
 return <section className="weekly-plan-schedule"><h3>{t("weeklySchedule")}</h3>{plans.length>0&&<div className="weekly-schedule-scroll" tabIndex={0} role="region" aria-label={t("weeklySchedule")}>
 <table className="planner-table"><thead><tr>{order.map((day,index)=><th scope="col" key={day}><abbr title={weekday(index)}>{i18n.language.startsWith("zh")?["一","二","三","四","五","六","日"][index]:weekday(index)}</abbr></th>)}</tr></thead>
 <tbody>{plans.map(saved=>{
  const plan=pending[saved.id]??saved,isOpen=!!expanded[plan.id],detailsId=prefix+"-"+plan.id;
  return <Fragment key={plan.id}>
   <tr className="planner-row" data-plan-id={plan.id} data-enabled={plan.enabled}><th scope="row" colSpan={7}><div className="planner-identity"><button type="button" className="planner-name" aria-expanded={isOpen} aria-controls={detailsId} onClick={()=>setExpanded(old=>({...old,[plan.id]:!old[plan.id]}))}><ChevronDown size={14}/><span>{plan.name}{!plan.enabled&&<small>{t("planDisabled")}</small>}{plan.schedule==="dates"&&<small>{t("legacyDatePlan")}</small>}</span></button><label className="planner-collapsed-enable"><input type="checkbox" checked={plan.enabled} disabled={!!pending[plan.id]} aria-label={t("enableExercisePlan",{name:plan.name})} onChange={event=>void setEnabled(saved,event.target.checked)}/>{t("enabled")}</label></div></th></tr>
   <tr className="planner-weekdays" data-weekdays-plan={plan.id}>
    {order.map((day,index)=>{const selected=planWeekdays(plan).includes(day);return <td key={day} data-day={day} data-scheduled={selected}>
     {plan.schedule!=="dates"&&<button type="button" aria-pressed={selected} disabled={!!pending[plan.id]} aria-label={plan.name+" · "+weekday(index)} onClick={async event=>{
      if(event.detail>1||locks.current.has(plan.id)||performance.now()-(lastToggle.current.get(plan.id+":"+day)??-Infinity)<350)return;
      const days=order.filter(value=>value===day?!selected:planWeekdays(plan).includes(value));
      if(!days.length){notice(t("minimumWeekday"));return}
      lastToggle.current.set(plan.id+":"+day,performance.now());locks.current.add(plan.id);
      setPending(old=>({...old,[plan.id]:{...plan,schedule:"custom",days,revision:plan.revision+1}}));
      try{await togglePlanWeekday(plan.id,day,plan.revision)}catch{setPending(old=>{const next={...old};delete next[plan.id];return next});notice(t("failedMessage"))}finally{locks.current.delete(plan.id)}
     }}><span className="weekly-dot" aria-hidden="true"/></button>}
    </td>})}
   </tr>
   <tr className="planner-details-row" hidden={!isOpen}><td colSpan={7}><div id={detailsId} className="planner-details">
    {plan.schedule==="dates"&&<p className="planner-dates">{plan.dates.map(date=>formatLocalDate(date,i18n.language,"short")).join(" · ")}</p>}
    <ul className="planner-exercises">{plan.exercises.map(exercise=><li key={exercise.id}><strong>{exercise.name}</strong><small><NumberLine items={[...(exercise.duration!=null?[{value:exercise.duration,unit:t("minutes")}]:[]),...(exercise.distance!=null?[{value:exercise.distance,unit:"km"}]:[]),...(exercise.estimatedCalories!=null?[{value:exercise.estimatedCalories,unit:"kcal",prefix:t("estimatedShort")}]:[])]}/></small>{exercise.notes&&<ExerciseNotes text={exercise.notes} notice={notice}/>}</li>)}</ul>
    {plan.notes&&<ExerciseNotes text={plan.notes} notice={notice}/>}
    <div className="planner-actions"><Actions edit={()=>edit(saved)} remove={()=>remove(saved)}/></div>
   </div></td></tr>
  </Fragment>;
 })}</tbody></table></div>}</section>;
}
