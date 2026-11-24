import './goal-presentation-locale';
import {NumberUnit} from "./NumberUnit";
import {rangeText} from './goal-format';
import {nutritionMetrics} from './aggregation';
import {MacronutrientGoals} from "./MacronutrientGoals";
import {formatLocalDate} from "./dates";
import {useTranslation} from "react-i18next";
import {Utensils} from "lucide-react";
import {todayProgress} from "./today-progress";
import {round,type FoodLog} from "./domain";
import type {Activity} from "./db";
import type {Goal} from "./goals";
import {nutritionGoals,type NutritionGoals} from "./goal-model";
import {weeklyStatistics} from "./weekly-goals";
import {NutritionGoalProgress} from "./OverviewGoalProgress";

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
 const foodEmpty=p.foodCount===0;
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
  </div>
 </section>;
}

function EmptyFoodTargets({configs}:{configs:NutritionGoals}){
 const {t}=useTranslation(),enabled=(key:keyof NutritionGoals)=>configs[key].mode!=='off'&&(configs[key].min!==null||configs[key].max!==null);
 return enabled('calories')?<div className="overview-compact-targets overview-compact-calories" data-goal-mode={configs.calories.mode}><p className="overview-compact-target-line"><span className="overview-compact-label">{t('overviewTodayTarget')}{configs.calories.mode==='weekly'&&<small> · {t('goalWeeklyAverage')}</small>}</span><span className="overview-target-value"><NumberUnit value={rangeText(configs.calories.min,configs.calories.max)} unit="kcal"/></span></p></div>:null;
}

function OverviewEmpty({kind:_kind}:{kind:'food'}){
 const {t}=useTranslation();return <div className="overview-journal-empty"><p>{t('overviewFoodInvitation')}</p><p>{t('overviewFoodInvitationHint')}</p></div>;
}
