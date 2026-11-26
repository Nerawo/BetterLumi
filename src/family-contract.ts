import {builtInFoods} from './data/builtInFoods';
import type {IngredientFamily} from './db';
import type {Recipe,FamilyLine,PantryItem,RecipeLine,TemplateLine} from './domain';

/** A prepared row carries the chosen product. Its stable slot identifies the template reference. */
export function templateFromPreparation(original:Recipe, prepared:RecipeLine[]):TemplateLine[]{
 const slots=new Map(original.lines.filter((line):line is FamilyLine=>line.source==='family').map(line=>[line.lineId,line]));
 return prepared.map(line=>{
  const slot=line.lineId?slots.get(line.lineId):undefined;
  if(!slot)return line;
  if(slot.unit!==line.unit)throw Error('familyUpdateUnit');
  return {...slot,quantity:line.quantity};
 });
}

export function checkPreparedMember(family:IngredientFamily|undefined,slot:FamilyLine,product:RecipeLine|undefined){
 if(!family||family.deletedAt)throw Error('familyReferenced');
 if(!product||product.source==='batch'||!family.memberIds.includes(product.ingredientId)||product.unit!==slot.unit)throw Error('familyUpdateUnit');
}
export function validateFamilies(families:IngredientFamily[],items:PantryItem[],cards:Recipe[]){
 const known=new Set<string>([...builtInFoods.map(i=>i.id),...items.filter(i=>!i.deletedAt).map(i=>i.id)]);
 const byId=new Map(families.map(f=>[f.id,f]));
 for(const f of families){
  if(typeof f.name!=='string'||!f.name.trim()||typeof f.alternateName!=='string'||!Array.isArray(f.memberIds)||!Array.isArray(f.inUseIds)||
     Object.keys(f).some(k=>!['id','createdAt','updatedAt','deletedAt','revision','name','alternateName','memberIds','inUseIds'].includes(k))||
     new Set(f.inUseIds).size!==f.inUseIds.length||f.inUseIds.some(id=>!f.memberIds.includes(id)))throw Error('familyInvalid');
  if(new Set(f.memberIds).size!==f.memberIds.length||f.memberIds.some(id=>f.deletedAt||!known.has(id)))throw Error('familyMembershipConflict');
 }
 for(const recipe of cards)for(const line of recipe.lines)if(line.source==='family'){
  if(!validFamilyLine(line))throw Error("familyInvalid");
  const family=byId.get(line.familyId);
  if(!family||family.deletedAt&&!recipe.deletedAt)throw Error('familyReferenced');
 }
}
export function validFamilyLine(l:FamilyLine){
 return !!l&&l.source==='family'&&typeof l.familyId==='string'&&!!l.familyId.trim()&&typeof l.lineId==='string'&&!!l.lineId.trim()&&
 typeof l.name==='string'&&!!l.name.trim()&&Number.isFinite(l.quantity)&&l.quantity>=0&&['g','mL'].includes(l.unit)&&
 Object.keys(l).every(k=>['source','familyId','lineId','groupId','name','quantity','unit'].includes(k));
}
