import './collection-locale';
import {useId,useRef,useState,type FormEvent} from "react";
import {flushSync} from "react-dom";
import {useTranslation} from "react-i18next";
import {Pencil,Trash2,GripVertical,ArrowUp,ArrowDown} from "lucide-react";
import {Modal} from "./ui";
import {confirmDelete} from "./DeleteConfirmation";
import {normalizeUserName} from "./user-names";
import type {RecordBase} from "./db";
import type {DeleteKind} from "./DeleteConfirmation";
type NamedItem=RecordBase&{name:string};

export function NamedCollectionManager({items,close,onDeleted,save,remove,reorder,onCreated,kind='category',labels={},counts={}}:{items:NamedItem[];close:()=>void;onDeleted:(id:string)=>void;reorder?:(id:string,target:string|number)=>Promise<void>;onCreated?:(id:string)=>void;save:(name:string,item?:NamedItem)=>Promise<unknown>;remove:(item:NamedItem)=>Promise<void>;kind?:DeleteKind;labels?:Record<string,string>;counts?:Record<string,number>}){
 const {t:translate}=useTranslation();const t=(key:string,options?:{name:string})=>translate(labels[key]??key,options??{});
 const prefix=useId(),[name,setName]=useState(""),[creatingError,setCreatingError]=useState("");
 const [editing,setEditing]=useState<string|null>(null),[rename,setRename]=useState(""),[renameError,setRenameError]=useState(""),[busy,setBusy]=useState(false);
 const [dragging,setDragging]=useState<string|null>(null),[orderError,setOrderError]=useState('');
 const move=async(id:string,target:string|number)=>{if(lock.current)return;lock.current=true;setBusy(true);setOrderError('');try{await reorder?.(id,target)}catch{setOrderError(t('failedMessage'))}finally{lock.current=false;setBusy(false)}};
 const lock=useRef(false),createInput=useRef<HTMLInputElement>(null),editInput=useRef<HTMLInputElement>(null),editButtons=useRef(new Map<string,HTMLButtonElement>());
 const errorText=(error:unknown)=>t(error instanceof Error&&["Empty category","Empty tag"].includes(error.message)?"categoryNameRequired":error instanceof Error&&["Duplicate category","Duplicate tag"].includes(error.message)?"categoryNameDuplicate":"failedMessage");
 const cancelRename=()=>{const id=editing;setEditing(null);setRenameError("");requestAnimationFrame(()=>{if(id)editButtons.current.get(id)?.focus()})};
 const submit=async(event:FormEvent,category?:NamedItem)=>{
  event.preventDefault();event.stopPropagation();if(lock.current)return;
  const clean=normalizeUserName(category?rename:name),setError=category?setRenameError:setCreatingError;
  if(!clean){setError(t("categoryNameRequired"));(category?editInput:createInput).current?.focus();return}
  lock.current=true;setBusy(true);setError("");
  try{const result=await save(clean,category);if(!category&&result&&typeof result==='object'&&'id' in result)onCreated?.(String(result.id));if(category)cancelRename();else{setName("");requestAnimationFrame(()=>createInput.current?.focus())}}
  catch(error){setError(errorText(error));requestAnimationFrame(()=>(category?editInput:createInput).current?.focus())}
  // Re-enable controls before the queued focus restoration can run.
  finally{lock.current=false;flushSync(()=>setBusy(false))}
 };
 return <Modal title={t("manageCategories")} close={close} className={"category-manager-modal"+(kind==="ingredientTag"?" ingredient-tag-manager":"")}>
  <div className="modal-scroll compact-category-manager" onKeyDown={event=>{if(event.key==="Escape"&&editing&&!busy){event.preventDefault();event.stopPropagation();cancelRename()}}}>
   <form className="category-create-inline" noValidate onSubmit={event=>void submit(event)}>
    <label htmlFor={prefix+"-new"}>{t("categoryCreateLabel")}</label>
    <div className="category-input-actions"><input ref={createInput} id={prefix+"-new"} name="categoryName" aria-label={t("categoryName")} aria-invalid={!!creatingError||undefined} aria-describedby={creatingError?prefix+"-create-error":undefined} value={name} maxLength={100} disabled={busy} onChange={event=>{setName(event.target.value);setCreatingError("")}}/><button className="primary" disabled={busy}>{t("add")}</button></div>
    {creatingError&&<p className="category-inline-error" id={prefix+"-create-error"} role="alert">{creatingError}</p>}
   </form>
   <div className="category-list-heading"><span>{t("categoryExistingLabel")}</span><span>{items.length}</span></div>
   <div className="managed-category-list">{orderError&&<p role="alert">{orderError}</p>}{items.map((category,index)=><div className={"managed-category-row"+(dragging===category.id?" is-dragging":"")} data-category-id={category.id} key={category.id} onDragOver={event=>{if(dragging){event.preventDefault();event.dataTransfer.dropEffect="move"}}} onDrop={event=>{event.preventDefault();if(dragging)void move(dragging,category.id);setDragging(null)}}>
    {editing===category.id?<form className="category-rename-inline" noValidate onSubmit={event=>void submit(event,category)}>
     <div className="category-input-actions"><input ref={editInput} autoFocus name="renameCategory" aria-label={t("categoryRenameLabel")} aria-invalid={!!renameError||undefined} aria-describedby={renameError?prefix+"-rename-error":undefined} value={rename} maxLength={100} disabled={busy} onChange={event=>{setRename(event.target.value);setRenameError("")}}/><button type="submit" className="text-link" disabled={busy}>{t("save")}</button><button type="button" className="text-link" disabled={busy} onClick={cancelRename}>{t("cancel")}</button></div>
     {renameError&&<p className="category-inline-error" id={prefix+"-rename-error"} role="alert">{renameError}</p>}
    </form>:<>{reorder&&<span className="collection-drag-handle" draggable={!busy} title={t("collectionDrag")} onDragStart={event=>{setDragging(category.id);event.dataTransfer.setData("text/plain",category.id);event.dataTransfer.effectAllowed="move"}} onDragEnd={()=>setDragging(null)} aria-hidden="true"><GripVertical size={16}/></span>}<span className="managed-category-name">{category.name}{counts[category.id]!==undefined&&<small className="muted"> · {counts[category.id]}</small>}</span><div className="actions">{reorder&&<><button type="button" aria-label={t("collectionMoveUp",{name:category.name})} disabled={busy||index===0} onClick={()=>void move(category.id,-1)}><ArrowUp size={15}/></button><button type="button" aria-label={t("collectionMoveDown",{name:category.name})} disabled={busy||index===items.length-1} onClick={()=>void move(category.id,1)}><ArrowDown size={15}/></button></>}<button type="button" ref={element=>{if(element)editButtons.current.set(category.id,element);else editButtons.current.delete(category.id)}} aria-label={t("edit")} disabled={busy} onClick={()=>{setEditing(category.id);setRename(category.name);setRenameError("")}}><Pencil size={15}/></button><button type="button" aria-label={t("delete")} disabled={busy} onClick={async()=>{let removed=false;await confirmDelete(kind,category.name,async()=>{await remove(category);onDeleted(category.id);removed=true});if(removed)requestAnimationFrame(()=>createInput.current?.focus())}}><Trash2 size={15}/></button></div></>}
   </div>)}</div>
  </div>
 </Modal>;
}
