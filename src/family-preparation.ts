import {automaticMember,familyOptions,familySnapshot,type FamilyCatalog} from './families';
import {unknownNutrition,type Recipe,type RecipeLine,type TemplateLine} from './domain';

export type EditorLine=RecipeLine & {draftFamilyId?:string;draftFamilyMemberId?:string};
export function templateEditorLine(line:TemplateLine):EditorLine{
 return line.source==='family'?{lineId:line.lineId,groupId:line.groupId,name:line.name,draftFamilyId:line.familyId,ingredientId:'',unit:line.unit,quantity:line.quantity,nutrition:unknownNutrition()}:line;
}
export function familyUnitNeedsReview(line:EditorLine){
 return !!line.draftFamilyId&&line.unit!=='g'&&line.unit!=='mL';
}
export function templateLine(line:EditorLine):TemplateLine{
 if(!line.draftFamilyId)return line;
 if(!line.lineId||(line.unit!=='g'&&line.unit!=='mL'))throw Error('familyInvalid');
 return {source:'family',familyId:line.draftFamilyId,lineId:line.lineId,groupId:line.groupId,name:line.name,quantity:line.quantity,unit:line.unit};
}

/** Keep Family slots in the editor, and give transaction callers only concrete rows. */
export function resolveFamilyPreparation(draft:EditorLine[],catalog:FamilyCatalog,language:string){
 const lines:RecipeLine[]=[],unresolved:EditorLine[]=[];
 for(const row of draft){
  const line=templateLine(row);
  if(line.source!=='family'){lines.push(line);continue}
  const member=row.draftFamilyMemberId
   ?familyOptions(line,catalog).find(option=>option.item.id===row.draftFamilyMemberId)
   :automaticMember(line,catalog);
  if(member)lines.push(familySnapshot(line,member,catalog,language));
  else unresolved.push(row);
 }
 return {lines,unresolved};
}

export function draftFromPrepared(template:Recipe,lines:RecipeLine[],catalog:FamilyCatalog):EditorLine[]{
 const slots=new Map(template.lines.flatMap(line=>line.source==='family'?[[line.lineId,line] as const]:[]));
 return lines.map(line=>{
  const slot=line.lineId?slots.get(line.lineId):undefined;
  if(!slot||slot.unit!==line.unit||!familyOptions(slot,catalog).some(member=>member.item.id===line.ingredientId))return line;
  return {...templateEditorLine({...slot,quantity:line.quantity}),draftFamilyMemberId:line.ingredientId};
 });
}
