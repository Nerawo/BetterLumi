import {calorieGoalDisplay} from "./nutrition-goal-display";
import {useTranslation} from "react-i18next";
import {round} from "./domain";
import {rangeText} from "./GoalCards";
import {progressPercent} from "./today-progress";
import type {NutritionGoal} from "./goal-model";
import type {measurement} from "./aggregation";
import type {weeklyStatistics} from "./weekly-goals";

type Week=ReturnType<typeof weeklyStatistics>;
type Measurement=ReturnType<typeof measurement>;
export function OverviewBar({percent,label,status}:{percent:number|null;label:string;status?:string|null}){
 return <div className={"progress-track "+(status??"neutral")} role={percent===null?undefined:"progressbar"} aria-label={label} aria-valuemin={percent===null?undefined:0} aria-valuemax={percent===null?undefined:100} aria-valuenow={percent===null?undefined:Number(percent.toFixed(1))}>{percent!==null&&<span style={{width:percent+"%"}}/>}</div>;
}
function GoalComparison({value,target,unit}:{value:number|null;target:string|number;unit:string}){
 const {t}=useTranslation();
 return <div className="overview-goal-comparison overview-goal-actual"><strong>{value===null?t("notRecorded"):round(value)}</strong><span className="goal-comparison-slash" aria-hidden="true"> / </span><span className="goal-comparison-target">{target}</span><small>{unit}</small></div>;
}
export function NutritionGoalProgress({metric,config,daily,weekly,graphic=false}:{graphic?:boolean;metric:"calories";config:NutritionGoal;daily:Measurement;weekly:Week["nutrients"]["calories"]}){
 const {t}=useTranslation();
 if(config.mode==="off"||(config.min===null&&config.max===null))return null;
 const display=calorieGoalDisplay(config,daily,weekly),{isWeekly,value:amount,status}=display,unit="kcal";
 const name=t(metric==="calories"?"goalCalories":metric);
 const message=status==="below"?t("overviewBelow",{value:round(config.min!-amount!),unit}):status==="above"?t("overviewAbove",{value:round(amount!-config.max!),unit}):status==="within"?(isWeekly&&weekly.days<7?t("overviewWeeklyPending"):t("progressFoodWithin")):null;
 return <div className={"overview-goal-progress"+(graphic?" graphic-calorie-goal":"")} data-status={status??(amount===null?"unknown":"partial")} data-incomplete={!display.complete||undefined} data-goal-metric={metric} data-weekly-metric={isWeekly?metric:undefined} data-goal-mode={config.mode} data-achieved={display.achieved||undefined}>
  <div className="overview-goal-heading"><p className="overview-goal-label">{t(isWeekly?"overviewWeeklyAverage":"dailyCalorieGoal")}</p>{isWeekly&&<small className="overview-goal-coverage">{t("overviewWeekCoverage",{count:weekly.days})}</small>}</div>
  <GoalComparison value={amount} target={rangeText(config.min,config.max)} unit={unit+(isWeekly?"/"+t("perDay"):"")}/>
  {graphic?<svg className="graphic-calorie-ring" viewBox="0 0 100 100" role={display.percent===null?"img":"progressbar"} aria-label={name+" · "+t(isWeekly?"overviewWeeklyAverage":"goalDaily")} aria-valuemin={display.percent===null?undefined:0} aria-valuemax={display.percent===null?undefined:100} aria-valuenow={display.percent===null?undefined:Number(display.percent.toFixed(1))} data-status={status??"unknown"}><circle className="graphic-calorie-track" cx="50" cy="50" r="45"/>{display.percent!==null&&<circle className="graphic-calorie-fill" cx="50" cy="50" r="45" pathLength="100" strokeDasharray="100" strokeDashoffset={100-display.percent} transform="rotate(-90 50 50)"/>}</svg>:<OverviewBar percent={display.percent} label={name+" · "+t(isWeekly?"overviewWeeklyAverage":"goalDaily")} status={status}/>}
  {(message||!display.complete)&&<p className="progress-message">{message??t(amount===null?"notRecorded":"partialData")}</p>}
 </div>;
}
export function ExerciseGoalProgress({metric,target,daily,weekly,isWeekly,compatible}:{metric:"minutes"|"burned";target:number|null;daily:Measurement;weekly:Measurement;isWeekly:boolean;compatible:boolean}){
 const {t}=useTranslation();if(target===null)return null;
 const actual=isWeekly?weekly:daily,canCompare=(!isWeekly||compatible)&&actual.complete&&actual.value!==null;
 const met=actual.value!==null&&actual.value>=target,unit=metric==="minutes"?t("minutes"):"kcal";
 const name=t(metric==="minutes"?"overviewDurationGoal":"overviewBurnGoal");
 return <div className="overview-goal-progress" data-status={canCompare?(met?"within":"below"):actual.value===null?"unknown":"partial"} data-incomplete={!actual.complete||undefined} data-exercise-goal={metric} data-goal-mode={isWeekly?"weekly":"daily"}>
  <div className="overview-goal-heading"><p className="overview-goal-label">{name}</p>{isWeekly&&<small>{t("overviewWeeklyShort")}</small>}</div>
  <GoalComparison value={actual.value} target={target} unit={unit}/>
  <OverviewBar percent={canCompare?progressPercent(actual.value,target):null} label={name+" · "+t(isWeekly?"goalWeeklyTotal":"goalDaily")} status={canCompare?(met?"within":"below"):null}/>
  {!canCompare&&<p className="progress-message">{t(actual.value===null?"notRecorded":"partialData")}</p>}
  {canCompare&&<p className="progress-message">{t(met?"overviewTargetMet":metric==="minutes"?"overviewMinutesLeft":"overviewKcalLeft",{value:round(Math.max(0,target-actual.value!))})}</p>}
 </div>;
}
