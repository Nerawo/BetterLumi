import {useRef,useState} from "react";
import {useTranslation} from "react-i18next";
import {BookOpen,Camera,Trash2} from "lucide-react";
import {recipes,type Recipe} from "./domain";
import {readLocalImage} from "./images";
import {changed,type Notice} from "./ui";

export function RecipeDetailImage({recipe,notice}:{recipe:Recipe;notice:Notice}){
 const {t}=useTranslation(),[busy,setBusy]=useState(false);
 const trigger=useRef<HTMLButtonElement>(null),input=useRef<HTMLInputElement>(null),locked=useRef(false);
 const save=async(photo:string)=>{
  // Update the latest row, preserving any concurrent edits to unrelated fields.
  await recipes.db.transaction("rw",recipes,async()=>{const current=await recipes.get(recipe.id);if(!current||current.deletedAt)throw Error("Recipe unavailable");await recipes.put({...changed(current),photo})});
 };
 return <div className="recipe-detail-image-editor" aria-busy={busy}>
  <button type="button" className="detail-image-trigger" ref={trigger} disabled={busy} aria-label={t(recipe.photo?"replacePhoto":"uploadRecipePhoto")+" · "+recipe.name} onClick={()=>input.current?.click()}>
   {recipe.photo?<img className="detail-photo" src={recipe.photo} alt={recipe.name}/>:<span className="detail-photo detail-photo-empty"><BookOpen size={40} strokeWidth={1}/></span>}
   <span className="detail-image-affordance" aria-hidden="true"><Camera size={17}/></span>
  </button>
  <input className="detail-image-input visually-hidden" ref={input} type="file" accept="image/jpeg,image/png,image/webp" tabIndex={-1} aria-label={t("uploadRecipePhoto")+" · "+recipe.name} disabled={busy} onChange={async event=>{const file=event.target.files?.[0];event.target.value="";if(!file||locked.current)return;locked.current=true;setBusy(true);try{let photo:string;try{photo=await readLocalImage(file)}catch{notice(t("photoError"));return}await save(photo);notice(t("savedMessage"))}catch{notice(t("failedMessage"))}finally{locked.current=false;setBusy(false);trigger.current?.focus({preventScroll:true})}}}/>
  {recipe.photo&&<button type="button" className="text-link detail-image-remove" disabled={busy} onClick={async()=>{if(locked.current)return;locked.current=true;setBusy(true);try{await save("");notice(t("savedMessage"))}catch{notice(t("failedMessage"))}finally{locked.current=false;setBusy(false);trigger.current?.focus({preventScroll:true})}}}><Trash2 size={13}/>{t("removePhoto")}</button>}
 </div>;
}
