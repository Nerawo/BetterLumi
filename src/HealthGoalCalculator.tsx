import {professionalCalorieTarget,specialCircumstances} from './professional-guidance';
import {calculateMacroPlan,type NutritionPlan} from './macro-planner';
import './macro-planner-locale';
import './professional-locale';
import './goal-presentation-locale';
import {calculatorSettingsKey,parseCalculatorDraft,saveCalculatorDraft,initialCalculatorDraft,calculatorWeightKg,type CalculatorDraft} from './calculator-settings';
import './calculator-locale';
import './planner-locale';
import './health-calculator.css';
import {useEffect,useId,useLayoutEffect,useRef,useState} from 'react';
import {ChevronDown,Info} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {Modal,type Notice} from './ui';
import {NumberInput} from './NumberInput';
import {durationInWeeks,durationFromWeeks,maxDurationWeeks,weightInKg,weightFromKg,type CalculatorInput,type EstimateRange} from './calculator-model';
import {planInteractively,plannerDefaults} from './interactive-planner';
import {primaryPlanReason,planReasonMessage,suggestTargetTimeline} from './goal-plan-suggestions';
import {applyCalculatorPlan} from './calculator-goals';
import {acceptableRange} from './goal-tolerance-model';
import {useGoalToleranceSettings} from './goal-tolerances';
import {db,localDate} from './domain';
import {formatLocalDate} from './dates';
import {useLiveQuery} from 'dexie-react-hooks';
import {useBmiProfile,weightBmi,type BmiProfile} from './bmi-profile';
import {PersistentBmi,BmiHeightInput} from './PersistentBmi';

/** Native top-layer popovers remain inside the visual viewport. */
function CalculatorInfo({label,text}:{label:string;text:string}){
  const id=useId(),trigger=useRef<HTMLButtonElement>(null),popup=useRef<HTMLDivElement>(null),[open,setOpen]=useState(false);
  const [nativePopover]=useState(()=>typeof HTMLElement.prototype.showPopover==='function');
  useLayoutEffect(()=>{
    if(!open)return;
    const position=()=>{const a=trigger.current?.getBoundingClientRect(),p=popup.current;if(!a||!p)return;const v=window.visualViewport,left=v?.offsetLeft??0,top=v?.offsetTop??0,width=v?.width??innerWidth,bottom=top+(v?.height??innerHeight);p.style.width=Math.min(280,width-32)+'px';p.style.maxHeight=Math.max(80,(v?.height??innerHeight)-32)+'px';const h=p.getBoundingClientRect().height;p.style.left=Math.max(left+16,Math.min(a.left,left+width-p.offsetWidth-16))+'px';p.style.top=Math.max(top+16,Math.min(a.bottom+8,bottom-h-16))+'px'};
    position();window.addEventListener('scroll',position,true);window.visualViewport?.addEventListener('resize',position);window.addEventListener('resize',position);
    return()=>{window.removeEventListener('scroll',position,true);window.visualViewport?.removeEventListener('resize',position);window.removeEventListener('resize',position)};
  },[open,text]);
  if(!nativePopover)return <details className="calculator-info-fallback"><summary aria-label={label}><Info size={15}/></summary><p role="note">{text}</p></details>;
  return <span className="calculator-info"><button type="button" ref={trigger} popoverTarget={id} aria-label={label} aria-expanded={open}><Info size={15}/></button><div id={id} ref={popup} popover="auto" className="calculator-popover" role="note" onToggle={event=>setOpen(event.currentTarget.matches(':popover-open'))}>{text}</div></span>;
}


