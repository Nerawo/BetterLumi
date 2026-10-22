import {activityMultipliers,bmi,durationInWeeks,estimatedEnergy,maxDurationWeeks,weightInKg,type CalculatorInput,type EstimateRange} from './calculator-model';

export type PlanAssessmentInput=Omit<CalculatorInput,'age'|'heightCm'|'currentWeight'|'targetWeight'|'duration'>&Record<'age'|'heightCm'|'currentWeight'|'targetWeight'|'duration',number|null>;
export type PlanReason='missingBody'|'invalidBody'|'minor'|'excluded'|'underweight'|'invalidTarget'|'targetUnderweight'|'invalidDuration'|'energyUnreliable'|'sexNeeded'|'normalBmi'|'olderAdult'|'pace'|'deficit'|'intake'|'gainPace'|'energyMargin'|'cautionIntake'|'cautionDeficit'|'cautionPace';
export interface PlanAssessment {
 status:'incomplete'|'reasonable'|'attention'|'notRecommended';reasons:PlanReason[];blockingReasons:PlanReason[];warningReasons:PlanReason[];
 currentBmi:number|null;targetBmi:number|null;weeks:number|null;weeklyChangeKg:number|null;weeklyPercent:number|null;dailyDeficit:number|null;
 referenceWeeks:EstimateRange|null;reachableWeightKg:EstimateRange|null;
 energy:ReturnType<typeof estimatedEnergy>|null;intakeFloor:number|null;cautionFloor:number|null;maxDeficit:number|null;
 energyIssue:'baselineBelowReference'|'baselinePlausibility'|'additionalExercise'|null;additionalDailyExercise:number|null;
 minimumIntake:number|null;intakeBoundarySource:'minimum'|'relative'|null;
 deficitFraction:number|null;cautionFraction:number|null;deficitLimit:number|null;cautionDeficitLimit:number|null;
 weeklyLossLimit:number|null;cautionWeeklyLossLimit:number|null;
 /** Raw mathematical requirement; it never authorizes application as a diet target. */
 requestedIntake:EstimateRange|null;withinPlanningRange:boolean;planTarget:number|null;maintenanceTarget:number|null;canEstimate:boolean;
}
const positive=(value:number|null):value is number=>value!==null&&Number.isFinite(value)&&value>0;
const round25=(value:number)=>Math.round(value/25)*25;
/** Conservative product screening, NOT a validated clinical prescription.
 * Sex-specific starting references are combined with body size, age, relative
 * rate and current/endpoint TDEE margins; BMR is never used as an intake floor.
 * See docs/health-goal-calculator.md for assumptions and primary references. */
