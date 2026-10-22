import './goal-tolerances-locale';
import {useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {useTranslation} from 'react-i18next';
import {NumberInput} from './NumberInput';
import {Modal} from './ui';
import {nutritionMetrics,type NutritionMetric} from './aggregation';
import {defaultGoalTolerances,type GoalTolerances} from './goal-tolerance-model';
import {saveGoalTolerances} from './goal-tolerances';
export function GoalTolerancePanel({close,initial}:{close:()=>void;initial:GoalTolerances}){
 const {t}=useTranslation(),[draft,setDraft]=useState<Record<NutritionMetric,number|null>>(()=>({...initial})),[error,setError]=useState(''),[busy,setBusy]=useState(false),[confirm,setConfirm]=useState(false),lock=useRef(false);
 const save=async(values:GoalTolerances)=>{if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await saveGoalTolerances(values);close()}catch{setError(t('failedMessage'))}finally{lock.current=false;setBusy(false)}};
 return <><form className="goal-tolerance-form" onSubmit={event=>{event.preventDefault();if(nutritionMetrics.some(key=>draft[key]===null||!Number.isFinite(draft[key])||draft[key]!<0)){setError(t('goalToleranceInvalid'));return}void save(draft as GoalTolerances)}}>
 <div className="modal-scroll"><div className="goal-tolerance-fields">{nutritionMetrics.map(key=><label key={key}>{t(key==='calories'?'goalCalories':key)} <small>± {key==='calories'?'kcal':'g'}</small><NumberInput name={key+'Tolerance'} type="number" min="0" step="any" required value={draft[key]??''} onChange={event=>setDraft(old=>({...old,[key]:event.target.value===''?null:Number(event.target.value)}))}/></label>)}</div><p className="goal-tolerance-note">{t('goalToleranceTiming')}</p>{error&&<p role="alert">{error}</p>}<button type="button" className="text-link tolerance-restore" disabled={busy} onClick={()=>setConfirm(true)}>{t('goalRestoreDefaults')}</button></div>
 <div className="form-actions"><button type="button" onClick={close} disabled={busy}>{t('cancel')}</button><button className="primary" disabled={busy}>{t('save')}</button></div></form>
 {confirm&&createPortal(<Modal title={t('goalRestoreConfirm')} close={()=>{if(!busy)setConfirm(false)}} className="goal-tolerance-reset-modal"><p>{t('goalRestoreDescription')}</p><div className="form-actions"><button type="button" disabled={busy} onClick={()=>setConfirm(false)}>{t('cancel')}</button><button type="button" className="primary" disabled={busy} onClick={()=>{setDraft({...defaultGoalTolerances});setConfirm(false);void save({...defaultGoalTolerances})}}>{t('goalRestoreDefaults')}</button></div></Modal>,document.body)}</>;
}
