import {familyTagPrefix,readFamilyTags} from './family-tags';
import {IngredientPicker} from './IngredientPicker';
import {JournalHeading} from './JournalHeading';
import {confirmDelete} from './DeleteConfirmation';
import {PantryRowContent} from './PantryRowContent';
import {useMemo,useState,useEffect,useId,useRef,type ReactNode} from 'react';
import {useTranslation} from 'react-i18next';
import {useLiveQuery} from 'dexie-react-hooks';
import {Plus,ChevronRight,ChevronDown,MoreHorizontal,CircleMinus} from 'lucide-react';
import {db,stamp,type IngredientFamily} from './db';
import type {PantryItem} from './domain';
import type {FoodChoice} from './reference-library';
import {ingredientPreferencePrefix,ingredientPreferenceRows} from './ingredient-preferences';
import {familyCatalog,familyMembers,saveFamily,deleteFamily,memberName,type FamilyCatalog} from './families';
import {Modal} from './ui';
import {JournalTextField} from './JournalTextField';
import {IngredientTagAssignment} from './IngredientTags';
import './family-locale';
import './families.css';

export function useFamilies(items:PantryItem[],enabled=true){
 const rows=useLiveQuery(async()=>enabled?db.transaction('r',db.ingredientFamilies,db.settings,async()=>({
  familyTags:Object.fromEntries((await db.settings.where("key").startsWith(familyTagPrefix).toArray()).map(row=>[row.key.slice(familyTagPrefix.length),readFamilyTags(row.value)])) as Record<string,string[]>,
  families:await db.ingredientFamilies.toArray(),preferences:ingredientPreferenceRows(await db.settings.where('key').startsWith(ingredientPreferencePrefix).toArray())
 })):undefined,[enabled]);
 return useMemo(()=>({...familyCatalog(rows?.families??[],items,rows?.preferences??{}),familyTags:rows?.familyTags??{},ready:!!rows}),[rows,items]);
}

export function FamilyEditor({family,catalog,items,close,initialTags=[]}:{initialTags?:string[];family?:IngredientFamily;catalog:FamilyCatalog;items:PantryItem[];close:()=>void}){
 const {t,i18n}=useTranslation();
 const [tagIds,setTagIds]=useState(initialTags);
 const [draft,setDraft]=useState<IngredientFamily>(()=>family??{...stamp(),name:'',alternateName:'',memberIds:[],inUseIds:[]});
 const [adding,setAdding]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const saving=useRef(false);
 const pickerEntry=useId();
 const returning=useRef(false);
 useEffect(()=>{
  const onBack=()=>{returning.current=false;setAdding(history.state?.familyMemberPicker===pickerEntry)};
  window.addEventListener('popstate',onBack);
  return ()=>window.removeEventListener('popstate',onBack);
 },[pickerEntry]);
 const openPicker=()=>{
  if(adding||returning.current)return;
  history.pushState({...history.state,familyMemberPicker:pickerEntry},'');
  setAdding(true);
 };
 const closePicker=()=>{
  if(returning.current)return;
  if(history.state?.familyMemberPicker===pickerEntry){returning.current=true;history.back()}
  else setAdding(false);
 };
 const addMembers=(ids:string[])=>{
  if(returning.current)return;
  setDraft(current=>({...current,memberIds:[...new Set([...current.memberIds,...ids])]}));
  closePicker();
 };
 async function submit(){
  if(saving.current)return;
  saving.current=true;setBusy(true);setError('');
  try{await saveFamily(draft,tagIds);close()}
  catch(e){setError(t(e instanceof Error?e.message:'failedMessage'))}
  finally{saving.current=false;setBusy(false)}
 }
 return <>
  <Modal title={t('familyTitle')} close={busy?()=>{}:close} className="family-editor ingredient-journal recipe-editor-modal journal-recipe-editor">
   <form className="recipe-editor-form" onSubmit={event=>{event.preventDefault();void submit()}}>
    <div className="recipe-editor-scroll family-editor-scroll">
     <section className="draft-basics">
      <h3><JournalHeading>{t('basicInformation')}</JournalHeading></h3>
      <JournalTextField name="familyName" label={t('name')} placeholder={t('familyName')} required value={draft.name} onChange={name=>setDraft({...draft,name})}/>
      <JournalTextField name="familyAlias" label={t('familyAlias')} placeholder={'＋ '+t('familyAddAlias')} value={draft.alternateName} onChange={alternateName=>setDraft({...draft,alternateName})}/>
      <IngredientTagAssignment value={tagIds} onChange={setTagIds} multiLabel/>
     </section>
     <section className="family-editor-members">
      <h3><JournalHeading>{t('familyMembers')}</JournalHeading></h3>
      <button type="button" className="text-link family-add-member" onClick={openPicker}><Plus size={14}/>{t('familyAddMember')}</button>
      {draft.memberIds.map(id=>{
       const choice=catalog.choices.get(id),name=choice?memberName(choice,i18n.language):id;
       return <div className="family-member-editor" key={id}>
        <span>{name}</span>
        <FamilyDot name={name} active={draft.inUseIds.includes(id)} toggle={()=>setDraft({...draft,inUseIds:toggleId(draft.inUseIds,id)})}/>
        <button type="button" aria-label={t('familyRemoveMember')+' · '+name} onClick={()=>setDraft({...draft,memberIds:draft.memberIds.filter(m=>m!==id),inUseIds:draft.inUseIds.filter(m=>m!==id)})}><CircleMinus size={15} aria-hidden="true"/></button>
       </div>;
      })}
     </section>
     {family&&<div className="family-delete-section">
      <button type="button" className="text-link family-delete" disabled={busy} onClick={()=>void confirmDelete('family',family.name,async()=>{await deleteFamily(family);close()})}>{t('familyDelete')}</button>
     </div>}
     {error&&<p role="alert">{error}</p>}
    </div>
    <div className="form-actions recipe-editor-footer">
     <button type="button" disabled={busy} onClick={close}>{t('cancel')}</button>
     <button className="primary" disabled={busy||!draft.name.trim()}>{t('save')}</button>
    </div>
   </form>
  </Modal>
 {adding&&<IngredientPicker items={items} memberSelection={{excluded:new Set(draft.memberIds),add:addMembers}}
   close={closePicker}/>}
 </>;
}
function toggleId(ids:string[],id:string){return ids.includes(id)?ids.filter(x=>x!==id):[...ids,id]}

