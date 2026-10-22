import {weeklyStatistics} from "./weekly-goals";
import {Modal} from "./ui";
import {Star,Info} from "lucide-react";
import { formatLocalDate } from "./dates";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from "lucide-react";
import { localDate, round, type FoodLog, type Plan } from "./domain";
import type { Activity } from "./db";
import type { Goal } from "./goals";
import { calendarRings } from "./calendar-rings";
import { CalendarRings } from "./CalendarRings";
import { CalendarDateJump } from "./CalendarDateJump";
import { shiftMonth } from "./routing";
import { shiftDay, weekDates } from "./exercise-schedule";
export function Journal({ logs, activity, planItems, selected, setSelected, goals }: { logs: FoodLog[]; activity: Activity[]; planItems: Plan[]; selected: string; setSelected:(date:string)=>void; goals:Goal[] }) {
 const {t,i18n}=useTranslation(); const [expanded,setExpanded]=useState(false);const [achievementDate,setAchievementDate]=useState<string|null>(null);const [help,setHelp]=useState(false);
 const first=new Date(selected.slice(0,7)+"-01T12:00:00");
 const count=new Date(first.getFullYear(),first.getMonth()+1,0).getDate();
 const offset=(first.getDay()+6)%7;
 const days=expanded?Array.from({length:count},(_,n)=>selected.slice(0,7)+"-"+String(n+1).padStart(2,"0")):weekDates(selected);
 const labels=["weekMonday","weekTuesday","weekWednesday","weekThursday","weekFriday","weekSaturday","weekSunday"];
 return <section className={"calendar-card compact-calendar " +(expanded?"is-expanded":"is-week")} aria-label={t("calendar")}>
  <div className="section-heading"><h2>{first.toLocaleDateString(i18n.language==="zh"?"zh-CN":"en-US",{month:"long",year:"numeric"})}</h2><div className="calendar-controls">
   <CalendarDateJump selected={selected} onSelect={setSelected}/><button type="button" aria-label={t("calendarGuide")} onClick={()=>setHelp(true)}><Info size={16}/></button>
   <button aria-label={t(expanded?"monthPrevious":"weekPrevious")} onClick={()=>setSelected(expanded?shiftMonth(selected,-1):shiftDay(selected,-7))}><ChevronLeft size={18}/></button>
   <button aria-label={t(expanded?"monthNext":"weekNext")} onClick={()=>setSelected(expanded?shiftMonth(selected,1):shiftDay(selected,7))}><ChevronRight size={18}/></button>
   <button aria-expanded={expanded} aria-label={t(expanded?"collapseCalendar":"expandCalendar")} onClick={()=>setExpanded(!expanded)}>{expanded?<ChevronUp size={18}/>:<ChevronDown size={18}/>}</button>
  </div></div>
  <div className="calendar-grid" style={{height: ((expanded ? Math.ceil((count+offset)/7) : 1)*50+24)+"px"}}>{labels.map((key,index)=><span className="weekday" key={key}>{formatLocalDate("2026-10-"+(12+index),i18n.language,"weekday")}</span>)}{expanded&&Array.from({length:offset},(_,n)=><span key={"blank"+n}/>)}
   {days.map(date=>{const rings=calendarRings(goals,date,logs,activity);const planned=planItems.some(p=>p.date===date);const sunday=new Date(date+"T12:00:00").getDay()===0;const achievements=expanded&&sunday?weeklyStatistics(goals,date,logs,activity).achievements:[];return <div className="calendar-day-cell" key={date}><button aria-current={date===localDate()?"date":undefined} data-date={date} data-food-status={rings.food.state} data-exercise-status={rings.exercise.state} aria-pressed={selected===date} aria-label={formatLocalDate(date,i18n.language)+" · "+t("loggedIntake")+": "+(rings.intake===null?t("notRecorded"):round(rings.intake)+" kcal")+" · "+t("loggedExercise")+": "+(rings.minutes===null?t("notRecorded"):round(rings.minutes)+" min")} className={(selected===date?"selected ":"")+(date===localDate()?"is-today":"")} onClick={()=>setSelected(date)}>
    <CalendarRings food={rings.food} exercise={rings.exercise}/><span className="calendar-date-number">{Number(date.slice(-2))}</span>{planned&&<span className="day-plan-marker" aria-hidden="true">·</span>}
   </button>{achievements.length>0&&<button type="button" className="weekly-achievement-star" data-week-sunday={date} aria-label={t("weeklyAchievements")+" · "+formatLocalDate(date,i18n.language)} onClick={event=>{event.stopPropagation();setAchievementDate(date)}}><Star size={11} fill="currentColor"/></button>}</div>})}
  </div>
  {help&&<Modal title={t("calendarGuide")} close={()=>setHelp(false)} className="calendar-guide"><dl>{["calendarSelectionHelp","calendarTodayHelp","calendarActivityHelp","calendarDashedHelp","calendarStarHelp"].map(key=><div key={key}><dd>{t(key)}</dd></div>)}</dl></Modal>}
  {achievementDate&&<Modal title={t("weeklyAchievements")} close={()=>setAchievementDate(null)} className="weekly-achievement-modal"><p className="muted text-small">{formatLocalDate(weeklyStatistics(goals,achievementDate,logs,activity).start,i18n.language)} – {formatLocalDate(achievementDate,i18n.language)}</p><ul>{weeklyStatistics(goals,achievementDate,logs,activity).achievements.map(key=><li key={key}>{t(key==="exercise"?"weeklyExerciseAchieved":"weeklyNutrientAchieved",{metric:t(key==="calories"?"goalCalories":key)})}</li>)}</ul></Modal>}
 </section>;
}
