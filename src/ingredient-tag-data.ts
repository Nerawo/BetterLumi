import {validOrder} from './collection-order';
import type {RecordBase} from './db';
import {normalizeUserName} from './user-names';
export interface IngredientTag extends RecordBase {name:string;sortOrder?:number}
/** Work only on cloned import data, before any database writes. */
export function reconcileIngredientTags(tables:Record<string,unknown[]>) {
 for(const row of [...(tables.recipeCategories??[]),...(tables.ingredientTags??[])])if(!validOrder(row as {sortOrder?:unknown}))throw Error('Invalid collection order');
 const tags=tables.ingredientTags??[];
 if(!Array.isArray(tags))throw Error('Invalid ingredient tags');
 const active=new Set<string>(),names=new Set<string>();
 for(const value of tags){
  const tag=value as IngredientTag;
  if(typeof tag.name!=='string'||!normalizeUserName(tag.name)||tag.name.length>100)throw Error('Invalid ingredient tag name');
  if(!tag.deletedAt){const key=normalizeUserName(tag.name).toLowerCase();if(names.has(key))throw Error('Duplicate ingredient tag name');names.add(key);active.add(tag.id);}
 }
 for(const value of tables.ingredients??[]){
  const item=value as {tagIds?:unknown};
  if(item.tagIds===undefined)continue;
  if(!Array.isArray(item.tagIds)||item.tagIds.some(id=>typeof id!=='string'||!id))throw Error('Invalid ingredient tag references');
  item.tagIds=[...new Set(item.tagIds.filter(id=>active.has(id)))];
 }
}
