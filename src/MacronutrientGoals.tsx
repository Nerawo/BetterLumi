import {NumberUnit} from "./NumberUnit";
import {useTranslation} from "react-i18next";
import type {NutritionGoals} from "./goal-model";
import type {dailyAggregation} from "./aggregation";
import {nutrientGoalDisplay} from "./nutrition-goal-display";
import type {weeklyStatistics} from './weekly-goals';
import {rangeText} from "./GoalCards";
import {round} from "./domain";

const metrics=["protein","carbs","fat"] as const;
export function MacronutrientGoals({configs,daily,week,showActuals=false}:{configs:NutritionGoals;daily:ReturnType<typeof dailyAggregation>;week:ReturnType<typeof weeklyStatistics>;showActuals?:boolean}){
 const {t}=useTranslation(),radius=13,circumference=2*Math.PI*radius;
 return <div className="macronutrient-goals" aria-label={t("overviewMacroGoals")}>{metrics.map(metric=>{
  const config=configs[metric],weekly=week.nutrients[metric],display=nutrientGoalDisplay(config,daily.nutrients[metric],weekly);
  const empty=daily.foodCount===0,ringPercent=empty?null:display.ringPercent;
  const enabled=display.enabled,actual=daily.nutrition[metric],name=t(metric==="carbs"?"macroCarbs":metric);
  if(!enabled&&!showActuals)return <div className="macro-goal-slot" data-macro-slot={metric} key={metric} aria-hidden="true"/>;
  const target=rangeText(config.min,config.max)+" g",mode=t(display.isWeekly?'goalWeeklyAverage':'goalDaily');
  const state=!display.complete?(display.value===null?'unknown':'partial'):display.status??'unknown',message=display.status==="above"?t("overviewAbove",{value:round(display.value!-config.max!),unit:"g"}):display.achieved?t("progressFoodWithin"):display.status==="below"?t("overviewBelow",{value:round(config.min!-display.value!),unit:"g"}):t(display.value===null?"notRecorded":"partialData");
  const description=empty?[name,t("notRecorded"),target].join(" · "):[name,mode,display.value===null?t("notRecorded"):round(display.value)+" g",target,message,display.upperOnly?t("upperOnlyRingHelp"):""].filter(Boolean).join(" · ");
  return <div className="macro-goal-slot" data-macro-slot={metric} data-empty={empty||undefined} data-goal-metric={enabled?metric:undefined} data-goal-mode={enabled?config.mode:undefined} data-incomplete={enabled&&!display.complete||undefined} data-status={enabled&&!empty?state:undefined} data-achieved={enabled&&!empty&&display.achieved||undefined} data-upper-only={display.upperOnly||undefined} key={metric}>
   {showActuals?<dl className="macro-actual" data-nutrient={metric}><dt className="macro-goal-name">{name}</dt>{!empty&&<dd data-missing={actual===null||undefined}>{actual===null?<span className="overview-unknown">{t("notRecorded")}</span>:<NumberUnit value={round(actual)} unit="g"/>}</dd>}</dl>:<small className="macro-goal-name">{name}</small>}
   {enabled&&<><svg className="macro-goal-ring" viewBox="0 0 32 32" role={ringPercent===null?"img":"progressbar"} aria-label={description} aria-valuemin={ringPercent===null?undefined:0} aria-valuemax={ringPercent===null?undefined:100} aria-valuenow={ringPercent===null?undefined:Number(ringPercent.toFixed(1))}>
    <title>{description}</title><circle className="macro-ring-track" cx="16" cy="16" r={radius}/>
    {ringPercent!==null&&<circle className="macro-ring-fill" cx="16" cy="16" r={radius} strokeDasharray={circumference} strokeDashoffset={circumference*(1-ringPercent/100)} transform="rotate(-90 16 16)"/>}
   </svg>{!empty&&display.isWeekly&&<small className="macro-weekly-summary" data-weekly-metric={metric} aria-label={t('overviewWeeklyAverage')+' · '+t('overviewWeekCoverage',{count:weekly.days})}>{display.value===null?t('notRecorded'):round(display.value)+' g'} · {weekly.days}/7</small>}<small className="macro-goal-range"><NumberUnit value={rangeText(config.min,config.max)} unit="g"/></small></>}{!enabled&&showActuals&&<small className="macro-goal-disabled">{t("goalOff")}</small>}
  </div>;
 })}</div>;
}
