import {useState} from 'react';
import {useLiveQuery} from 'dexie-react-hooks';
import {useTranslation} from 'react-i18next';
import {db,round,scaleNutrition,type RecipeLine,type FoodLog} from './domain';
import {storageNutritionEqual,type FoodBatch} from './food-storage-model';
import {storedRecipeLine} from './recipe-storage';
import {Modal} from './ui';
import {RecipeNutritionStrip} from './RecipeNutritionStrip';
import './food-storage-locale';
import './food-storage.css';

export function StoredFoodPicker({close,onSelect}:{close:()=>void;onSelect:(b:FoodBatch)=>void}){
 const {t}=useTranslation(),[query,setQuery]=useState('');
 const batches=useLiveQuery(()=>db.foodBatches.filter(b=>!b.deletedAt&&!b.archived&&b.remainingQuantity>0).toArray())??[];
 return <Modal title={t('storageSelectBatch')} close={close} className="recipe-detail-modal food-storage-modal stored-food-picker">
  <div className="modal-scroll"><input type="search" aria-label={t('search')} placeholder={t('search')} value={query} onChange={e=>setQuery(e.target.value)}/>
   <div className="storage-list">{batches.filter(b=>b.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(b=><button type="button" className="storage-list-row" key={b.id} onClick={()=>onSelect(b)}><span className="storage-row-heading"><strong>{b.name}</strong><span>{round(b.remainingQuantity*(b.mode==='ratio'?100:1))}{b.mode==='ratio'?'%':' g'}</span></span><small>{t('storagePrepared')}: {b.preparedOn} · {t(b.mode==='weight'?'storagePer100':'storageOriginalPortion')}</small><RecipeNutritionStrip value={scaleNutrition(b.totalNutrition,b.mode==='weight'?100*b.fractionPerUnit:1)}/></button>)}</div>
   {!batches.length&&<p className="muted">{t('storageEmpty')}</p>}
  </div>
 </Modal>;
}

/** Actual meal allocations are resolved explicitly; browsing never changes the template or stock. */
export function StoredRecipeSources({lines,setLines,percent,initial,prepared=false}:{lines:RecipeLine[];setLines:(v:RecipeLine[])=>void;percent:number;initial?:FoodLog;prepared?:boolean}){
 const {t}=useTranslation(),[picking,setPicking]=useState<number|null>(null);
 const batches=useLiveQuery(()=>db.foodBatches.toArray())??[];
 return <section className="stored-recipe-sources" aria-label={t('storageRecipeSources')}>
  <h3>{t('storageRecipeSources')}</h3>
  {lines.map((line,index)=>{if(line.source!=='batch')return null;const b=batches.find(b=>b.id===line.sourceBatchId),factor=prepared?1:percent/100,needed=line.quantity*factor;
   const restored=initial?.recipeAllocations?.filter(a=>a.batchId===b?.id).reduce((n,a)=>n+a.originalFraction,0)??0;
   const available=b?(b.remainingQuantity*b.fractionPerUnit+restored)/(line.quantityBasis==='g'?b.fractionPerUnit:1):0;
   const changed=!!b&&!storageNutritionEqual(line.nutrition,scaleNutrition(b.totalNutrition,line.quantity*(line.quantityBasis==='g'?b.fractionPerUnit:1)));
   const unavailable=!b||!!b.deletedAt||b.archived&&!(b.archiveReason==='exhausted'&&restored>0);
   const totalNeeded=lines.filter(l=>l.source==='batch'&&l.sourceBatchId===line.sourceBatchId).reduce((n,l)=>n+l.quantity*(l.quantityBasis==='g'?b?.fractionPerUnit??0:1)*factor,0);
   const insufficient=!!b&&totalNeeded>b.remainingQuantity*b.fractionPerUnit+restored+Number.EPSILON*32;
   return <div className="stored-recipe-source" key={line.lineId??index}><div><strong>{line.name}</strong><small>{t('storageRecipeRequired')}: {round(needed*(line.unit==='fraction'?100:1))}{line.unit==='fraction'?'% '+t('storageReference'):' g'}{!initial?.leftoverBatchId&&<> · {t('storageAvailableLabel')}: {round(available*(line.unit==='fraction'?100:1))}{line.unit==='fraction'?'%':' g'}</>}</small>{!initial?.leftoverBatchId&&(unavailable||insufficient||changed)&&<small role="status">{t(unavailable?'storageSourceMissing':changed?'storageCompositionChanged':'storageOverdraw')}</small>}</div>{!initial?.leftoverBatchId&&<button type="button" className="secondary" onClick={()=>setPicking(index)}>{t('replaceIngredient')}</button>}</div>;
  })}
  {picking!==null&&<StoredFoodPicker close={()=>setPicking(null)} onSelect={b=>{setLines(lines.map((l,i)=>i===picking?storedRecipeLine(b,l):l));setPicking(null)}}/>}
 </section>;
}
