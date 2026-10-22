import './goal-presentation-locale';
import {NumberLine,NumberUnit} from "./NumberUnit";
import {rangeText} from './goal-format';
import {nutritionMetrics} from './aggregation';
import {MacronutrientGoals} from "./MacronutrientGoals";
import {formatLocalDate} from "./dates";
import {useTranslation} from "react-i18next";
import {Utensils,Footprints} from "lucide-react";
import {todayProgress} from "./today-progress";
import {round,type FoodLog} from "./domain";
import type {Activity} from "./db";
import type {Goal} from "./goals";
import {exerciseGoalsEnabled,nutritionGoals,type NutritionGoals} from "./goal-model";
import {weeklyStatistics} from "./weekly-goals";
import {NutritionGoalProgress,ExerciseGoalProgress} from "./OverviewGoalProgress";

/** Shared recorded values and period-aware goals for the persistent overview. */
export function todayOverview(goals:Goal[],date:string,logs:FoodLog[],activities:Activity[]){
 const p=todayProgress(goals,date,logs,activities),dailyConfigs=nutritionGoals(p.goal),week=weeklyStatistics(goals,date,logs,activities);
 const configs=Object.fromEntries(nutritionMetrics.map(key=>[key,dailyConfigs[key].mode==="daily"?dailyConfigs[key]:week.nutrients[key].mode==="weekly"?week.nutrients[key]:{...dailyConfigs[key],mode:"off" as const}])) as NutritionGoals;
 const exerciseWeekly=p.goal?.exerciseMode!=="daily"&&(!p.goal||p.goal.exerciseMode==="weekly")&&week.exercise.mode==="weekly";
 const reference=exerciseWeekly?week.goal:p.goal?.exerciseMode==="weekly"?null:p.goal;
 const exerciseReference=exerciseGoalsEnabled(reference)?reference:null;
 const enabled=(config:{mode:string;min:number|null;max:number|null})=>config.mode!=="off"&&(config.min!==null||config.max!==null);
 const hasMacroHistory=goals.some(goal=>!goal.deletedAt&&(["protein","carbs","fat"] as const).some(key=>nutritionGoals(goal)[key].mode!=="off"&&enabled(nutritionGoals(goal)[key])));
 const hasGoalHistory=goals.some(goal=>!goal.deletedAt&&(Object.values(nutritionGoals(goal)).some(enabled)||goal.exerciseMinutes!==null||goal.exerciseKcal!==null));
 return {date,p,week,configs,exerciseWeekly,exerciseReference,hasMacroHistory,hasGoalHistory,calorieGoalEnabled:enabled(configs.calories)};
}
type Overview=ReturnType<typeof todayOverview>;
function RecordedValue({value}:{value:number|null}){
 const {t}=useTranslation();return value===null?<span className="overview-unknown">{t("notRecorded")}</span>:<>{round(value)}</>;
}
export function TodayProgress({model}:{model:Overview}){
 const {t,i18n}=useTranslation(),{date,p,week,configs,exerciseWeekly,exerciseReference,hasGoalHistory}=model;
 const foodEmpty=p.foodCount===0,exerciseEmpty=p.activityCount===0;
 return <section className={"today-progress unified-overview compact-daily-overview "+(hasGoalHistory?"has-goal-history":"")} aria-labelledby="today-progress-heading">
  <h2 id="today-progress-heading">{t("dailyOverview")} · <time>{formatLocalDate(date,i18n.language)}</time></h2>
  <div className="progress-columns">
   <div className="progress-area" data-testid="food-progress">
    <h3><Utensils size={15}/>{t("editorialFood")}</h3>
    <div className="overview-readings">{foodEmpty?<OverviewEmpty kind="food"/>:<div className="progress-number"><RecordedValue value={p.daily.nutrition.calories}/>{p.daily.nutrition.calories!==null&&<small>kcal</small>}</div>}</div>
    <div className="overview-goals food-goal-region" data-empty={foodEmpty||undefined}>
     {foodEmpty?<EmptyFoodTargets configs={configs}/>:<NutritionGoalProgress metric="calories" config={configs.calories} daily={p.daily.nutrients.calories} weekly={week.nutrients.calories}/>}
     <MacronutrientGoals configs={configs} daily={p.daily} week={week} showActuals/>
    </div>
   </div>
   <div className="progress-area" data-testid="exercise-progress">
    <h3><Footprints size={15}/>{t("editorialMovement")}</h3>
    <div className="overview-readings">{exerciseEmpty?<OverviewEmpty kind="exercise"/>:<><div className="progress-number"><RecordedValue value={p.burned}/>{p.burned!==null&&<small>kcal</small>}</div><p className="movement-duration"><RecordedValue value={p.minutes}/>{p.minutes!==null&&<small>{t('minutes')}</small>}</p></>}</div>
    {exerciseEmpty?exerciseReference&&(exerciseReference.exerciseMinutes!==null||exerciseReference.exerciseKcal!==null)&&<div className="overview-compact-targets" data-goal-mode={exerciseWeekly?'weekly':'daily'}><p className="overview-compact-exercise"><span className="overview-compact-label">{t(exerciseWeekly?'overviewWeeklyTarget':'overviewDailyTarget')}</span><span className="overview-target-value"><NumberLine items={[...(exerciseReference.exerciseMinutes!==null?[{value:round(exerciseReference.exerciseMinutes),unit:t('minutes')}]:[]),...(exerciseReference.exerciseKcal!==null?[{value:round(exerciseReference.exerciseKcal),unit:'kcal'}]:[])]}/></span></p></div>:<div className="overview-goals exercise-goal-region"><ExerciseGoalProgress metric="minutes" target={exerciseReference?.exerciseMinutes??null} daily={p.daily.minutes} weekly={week.exercise.minutes} isWeekly={exerciseWeekly} compatible={week.exercise.compatible}/><ExerciseGoalProgress metric="burned" target={exerciseReference?.exerciseKcal??null} daily={p.daily.burned} weekly={week.exercise.burned} isWeekly={exerciseWeekly} compatible={week.exercise.compatible}/></div>}

   </div>
  </div>
 </section>;
}

function EmptyFoodTargets({configs}:{configs:NutritionGoals}){
 const {t}=useTranslation(),enabled=(key:keyof NutritionGoals)=>configs[key].mode!=='off'&&(configs[key].min!==null||configs[key].max!==null);
 return enabled('calories')?<div className="overview-compact-targets overview-compact-calories" data-goal-mode={configs.calories.mode}><p className="overview-compact-target-line"><span className="overview-compact-label">{t('overviewTodayTarget')}{configs.calories.mode==='weekly'&&<small> · {t('goalWeeklyAverage')}</small>}</span><span className="overview-target-value"><NumberUnit value={rangeText(configs.calories.min,configs.calories.max)} unit="kcal"/></span></p></div>:null;
}

function OverviewEmpty({kind}:{kind:'food'|'exercise'}){
 const {t}=useTranslation();return <div className="overview-journal-empty"><p>{t(kind==='food'?'overviewFoodInvitation':'overviewExerciseInvitation')}</p><p>{t(kind==='food'?'overviewFoodInvitationHint':'overviewExerciseInvitationHint')}</p></div>;
}
