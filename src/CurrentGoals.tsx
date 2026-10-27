import type {Ref} from 'react';
import {useTranslation} from 'react-i18next';
import type {Goal} from './goal-model';
import {nutritionGoals,exerciseGoalsEnabled} from './goal-model';
import {localDate} from './domain';
import {rangeText} from './goal-format';
/** Read-only projection of the same resolved goal used by evaluation; never a saved copy. */
export function CurrentGoals({goal,edit,editRef}:{goal:Goal|null;edit:()=>void;editRef:Ref<HTMLButtonElement>}){
 const {t,i18n}=useTranslation(),configs=nutritionGoals(goal),enabled=(key:keyof typeof configs)=>configs[key].mode!=='off'&&(configs[key].min!==null||configs[key].max!==null);
 const hasFood=Object.keys(configs).some(key=>enabled(key as keyof typeof configs)),hasExercise=exerciseGoalsEnabled(goal)&&(goal!.exerciseMinutes!==null||goal!.exerciseKcal!==null),hasTargets=hasFood||hasExercise;
 const number=(value:number,digits=6)=>value.toLocaleString(i18n.language,{maximumFractionDigits:digits});
 const calories=configs.calories,target=goal?.evaluationCalorieTarget??goal?.nutritionTargets?.calories;
 const updated=goal?.updatedAt&&Number.isFinite(Date.parse(goal.updatedAt))?localDate(new Date(goal.updatedAt)):null;
 const period=(weekly:boolean)=>t(weekly?'currentPerWeek':'currentPerDay');
 return <div className="current-goals" data-testid="current-goals"><div className="current-goals-heading"><h3>{t('currentGoals')}</h3>{hasTargets&&<button type="button" ref={editRef} onClick={edit}>{t('modifyGoals')}</button>}</div>
 {!hasTargets?<div className="current-goals-empty"><p>{t(goal?'currentGoalsDisabled':'currentGoalsEmpty')}</p><p className="muted text-small">{t('currentGoalsEmptyHint')}</p><button type="button" ref={editRef} onClick={edit}>{t(goal?'modifyGoals':'setupGoals')}</button></div>:<>
 {hasFood&&<section className="current-goal-section" aria-label={t('editorialFood')}><h4>{t(goal?.nutritionFrequency==='weekly'?'currentAverageNutritionGoals':'currentDailyNutritionGoals')}</h4>{enabled('calories')&&<><p className="current-goal-number" data-testid="current-calorie-target">{target!=null?number(target):rangeText(calories.min,calories.max)}<small>kcal / {period(false)}</small></p>{target!=null&&<p className="current-goal-range">{t('currentCalorieRange')} · {rangeText(calories.min,calories.max)} kcal</p>}</>}
 <dl className="current-goal-macros">{(['protein','carbs','fat'] as const).filter(enabled).map(key=><div key={key}><dt>{t(key==='carbs'?'macroCarbs':key)}</dt><dd>{goal?.nutritionTargets?.[key]!=null?number(goal.nutritionTargets[key]!,1):rangeText(configs[key].min,configs[key].max)}<span className="current-macro-unit"> g</span></dd><small className="current-goal-frequency">{t(configs[key].mode==='weekly'?'goalWeeklyAverage':'goalDaily')}</small></div>)}</dl></section>}
 {hasExercise&&<section className="current-goal-section" aria-label={t('editorialMovement')}><h4>{t('editorialMovement')}</h4><div className="current-exercise-targets">{goal!.exerciseMinutes!==null&&<p className="current-goal-number" data-testid="current-exercise-minutes">{number(goal!.exerciseMinutes!)}<small>{t('minutes')} / {period(goal!.exerciseMode==='weekly')}</small></p>}{goal!.exerciseKcal!==null&&<p className="current-goal-number" data-testid="current-exercise-calories">{number(goal!.exerciseKcal!)}<small>kcal / {period(goal!.exerciseMode==='weekly')}</small></p>}</div></section>}
 {updated&&<p className="current-goals-updated">{t('currentUpdatedOn',{date:updated.replaceAll('-','.')})}</p>}
 </>}
 </div>;
}
