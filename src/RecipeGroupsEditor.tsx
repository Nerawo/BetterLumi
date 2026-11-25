import {useState,type ReactNode} from 'react';
import {useTranslation} from 'react-i18next';
import {newId} from './ids';
import {removeIngredientGroup,type IngredientGroup} from './cooking-journal';
import type {RecipeLine} from './domain';
import {JournalHeading} from './JournalHeading';
import {DraftConfirmation,DraftMenu} from './RecipeDraftJournal';
import './cooking-journal-locale';
import './cooking-journal.css';

interface GroupEditorProps {
  groups:IngredientGroup[];
  lines:RecipeLine[];
  onChange:(groups:IngredientGroup[],lines:RecipeLine[])=>void;
  renderGroup:(id:string|undefined,grouping:boolean)=>ReactNode;
}

export function RecipeGroupsEditor({groups,lines,onChange,renderGroup}:GroupEditorProps){
  const {t}=useTranslation();
  const [renaming,setRenaming]=useState<string>();
  const [grouping,setGrouping]=useState(groups.length>0);
  const [confirming,setConfirming]=useState(false);
  function disableGrouping(){
    // Keep the displayed order, including any legacy line without a matching group.
    const rank=new Map(groups.map((group,index)=>[group.id,index+1]));
    const order=(line:RecipeLine)=>rank.get(line.groupId??'')??0;
    const ordered=[...lines].sort((a,b)=>order(a)-order(b));
    onChange([],ordered.map(({groupId,...line})=>line));
    setGrouping(false);setConfirming(false);setRenaming(undefined);
  }
  function move(index:number,delta:number){
    setRenaming(undefined);
    const next=[...groups];
    [next[index],next[index+delta]]=[next[index+delta],next[index]];
    onChange(next,lines);
  }
  function addGroup(){
    const id=newId();
    onChange([...groups,{id,name:t('journalGroup')+' '+(groups.length+1)}],lines);
    setRenaming(id);
  }
  return <div className="journal-group-editor">
    <div className="draft-heading-row"><h3><JournalHeading>{t('lines')}</JournalHeading></h3>
      <button type="button"  className="draft-group-switch" aria-pressed={grouping} onClick={()=>{
        if(!grouping)setGrouping(true);
        else setConfirming(true);
      }}>{grouping&&<span aria-hidden="true">✓ </span>}{t('draftGrouping')}</button></div>
    {grouping&&<button className="journal-add-group" type="button" onClick={addGroup}>＋ {t('journalAddGroup')}</button>}
    <section className="journal-editor-group" data-group-id="">
      {grouping&&<h4 className="draft-ungrouped">{t('journalUngrouped')}</h4>}{renderGroup(undefined,grouping)}
    </section>
    {groups.map((group,index)=><section className="journal-editor-group" key={group.id} data-group-id={group.id}>
      <div className="journal-group-edit">
        {renaming===group.id?<input autoFocus required aria-label={t('journalGroupName')} value={group.name}
          onFocus={e=>e.target.select()} onBlur={()=>{if(group.name.trim())setRenaming(undefined)}}
          onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur()}}}
          onChange={e=>onChange(groups.map(g=>g.id===group.id?{...g,name:e.target.value}:g),lines)}/>
          :<h4><JournalHeading>{group.name}</JournalHeading></h4>}
        <DraftMenu label={t('journalGroupActions')+' '+group.name}>
          <button type="button" onClick={()=>setRenaming(group.id)}>{t('journalRenameGroup')}</button>
          <button type="button" disabled={!index} onClick={()=>move(index,-1)}>{t('journalUp')}</button>
          <button type="button" disabled={index===groups.length-1} onClick={()=>move(index,1)}>{t('journalDown')}</button>
          <button type="button" className="draft-delete" onClick={()=>{
            const next=removeIngredientGroup({ingredientGroups:groups,lines},group.id);
            onChange(next.ingredientGroups,next.lines);
          }}>{t('delete')}</button>
        </DraftMenu>
      </div>{renderGroup(group.id,grouping)}
    </section>)}
    {confirming&&<DraftConfirmation title={t('draftGroupingTitle')} description={t('draftGroupingExplain')}
      action={t('draftDisableGrouping')} onCancel={()=>setConfirming(false)} onConfirm={disableGrouping}/>}
  </div>;
}
