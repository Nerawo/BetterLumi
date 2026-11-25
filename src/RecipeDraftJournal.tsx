import {useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode} from 'react';
import {DraftUnitPicker,type DraftUnits} from './DraftUnitPicker';
import {createPortal} from 'react-dom';
import {useTranslation} from 'react-i18next';
import {Check, Pencil} from 'lucide-react';
import {JournalHeading} from './JournalHeading';
import {JournalMethod} from './JournalMethod';
import {Modal} from './ui';
import './recipe-draft-journal.css';

interface DraftConfirmationProps {
  title:string;
  description?:string;
  action:string;
  onCancel:()=>void;
  onConfirm:()=>void;
}
export function DraftConfirmation({title,description,action,onCancel,onConfirm}:DraftConfirmationProps) {
  const {t}=useTranslation();
  const descriptionId=useId();
  // Keep the dialog's buttons outside the recipe form and its sticky footer styles.
  return createPortal(<Modal className="draft-confirmation" title={title} close={onCancel}
    descriptionId={description?descriptionId:undefined}>
    {description&&<p id={descriptionId}>{description}</p>}
    <div className="draft-confirmation-actions">
      <button type="button" className="secondary" onClick={onCancel}>{t('cancel')}</button>
      <button type="button" className="primary" onClick={onConfirm}>{action}</button>
    </div>
  </Modal>,document.body);
}

interface DraftMenuProps {
  label:string;
  children:ReactNode;
  className?:string;
  leading?:ReactNode;
  directUnit?:DraftUnits;
  choices?:{key:string;label:string;control:ReactNode;disabled?:boolean}[];
}
export function DraftMenu({label,children,className='',leading,directUnit,choices=[]}:DraftMenuProps) {
  const ref=useRef<HTMLDetailsElement>(null);
  const [panel,setPanel]=useState<string>();
  const [unitsOpen,setUnitsOpen]=useState(false);
  function close(){
    if(ref.current)ref.current.open=false;
    setPanel(undefined);
  }
  const {t}=useTranslation();
  const [open,setOpen]=useState(false);
  useLayoutEffect(()=>{
    if(panel)ref.current?.querySelector<HTMLSelectElement>('section:not([hidden]) select')?.focus({preventScroll:true});
  },[panel]);
  useEffect(()=>{
    if(!open)return;
    const dismiss=(event:Event)=>{
      if(ref.current && !ref.current.contains(event.target as Node))close();
    };
    document.addEventListener('pointerdown',dismiss,true);
    return ()=>{
      document.removeEventListener('pointerdown',dismiss,true);
    };
  },[open]);
  return <>{directUnit&&<DraftUnitPicker units={directUnit} open={unitsOpen} setOpen={setUnitsOpen}/>}<details ref={ref} name="recipe-draft-actions" className={'journal-context-menu '+className}
    onToggle={event=>{setOpen(event.currentTarget.open);if(!event.currentTarget.open)setPanel(undefined)}}
    onKeyDown={event=>{if(event.key==='Escape' && ref.current?.open){event.preventDefault();event.stopPropagation();ref.current.open=false;ref.current.querySelector('summary')?.focus()}}}>
    <summary aria-label={label}>···</summary>
    <div onClick={event=>{if((event.target as Element).closest('button:not([data-panel])'))close()}}
      onChange={close}>
      <section hidden={!!panel}>{leading}{directUnit&&<button type="button" data-panel="unit" disabled={directUnit.fixed} onClick={()=>{close();setUnitsOpen(true)}}>{t('draftChangeUnit')}</button>}{choices.map(c=><button key={c.key} type="button" data-panel={c.key} disabled={c.disabled} onClick={()=>setPanel(c.key)}>{c.label}</button>)}{children}</section>
      {choices.map(c=><section hidden={panel!==c.key} key={c.key}><label>{c.label}{c.control}</label><button type="button" data-panel="back" onClick={()=>setPanel(undefined)}>{t('draftMenuBack')}</button></section>)}
    </div>
  </details></>;
}

export function DraftMethod({value,onConfirm,editing,setEditing}:{value:string;onConfirm:(text:string)=>void;editing:boolean;setEditing:(editing:boolean)=>void}) {
  const {t}=useTranslation();
  const [buffer,setBuffer]=useState(value);
  const ref=useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(()=>{
    if(ref.current){ref.current.style.height='auto';ref.current.style.height=ref.current.scrollHeight+'px'}
  },[buffer,editing]);
  return <section className="recipe-editor-section draft-method">
    <div className="draft-heading-row"><h3><JournalHeading>Method</JournalHeading></h3>
      <button type="button" className="draft-method-toggle" aria-label={t(editing?'journalMethodSave':'journalMethodEdit')}
        aria-expanded={editing} onClick={()=>{
          if(editing)onConfirm(buffer);else setBuffer(value);
          setEditing(!editing);
        }}>{editing?<Check size={17}/>:<Pencil size={15}/>}</button>
    </div>
    {editing?<textarea ref={ref} autoFocus rows={2} name="instructions" aria-label={t('instructions')} value={buffer} onChange={e=>setBuffer(e.target.value)}/>
      :<JournalMethod text={value||t('notRecorded')}/>}
  </section>;
}
