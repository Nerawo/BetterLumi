import {nextOrder,associatedNameMatches} from './collection-order';
import {db,stamp,type PantryItem} from './domain';
import {normalizeUserName} from './user-names';
import {matchesIngredient} from './pantry-names';
import type {IngredientTag} from './ingredient-tag-data';
export type {IngredientTag};
export const ingredientTags=db.table<IngredientTag>('ingredientTags');
export async function saveIngredientTag(name:string,item?:IngredientTag){
 const clean=normalizeUserName(name);if(!clean||clean.length>100)throw Error('Empty tag');
 return db.transaction('rw',ingredientTags,async()=>{
  const current=item?await ingredientTags.get(item.id):undefined;if(item&&(!current||current.deletedAt))throw Error('Tag unavailable');
  if(await ingredientTags.filter(tag=>!tag.deletedAt&&tag.id!==item?.id&&normalizeUserName(tag.name).toLowerCase()===clean.toLowerCase()).first())throw Error('Duplicate tag');
  const row={...(current?{...current,revision:current.revision+1,updatedAt:new Date().toISOString()}:{...stamp(),sortOrder:nextOrder(await ingredientTags.filter(t=>!t.deletedAt).toArray())}),name:clean};await ingredientTags.put(row);return row;
 });
}
export async function deleteIngredientTag(tag:IngredientTag){
 await db.transaction('rw',[ingredientTags,db.ingredients],async()=>{
  const current=await ingredientTags.get(tag.id);if(!current||current.deletedAt)return;
  const now=new Date().toISOString();await ingredientTags.update(tag.id,{deletedAt:now,updatedAt:now,revision:current.revision+1});
  await db.ingredients.filter(i=>(i.tagIds??[]).includes(tag.id)).modify(i=>{i.tagIds=i.tagIds!.filter(id=>id!==tag.id);i.updatedAt=now;i.revision++;});
 });
}
export async function putTaggedIngredient(row:PantryItem){
 await db.transaction('rw',[ingredientTags,db.ingredients],async()=>{
  const active=new Set((await ingredientTags.filter(t=>!t.deletedAt).toArray()).map(t=>t.id));
  await db.ingredients.put({...row,tagIds:[...new Set(row.tagIds??[])].filter(id=>active.has(id))});
 });
}
export function filterIngredients(items:PantryItem[],query:string,tagId:string,tags:IngredientTag[]=[]){return items.filter(i=>(matchesIngredient(i,query)||associatedNameMatches(i.tagIds,tags,query))&&(!tagId||(i.tagIds??[]).includes(tagId)));}