function FamilyDot({name,active,toggle}:{name:string;active:boolean;toggle:()=>void}){
 const {t}=useTranslation();
 return <button className="family-dot" type="button" aria-label={t('familyInUse')+' · '+name} aria-pressed={active} onClick={event=>{event.stopPropagation();toggle()}}><span aria-hidden="true"/></button>;
}

export function PantryFamilyRow({family,catalog,visible,autoExpand,edit,render}:{family:IngredientFamily;catalog:FamilyCatalog;visible:FoodChoice[];autoExpand:boolean;edit:()=>void;render:(choice:FoodChoice,action:ReactNode)=>ReactNode}){
 const {t,i18n}=useTranslation();
 const canExpand=visible.length>0;
 const [expanded,setExpanded]=useState(autoExpand),[error,setError]=useState(''),[menuOpen,setMenuOpen]=useState(false);
 const menu=useRef<HTMLSpanElement>(null),menuTrigger=useRef<HTMLButtonElement>(null),menuItem=useRef<HTMLButtonElement>(null);
 const menuId=useId();
 useEffect(()=>setExpanded(autoExpand&&canExpand),[autoExpand,canExpand]);
 useEffect(()=>{
  if(!menuOpen)return;
  menuItem.current?.focus({preventScroll:true});
  const outside=(event:PointerEvent)=>{if(!menu.current?.contains(event.target as Node))setMenuOpen(false)};
  document.addEventListener('pointerdown',outside);
  return ()=>document.removeEventListener('pointerdown',outside);
 },[menuOpen]);
 const members=familyMembers(family,catalog);
 const names=members.filter(choice=>family.inUseIds.includes(choice.item.id)).map(choice=>memberName(choice,i18n.language));
 const title=<>{family.name}{family.alternateName&&<small className="ingredient-secondary"> · {family.alternateName}</small>}</>;
 return <article className="pantry-family" data-family-id={family.id}>
  <div className="pantry-row family-parent" onClick={canExpand?()=>setExpanded(value=>!value):undefined}>
   <PantryRowContent
    title={canExpand?<button type="button" className="ingredient-name family-heading" aria-expanded={expanded}>{title}</button>:<span className="ingredient-name family-heading">{title}</span>}
    energy={<>
     <span>{t('familyCount',{count:members.length})}</span>
     <span ref={menu} className="family-actions" onClick={event=>event.stopPropagation()} onBlur={event=>{
      if(event.relatedTarget&&!event.currentTarget.contains(event.relatedTarget))setMenuOpen(false);
     }} onKeyDown={event=>{
      if(event.key==='Escape'&&menuOpen){event.stopPropagation();setMenuOpen(false);menuTrigger.current?.focus()}
     }}>
      <button type="button" ref={menuTrigger} className="family-action-trigger" aria-label={t('familyActions',{name:family.name})} aria-expanded={menuOpen} aria-haspopup="menu" aria-controls={menuOpen?menuId:undefined} onClick={()=>setMenuOpen(value=>!value)}><MoreHorizontal size={16} aria-hidden="true"/></button>
      {menuOpen&&<span className="family-action-menu" role="menu" id={menuId}>
       <button type="button" role="menuitem" ref={menuItem} onClick={()=>{menuTrigger.current?.focus();setMenuOpen(false);edit()}}>{t('familyEdit')}</button>
      </span>}
     </span>
     {canExpand&&(expanded?<ChevronDown size={14} aria-hidden="true"/>:<ChevronRight size={14} aria-hidden="true"/>)}
    </>}
    metadata={names.length>0&&<span className="family-summary">{names.join(" · ")}</span>}
   />
  </div>
  {expanded&&<div className="family-children">{visible.map(choice=>{
   const active=family.inUseIds.includes(choice.item.id);
   return <div className="family-child" key={choice.item.id} data-in-use={active}>
    {render(choice,<FamilyDot name={memberName(choice,i18n.language)} active={active} toggle={()=>{
     setError('');
     void saveFamily({...family,inUseIds:toggleId(family.inUseIds,choice.item.id)}).catch(e=>setError(t(e.message)));
    }}/>)}
   </div>;
  })}</div>}
  {error&&<p role="alert">{error}</p>}
 </article>;
}
