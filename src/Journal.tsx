import {confirmDelete} from "./DeleteConfirmation";
import {formatLocalDate} from "./dates";
import {DateInput} from "./DateInput";
import {useEffect,useState} from "react";
import {useTranslation} from "react-i18next";
import {Plus} from "lucide-react";
import {plans,stamp,localDate,softDelete,type Plan} from "./domain";
import {Modal,Actions,changed,type Notice} from "./ui";

export function PlanList({items,notice,defaultDate=localDate()}:{items:Plan[];notice:Notice;defaultDate?:string}){
 const {t,i18n}=useTranslation();
 const [editing,setEditing]=useState<Plan|null|undefined>();
 const [pending,setPending]=useState<Record<string,boolean>>({});
 useEffect(()=>{setPending(old=>Object.fromEntries(Object.entries(old).filter(([id,value])=>{const item=items.find(item=>item.id===id);return item&&!!item.completed!==value})))},[items]);
 return <div className="todo-list">
  <div className="section-heading"><button className="text-link" onClick={()=>setEditing(null)}><Plus size={15}/>{t("add")}</button></div>
  {items.length?items.map(item=><div className="todo-row" data-todo-id={item.id} data-completed={pending[item.id]??!!item.completed} key={item.id}>
   <label className="todo-check"><input type="checkbox" checked={pending[item.id]??!!item.completed} disabled={item.id in pending} aria-label={t((pending[item.id]??item.completed)?"uncompleteTodo":"completeTodo",{title:item.title})} onChange={async event=>{
    const completed=event.target.checked;
    setPending(old=>({...old,[item.id]:completed}));
    try{await plans.db.transaction("rw",plans,async()=>{const current=await plans.get(item.id);if(!current||current.deletedAt)throw new Error("To-do no longer available");await plans.put({...changed(current),completed})})}catch{notice(t("failedMessage"));setPending(old=>{const next={...old};delete next[item.id];return next})}
   }}/></label>
   <div className="todo-content"><h3>{item.title}</h3><p><time dateTime={item.date}>{formatLocalDate(item.date,i18n.language)}</time>{item.notes&&<span>{item.notes}</span>}</p></div>
   <Actions edit={()=>setEditing(item)} remove={async()=>{await confirmDelete("todo",item.title,async()=>{await softDelete(plans,item.id)})}}/>
  </div>):<p className="muted text-small">{t("noTodos")}</p>}
  {editing!==undefined&&<PlanEditor item={editing} defaultDate={defaultDate} close={()=>setEditing(undefined)} notice={notice}/>}
 </div>;
}
function PlanEditor({item,close,notice,defaultDate}:{item:Plan|null;close:()=>void;notice:Notice;defaultDate:string}){
 const {t}=useTranslation();
 const [saving,setSaving]=useState(false);
 return <Modal className="todo-editor-modal" title={t(item?"editTodo":"addTodo")} close={close}><form onSubmit={async event=>{
  event.preventDefault();if(saving)return;
  const fields=new FormData(event.currentTarget),title=String(fields.get("title")??"").trim();if(!title)return;
  setSaving(true);
  try{
   await plans.db.transaction("rw",plans,async()=>{
    const current=item?await plans.get(item.id):null;
    if(item&&(!current||current.deletedAt))throw new Error("To-do no longer available");
    await plans.put({...((current?changed(current):stamp())),title,date:String(fields.get("date")),kind:current?.kind??"meal",notes:String(fields.get("notes")??"").trim(),completed:current?.completed??false});
   });close();notice(t("savedMessage"));
  }catch{notice(t("failedMessage"));setSaving(false)}
 }}>
  <label>{t("todoTitle")}<input name="title" required defaultValue={item?.title}/></label>
  <label>{t("date")}<DateInput name="date" required defaultValue={item?.date??defaultDate}/></label>
  <label>{t("notes")} <small>{t("optional")}</small><textarea name="notes" rows={3} defaultValue={item?.notes}/></label>
  <div className="form-actions"><button type="button" onClick={close}>{t("cancel")}</button><button className="primary" disabled={saving}>{t("save")}</button></div>
 </form></Modal>;
}
