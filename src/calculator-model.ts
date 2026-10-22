export type CalculatorWeightUnit='kg'|'jin'|'lb';
export type CalculatorActivity='sedentary'|'light'|'moderate'|'very';
export interface CalculatorInput {
 age:number;heightCm:number;currentWeight:number;targetWeight:number;weightUnit:CalculatorWeightUnit;
 duration:number;durationUnit:'weeks'|'months';activity:CalculatorActivity;sex:''|'female'|'male';excluded:boolean;
}
export interface EstimateRange {min:number;max:number}
export const activityMultipliers:Record<CalculatorActivity,number>={sedentary:1.2,light:1.375,moderate:1.55,very:1.725};
export const weightInKg=(value:number,unit:CalculatorWeightUnit)=>value*(unit==='jin'?.5:unit==='lb'?.45359237:1);
export const weightFromKg=(value:number,unit:CalculatorWeightUnit)=>value/(unit==='jin'?.5:unit==='lb'?.45359237:1);
export const bmi=(kg:number,cm:number)=>kg/(cm/100)**2;
export const weeksPerMonth=365.25/12/7;
export const maxDurationWeeks=24*weeksPerMonth;
export const durationInWeeks=(value:number,unit:CalculatorInput['durationUnit'])=>value*(unit==='months'?weeksPerMonth:1);
export const durationFromWeeks=(weeks:number,unit:CalculatorInput['durationUnit'])=>weeks/(unit==='months'?weeksPerMonth:1);
/** Same Mifflin/activity equations as before; endpoints preserve unspecified sex. */
export function estimatedEnergy(age:number,cm:number,kg:number,sex:CalculatorInput['sex'],activity:CalculatorActivity){
 const base=10*kg+6.25*cm-5*age;
 const bmr={min:base+(sex==='male'?5:-161),max:base+(sex==='female'?-161:5)};
 return {bmr,maintenance:{min:bmr.min*activityMultipliers[activity],max:bmr.max*activityMultipliers[activity]}};
}

/** Mathematical output for the supported adult model, independent of planning
 * approval. Even zero/negative requirements remain visible, never diet targets. */
export function theoreticalGoalMath(input:CalculatorInput){
 if(!input||!['kg','jin','lb'].includes(input.weightUnit)||!['weeks','months'].includes(input.durationUnit)||!Object.hasOwn(activityMultipliers,input.activity)||!['','female','male'].includes(input.sex)||input.excluded!==false||!Number.isInteger(input.age)||input.age<18||input.age>120||!Number.isFinite(input.heightCm)||input.heightCm<100||input.heightCm>250||![input.currentWeight,input.targetWeight,input.duration].every(Number.isFinite))throw Error('Invalid calculator input');
 const kg=weightInKg(input.currentWeight,input.weightUnit),target=weightInKg(input.targetWeight,input.weightUnit),weeks=durationInWeeks(input.duration,input.durationUnit);
 if(!Number.isFinite(kg)||kg<30||kg>350||!Number.isFinite(target)||target<30||target>350||!Number.isFinite(weeks)||weeks<=0||weeks>maxDurationWeeks+1e-8)throw Error('Invalid calculator input');
 const changeKg=target-kg,weeklyChangeKg=changeKg/weeks,energy=estimatedEnergy(input.age,input.heightCm,kg,input.sex,input.activity);
 const theoretical={min:energy.maintenance.min+weeklyChangeKg*1100,max:energy.maintenance.max+weeklyChangeKg*1100};
 if(!Number.isFinite(theoretical.min)||!Number.isFinite(theoretical.max))throw Error('Invalid calculator input');
 return {currentBmi:bmi(kg,input.heightCm),targetBmi:bmi(target,input.heightCm),changeKg,weeklyChangeKg,weeks,...energy,theoretical};
}
