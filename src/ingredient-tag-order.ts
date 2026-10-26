import {db} from './domain';
import {ingredientTags} from './ingredient-tags';
import {orderedItems} from './collection-order';
import {ingredientTagOptions} from './data/builtInTags';

export const ingredientTagOrderKey='ingredientTagOrder';
export function parseIngredientTagOrder(value:string|undefined):string[]{
 try{const parsed:unknown=JSON.parse(value??'[]');return Array.isArray(parsed)?[...new Set(parsed.filter((id):id is string=>typeof id==='string'&&id.length>0))]:[]}catch{return []}
}
/** Existing defaults/legacy custom order are the fallback; new IDs append safely. */
export function applyIngredientTagOrder<T extends {id:string}>(available:readonly T[],preferred:readonly string[]):T[]{
 const byId=new Map<string,T>(),result:T[]=[];
 for(const item of available)if(!byId.has(item.id))byId.set(item.id,item);
 for(const id of preferred){const item=byId.get(id);if(item){result.push(item);byId.delete(id)}}
 return [...result,...byId.values()];
}
/** Only a stable-ID preference is saved; tag definitions and associations never change. */
export async function moveIngredientTag(id:string,target:string|number){
 await db.transaction('rw',[db.settings,ingredientTags],async()=>{
  const custom=orderedItems(await ingredientTags.filter(tag=>!tag.deletedAt).toArray());
  const rows=applyIngredientTagOrder(ingredientTagOptions(custom,'en'),parseIngredientTagOrder((await db.settings.get(ingredientTagOrderKey))?.value));
  const from=rows.findIndex(row=>row.id===id),to=typeof target==='number'?from+target:rows.findIndex(row=>row.id===target);
  if(from<0||!Number.isInteger(to)||to<0||to>=rows.length||from===to)return;
  const [row]=rows.splice(from,1);rows.splice(to,0,row);
  await db.settings.put({key:ingredientTagOrderKey,value:JSON.stringify(rows.map(row=>row.id))});
 });
}
