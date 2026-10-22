import './weight-entry.css';
import {NumberInput} from './NumberInput';
import {DateInput} from './DateInput';
import {useRef,useState} from 'react';
import {useTranslation} from 'react-i18next';
import {localDate,toKg,displayWeight,type Weight} from './domain';
import {validLocalDate} from './routing';
import {Modal,type Notice} from './ui';
import './update-locale';
import {localMeasurementIso,localMeasurementTime,measurementDate,validMeasuredAt} from './weight-time';
import {saveWeightMeasurement} from './weight-records';

function weightText(kg:number,unit:string){
 const exact=displayWeight(kg,unit),rounded=Number(exact.toFixed(4));
 return String(rounded===0&&exact!==0?exact:rounded);
}

export function WeightEntry({item,initialUnit,close,notice}:{item?:Weight|null;initialUnit:string;close:()=>void;notice:Notice}){
 const {t}=useTranslation(),[unit,setUnit]=useState(initialUnit==='lb'?'lb':'kg');
 // Canonical kg is retained separately from the native numeric edit buffer.
 // Unit-only changes therefore never round or change the stored measurement.
 const [kg,setKg]=useState<number|null>(item?.kg??null);
 const [value,setValue]=useState(item?weightText(item.kg,unit):'');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const lock=useRef(false);
 const [original]=useState(()=>{const instant=item?.measuredAt&&validMeasuredAt(item.measuredAt)?item.measuredAt:item?undefined:new Date().toISOString();return {date:item?measurementDate(item):localDate(new Date(instant!)),time:instant?localMeasurementTime(instant):'',instant}});
 const [date,setDate]=useState(original.date),[time,setTime]=useState(original.time);
 const timeChanged=date!==original.date||time!==original.time;

 return <Modal className="weight-entry-modal" title={t(item?'editWeight':'recordWeight')} close={close}>
  <form onSubmit={async e=>{
   e.preventDefault();if(lock.current)return;setError('');const f=new FormData(e.currentTarget);
   if(!validLocalDate(date)||date>localDate()){setError(t('errorDate'));return}
   if(value===''||kg===null||!Number.isFinite(kg)||kg<=0){setError(t('weightEntryInvalid'));return}
   lock.current=true;setBusy(true);
   try{const measuredAt=timeChanged?localMeasurementIso(date,time):original.instant;await saveWeightMeasurement({date:item&&!timeChanged?item.date:date,kg,measuredAt,notes:String(f.get('notes')??'')},item);close();notice(t('savedMessage'))}
   catch(error){setError(t(error instanceof Error&&error.message==='Invalid measurement time'?'weightTimeInvalid':error instanceof Error&&error.message==='Weight changed'?'weightChanged':'failedMessage'))}finally{lock.current=false;setBusy(false)}
  }}>
   <div className="modal-scroll weight-entry-fields">
    <div className="weight-entry-date-time"><label>{t('date')}<DateInput name="date" required max={localDate()} value={date} onChange={e=>{setDate(e.target.value);setError('')}}/></label><label>{t('weightMeasurementTime')}<input type="time" name="time" step="60" required={!item||timeChanged} value={time} onChange={e=>{setTime(e.target.value);setError('')}}/></label></div>
    {item&&!original.instant&&<small className="weight-time-note">{t('weightTimeUnknown')}</small>}
    <label className="weight-entry-measurement">{t('weightEntryValue')}<span className="weight-entry-controls">
     <NumberInput key={unit} name="value" min="0" step="any" required value={value} aria-invalid={error===t('weightEntryInvalid')||undefined} onInvalid={()=>setError(t('weightEntryInvalid'))} onChange={e=>{const text=e.target.value;setValue(text);setKg(text===''?null:toKg(Number(text),unit));setError('')}} onBlur={()=>{if(value!==''&&(kg===null||!Number.isFinite(kg)||kg<=0))setError(t('weightEntryInvalid'))}}/>
     <select name="unit" aria-label={t('weightUnit')} value={unit} onChange={e=>{const next=e.target.value;setValue(kg!==null&&Number.isFinite(kg)?weightText(kg,next):'');setUnit(next);setError('')}}><option value="kg">kg</option><option value="lb">lb</option></select>
    </span></label>
    <label className="weight-entry-notes">{t('weightNotes')}<textarea name="notes" rows={2} defaultValue={item?.notes??''}/></label>
    {error&&<p className="weight-entry-error" role="alert">{error}</p>}
   </div>
   <div className="form-actions"><button type="button" onClick={close}>{t('cancel')}</button><button className="primary" disabled={busy}>{t('save')}</button></div>
  </form>
 </Modal>;
}