export function assessGoalPlan(input:PlanAssessmentInput,additionalDailyExercise=0):PlanAssessment {
 const a:PlanAssessment={status:'incomplete',reasons:[],blockingReasons:[],warningReasons:[],currentBmi:null,targetBmi:null,weeks:null,weeklyChangeKg:null,weeklyPercent:null,dailyDeficit:null,referenceWeeks:null,reachableWeightKg:null,energy:null,intakeFloor:null,cautionFloor:null,maxDeficit:null,energyIssue:null,additionalDailyExercise:Number.isFinite(additionalDailyExercise)?additionalDailyExercise:null,minimumIntake:null,intakeBoundarySource:null,deficitFraction:null,cautionFraction:null,deficitLimit:null,cautionDeficitLimit:null,weeklyLossLimit:null,cautionWeeklyLossLimit:null,requestedIntake:null,withinPlanningRange:false,planTarget:null,maintenanceTarget:null,canEstimate:false};
 let rejected=false;
 const reject=(reason:PlanReason)=>{rejected=true;if(!a.reasons.includes(reason))a.reasons.push(reason);if(!a.blockingReasons.includes(reason))a.blockingReasons.push(reason);a.status='notRecommended'};
 const caution=(reason:PlanReason)=>{if(!a.reasons.includes(reason))a.reasons.push(reason);if(!a.warningReasons.includes(reason))a.warningReasons.push(reason)};
 if(!['kg','jin','lb'].includes(input.weightUnit)||!['weeks','months'].includes(input.durationUnit)||!Object.hasOwn(activityMultipliers,input.activity)||!['','female','male'].includes(input.sex)||typeof input.excluded!=='boolean'){reject('invalidBody');return a}
 if(input.age!==null&&(!Number.isInteger(input.age)||input.age<18)){reject(input.age>=0&&input.age<18?'minor':'invalidBody');return a}
 if(input.excluded){reject('excluded');return a}
 if(input.age===null||input.heightCm===null||input.currentWeight===null){a.reasons.push('missingBody');return a}
 const kg=weightInKg(input.currentWeight,input.weightUnit),cm=input.heightCm,age=input.age;
 if(!Number.isFinite(age)||age>120||!Number.isFinite(cm)||cm<100||cm>250||!Number.isFinite(kg)||kg<30||kg>350){reject('invalidBody');return a}
 a.currentBmi=bmi(kg,cm);
 if(a.currentBmi<18.5){reject('underweight');return a}
 a.energy=estimatedEnergy(age,cm,kg,input.sex,input.activity);
 // Starting references are not "safe for everyone" and do not replace clinical review.
 const baseFloor=input.sex==='female'?1200:1500;
 // Smooth product reference margins, not a medical risk curve. BMI 21 has
 // no special role. Standard BMI categories remain descriptive screening context.
 const normalProgress=Math.max(0,Math.min(1,(a.currentBmi-18.5)/6.5));
 const higherProgress=Math.max(0,Math.min(1,(a.currentBmi-25)/5));
 const fraction=age>=65?.10:.15+.05*normalProgress;
 const deficitCap=age>=65?250:375+125*normalProgress;
 const softRateCap=Math.min(.75,kg*(age>=65?.005:.005+.005*higherProgress));
 const hardFraction=age>=65?.20:.25+.05*higherProgress;
 const hardDeficitCap=age>=65?500:500+250*higherProgress;
 const rateCap=Math.min(age>=65?.75:1,kg*(age>=65?.005:.01));
 a.minimumIntake=baseFloor;a.deficitFraction=hardFraction;a.cautionFraction=fraction;
 a.weeklyLossLimit=rateCap;a.cautionWeeklyLossLimit=softRateCap;
 const m=a.energy.maintenance.min;
 if(!Number.isFinite(m)||!Number.isFinite(a.energy.maintenance.max)||a.energy.bmr.min<=0||m/kg<10||a.energy.maintenance.max/kg>80||m<baseFloor){a.energyIssue=m<baseFloor?'baselineBelowReference':'baselinePlausibility';reject('energyUnreliable');return a}
 a.canEstimate=true;
 const extraValid=Number.isFinite(additionalDailyExercise)&&additionalDailyExercise>=0&&additionalDailyExercise<=m*.25;
 const extra=extraValid?additionalDailyExercise:0;
 if(!extraValid){a.energyIssue='additionalExercise';reject('energyUnreliable')}
 const total=m+extra;
 a.intakeFloor=Math.max(baseFloor,total*(1-hardFraction));
 a.intakeBoundarySource=baseFloor>=total*(1-hardFraction)?'minimum':'relative';
 a.cautionFloor=Math.max(baseFloor,total*(1-fraction));
 const budget=(targetKg:number,cap:number,f:number)=>{
  const end=estimatedEnergy(age,cm,targetKg,input.sex,input.activity).maintenance.min+extra*targetKg/kg;
  return Math.max(0,Math.min(cap,total*f,end*f,total-baseFloor,end-baseFloor));
 };
 const lossBudget=(targetKg:number)=>budget(targetKg,hardDeficitCap,hardFraction);
 const softBudget=(targetKg:number)=>budget(targetKg,deficitCap,fraction);
 a.maxDeficit=lossBudget(kg);
 const rateFor=(targetKg:number)=>Math.min(rateCap,lossBudget(targetKg)/1100);
 const gainRate=Math.min(.25,kg*.005,Math.min(250,m*.1)/1100);
 if(!input.sex)caution('sexNeeded');
 if(age>=65)caution('olderAdult');
 a.status=rejected?'notRecommended':a.reasons.length?'attention':'incomplete';
 if(input.sex){const maintenance=round25(m);if(maintenance>=baseFloor)a.maintenanceTarget=maintenance}
 let targetKg:number|null=null;
 if(input.targetWeight!==null){
  targetKg=weightInKg(input.targetWeight,input.weightUnit);
  if(!positive(targetKg)||targetKg<30||targetKg>350){reject('invalidTarget');targetKg=null}
  else {a.targetBmi=bmi(targetKg,cm);if(a.targetBmi<18.5)reject('targetUnderweight')}
 }
 if(input.duration!==null){
  const weeks=durationInWeeks(input.duration,input.durationUnit);
  if(!positive(input.duration)||!Number.isFinite(weeks)||weeks<=0||weeks>maxDurationWeeks+1e-8)reject('invalidDuration');else a.weeks=weeks;
 }
 const change=targetKg===null?null:targetKg-kg;
 // Adult underweight classification is the only BMI eligibility boundary.
 // Intake, energy budgets, pace and other profile checks remain independent.
 const lossAllowed=a.currentBmi>=18.5;
 if(change!==null&&change<0&&a.currentBmi<25)caution('normalBmi');
 // Invert the same conservative endpoint-aware rate model. No fields are written.
 if(a.weeks!==null){
  const healthyMin=Math.max(30,18.5*(cm/100)**2);let lo=0,hi=Math.max(0,kg-healthyMin);
  for(let i=0;i<48;i++){const loss=(lo+hi)/2;if(loss/a.weeks<=rateFor(kg-loss))lo=loss;else hi=loss}
  if(change!==null&&change>0)a.reachableWeightKg={min:Math.min(350,kg+gainRate*.5*a.weeks),max:Math.min(350,kg+gainRate*a.weeks)};
  else if(lossAllowed&&lo>1e-7)a.reachableWeightKg={min:kg-lo,max:kg-lo*.5};
 }
 if(change!==null&&change!==0&&a.targetBmi!==null&&(change>0||lossAllowed&&a.targetBmi>=18.5)){
  const maxRate=change<0?rateFor(targetKg!):gainRate;
  if(maxRate>1e-9)a.referenceWeeks={min:Math.abs(change)/maxRate,max:Math.abs(change)/(maxRate*.5)};
  else reject('energyMargin');
 }
 if(change===null||a.weeks===null){if(!rejected&&a.reasons.length)a.status='attention';return a}
 a.weeklyChangeKg=change/a.weeks;a.weeklyPercent=a.weeklyChangeKg/kg*100;a.dailyDeficit=-a.weeklyChangeKg*1100;
 // Extra exercise changes food energy, never the total required deficit or pace.
 a.requestedIntake={min:m-a.dailyDeficit+additionalDailyExercise,max:a.energy.maintenance.max-a.dailyDeficit+additionalDailyExercise};
 if(change<0){
  if(-a.weeklyChangeKg>rateCap+1e-8)reject('pace');
  a.deficitLimit=Math.min(a.maxDeficit!,lossBudget(targetKg!));
  a.cautionDeficitLimit=Math.min(softBudget(kg),softBudget(targetKg!));
  if(a.dailyDeficit>a.deficitLimit+1e-8)reject('deficit');
  if(Math.min(a.requestedIntake.min,Math.round(a.requestedIntake.min))<a.intakeFloor-1e-8)reject('intake');
  if(-a.weeklyChangeKg>softRateCap+1e-8)caution('cautionPace');
  if(a.dailyDeficit>softBudget(kg)+1e-8||a.dailyDeficit>softBudget(targetKg!)+1e-8)caution('cautionDeficit');
  if(a.requestedIntake.min<a.cautionFloor-1e-8)caution('cautionIntake');
 }else if(change>0&&a.weeklyChangeKg>gainRate+1e-8)reject('gainPace');
 if(!Number.isFinite(a.requestedIntake.min)||a.requestedIntake.min<=0)reject('intake');
 if(!rejected){
  a.status=a.reasons.length?'attention':'reasonable';a.withinPlanningRange=true;
  if(input.sex){
   // Only quantize a request that already passed screening; never clamp an unsafe plan up.
   const floor=change<0?a.intakeFloor:baseFloor;
   a.planTarget=Math.max(round25(a.requestedIntake.min),Math.ceil(floor/25)*25);
  }
 }
 return a;
}
