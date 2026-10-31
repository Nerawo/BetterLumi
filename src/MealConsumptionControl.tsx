import {useTranslation} from 'react-i18next';
import {NumberInput} from './NumberInput';
/** Legacy values stay exact until explicitly edited; new portions use the common 5% slider. */
export function MealConsumptionControl({value,onChange,description}:{value:number;onChange:(value:number)=>void;description?:string}){
 const {t}=useTranslation(),legacy=value<0||value>100||value%5!==0;
 return <label className="consumption-control recipe-consumption-control"><span className="recipe-consumption-heading"><span>{t('consumptionPercent')}</span><span className="recipe-consumption-value" aria-hidden="true">{value}%</span></span>
 {legacy?<NumberInput name="consumptionPercent" aria-label={t('consumptionPercent')} required min="0" step="any" value={value} onChange={e=>{if(e.target.value!=='')onChange(Number(e.target.value))}}/>:<input aria-label={t('consumptionPercent')} className="meal-consumption-slider" name="consumptionPercent" type="range" min="0" max="100" step="5" value={value} aria-valuetext={value+'%'} onChange={e=>onChange(Number(e.target.value))}/>}
 {!legacy&&<span className="recipe-consumption-scale" aria-hidden="true"><span>0%</span><span>50%</span><span>100%</span></span>}{description&&<small className="storage-footnote">{description}</small>}</label>;
}