/** One compact numeric edit buffer accompanies each touch-sized slider. */
function PlannerSlider({name,label,value,unit,min,max,step=1,onChange,disabled=false}:{name:string;label:string;value:number|null;unit:string|React.ReactNode;min:number;max:number;step?:number;onChange:(value:number|null)=>void;disabled?:boolean}){
 const id=useId(),[revision,setRevision]=useState(0),{t}=useTranslation();
 const ownEdit=useRef<number|null|undefined>(undefined),previous=useRef(value);
 useLayoutEffect(()=>{if(value!==previous.current){previous.current=value;if(ownEdit.current!==value)setRevision(v=>v+1);ownEdit.current=undefined}},[value]);
 const within=value===null||value>=min&&value<=max;
 const sliderValue=Math.max(min,Math.min(max,value??min)),hintId=id+'-hint';
 return <div className="planner-control"><div className="planner-control-heading"><label htmlFor={id}>{label}</label><div className="planner-value-edit"><NumberInput key={revision} id={id} name={name} aria-describedby={!within||disabled?hintId:undefined} value={value??''} step="any" onChange={e=>{const n=e.target.value===''?null:Number(e.target.value);ownEdit.current=n;onChange(n)}}/>{typeof unit==='string'?<small>{unit}</small>:unit}</div></div>
 <input className="planner-slider" disabled={disabled} aria-describedby={!within||disabled?hintId:undefined} type="range" name={name+'Slider'} aria-label={label} aria-valuetext={value===null?t('plannerNotRecorded'):String(sliderValue)} min={min} max={max} step={step} value={sliderValue} style={{'--planner-progress':Math.max(0,Math.min(100,((value??min)-min)/(max-min)*100))+'%'} as React.CSSProperties} onChange={e=>{ownEdit.current=Number(e.target.value);onChange(Number(e.target.value));setRevision(v=>v+1)}}/>
 {(disabled||!within)&&<p id={hintId} className="calculator-footnote">{t(disabled?'plannerWeightRangeNeedsWeight':'plannerNoLimit')}</p>}
</div>;
}
export function HealthGoalCalculator({notice,active=true}:{notice:Notice;active?:boolean}){
 const profile=useBmiProfile();
 const saved=useLiveQuery(()=>db.settings.get(calculatorSettingsKey).then(value=>value??null));
 if(!profile||saved===undefined)return null;
 return <CalculatorContent profile={profile} initialDraft={parseCalculatorDraft(saved?.value)??initialCalculatorDraft} notice={notice} active={active}/>;
}
function CalculatorContent({profile,initialDraft,notice,active}:{profile:BmiProfile;initialDraft:CalculatorDraft;notice:Notice;active:boolean}){
 const {t,i18n}=useTranslation(),[draft,setDraft]=useState<CalculatorDraft>(()=>({...initialDraft}));
 const [heightDraft,setHeightDraft]=useState<number|null|undefined>();
 const height=heightDraft===undefined?profile.height:heightDraft;
 // Undefined follows the journal; null is an intentionally blank estimate.
 const [temporaryKg,setTemporaryKg]=useState<number|null|undefined>();
 const [weightRevision,setWeightRevision]=useState(0);
 const recordedKg=profile.weight?.kg??null,previousRecorded=useRef(recordedKg);
 useLayoutEffect(()=>{if(!active){setTemporaryKg(undefined);setWeightRevision(v=>v+1)}},[active]);
 useLayoutEffect(()=>{if(previousRecorded.current!==recordedKg){previousRecorded.current=recordedKg;if(temporaryKg===undefined)setWeightRevision(v=>v+1)}},[recordedKg,temporaryKg]);
 const kg=temporaryKg===undefined?calculatorWeightKg(draft,recordedKg):temporaryKg,currentUnit=profile.unit;
 const currentWeight=kg===null?null:weightFromKg(kg,currentUnit);
 const settings={...plannerDefaults,...draft};
 const quickWeightAvailable=kg!==null&&Number.isFinite(kg)&&kg>=30&&kg<=350;
 const special=specialCircumstances(draft);
 const specialMessage=t('manualTargetHint');
 const activityTrigger=useRef<HTMLElement>(null);
 const [activityOpen,setActivityOpen]=useState(false);
 const specialPanel=useRef<HTMLDetailsElement>(null);
 const input={...draft,excluded:special.active,heightCm:height,currentWeight:kg===null?null:weightFromKg(kg,draft.weightUnit)};
 const plan=planInteractively(input,settings),tolerance=useGoalToleranceSettings();
 const [expanded,setExpanded]=useState(()=>weightBmi(profile.weight?.kg??null,profile.height)===null);
 const [riskOpen,setRiskOpen]=useState(false),riskTrigger=useRef<HTMLButtonElement>(null);
 useEffect(()=>{if(riskOpen)return()=>{if(riskTrigger.current?.isConnected)riskTrigger.current.focus({preventScroll:true})}},[riskOpen]);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const lock=useRef(false),dirty=useRef(false),lastWritten=useRef(JSON.stringify(initialDraft));
 const writes=useRef(Promise.resolve());
 useEffect(()=>{if(!(document.activeElement instanceof HTMLInputElement)||document.activeElement.name!=='bmiHeightCm')setHeightDraft(undefined)},[profile.height]);
 useEffect(()=>{if(weightBmi(profile.weight?.kg??null,height)===null)setExpanded(true)},[profile.weight?.kg,height]);
 // Serialize draft writes so quick slider events cannot persist out of order.
 useEffect(()=>{const json=JSON.stringify(draft);if(dirty.current&&json!==lastWritten.current){lastWritten.current=json;writes.current=writes.current.then(()=>saveCalculatorDraft(draft)).catch(()=>{lastWritten.current='';notice(t('failedMessage'))})}},[draft,notice,t]);
 const edit=(partial:Partial<CalculatorDraft>)=>{setRiskOpen(false);dirty.current=true;setDraft(old=>({...old,...partial}));setError('')};
 const format=(n:number,digits=0)=>n.toLocaleString(i18n.language,{maximumFractionDigits:digits});
 const range=(r:EstimateRange)=>r.min===r.max?format(r.min):format(r.min)+'–'+format(r.max);
 const durationValue=draft.duration;
 const guidedTarget=professionalCalorieTarget(draft),useProfessional=special.active;
 const appliedTarget=useProfessional?guidedTarget:plan.targetKcal;
 const nutritionPlan=draft.nutritionPlan??'balanced';
 const macros=!special.active&&plan.bodyValid?calculateMacroPlan(kg,plan.targetKcal,nutritionPlan):null;
 const calorieRange=acceptableRange(appliedTarget,tolerance.values.calories);
 const bmrValue=plan.energy&&draft.sex?plan.energy.bmr.min:null;
 const explain=(reason:Parameters<typeof planReasonMessage>[0])=>{if(reason==='excluded')return specialMessage;const message=planReasonMessage(reason,plan.assessment);return t(message.key,Object.fromEntries(Object.entries(message.values).map(([key,value])=>[key,format(value,1)])))};
 const reason=primaryPlanReason(plan.assessment.blockingReasons.length?plan.assessment.blockingReasons:plan.assessment.reasons);
 const unavailable=special.active?specialMessage:draft.age!==null&&draft.age<18?t('planReason_minor'):!plan.exerciseValid?t('plannerExerciseInvalid'):plan.weeks!==null&&plan.weeks>maxDurationWeeks?t('plannerHorizon'):!plan.intake?t('plannerNeed'):!draft.sex?t('planReason_sexNeeded'):!plan.nutritionApplicable?explain(reason):'';
 const suggested=suggestTargetTimeline(input,(plan.exerciseKcal??0)/7);
 const caution=plan.nutritionApplicable&&plan.assessment.status==='attention'?explain(primaryPlanReason(plan.assessment.warningReasons)):'';
 const save=async(choice:'plan'|'eligible'|'professional')=>{
  if(choice==='professional'?guidedTarget===null:!plan.nutritionApplicable&&!plan.exerciseApplicable){setError(t('plannerNoEligible'));return}
  if(lock.current)return;lock.current=true;setBusy(true);setError('');
  try{
   await writes.current;
   await applyCalculatorPlan(draft,input,choice);
   setRiskOpen(false);
   notice(t('planApplied'),2500);
  }catch{setError(t('plannerSaveFailed'))}finally{lock.current=false;setBusy(false)}
 };
 const openRisk=(trigger:HTMLButtonElement)=>{riskTrigger.current=trigger;setError('');setRiskOpen(true)};
 const requestPlan=(event:React.MouseEvent<HTMLButtonElement>)=>{notice('',0);setError('');if(useProfessional){if(guidedTarget===null){setError(t('guidedInvalid'));if(specialPanel.current){specialPanel.current.open=true;specialPanel.current.querySelector<HTMLInputElement>('[name=professionalKcal]')?.focus({preventScroll:true});specialPanel.current.scrollIntoView({block:'nearest'})}return}openRisk(event.currentTarget);return}if(plan.nutritionApplicable&&(!settings.exerciseEnabled||plan.exerciseApplicable))void save('plan');else openRisk(event.currentTarget)};
 return <section className="health-calculator-inline" aria-label={t('calcTitle')}>
  <PersistentBmi age={draft.age} profile={profile} height={height} calculationWeightKg={kg}/>
  <details className="calculator-input-section" open={expanded} onToggle={e=>setExpanded(e.currentTarget.open)}>
   <summary><span>{t('inlineBodyGoals')}</span><span className="calculator-chevron" aria-hidden="true"><ChevronDown size={17}/></span></summary>
   <form onSubmit={e=>e.preventDefault()}>
    <section className="calculator-subsection calculator-body-section"><h3>{t('inlineBodyData')}</h3><div className="calculator-fields">
     <BmiHeightInput height={height} onChange={setHeightDraft} notice={notice}/>
     <label>{t('calcAge')}<span className="calculator-number-unit"><NumberInput name="age" value={draft.age??''} step="1" onChange={e=>edit({age:e.target.value===''?null:Number(e.target.value)})}/><small>{t('calcYears')}</small></span></label>
     <label className="calculator-unit-field"><span className="calculator-label">{t('calcCurrent')}</span><span className="calculator-unit-controls"><NumberInput key={currentUnit+'-'+weightRevision} name="currentWeight" value={currentWeight??''} step="any" onChange={e=>{setRiskOpen(false);setError('');setTemporaryKg(e.target.value===''?null:weightInKg(Number(e.target.value),currentUnit))}}/><select name="currentWeightUnit" aria-label={t('calcCurrentUnit')} value={currentUnit} onChange={e=>{const unit=e.target.value as 'kg'|'lb';void db.settings.put({key:'weightUnit',value:unit}).catch(()=>notice(t('failedMessage')))}}><option value="kg">kg</option><option value="lb">lb</option></select></span></label>
     <div className="calculator-sex"><div className="calculator-label">{t('calcSex')}<CalculatorInfo label={t('calcSex')} text={t('calcSexInfo')}/></div><select name="sex" aria-label={t('calcSex')} value={draft.sex} onChange={e=>edit({sex:e.target.value as CalculatorInput['sex']})}><option value="">{t('calcUnspecified')}</option><option value="female">{t('calcFemale')}</option><option value="male">{t('calcMale')}</option></select></div>
    </div>
    <div className="calculator-weight-note"><p className="calculator-footnote">{t('calcTemporaryWeightNote')}</p>{temporaryKg!==undefined&&recordedKg!==null&&<button type="button" className="planner-text-action" onClick={()=>{setTemporaryKg(undefined);setWeightRevision(v=>v+1)}}>{t('calcUseLatestWeight')}</button>}</div>
    <div className="calculator-body-bmr" aria-live="polite"><div className="calculator-result-heading">{t('bodyBmr')}<CalculatorInfo label={t('bodyBmr')} text={t('bodyBmrInfo')}/></div><p className={bmrValue===null?'calculator-footnote calculator-bmr-missing':'calculator-secondary-value'} data-testid="body-bmr">{bmrValue===null?t('bodyBmrMissing'):'≈ '+format(bmrValue)}{bmrValue!==null&&<small>{t('calcPerDay')}</small>}</p></div>
    <details className="calculator-setting-row" open={activityOpen} onToggle={e=>setActivityOpen(e.currentTarget.open)}><summary ref={activityTrigger}><span>{t('calcActivity')}</span><span className="calculator-setting-value">{t({sedentary:'calcSedentary',light:'calcLight',moderate:'calcModerate',very:'calcVery'}[draft.activity])}<ChevronDown size={15}/></span></summary><fieldset className="calculator-activity"><legend className="sr-only">{t('calcActivity')}</legend>{(['sedentary','light','moderate','very'] as const).map((key,index)=><label key={key}><input type="radio" name="activity" value={key} checked={draft.activity===key} onClick={()=>{setActivityOpen(false);activityTrigger.current?.focus({preventScroll:true})}} onChange={()=>{edit({activity:key});setActivityOpen(false);activityTrigger.current?.focus({preventScroll:true})}}/><span>{t(['calcSedentary','calcLight','calcModerate','calcVery'][index])}</span></label>)}</fieldset></details>
    <details ref={specialPanel} className="calculator-setting-row calculator-special-settings"><summary><span>{t('compactSpecial')}</span><span className="calculator-setting-value">{t(special.active?'compactConfigured':'compactNotSet')}<ChevronDown size={15}/></span></summary><div className="calculator-guidance">
     <label className="calculator-exclusion"><input type="checkbox" name="specialOrProfessionalGuidance" checked={special.active} onChange={e=>edit({specialOrProfessionalGuidance:e.target.checked,excluded:e.target.checked})}/><span>{t('unifiedSpecialLabel')}</span></label>
     <p className="calculator-footnote">{t('unifiedSpecialDescription')}</p>
     {special.active&&<div className="calculator-guidance-entry"><label>{t('manualTargetTitle')}<span className="calculator-number-unit"><NumberInput name="professionalKcal" value={draft.professionalKcal??''} step="any" aria-invalid={draft.professionalKcal!=null&&guidedTarget===null||undefined} onChange={e=>edit({professionalKcal:e.target.value===''?null:Number(e.target.value)})}/><small>{t('calcPerDay')}</small></span></label><p className="calculator-footnote">{t('manualTargetHint')}</p>{draft.professionalKcal!=null&&guidedTarget===null&&<p className="calculator-error" role="alert">{t('guidedInvalid')}</p>}</div>}
    </div></details>
    </section>
    <section className="calculator-subsection planner-section"><h3>{t('inlineGoalPlan')}</h3>
     <PlannerSlider key={'weight-'+draft.weightUnit} name="targetWeight" label={t('calcTarget')} value={draft.targetWeight} disabled={!quickWeightAvailable} min={quickWeightAvailable?weightFromKg(kg!-15,draft.weightUnit):0} max={quickWeightAvailable?weightFromKg(kg!+10,draft.weightUnit):1} step={weightFromKg(.5,draft.weightUnit)} onChange={targetWeight=>edit({targetWeight})} unit={<select name="weightUnit" aria-label={t('bmiTargetWeightUnit')} value={draft.weightUnit} onChange={e=>{const unit=e.target.value as CalculatorInput['weightUnit'];edit({weightUnit:unit,targetWeight:draft.targetWeight===null?null:weightFromKg(weightInKg(draft.targetWeight,draft.weightUnit),unit)})}}><option value="kg">kg</option><option value="jin">{t('calcJinUnit')}</option><option value="lb">lb</option></select>}/>
     <PlannerSlider key={'time-'+draft.durationUnit} name="duration" label={t('calcDuration')} value={durationValue} min={durationFromWeeks(1,draft.durationUnit)} max={durationFromWeeks(30,draft.durationUnit)} step={durationFromWeeks(1,draft.durationUnit)} onChange={duration=>edit({duration})} unit={<select name="durationUnit" aria-label={t('calcDurationUnit')} value={draft.durationUnit} onChange={e=>{const unit=e.target.value as CalculatorInput['durationUnit'];edit({durationUnit:unit,duration:draft.duration===null?null:durationFromWeeks(durationInWeeks(draft.duration,draft.durationUnit),unit)})}}><option value="weeks">{t('calcWeeks')}</option><option value="months">{t('calcMonths')}</option></select>}/>
     <label className="calculator-exclusion planner-exercise-toggle"><input type="checkbox" name="exerciseEnabled" checked={settings.exerciseEnabled} onChange={e=>edit({exerciseEnabled:e.target.checked})}/><span>{t('plannerExercise')}</span></label>
     {settings.exerciseEnabled&&<div className="planner-exercise-fields"><p className="calculator-footnote">{t('plannerAdditional')}</p>
      <PlannerSlider name="exerciseMinutes" label={t('plannerMinutes')} value={settings.exerciseMinutes} unit={t('calcMinutesWeek')} min={0} max={600} step={5} onChange={exerciseMinutes=>edit({exerciseMinutes})}/>
     </div>}
    </section>
    <section className="planner-live-summary" aria-label={t('compactPlanAdvice')}>
     <h3>{t('compactPlanAdvice')}</h3>
     <div className="calculator-result-heading">{t(special.active?'manualTargetTitle':'plannerIntake')}{special.active?<small className="planner-calculated-label">{t('manualTargetSource')}</small>:<CalculatorInfo label={t('calcReference')} text={t('plannerFormula')}/>}</div>
     <p className={special.active?'calculator-unavailable-value':'calculator-primary-value'} data-testid="planner-intake">{special.active?(guidedTarget===null?t('compactNoAutomatic'):format(guidedTarget)):plan.intake?range(plan.intake):t('plannerNotRecorded')}{(special.active?guidedTarget!==null:plan.intake!==null)&&<small>{t('calcPerDay')}</small>}</p>
     {special.active&&<p className="calculator-footnote">{specialMessage}</p>}
     {settings.exerciseEnabled&&<div className="planner-exercise-result"><div className="calculator-result-heading">{t('plannerBurn')}<small className="planner-calculated-label">{t('plannerCalculated')}</small></div><p className="calculator-secondary-value" data-testid="planner-exercise-calories">{plan.exerciseKcal===null?t('plannerNotRecorded'):format(plan.exerciseKcal)}<small>{t('plannerWeeklyBurn')}</small></p></div>}
     {special.active?<p className="calculator-footnote calculator-macro-manual">{t('macroManualMode')}</p>:<section className="calculator-macro-plan" aria-label={t('macroScheme')}>
      <div className="calculator-macro-heading"><span className="calculator-result-heading">{t('macroScheme')}</span><div className="calculator-macro-options" role="group" aria-label={t('macroScheme')}>{(['balanced','highProtein'] as const).map((scheme:NutritionPlan)=><button type="button" key={scheme} aria-pressed={nutritionPlan===scheme} onClick={()=>edit({nutritionPlan:scheme})}>{t(scheme==='balanced'?'macroBalanced':'macroHighProtein')}</button>)}</div></div>
      <details className="calculator-macro-details"><summary>{t('macroAbout')}<ChevronDown size={14}/></summary><p>{t(nutritionPlan==='balanced'?'macroBalancedDescription':'macroHighProteinDescription')}</p></details>
      {macros?<><dl className="calculator-macro-values">{(['protein','carbs','fat'] as const).map(key=><div key={key}><dt>{t(key)}</dt><dd data-testid={'macro-'+key}>{format(macros[key])}<small>g</small></dd></div>)}</dl>{macros.cautions.length>0&&<details className="calculator-macro-details calculator-macro-caution"><summary>{t('macroCaution')}<ChevronDown size={14}/></summary>{macros.cautions.map(item=><p key={item.nutrient}>{t('macroProportion',{nutrient:t(item.nutrient),percent:format(item.percent,1),min:item.min,max:item.max})}</p>)}</details>}</>:<p className="calculator-footnote">{t(plan.targetKcal!==null&&plan.targetKcal>0&&kg!==null?'macroCannotAllocate':'macroNeedInputs')}</p>}
     </section>}
     <p className="planner-compact-plan"><span>{draft.targetWeight===null?t('plannerNotRecorded'):format(draft.targetWeight,2)+' '+(draft.weightUnit==='jin'?t('calcJinUnit'):draft.weightUnit)}</span><span data-testid="planner-duration">{durationValue===null?t('plannerNotRecorded'):format(durationValue,2)+' '+t(draft.durationUnit==='weeks'?'calcWeeks':'calcMonths')}</span>{settings.exerciseEnabled&&<span>{plan.exerciseMinutes===null?t('plannerNotRecorded'):format(plan.exerciseMinutes!,1)+' '+t('calcMinutesWeek')}</span>}</p>
     {!special.active&&(unavailable||caution)&&<details id="planner-apply-status" className="calculator-theory-warning"><summary><span>{t(plan.intake?(plan.assessment.status==='attention'?'planStatus_attention':'compactPlanWarning'):'compactNeedInputs')}</span><span>{t('compactViewReason')}<ChevronDown size={14}/></span></summary><p>{unavailable||caution}</p>{!plan.nutritionApplicable&&suggested?.adopt!=null&&<button type="button" className="planner-text-action" onClick={()=>edit({duration:suggested.adopt})}>{t('planUseTimeline')} · {format(suggested.adopt,1)} {t(draft.durationUnit==='weeks'?'calcWeeks':'calcMonths')}</button>}</details>}
     <div className="form-actions"><button className="primary" type="button" disabled={busy||!tolerance.ready} aria-describedby={!special.active&&(unavailable||caution)?'planner-apply-status':undefined} onClick={requestPlan}>{t('plannerApplyPlan')}</button></div>
     {error&&<p role="alert" className="calculator-error">{error}</p>}
     <details className="calculator-references"><summary>{t('compactCalculationDetails')}<ChevronDown size={15}/></summary>
      {plan.energy&&<dl className="planner-summary-grid"><div><dt>{t('calcMaintenance')}</dt><dd>{range(plan.energy.maintenance)} {t('calcPerDay')}</dd></div><div><dt>{t('calcBmr')}</dt><dd>{range(plan.energy.bmr)} {t('calcPerDay')}</dd></div><div><dt>{t('calcPace')}</dt><dd>{plan.weeklyChangeKg===null?t('plannerNotRecorded'):format(plan.weeklyChangeKg,2)+' '+t('calcKgWeek')}</dd></div><div><dt>{t('calcTargetBmi')}</dt><dd>{plan.targetBmi===null?t('plannerNotRecorded'):format(plan.targetBmi,1)}</dd></div><div><dt>{t('calcChange')}</dt><dd>{plan.changeKg===null?t('plannerNotRecorded'):format(plan.changeKg,2)+' kg'}</dd></div></dl>}
      {appliedTarget!==null&&(useProfessional||plan.nutritionApplicable)&&<div className="calculator-apply-preview"><dl><div><dt>{t('calcApplyRange')}</dt><dd>{format(calorieRange.min!)}–{format(calorieRange.max!)} {t('calcPerDay')}</dd></div><div><dt>{t('startDate')}</dt><dd>{formatLocalDate(localDate(),i18n.language)}</dd></div></dl></div>}
      <p>{t('plannerUnifiedNote')}</p>{plan.assessment.intakeFloor!==null&&!special.active&&<p>{t('planIntakeBoundary',{value:format(plan.assessment.intakeFloor)})}</p>}
      <p>{t('plannerFormula')}</p><p>{t('plannerMethod')}</p><p>{t('planScreeningNote')}</p>
      {plan.assessment.reasons.map(reason=><p key={reason}>{explain(reason)}</p>)}
      <h4>{t('macroReferenceTitle')}</h4><p>{t('macroReferenceText')}</p><p>{t('macroReferenceAmdr')}</p>
      <a href="https://pacompendium.com/" target="_blank" rel="noreferrer">2024 Adult Compendium · MET</a><a href="https://www.niddk.nih.gov/health-information/weight-management/body-weight-planner" target="_blank" rel="noreferrer">NIDDK · Body Weight Planner</a>
      <a href="https://cdn.realfood.gov/DGA_508.pdf" target="_blank" rel="noreferrer">Dietary Guidelines for Americans 2025–2030 · Protein</a><a href="https://nap.nationalacademies.org/catalog/10490/dietary-reference-intakes-for-energy-carbohydrate-fiber-fat-fatty-acids-cholesterol-protein-and-amino-acids" target="_blank" rel="noreferrer">National Academies · Dietary Reference Intakes / AMDR</a>
     </details>
    </section>
   </form>
  </details>
  {riskOpen&&<Modal className="calculator-risk-modal" title={t(useProfessional?'guidedConfirm':'plannerRiskTitle')} descriptionId="calculator-risk-description" close={()=>{if(!busy)setRiskOpen(false)}}>
   <div className="modal-scroll calculator-risk-body">
    <p className="calculator-result-heading">{t(useProfessional?'guidedTarget':'plannerTheoretical')}</p>
    <p className="calculator-secondary-value" data-testid="risk-theoretical">{useProfessional?(guidedTarget===null?t('plannerNotRecorded'):format(guidedTarget)):(special.active?t('compactNoAutomatic'):plan.intake?range(plan.intake):t('plannerNotRecorded'))}{(useProfessional?guidedTarget!==null:plan.intake!==null)&&<small>{t('calcPerDay')}</small>}</p>
    <p id="calculator-risk-description">{useProfessional?t('guidedConfirmNote'):(unavailable||t('plannerRiskExplanation'))}</p>
    <p className="calculator-footnote">{t('plannerEstimateRetained')}</p>
    <dl className="planner-review-summary">
     <div><dt>{t('plannerReviewNutrition')}</dt><dd>{t(useProfessional?'guidedTarget':plan.nutritionApplicable?'plannerReviewApply':'plannerReviewEstimate')}</dd></div>
     <div><dt>{t('plannerMinutes')}</dt><dd>{settings.exerciseEnabled?(plan.exerciseMinutes===null?t('plannerNotRecorded'):format(plan.exerciseMinutes!)+' '+t('calcMinutesWeek')):t('plannerNotEnabled')}</dd></div>
     <div><dt>{t('plannerBurn')}</dt><dd>{plan.exerciseKcal===null?t(settings.exerciseEnabled?'plannerNotRecorded':'plannerNotEnabled'):format(plan.exerciseKcal)+' '+t('plannerWeeklyBurn')}</dd></div>
    </dl>
    {!error&&<p className="calculator-footnote">{t(useProfessional?'guidedApplyNote':plan.nutritionApplicable?(plan.exerciseApplicable?'plannerUnifiedNote':'plannerNutritionOnly'):plan.exerciseApplicable?'plannerExerciseWillApply':'plannerNoEligible')}</p>}
    {error&&<p role="alert" className="calculator-error">{error}</p>}
   </div>
   <div className="form-actions calculator-risk-actions">
    <button type="button" className="primary" disabled={busy||!tolerance.ready} onClick={()=>void save(useProfessional?'professional':'eligible')}>{t('plannerApplyPlan')}</button>
    <button type="button" className="calculator-risk-secondary" disabled={busy} onClick={()=>setRiskOpen(false)}>{t('plannerReturnEdit')}</button>
   </div>
  </Modal>}
 </section>;
}
