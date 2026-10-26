import './reference-locale';
import {ingredientTagOptions,type IngredientTagOption} from './data/builtInTags';
import {builtInFoods} from './data/builtInFoods';
import {applyIngredientTagOrder,ingredientTagOrderKey,moveIngredientTag,parseIngredientTagOrder} from './ingredient-tag-order';
import './ingredient-tags-locale';
import {createPortal} from 'react-dom';
import {useRef,useState} from 'react';
import {useLiveQuery} from 'dexie-react-hooks';
import {useTranslation} from 'react-i18next';
import {MoreHorizontal,Check} from 'lucide-react';
import {ingredientTags,saveIngredientTag,deleteIngredientTag,type IngredientTag} from './ingredient-tags';
import {db} from './domain';
import {orderedItems} from './collection-order';
import {CollectionNavigation} from './CollectionNavigation';
import {NamedCollectionManager} from './NamedCollectionManager';
const empty:IngredientTag[]=[];
function useCustomIngredientTags(){return useLiveQuery(async()=>orderedItems(await ingredientTags.filter(tag=>!tag.deletedAt).toArray()))??empty;}
function useIngredientTagOrder(){return parseIngredientTagOrder(useLiveQuery(()=>db.settings.get(ingredientTagOrderKey))?.value)}
export function useIngredientTags(){const {i18n}=useTranslation();return applyIngredientTagOrder(ingredientTagOptions(useCustomIngredientTags(),i18n.language),useIngredientTagOrder());}
export function IngredientTagNavigation({items,active,onChange,manage}:{items:IngredientTagOption[];active:string;onChange:(id:string)=>void;manage?:()=>void}){
 const {t}=useTranslation();return <div className="ingredient-tag-bar"><CollectionNavigation items={items.map(item=>({...item,label:item.builtIn?item.name+' · '+t('referenceBuiltIn'):undefined}))} active={active} onChange={onChange} label={t('ingredientTagFilter')} allLabel={t('ingredientTagAll')} manageLabel={t('manageIngredientTags')} manage={manage}/></div>;
}
export function IngredientTagAssignment({value,onChange}:{value:string[];onChange:(ids:string[])=>void}){
 const {t}=useTranslation(),items=useIngredientTags(),[managing,setManaging]=useState(false),trigger=useRef<HTMLButtonElement>(null);
 const close=()=>{setManaging(false);requestAnimationFrame(()=>trigger.current?.focus())};
 return <section className="ingredient-form-section ingredient-tag-assignment"><h3>{t('ingredientTagsMultiple')}</h3><div className="ingredient-tag-choices" role="group" aria-label={t('ingredientTagsMultiple')}>
 {items.map(tag=><button type="button" key={tag.id} aria-label={tag.builtIn?tag.name+' · '+t('referenceBuiltIn'):undefined} aria-pressed={value.includes(tag.id)} onClick={()=>onChange(value.includes(tag.id)?value.filter(id=>id!==tag.id):[...value,tag.id])}>{value.includes(tag.id)&&<Check size={13}/>}<span>{tag.name}</span></button>)}<button type="button" ref={trigger} aria-label={t('manageIngredientTags')} aria-expanded={managing} onClick={()=>setManaging(true)}><MoreHorizontal size={16}/></button></div>
 {managing&&createPortal(<IngredientTagManager close={close} onDeleted={id=>onChange(value.filter(x=>x!==id))} onCreated={id=>onChange([...new Set([...value,id])])}/>,document.body)}</section>;
}
export function IngredientTagManager({close,onDeleted,onCreated}:{close:()=>void;onDeleted:(id:string)=>void;onCreated?:(id:string)=>void}){
 const {t,i18n}=useTranslation(),custom=useCustomIngredientTags(),preferred=useIngredientTagOrder();
 type ManagedTag=(IngredientTag&{builtIn?:false})|(IngredientTagOption&{builtIn:true});
 const items:ManagedTag[]=applyIngredientTagOrder([...ingredientTagOptions([],i18n.language).map(tag=>({...tag,builtIn:true as const})),...custom],preferred);
 const counts=useLiveQuery(async()=>{const result:Record<string,number>={};for(const item of [...builtInFoods,...await db.ingredients.filter(i=>!i.deletedAt).toArray()])for(const id of new Set(item.tagIds??[]))result[id]=(result[id]??0)+1;return result})??{};
 return <NamedCollectionManager items={items} close={close} onDeleted={onDeleted} onCreated={onCreated} save={(name,item)=>{if(item?.builtIn)throw Error('Tag unavailable');return saveIngredientTag(name,item)}} remove={async item=>{if(item.builtIn)throw Error('Tag unavailable');await deleteIngredientTag(item)}} reorder={moveIngredientTag} originLabel={item=>t(item.builtIn?'referenceBuiltIn':'ingredientTagMine')} kind="ingredientTag" counts={Object.fromEntries(items.map(t=>[t.id,counts[t.id]??0]))} labels={{manageCategories:'manageIngredientTags',categoryName:'ingredientTagName',categoryNameRequired:'ingredientTagNameRequired',categoryNameDuplicate:'ingredientTagNameDuplicate',categoryCreateLabel:'createIngredientTag',categoryExistingLabel:'ingredientTagExisting',categoryRenameLabel:'ingredientTagRename'}}/>;
}
