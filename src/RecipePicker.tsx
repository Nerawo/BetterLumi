import {useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {useLiveQuery} from 'dexie-react-hooks';
import {useTranslation} from 'react-i18next';
import {Check,ChevronDown} from 'lucide-react';
import {categories,filterRecipes} from './categories';
import {orderedItems} from './collection-order';
import {CollectionNavigation} from './CollectionNavigation';
import {Modal} from './ui';
import type {Recipe} from './domain';
import './recipe-picker.css';

export function RecipeSelection({recipes,value,onChange,label,emptyLabel,disabled=false}:{recipes:Recipe[];value:string;onChange:(id:string)=>void;label:string;emptyLabel?:string;disabled?:boolean}){
 const {t}=useTranslation(),[open,setOpen]=useState(false),trigger=useRef<HTMLButtonElement>(null);
 const close=()=>{setOpen(false);requestAnimationFrame(()=>trigger.current?.focus({preventScroll:true}))};
 return <div className="recipe-selection"><span className="recipe-selection-label">{label}</span><button ref={trigger} type="button" className="meal-selection-control recipe-selection-trigger" aria-label={label} aria-haspopup="dialog" aria-expanded={open} disabled={disabled} onClick={()=>setOpen(true)}><span>{recipes.find(r=>r.id===value)?.name??emptyLabel??t('selectRecipe')}</span><ChevronDown size={16} aria-hidden="true"/></button>{open&&createPortal(<RecipePicker recipes={recipes} selected={value} clearLabel={emptyLabel} close={close} select={id=>{onChange(id);close()}}/>,document.body)}</div>;
}
function RecipePicker({recipes,selected,clearLabel,close,select}:{recipes:Recipe[];selected:string;clearLabel?:string;close:()=>void;select:(id:string)=>void}){
 const {t,i18n}=useTranslation(),[search,setSearch]=useState(''),[category,setCategory]=useState('');
 const definitions=useLiveQuery(async()=>orderedItems(await categories.filter(c=>!c.deletedAt).toArray()))??[];
 const active=definitions.some(c=>c.id===category)?category:'';
 const results=filterRecipes([...new Map(recipes.filter(r=>!r.deletedAt).map(r=>[r.id,r])).values()],search,active,definitions);
 return <Modal title={i18n.language.startsWith('zh')?'选择食谱':'Select Recipe'} close={close} className="recipe-detail-modal recipe-picker-modal">
  <div className="modal-scroll recipe-picker-scroll"><label className="recipe-picker-search"><span className="sr-only">{t('searchRecipes')}</span><input type="search" placeholder={t('searchRecipes')} value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')e.preventDefault()}}/></label>
   <CollectionNavigation items={definitions} active={active} onChange={setCategory} label={t('recipeCategory')} allLabel={t('allCategories')}/>
   <div className="recipe-picker-results" role="group" aria-label={t('selectRecipe')}>
    {clearLabel&&!search&&!active&&<button type="button" className="recipe-picker-result" aria-pressed={!selected} onClick={()=>select('')}>{clearLabel}{!selected&&<Check size={16} aria-hidden="true"/>}</button>}
    {results.map(r=><button type="button" className="recipe-picker-result" key={r.id} data-recipe-id={r.id} aria-pressed={selected===r.id} onClick={()=>select(r.id)}><span>{r.name}</span>{selected===r.id&&<Check size={16} aria-hidden="true"/>}</button>)}
    {!results.length&&<p role="status" className="collection-empty">{i18n.language.startsWith('zh')?'没有匹配的食谱，请调整搜索或分类。':'No matching recipes. Try another search or category.'}</p>}
   </div>
  </div>
 </Modal>;
}

