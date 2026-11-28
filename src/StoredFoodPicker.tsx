import {stockViews} from './stock-view';
import {useState} from 'react';
import {useLiveQuery} from 'dexie-react-hooks';
import {useTranslation} from 'react-i18next';
import {round,scaleNutrition,type RecipeLine,type FoodLog} from './domain';
import {storageNutritionEqual,type FoodBatch} from './food-storage-model';
import {storedRecipeLine,needsFirstAllocationReview} from './recipe-storage';
import {Modal} from './ui';
import {RecipeNutritionStrip} from './RecipeNutritionStrip';
import './food-storage-locale';
import './food-storage.css';

export function StoredFoodPicker({close,onSelect}:{close:()=>void;onSelect:(b:FoodBatch)=>void}){
 const {t}=useTranslation(),[query,setQuery]=useState('');
 const batches=useLiveQuery(async()=>(await stockViews()).filter(b=>!b.deletedAt&&!b.archived&&b.remainingQuantity>0))??[];
 return <Modal title={t('storageSelectBatch')} close={close} className="recipe-detail-modal food-storage-modal stored-food-picker">
  <div className="modal-scroll"><input type="search" aria-label={t('search')} placeholder={t('search')} value={query} onChange={e=>setQuery(e.target.value)}/>
   <div className="storage-list">{batches.filter(b=>b.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(b=><button type="button" className="storage-list-row" key={b.id} onClick={()=>onSelect(b)}><span className="storage-row-heading"><strong>{b.name}</strong><span>{round(b.remainingQuantity*(b.mode==='ratio'?100:1))}{b.mode==='ratio'?'%':b.mode==='servings'?' '+t('batchServingUnit'):' g'}</span></span><small>{t('storagePrepared')}: {b.preparedOn} · {t(b.mode==='weight'?'storagePer100':b.mode==='servings'?'batchPerServing':'storageOriginalPortion')}</small><RecipeNutritionStrip value={scaleNutrition(b.totalNutrition,b.mode==='weight'?100*b.fractionPerUnit:b.mode==='servings'?b.fractionPerUnit:1)}/></button>)}</div>
   {!batches.length&&<p className="muted">{t('storageEmpty')}</p>}
  </div>
 </Modal>;
}

/** Actual meal allocations are resolved explicitly; browsing never changes the template or stock. */
export function StoredRecipeSources({lines,setLines,percent,initial,prepared=false,onReselect}:{onReselect?:(lineId:string)=>void;lines:RecipeLine[];setLines:(v:RecipeLine[])=>void;percent:number;initial?:FoodLog;prepared?:boolean}){
 const {t}=useTranslation(),[picking,setPicking]=useState<number|null>(null);
 const batches=useLiveQuery(stockViews)??[];
 if(!lines.some(l=>l.source==='batch'&&l.quantity>0))return null;
 return <section className="stored-recipe-sources" aria-label={t('storageRecipeSources')}>
  <h3>{t('storageRecipeSources')}</h3>
  {lines.map((line,index)=>{if(line.source!=='batch'||line.quantity===0)return null;const b=batches.find(b=>b.id===line.sourceBatchId),factor=prepared?1:percent/100,needed=line.quantity*factor;
   const restored=initial?.recipeAllocations?.filter(a=>a.batchId===b?.id).reduce((n,a)=>n+a.originalFraction,0)??0;
   const available=b?(b.remainingQuantity*b.fractionPerUnit+restored)/(line.quantityBasis==='g'?b.fractionPerUnit:1):0;
   const changed=!!b&&!storageNutritionEqual(line.nutrition,scaleNutrition(b.totalNutrition,line.quantity*(line.quantityBasis==='g'?b.fractionPerUnit:1)));
   const review=needsFirstAllocationReview(initial,line,b,percent);
   const inherited=initial?.lines.some(l=>l.source==='batch'&&l.lineId===line.lineId&&l.sourceBatchId===line.sourceBatchId);
   const warnComposition=changed&&(!inherited||review);
   const unavailable=!b||!!b.deletedAt||b.archived&&!(b.archiveReason==='exhausted'&&restored>0);
   const totalNeeded=lines.filter(l=>l.source==='batch'&&l.sourceBatchId===line.sourceBatchId).reduce((n,l)=>n+l.quantity*(l.quantityBasis==='g'?b?.fractionPerUnit??0:1)*factor,0);
   const insufficient=!!b&&totalNeeded>b.remainingQuantity*b.fractionPerUnit+restored+Number.EPSILON*32;
   return <div className="stored-recipe-source" data-first-allocation-review={review||undefined} key={line.lineId??index}><div><strong>{line.name}</strong><small>{t('storageRecipeRequired')}: {round(needed*(line.unit==='fraction'?100:1))}{line.unit==='fraction'?'% '+t('storageReference'):' g'}{!initial?.leftoverBatchId&&<> · {t('storageAvailableLabel')}: {round(available*(line.unit==='fraction'?100:1))}{line.unit==='fraction'?'%':' g'}</>}</small>{!initial?.leftoverBatchId&&(unavailable||insufficient||warnComposition)&&<small role="status">{t(review?'storageFirstAllocationReview':unavailable?'storageSourceMissing':warnComposition?'storageCompositionChanged':'storageOverdraw')}</small>}</div>{!initial?.leftoverBatchId&&<button type="button" className="secondary" onClick={()=>setPicking(index)}>{t('replaceIngredient')}</button>}</div>;
  })}
  {picking!==null&&<StoredFoodPicker close={()=>setPicking(null)} onSelect={b=>{const lineId=lines[picking].lineId;if(lineId)onReselect?.(lineId);setLines(lines.map((l,i)=>i===picking?storedRecipeLine(b,l):l));setPicking(null)}}/>}
 </section>;
}
