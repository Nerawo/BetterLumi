import {bmiFeedback} from './bmi-feedback';
import './bmi-locale';
import {useRef,useState} from 'react';
import {ChevronDown} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {NumberInput} from './NumberInput';
import {displayWeight} from './domain';
import {bmiCategories,weightBmi,saveHeightCm,validHeightCm,type BmiProfile,type BmiCategory} from './bmi-profile';
import type {Notice} from './ui';

const categoryKeys:Record<BmiCategory,string>={underweight:'bmiUnderweight',healthy:'bmiHealthy',overweight:'bmiOverweight',obesity:'bmiObesity'};
const ranges:Record<BmiCategory,string>={underweight:'<18.5',healthy:'18.5–<25',overweight:'25–<30',obesity:'≥30'};
export function BmiHeightInput({height,onChange,notice}:{height:number|null;onChange:(value:number|null)=>void;notice:Notice}){
  const {t}=useTranslation(),[error,setError]=useState(false),[status,setStatus]=useState(''),revision=useRef(0);
  const persist=async(value:number)=>{const request=++revision.current;setStatus('bmiHeightSaving');try{await saveHeightCm(value);if(request===revision.current)setStatus('bmiHeightSaved')}catch{if(request===revision.current){setStatus('');notice(t('failedMessage'))}}};
  return <div className="bmi-height-setting"><label>{t('bmiHeight')}<span className="calculator-number-unit"><NumberInput name="bmiHeightCm" required min="100" max="250" step="any" aria-invalid={error||undefined} value={height??''} onChange={event=>{revision.current++;const value=event.target.value===''?null:Number(event.target.value),valid=validHeightCm(value);onChange(valid?value:null);setError(false);setStatus('');if(valid)void persist(value)}} onBlur={event=>setError(event.target.value!==''&&!validHeightCm(Number(event.target.value)))}/><small>cm</small></span></label>{error?<small className="bmi-height-feedback" role="alert">{t('bmiHeightInvalid')}</small>:status&&<small className="bmi-height-feedback" role="status">{t(status)}</small>}</div>;
}
export function PersistentBmi({age,profile,height,calculationWeightKg=profile.weight?.kg??null}:{age:number|null;profile:BmiProfile;height:number|null;calculationWeightKg?:number|null}){
  const {t,i18n}=useTranslation();
  const value=weightBmi(calculationWeightKg,height),feedback=bmiFeedback(value,age),category=feedback.category;
  // Linear scale 12–40; only the marker is clamped in the open-ended categories.
  const position=value===null?null:(Math.min(40,Math.max(12,value))-12)/28*100;
  return <section className="persistent-bmi" aria-labelledby="persistent-bmi-heading">
    <div className="bmi-heading-row"><h2 id="persistent-bmi-heading">{t('bmiTitle')}</h2></div>
    {value!==null?<div className="bmi-reading" aria-live="polite"><strong data-testid="persistent-bmi-value">{value.toLocaleString(i18n.language,{minimumFractionDigits:1,maximumFractionDigits:1})}</strong>{category&&<span>{t(categoryKeys[category])}</span>}</div>:<div className="bmi-setup"><p role="status">{t(!calculationWeightKg&&!height?'bmiMissingBoth':!calculationWeightKg?'bmiMissingWeight':'bmiMissingHeight')}</p></div>}
    {feedback.comment&&<p className="bmi-comment" aria-live="polite">{t(feedback.comment)}</p>}
    <p className="bmi-current-weight"><span>{t('calcCurrent')} · </span><span className="bmi-current-weight-value">{calculationWeightKg!==null?<>{displayWeight(calculationWeightKg,profile.unit).toLocaleString(i18n.language,{maximumFractionDigits:2})} {profile.unit}</>:t('bmiWeightUnset')}</span></p>
    {feedback.useAdultCategories&&<details className="bmi-categories"><summary><span className="bmi-categories-title">{t('inlineBmiCategories')}<span className="calculator-chevron" aria-hidden="true"><ChevronDown size={16}/></span></span><span className="bmi-category-indicator" role="img" aria-label={category?t('bmiIndicator',{category:t(categoryKeys[category])}):t('bmiSetup')}>{bmiCategories.map(key=><span key={key} data-active={category===key}/>)}{position!==null&&<i className="bmi-current-marker" style={{left:position+'%'}}/>}</span><span className="bmi-scale-labels" aria-hidden="true"><span style={{left:'23.214%'}}>18.5</span><span style={{left:'46.429%'}}>25</span><span style={{left:'64.286%'}}>30</span></span></summary>
      <table className="bmi-category-table"><thead><tr><th scope="col">{t('bmiCategory')}</th><th scope="col">{t('bmiRange')}</th></tr></thead><tbody>{bmiCategories.map(key=><tr key={key} data-current={category===key} aria-current={category===key?'true':undefined}><th scope="row">{t(categoryKeys[key])}</th><td>{ranges[key]}</td></tr>)}</tbody></table>
      <p className="bmi-reference"><a href="https://www.cdc.gov/bmi/adult-calculator/bmi-categories.html" target="_blank" rel="noreferrer">{t('bmiAdultReference')}</a></p>
    </details>}
  </section>;
}

