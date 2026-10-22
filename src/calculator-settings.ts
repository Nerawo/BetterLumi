import {validProfessionalGuidance,specialCircumstances,type ProfessionalGuidance} from './professional-guidance';
import {db} from './domain';
import {validPlannerSettings,type PlannerSettings} from './interactive-planner';
import {weightFromKg,type CalculatorInput} from './health-calculator';
export type CalculatorDraft=Omit<CalculatorInput,'age'|'heightCm'|'currentWeight'|'targetWeight'|'duration'>&Record<'age'|'targetWeight'|'duration',number|null>&{
 /** Legacy manual calculation weights are retained for backup compatibility only. */
 currentWeight?:number|null;currentWeightUnit?:'kg'|'lb';
}&PlannerSettings&ProfessionalGuidance;
export const calculatorSettingsKey='healthGoalCalculatorDraft';
export const initialCalculatorDraft:CalculatorDraft={age:null,targetWeight:null,weightUnit:'kg',duration:12,durationUnit:'weeks',activity:'sedentary',sex:'',excluded:false};
/** Draft values are never active goals; calculation validates safety separately. */
export function validCalculatorDraft(value:unknown):value is CalculatorDraft {
  const x=value as CalculatorDraft;return !!x&&validProfessionalGuidance(x)&&validPlannerSettings(x)&&(x.currentWeight===undefined||x.currentWeight===null||typeof x.currentWeight==='number'&&Number.isFinite(x.currentWeight))&&(x.currentWeightUnit===undefined||['kg','lb'].includes(x.currentWeightUnit))&&(x.currentWeight===undefined||x.currentWeightUnit!==undefined)&&(['age','targetWeight','duration'] as const).every(key=>x[key]===null||typeof x[key]==='number'&&Number.isFinite(x[key]))&&['kg','jin','lb'].includes(x.weightUnit)&&['weeks','months'].includes(x.durationUnit)&&['sedentary','light','moderate','very'].includes(x.activity)&&['','female','male'].includes(x.sex)&&typeof x.excluded==='boolean';
}
export function calculatorWeightKg(_legacyDraft:CalculatorDraft,journalKg:number|null){
 return journalKg;
}
/** A calculation snapshot excludes UI-only draft fields; blanks are never zero. */
export function calculatorInput(draft:CalculatorDraft,height:number|null,kg:number|null):CalculatorInput|null{
 if(height===null||kg===null||draft.age===null||draft.targetWeight===null||draft.duration===null)return null;
 return {age:draft.age,heightCm:height,currentWeight:weightFromKg(kg,draft.weightUnit),targetWeight:draft.targetWeight,weightUnit:draft.weightUnit,duration:draft.duration,durationUnit:draft.durationUnit,activity:draft.activity,sex:draft.sex,excluded:specialCircumstances(draft).active};
}
export function sameCalculatorInput(a:CalculatorInput|null,b:CalculatorInput|null){
 return !!a&&!!b&&a.age===b.age&&(['heightCm','currentWeight','targetWeight','duration'] as const).every(key=>Number.isFinite(a[key])&&Number.isFinite(b[key])&&Math.abs(a[key]-b[key])<1e-8)&&(['weightUnit','durationUnit','activity','sex','excluded'] as const).every(key=>a[key]===b[key]);
}
export function parseCalculatorDraft(raw:string|undefined):CalculatorDraft|null {
  try{const parsed=JSON.parse(raw??'null');return parsed?.version===1&&validCalculatorDraft(parsed.value)?parsed.value:null}catch{return null}
}
export async function saveCalculatorDraft(value:CalculatorDraft){
  if(!validCalculatorDraft(value))throw Error('Invalid calculator draft');
  await db.settings.put({key:calculatorSettingsKey,value:JSON.stringify({version:1,value})});
}
