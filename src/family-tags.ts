import {builtInTagIds} from './data/builtInTags';
import {db} from './db';

export const familyTagPrefix = 'familyTags:';

export function readFamilyTags(value: string): string[] {
  const ids: unknown = JSON.parse(value);
  if (!Array.isArray(ids) || !ids.every(id => typeof id === 'string' && id.length > 0) || new Set(ids).size !== ids.length)
    throw Error('Invalid Family tags');
  return ids;
}

/** Validate relationships on the detached import, before the replacement transaction. */
export function reconcileFamilyTags(tables:{
 settings:{key:string;value:string}[];
 ingredientFamilies:{id:string;deletedAt:string|null}[];
 ingredientTags:{id:string;deletedAt:string|null}[];
},version:number){
 const families=new Set(tables.ingredientFamilies.filter(f=>!f.deletedAt).map(f=>f.id));
 const tags=new Set<string>([...builtInTagIds,...tables.ingredientTags.filter(t=>!t.deletedAt).map(t=>t.id)]);
 tables.settings=tables.settings.filter(row=>{
  if(!row.key.startsWith(familyTagPrefix))return true;
  const familyId=row.key.slice(familyTagPrefix.length);
  const ids=readFamilyTags(row.value);
  if(!families.has(familyId)){
   if(version>=18)throw Error('Invalid Family tag reference: unknown Family '+familyId);
   return false;
  }
  const valid=ids.filter(id=>tags.has(id));
  if(valid.length!==ids.length){
   if(version>=18)throw Error('Invalid Family tag reference: unknown tag for '+familyId);
   row.value=JSON.stringify(valid);
  }
  return true;
 });
}

export async function saveFamilyTags(familyId: string, ids: string[]) {
  const custom = await db.table('ingredientTags').filter(tag => !tag.deletedAt).primaryKeys();
  const allowed = new Set([...builtInTagIds, ...custom]);
  const selected = [...new Set(ids)].filter(id => allowed.has(id));
  const key = familyTagPrefix + familyId;
  if (selected.length) await db.settings.put({key, value: JSON.stringify(selected)});
  else await db.settings.delete(key);
}
