import './goal-presentation-locale';
import './today-nutrition-editorial-locale';
import './today-nutrition-editorial.css';
import {nutritionMetrics} from './aggregation';
import {MacronutrientGoals} from "./MacronutrientGoals";
import {formatLocalDate} from "./dates";
import {useTranslation} from "react-i18next";
import {todayProgress} from "./today-progress";
import {round,type FoodLog} from "./domain";
import type {Activity} from "./db";
import type {Goal} from "./goals";
import {nutritionGoals,type NutritionGoals} from "./goal-model";
import {weeklyStatistics} from "./weekly-goals";
import {NutritionGoalProgress,OverviewBar} from "./OverviewGoalProgress";

/** Shared recorded values and period-aware goals for the persistent overview. */
export function todayOverview(goals:Goal[],date:string,logs:FoodLog[],_activities:Activity[]){
 const p=todayProgress(goals,date,logs,[]),dailyConfigs=nutritionGoals(p.goal),week=weeklyStatistics(goals,date,logs,[]);
 const configs=Object.fromEntries(nutritionMetrics.map(key=>[key,dailyConfigs[key].mode==="daily"?dailyConfigs[key]:week.nutrients[key].mode==="weekly"?week.nutrients[key]:{...dailyConfigs[key],mode:"off" as const}])) as NutritionGoals;
 const enabled=(config:{mode:string;min:number|null;max:number|null})=>config.mode!=="off"&&(config.min!==null||config.max!==null);
 const hasMacroHistory=goals.some(goal=>!goal.deletedAt&&(["protein","carbs","fat"] as const).some(key=>nutritionGoals(goal)[key].mode!=="off"&&enabled(nutritionGoals(goal)[key])));
 const hasGoalHistory=goals.some(goal=>!goal.deletedAt&&(Object.values(nutritionGoals(goal)).some(enabled)));
 return {date,p,week,configs,hasMacroHistory,hasGoalHistory,calorieGoalEnabled:enabled(configs.calories)};
}
type Overview=ReturnType<typeof todayOverview>;
function RecordedValue({value}:{value:number|null}){
 const {t}=useTranslation();return value===null?<span className="overview-unknown">{t("notRecorded")}</span>:<>{round(value)}</>;
}
export function TodayProgress({model}:{model:Overview}){
 const {t,i18n}=useTranslation(),{date,p,week,configs,hasGoalHistory}=model;

 return <section className={"today-progress unified-overview compact-daily-overview editorial-nutrition "+(hasGoalHistory?"has-goal-history":"")} aria-labelledby="today-progress-heading">
  <h2 id="today-progress-heading">{t("dailyOverview")} · <time>{formatLocalDate(date,i18n.language)}</time></h2>
  <div className="progress-columns" data-testid="food-progress">
   <div className="progress-area">
    <h3 className="daily-intake-label">{t("overviewDailyIntake")}</h3>
    <div className="overview-readings"><div className="calorie-reading" style={{"--calorie-fit":p.daily.nutrition.calories===null?1:Math.min(1,5/String(round(p.daily.nutrition.calories)).length)} as React.CSSProperties}><div className="progress-number"><RecordedValue value={p.daily.nutrition.calories}/></div><span className="daily-intake-unit">kcal</span></div></div>
    <div className="overview-goals food-goal-region">
     {model.calorieGoalEnabled?<NutritionGoalProgress metric="calories" config={configs.calories} daily={p.daily.nutrients.calories} weekly={week.nutrients.calories} targetOnly/>:<div className="calorie-target-unset"><p>{t("overviewNoCalorieTarget")}</p><OverviewBar percent={null} label={t("dailyCalorieGoal")} /></div>}
    </div>
   </div>
   <div className="nutrition-macro-column"><MacronutrientGoals configs={configs} daily={p.daily} week={week} showActuals layout="rows"/></div>
  </div>
 </section>;
}
