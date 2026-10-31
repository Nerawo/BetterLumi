import {useId,type CSSProperties} from 'react';
import {useTranslation} from 'react-i18next';
import type {FoodBatch} from './food-storage-model';
import {NumberInput} from './NumberInput';
import {consumptionView,sliderAmount} from './storage-consumption-ui';

export function StorageConsumptionControl({batch,available,amount,onChange}:{batch:FoodBatch;available:number;amount:string;onChange:(value:string)=>void}){
 const {t,i18n}=useTranslation(),id=useId(),view=consumptionView(batch,available,amount);
 const format=(n:number)=>Number.isFinite(n)?new Intl.NumberFormat(i18n.language,{maximumFractionDigits:1}).format(n):'—';
 const quantity=(n:number)=>format(batch.mode==='weight'?n:n*100)+(batch.mode==='weight'?' g':'%');
 const selected=view.valid?view.selected:NaN,after=view.valid?available-selected:NaN;
 const reference=batch.mode==='ratio'?'storageOriginalPortion':batch.originalCookedYield===null?'storageEquivalentOriginal':'storageOriginal';
 const style={'--storage-selected':view.selectedWidth+'%','--storage-available':view.availableWidth+'%'} as CSSProperties;
 return <section className="storage-consumption-control" aria-label={t('storageRecord')}>
  <dl className="storage-consumption-context"><div><dt>{t(reference)}</dt><dd>{quantity(view.original)}</dd></div><div><dt>{t('storageAvailableLabel')}</dt><dd>{quantity(available)}</dd></div></dl>
  <label className="storage-actual-amount">{t(batch.mode==='weight'?'storageGrams':'storagePercent')}<NumberInput name={batch.mode==='weight'?'storageGrams':'storageStockPercent'} required min="0.000001" max={batch.mode==='weight'?available:100} step="any" value={amount} onChange={e=>onChange(e.target.value)}/></label>
  <div className="storage-consumption-caption"><span>{t('storageSelected')}: {quantity(selected)}</span><strong>{format(view.percent)}% <small>{t(batch.originalCookedYield===null&&batch.mode==='weight'?'storageOfEquivalent':'storageOfOriginal')}</small></strong></div>
  <div className="storage-inventory-range" style={style}>
   <div className="storage-inventory-track" aria-hidden="true"><span className="storage-segment-selected"/><span className="storage-segment-available"/><span className="storage-segment-unavailable"/>{view.overflow>0&&<i className="storage-original-mark" style={{left:view.original/view.axis*100+'%'}}/>}</div>
   {/* Safari may leave the gram field focused; finish its native editing buffer before slider synchronization. */}
   <input type="range" name="storageInventory" min="0" max={view.axis} step="any" value={view.valid?selected:0} aria-label={t('storageSelected')} aria-valuemax={available} aria-valuetext={quantity(selected)+' · '+format(view.percent)+'%'} aria-describedby={id} onPointerDown={e=>{const active=document.activeElement;if(active instanceof HTMLInputElement&&active.type==='number'&&e.currentTarget.closest('.storage-consumption-control')?.contains(active))active.blur()}} onChange={e=>onChange(sliderAmount(batch,available,Number(e.target.value)))}/>
  </div>
  <div className="storage-inventory-scale" aria-hidden="true"><span>0%</span><span>{format(view.axis/view.original*100)}%</span></div>
  <div className="storage-inventory-legend" id={id}><span className="selected">{t('storageSelected')}: {quantity(selected)}</span><span className="available">{t('storageAfterSelection')}: {quantity(after)}</span><span className="unavailable">{t('storageUnavailable')}: {quantity(Math.max(0,view.original-available))}</span></div>
  {view.overflow>0&&<p className="storage-footnote storage-inventory-overflow">{t('storageOverflow',{amount:quantity(view.overflow),percent:format(view.axis/view.original*100)})}</p>}
  {batch.mode==='ratio'&&<p className="storage-footnote">{t('storagePercentBasis')}</p>}
  {batch.mode==='weight'&&batch.originalCookedYield===null&&<p className="storage-footnote">{t('storageEquivalentHelp')}</p>}
 </section>;
}
