import {useTranslation} from 'react-i18next';
import {newId} from './ids';
import {removeIngredientGroup,type IngredientGroup} from './cooking-journal';
import type {RecipeLine} from './domain';
import type {ReactNode} from 'react';
import {JournalHeading} from './JournalHeading';
import './cooking-journal-locale';
import './cooking-journal.css';
export function RecipeGroupsEditor({groups,lines,onChange,renderGroup}:{groups:IngredientGroup[];lines:RecipeLine[];onChange:(groups:IngredientGroup[],lines:RecipeLine[])=>void;renderGroup:(id:string|undefined)=>ReactNode}){
 const {t}=useTranslation();
 const move=(index:number,delta:number)=>{const next=[...groups];[next[index],next[index+delta]]=[next[index+delta],next[index]];onChange(next,lines)};
 return <div className="journal-group-editor">
  {(!groups.length||lines.some(l=>!l.groupId))&&<section className="journal-editor-group" data-group-id="">{groups.length>0&&<h4><JournalHeading>{t('journalUngrouped')}</JournalHeading></h4>}{renderGroup(undefined)}</section>}
  {groups.map((g,i)=><section className="journal-editor-group" data-group-id={g.id} key={g.id}>
   <div className="journal-group-edit">
    <label className="journal-editable-heading"><span className="sr-only">{t('journalGroupName')+' '+(i+1)}</span><input style={{width:Math.max(5,Array.from(g.name).reduce((n,c)=>n+(c.charCodeAt(0)>255?2:1),0)+1)+'ch',maxWidth:'100%'}} aria-label={t('journalGroupName')+' '+(i+1)} required value={g.name} onChange={e=>onChange(groups.map(x=>x.id===g.id?{...x,name:e.target.value}:x),lines)}/></label>
    <details className="journal-context-menu"><summary aria-label={t('journalGroupActions')+' '+g.name}>···</summary><div>
     <button type="button" aria-label={t('journalUp')+' '+g.name} disabled={!i} onClick={()=>move(i,-1)}>↑ {t('journalUp')}</button>
     <button type="button" aria-label={t('journalDown')+' '+g.name} disabled={i===groups.length-1} onClick={()=>move(i,1)}>↓ {t('journalDown')}</button>
     <button type="button" aria-label={t('delete')+' '+g.name} onClick={()=>{const next=removeIngredientGroup({ingredientGroups:groups,lines},g.id);onChange(next.ingredientGroups,next.lines)}}>{t('delete')}</button>
    </div></details>
   </div>{renderGroup(g.id)}
  </section>)}
  <button type="button" className="secondary journal-add-group" onClick={()=>onChange([...groups,{id:newId(),name:t('journalGroup')+' '+(groups.length+1)}],lines)}>{t('journalAddGroup')}</button>
 </div>;
}
