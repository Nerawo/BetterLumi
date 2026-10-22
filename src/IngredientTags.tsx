import './ingredient-tags-locale';
import {createPortal} from 'react-dom';
import {useRef,useState} from 'react';
import {useLiveQuery} from 'dexie-react-hooks';
import {useTranslation} from 'react-i18next';
import {MoreHorizontal,Check} from 'lucide-react';
import {ingredientTags,saveIngredientTag,deleteIngredientTag,type IngredientTag} from './ingredient-tags';
import {db} from './domain';
import {orderedItems,moveOrderedItem} from './collection-order';
import {CollectionNavigation} from './CollectionNavigation';
import {NamedCollectionManager} from './NamedCollectionManager';
const empty:IngredientTag[]=[];
export function useIngredientTags(){return useLiveQuery(async()=>orderedItems(await ingredientTags.filter(tag=>!tag.deletedAt).toArray()))??empty;}
export function IngredientTagNavigation({items,active,onChange,manage}:{items:IngredientTag[];active:string;onChange:(id:string)=>void;manage?:()=>void}){
 const {t}=useTranslation();return <div className="ingredient-tag-bar"><CollectionNavigation items={items} active={active} onChange={onChange} label={t('ingredientTagFilter')} allLabel={t('ingredientTagAll')} manageLabel={t('manageIngredientTags')} manage={manage}/></div>;
}
export function IngredientTagAssignment({value,onChange}:{value:string[];onChange:(ids:string[])=>void}){
 const {t}=useTranslation(),items=useIngredientTags(),[managing,setManaging]=useState(false),trigger=useRef<HTMLButtonElement>(null);
 const close=()=>{setManaging(false);requestAnimationFrame(()=>trigger.current?.focus())};
 return <section className="ingredient-form-section ingredient-tag-assignment"><h3>{t('ingredientTagsMultiple')}</h3><div className="ingredient-tag-choices" role="group" aria-label={t('ingredientTagsMultiple')}>
 {items.map(tag=><button type="button" key={tag.id} aria-pressed={value.includes(tag.id)} onClick={()=>onChange(value.includes(tag.id)?value.filter(id=>id!==tag.id):[...value,tag.id])}>{value.includes(tag.id)&&<Check size={13}/>}<span>{tag.name}</span></button>)}<button type="button" ref={trigger} aria-label={t('manageIngredientTags')} aria-expanded={managing} onClick={()=>setManaging(true)}><MoreHorizontal size={16}/></button></div>
 {managing&&createPortal(<IngredientTagManager close={close} onDeleted={id=>onChange(value.filter(x=>x!==id))} onCreated={id=>onChange([...new Set([...value,id])])}/>,document.body)}</section>;
}
export function IngredientTagManager({close,onDeleted,onCreated}:{close:()=>void;onDeleted:(id:string)=>void;onCreated?:(id:string)=>void}){
 const items=useIngredientTags(),counts=useLiveQuery(async()=>{const result:Record<string,number>={};for(const item of await db.ingredients.filter(i=>!i.deletedAt).toArray())for(const id of new Set(item.tagIds??[]))result[id]=(result[id]??0)+1;return result})??{};
 return <NamedCollectionManager items={items} close={close} onDeleted={onDeleted} onCreated={onCreated} save={saveIngredientTag} remove={deleteIngredientTag} reorder={(id,target)=>moveOrderedItem(ingredientTags,id,target)} kind="ingredientTag" counts={Object.fromEntries(items.map(t=>[t.id,counts[t.id]??0]))} labels={{manageCategories:'manageIngredientTags',categoryName:'ingredientTagName',categoryNameRequired:'ingredientTagNameRequired',categoryNameDuplicate:'ingredientTagNameDuplicate',categoryCreateLabel:'createIngredientTag',categoryExistingLabel:'ingredientTagExisting',categoryRenameLabel:'ingredientTagRename'}}/>;
}
