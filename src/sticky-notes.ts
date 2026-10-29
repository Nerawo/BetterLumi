import {db,stamp,type RecordBase} from './db';
import {foodLogs,recipes,type FoodLog} from './domain';
import {recipeNotes,type RecipeNote} from './goals';

/** Additive metadata in the existing recipeNotes store; no new store, index or backup version. */
export interface StickyNoteRecord extends RecipeNote {origin?:'recipe'|'meal';mealId?:string;mealDate?:string}
export interface StickyNote extends StickyNoteRecord {location:'stored'|'legacy-meal'|'legacy-recipe'}
export interface StickyNoteChange {before:StickyNote;text:string|null;fresh?:boolean}
export class StickyNoteConflict extends Error {constructor(){super('The meal or note changed. Reopen it before saving.')}}
const importedDetails=(m:FoodLog)=>m.id.startsWith('ai-meal:');
const link=(m:FoodLog)=>m.source==='recipe'?m.sourceId??'':'';
const legacy=(r:RecordBase,text:string,recipeId:string,location:StickyNote['location'],meal?:FoodLog):StickyNote=>({...r,id:location+':'+r.id,recipeId,text,location,origin:meal?'meal':'recipe',...(meal?{mealId:meal.id,mealDate:meal.date}:{})});
export async function loadStickyNotes(recipeId='',mealId=''):Promise<StickyNote[]> {
 const [stored,recipe,meals]=await Promise.all([
  recipeNotes.filter(n=>!n.deletedAt&&(!!recipeId&&n.recipeId===recipeId||!!mealId&&(n as StickyNoteRecord).mealId===mealId)).toArray(),
  recipeId?recipes.get(recipeId):undefined,
  foodLogs.filter(m=>(!!mealId&&m.id===mealId||!!recipeId&&link(m)===recipeId)&&!!m.cookingNote&&!importedDetails(m)).toArray(),
 ]);
 const originIds=[...new Set(stored.map(n=>(n as StickyNoteRecord).mealId).filter((id):id is string=>!!id))];
 const origins=new Map((await foodLogs.bulkGet(originIds)).filter((m):m is FoodLog=>!!m).map(m=>[m.id,m]));
 const notes:StickyNote[]=stored.map(n=>({...n,location:'stored',...((n as StickyNoteRecord).mealId&&origins.get((n as StickyNoteRecord).mealId!)?{mealDate:origins.get((n as StickyNoteRecord).mealId!)!.date}:{})}));
 if(recipe?.stickyNote)notes.push(legacy(recipe,recipe.stickyNote,recipe.id,'legacy-recipe'));
 for(const meal of meals)notes.push(legacy(meal,meal.cookingNote,link(meal),'legacy-meal',meal));
 // Soft-deleted parents are intentionally included: deleting a parent never erases shared notes.
 return sortStickyNotes(notes);
}
export const sortStickyNotes=(notes:StickyNote[])=>notes.sort((a,b)=>{const left=Date.parse(a.createdAt),right=Date.parse(b.createdAt);return (Number.isFinite(left)&&Number.isFinite(right)?left-right:a.createdAt.localeCompare(b.createdAt))||a.id.localeCompare(b.id)});
export function newStickyNote(recipeId:string,meal?:{id:string;date:string}):StickyNote {
 return {...stamp(),recipeId,text:'',origin:meal?'meal':'recipe',location:'stored',...(meal?{mealId:meal.id,mealDate:meal.date}:{})};
}
export async function assertMealNoteRevision(initial:FoodLog|undefined){
 if(!initial)return;const current=await foodLogs.get(initial.id);
 if(!current||current.deletedAt||current.revision!==initial.revision)throw new StickyNoteConflict();
}
/** Also used inside the meal's existing transaction, so Cancel/failure cannot leak shared edits. */
export async function commitStickyNoteChanges(changes:StickyNoteChange[],meal?:FoodLog){
 await db.transaction('rw',[recipeNotes,recipes,foodLogs],async()=>{
  for(const change of changes){
   const {before,text}=change;
   if(text!==null&&!text.trim())throw Error('A sticky note cannot be blank');
   if(before.location==='stored'){
    const current=await recipeNotes.get(before.id);
    if(change.fresh?!!current:!current||!!current.deletedAt||current.revision!==before.revision)throw new StickyNoteConflict();
    if(text===null){if(current)await recipeNotes.update(current.id,{deletedAt:new Date().toISOString(),updatedAt:new Date().toISOString(),revision:current.revision+1});continue}
    const {location:_,...record}=before;
    const next:StickyNoteRecord={...record,text:text.trim(),updatedAt:new Date().toISOString(),revision:change.fresh?before.revision:before.revision+1};
    if(change.fresh&&meal){next.origin='meal';next.mealId=meal.id;next.mealDate=meal.date;next.recipeId=link(meal)}
    await recipeNotes.put(next);
   }else{
    const isMeal=before.location==='legacy-meal',table=isMeal?foodLogs:recipes;
    const id=isMeal?before.mealId!:before.recipeId,current=await table.get(id);
    const field=isMeal?'cookingNote':'stickyNote';
    if(!current||(current as unknown as Record<string,unknown>)[field]!==before.text)throw new StickyNoteConflict();
    const meta={updatedAt:new Date().toISOString(),revision:current.revision+1};
    if(isMeal)await foodLogs.update(id,{...meta,cookingNote:text?.trim()??''});
    else await recipes.update(id,{...meta,stickyNote:text?.trim()??''});
   }
  }
  if(meal){
   // Only private notes attach when explicitly linked. Previously shared notes retain their recipe.
   const own=await recipeNotes.filter(n=>!n.deletedAt&&(n as StickyNoteRecord).mealId===meal.id).toArray();
   for(const value of own){const note=value as StickyNoteRecord,recipeId=note.recipeId||link(meal);if(recipeId!==note.recipeId||note.mealDate!==meal.date)await recipeNotes.update(note.id,{recipeId,mealDate:meal.date,updatedAt:new Date().toISOString(),revision:note.revision+1} as Partial<StickyNoteRecord>)}
  }
 });
}
