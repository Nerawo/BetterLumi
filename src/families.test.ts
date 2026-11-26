import 'fake-indexeddb/auto';
import {livePreparation} from './live-nutrition';
import Dexie from 'dexie';
import {afterEach,expect,it} from 'vitest';
import {db,stamp,recipes,foodLogs,restoreAll,exportAll,softDelete,type Recipe,type FamilyLine,type PantryItem} from './domain';
import {LumiDB,type IngredientFamily} from './db';
import {automaticMember,commonUnits,familyCatalog,familyOptions,familySnapshot,saveFamily,saveFamilyRecipe,saveMealRecipeVersion,deleteFamily} from './families';
import {resolveFamilyPreparation,templateEditorLine} from './family-preparation';
import {formatNutritionRange,recipeCardRange,recipeNutritionRange} from './recipe-nutrition-range';
import {openCookingSession,saveCookingSession,updateRecipeFromCooking} from './cooking-session';
import {effectiveCookingRecipe} from './cooking-effective';
import {setCookingQuantity,replaceCookingIngredient} from './cooking-journal';
import {copyRecipeForBatch,FoodStorage} from './food-storage';
import {saveIngredientPreference,userChoice} from './ingredient-preferences';

afterEach(async()=>{for(const table of db.tables)await table.clear()});
const food=(name:string,calories:number):PantryItem=>({...stamp(),name,nameZh:'',brand:name,basis:'100g',referenceUnit:'g',servingGrams:null,calories,protein:8,carbs:5,fat:3});
async function setup(){
 const a=food('Fage',59),b=food('Chobani',88);
 await db.ingredients.bulkPut([a,b]);
 const f:IngredientFamily={...stamp(),name:'酸奶',alternateName:'Yogurt',memberIds:[a.id,b.id],inUseIds:[a.id]};
 await saveFamily(f);
 const line:FamilyLine={source:'family',lineId:'yogurt-slot',familyId:f.id,name:f.name,quantity:100,unit:'g'};
 const r:Recipe={...stamp(),name:'Breakfast',servings:1,lines:[line],instructions:'Mix',stickyNote:''};
 await saveFamilyRecipe(r);return {a,b,f,r,line,c:familyCatalog([f],[a,b],{})};
}
it('round trips a pending Family checklist and requires a concrete product for destinations',async()=>{
 const {r,line}=await setup();
 const fresh=await openCookingSession(r);
 const editing=setCookingQuantity({...fresh,checked:[line.lineId]},line.lineId,125,'g');
 await saveCookingSession(fresh,editing);
 await restoreAll(await exportAll());
 const restored=await openCookingSession(r);
 expect(restored).toEqual(editing);
 expect(()=>effectiveCookingRecipe(r,restored)).toThrow('familyUnavailable');
 expect((await recipes.get(r.id))?.lines).toEqual([line]);
});
it('keeps mixed-basis membership and saves templates while ignoring incompatible members',async()=>{
 const {a,b,f,line,r}=await setup();
 await db.ingredients.update(b.id,{referenceUnit:'mL'});
 await saveFamily({...f,inUseIds:[a.id,b.id]});
 const catalog=familyCatalog([f],await db.ingredients.toArray(),{});
 expect(commonUnits(f,catalog)).toEqual([]);expect(familyOptions(line,catalog).map(choice=>choice.item.id)).toEqual([a.id]);
 const template={...r,...stamp()};await saveFamilyRecipe(template);expect((await recipes.get(template.id))?.lines).toEqual([line]);
 await expect(saveFamily({...f,...stamp(),memberIds:[a.id,a.id]})).rejects.toThrow('familyMembershipConflict');
});
it.each([0,1,2])('resolves only exactly one active member (%s active)',async count=>{
 const {a,b,f,line}=await setup(),family={...f,inUseIds:[a.id,b.id].slice(0,count)},catalog=familyCatalog([family],[a,b],{});
 expect(automaticMember(line,catalog)?.item.id).toBe(count===1?a.id:undefined);
 expect(familyOptions(line,catalog)).toHaveLength(count||2);
 expect(recipeNutritionRange([line],catalog,'en').calories).toEqual(count===1?[59,59]:[59,88]);
});
it('derives independent live bounds, scales servings, and ignores incompatible members',async()=>{
 const {a,b,f,line,r}=await setup();
 const A={...a,protein:10,carbs:4,fat:0},B={...b,protein:8,carbs:5,fat:4};
 const C={...food('Skyr',73),protein:11,carbs:6,fat:1},D={...food('Liquid',999),referenceUnit:'mL' as const};
 const x=food('Fixed',300),y=food('Milk One',40),z=food('Milk Two',65);
 const yogurt={...f,memberIds:[A.id,B.id,C.id,D.id],inUseIds:[A.id,B.id,C.id,D.id]};
 const milk={...f,...stamp(),memberIds:[y.id,z.id],inUseIds:[]};
 const both=[yogurt,milk],foods=[A,B,C,D,x,y,z],catalog=familyCatalog(both,foods,{});
 expect(recipeNutritionRange([line],catalog,'zh')).toEqual({calories:[59,88],protein:[8,11],carbs:[4,6],fat:[0,4]});
 expect(recipeNutritionRange([{...line,quantity:200}],catalog,'zh').calories).toEqual([118,176]);
 const fixed={ingredientId:x.id,name:x.name,quantity:100,unit:'g',nutrition:{calories:1,protein:1,carbs:1,fat:1}};
 const lines=[fixed,line,{...line,familyId:milk.id,lineId:'milk'}];
 expect(recipeNutritionRange(lines,catalog,'zh').calories).toEqual([399,453]);
 expect(recipeCardRange({...r,lines,servings:2},catalog,'zh').nutrition.calories).toEqual([199.5,226.5]);
 const current=familyCatalog([{...yogurt,inUseIds:[]}],foods.map(item=>item.id===A.id?{...A,calories:50}:item),{});
 expect(recipeNutritionRange([line],current,'zh').calories).toEqual([50,88]);
 expect(recipeNutritionRange([line],familyCatalog([{...yogurt,inUseIds:[D.id]}],foods,{}),'zh').calories).toBeNull();
 expect(formatNutritionRange([58.7,59.2])).toBe(59);
 expect(formatNutritionRange([59,88])).toBe('59–88');
 const backup=await exportAll();await restoreAll(backup);
 expect((await recipes.get(r.id))?.lines).toEqual([line]);
});
it('uses separate draft choices for two slots of the same Family without changing the template or cooking defaults',async()=>{
 const {a,b,f,line,r}=await setup();
 const family={...f,inUseIds:[a.id,b.id]},catalog=familyCatalog([family],[a,b],{});
 const second={...line,lineId:'second-slot',quantity:25};
 const selections=[{...templateEditorLine(line),draftFamilyMemberId:a.id},{...templateEditorLine(second),draftFamilyMemberId:b.id}];
 expect(resolveFamilyPreparation(selections,catalog,'en').lines).toMatchObject([
  {ingredientId:a.id,nutrition:{calories:59}},{ingredientId:b.id,nutrition:{calories:22}},
 ]);
 expect(automaticMember(line,catalog)).toBeUndefined();
 expect(resolveFamilyPreparation([line,second].map(templateEditorLine),catalog,'en').unresolved).toHaveLength(2);
 expect((await recipes.get(r.id))?.lines).toEqual([line]);
});
it('pins actual product, updates only the template quantity, restores the v4 slot and preserves meal history',async()=>{
 const {a,b,f,r,line,c}=await setup();
 const product=familySnapshot(line,userChoice(a),c,'en');
 let session=await openCookingSession(r,true,{baseline:r,servings:1,lines:[product]});
 session=await saveCookingSession(session,setCookingQuantity(session,line.lineId,125.5,'g'));
 const next=await updateRecipeFromCooking(r,session);
 expect(next.recipe.lines).toEqual([{...line,quantity:125.5}]);
 expect(next.session.version).toBe(4);
 const actual=effectiveCookingRecipe(next.recipe,next.session);
 expect(actual.lines[0]).toMatchObject({ingredientId:a.id,lineId:line.lineId,quantity:125.5});
 expect(actual.lines[0].nutrition.calories).toBeCloseTo(59*1.255,12);
 const log={...stamp(),date:'2026-11-25',source:'recipe' as const,sourceId:r.id,category:'lunch',name:r.name,quantity:1,unit:'serving',lines:actual.lines,nutrition:actual.lines[0].nutrition,cookingNote:''};
 await foodLogs.put(log);await saveFamily({...f,inUseIds:[b.id]});
 const backup=await exportAll();expect(backup.version).toBe(20);
 await restoreAll(JSON.parse(JSON.stringify(backup)));
 expect(await foodLogs.get(log.id)).toEqual(log);
 expect(await recipes.get(r.id)).toEqual(next.recipe);
 expect((await db.ingredientFamilies.get(f.id))?.inUseIds).toEqual([b.id]);
 expect(effectiveCookingRecipe(next.recipe,await openCookingSession(next.recipe)).lines).toEqual(actual.lines);
 expect(await db.inventoryTransactions.count()).toBe(0);
});
it('blocks deletion while referenced, detaches deleted members, and keeps archived members out of actual choices',async()=>{
 const {a,b,f,r}=await setup();await expect(deleteFamily(f)).rejects.toThrow('familyReferenced');
 const other:IngredientFamily={...f,...stamp(),name:'Breakfast',inUseIds:[a.id,b.id]};
 await saveFamily(other);
 await saveIngredientPreference(userChoice(a),{version:1,preferred:'g',units:[],archived:true});
 expect((await db.ingredientFamilies.get(f.id))?.inUseIds).toEqual([]);
 expect(await db.ingredientFamilies.get(other.id)).toMatchObject({memberIds:[a.id,b.id],inUseIds:[b.id]});
 await softDelete(db.ingredients,b.id);
 const current=(await db.ingredientFamilies.get(f.id))!;expect(current.memberIds).toEqual([a.id]);
 expect(await db.ingredientFamilies.get(other.id)).toMatchObject({memberIds:[a.id],inUseIds:[]});
 await softDelete(recipes,r.id);await deleteFamily(current);
 expect((await db.ingredients.get(a.id))?.deletedAt).toBeNull();
 expect((await db.ingredientFamilies.get(f.id))?.memberIds).toEqual([]);
 await restoreAll(await exportAll());
});
it('rejects dangling, duplicate and historical family references before writing',async()=>{
 const {f,r,line}=await setup(),before=await exportAll();
 for(const corrupt of [(b:typeof before)=>b.tables.ingredientFamilies.splice(0),(b:typeof before)=>b.tables.ingredientFamilies.push({...f,...stamp(),memberIds:[f.memberIds[0],f.memberIds[0]]}),(b:typeof before)=>b.tables.foodLogs.push({...r,date:'2026-11-25',source:'recipe',lines:[line]})]){
  const copy=structuredClone(before);corrupt(copy);await expect(restoreAll(copy)).rejects.toThrow();expect((await exportAll()).tables).toEqual(before.tables);
 }
});

it('round-trips shared members and resolves each recipe by its own Family ID and In Use state',async()=>{
 const {a,b,f,r,line}=await setup();
 const egg=food('Egg',155),tag='betterlumi:ingredient-tag:dairy-eggs';
 await db.ingredients.put(egg);
 await db.ingredients.update(a.id,{tagIds:[tag]});
 const fage=(await db.ingredients.get(a.id))!;
 const breakfast:IngredientFamily={...stamp(),name:'早餐',alternateName:'Breakfast',memberIds:[a.id,egg.id],inUseIds:[egg.id]};
 await saveFamily(breakfast);
 const breakfastSlot={...line,familyId:breakfast.id,name:breakfast.name,lineId:'breakfast-slot'};
 const breakfastRecipe={...r,...stamp(),lines:[breakfastSlot]};
 await saveFamilyRecipe(breakfastRecipe);
 const exact:Recipe={...r,...stamp(),lines:[{ingredientId:a.id,name:a.name,unit:'g',quantity:100,nutrition:{calories:59,protein:8,carbs:5,fat:3}}]};
 await saveFamilyRecipe(exact);
 const backup=await exportAll();expect(backup.version).toBe(20);
 await restoreAll(JSON.parse(JSON.stringify(backup)));
 expect(await db.ingredientFamilies.get(f.id)).toMatchObject({memberIds:[a.id,b.id],inUseIds:[a.id]});
 expect(await db.ingredientFamilies.get(breakfast.id)).toMatchObject({memberIds:[a.id,egg.id],inUseIds:[egg.id]});
 const catalog=familyCatalog(await db.ingredientFamilies.toArray(),await db.ingredients.toArray(),{});
 expect(resolveFamilyPreparation([line,breakfastSlot].map(templateEditorLine),catalog,'en').lines).toMatchObject([{ingredientId:a.id},{ingredientId:egg.id}]);
 expect((await recipes.get(r.id))?.lines).toEqual([line]);
 expect((await recipes.get(breakfastRecipe.id))?.lines).toEqual([breakfastSlot]);
 await saveFamily({...breakfast,inUseIds:[egg.id,a.id]});
 const sharedBreakfast=(await db.ingredientFamilies.get(breakfast.id))!;
 expect((await db.ingredientFamilies.get(f.id))?.inUseIds).toEqual([a.id]);
 await saveFamily({...f,memberIds:[b.id],inUseIds:[]});
 expect(await db.ingredientFamilies.get(breakfast.id)).toEqual(sharedBreakfast);
 await softDelete(recipes,r.id);
 await deleteFamily((await db.ingredientFamilies.get(f.id))!);
 expect(await db.ingredientFamilies.get(breakfast.id)).toEqual(sharedBreakfast);
 expect(await db.ingredients.get(a.id)).toEqual(fage);
 expect(await recipes.get(exact.id)).toEqual(exact);
 expect(await db.foodBatches.count()).toBe(0);
 await restoreAll(await exportAll());
 expect(await db.ingredientFamilies.get(breakfast.id)).toEqual(sharedBreakfast);
});
it('keeps volume-based families in mL and asks even for a sole member with no In Use selection',async()=>{
 const {a,f,line}=await setup();
 const member={...a,referenceAmount:15,referenceUnit:'mL' as const};
 const family={...f,memberIds:[a.id],inUseIds:[]};
 const catalog=familyCatalog([family],[member],{}),volume={...line,unit:'mL' as const,quantity:30};
 expect(commonUnits(family,catalog)).toEqual(['mL']);
 expect(automaticMember(volume,catalog)).toBeUndefined();
 expect(familySnapshot(volume,userChoice(member),catalog,'en').nutrition.calories).toBe(118);
 expect(familyOptions(line,catalog)).toEqual([]);
});
it('preserves family slots on explicit updates from Adjust Recipe and rejects an unrelated replacement',async()=>{
 const {r,line,a,c}=await setup();
 const concrete=familySnapshot({...line,quantity:75},userChoice(a),c,'en');
 await saveMealRecipeVersion(r,{...r,revision:r.revision+1,lines:[concrete]},false);
 const updated=(await recipes.get(r.id))!;
 expect(updated.lines).toEqual([{...line,quantity:75}]);
 await expect(saveMealRecipeVersion(updated,{...updated,lines:[{...concrete,ingredientId:'outside'}]},false)).rejects.toThrow('familyUpdateUnit');
 await expect(saveMealRecipeVersion(updated,{...updated,lines:[{...concrete,lineId:undefined}]},true)).rejects.toThrow('familyUpdateUnit');
 expect(await recipes.get(r.id)).toEqual(updated);
});
it('detaches members without editing ingredients and prevents reopening a deleted family from a stale window',async()=>{
 const {a,b,f,r,line,c}=await setup();
 await saveFamily({...f,memberIds:[b.id],inUseIds:[]});
 expect(await db.ingredients.get(a.id)).toEqual(a);
 const product=familySnapshot(line,userChoice(a),c,'en'),current=(await db.ingredientFamilies.get(f.id))!;
 await softDelete(recipes,r.id);await deleteFamily(current);
 await expect(openCookingSession(r,true,{servings:1,lines:[product],baseline:r})).rejects.toThrow('familyReferenced');
 expect(await db.ingredients.get(b.id)).toEqual(b);
});
it('uses a replacement product in a batch snapshot through the existing transaction boundary',async()=>{
 const {a,b,f,r,c,line}=await setup();
 const product=familySnapshot(line,userChoice(a),c,'en');
 const session=await openCookingSession(r,true,{baseline:r,servings:1,lines:[product]});
 const replacement={...product,ingredientId:b.id,name:b.name,nutrition:{calories:88,protein:8,carbs:5,fat:3}};
 const next=await saveCookingSession(session,replaceCookingIngredient(session,line.lineId,replacement));
 expect(await recipes.get(r.id)).toEqual(r);
 expect(()=>copyRecipeForBatch(r)).toThrow();
 expect(await db.inventoryTransactions.count()).toBe(0);
 const store=new FoodStorage(),id=stamp().id,ingredients=copyRecipeForBatch(effectiveCookingRecipe(r,next));
 await store.makeBatch({operationId:stamp().id,id,name:'Lunch',preparedOn:'2026-11-25',sourceRecipeId:r.id,cookedYieldGrams:100,ingredients});
 const stored=await store.batches.get(id);
 expect(stored?.ingredients[0]).toMatchObject({source:'pantry',ingredientId:b.id,nutrition:{calories:88}});
 await saveFamily({...f,inUseIds:[]});
 await restoreAll(await exportAll());expect(await store.batches.get(id)).toEqual(stored);
 expect((await recipes.get(r.id))?.lines[0]).toEqual(line);
});
it.each(Array.from({length:15},(_,i)=>i+2))('imports Backup %i with an empty family table',async version=>{
 const old=await exportAll();old.version=version;delete old.tables.ingredientFamilies;
 await restoreAll(old);expect(await db.ingredientFamilies.count()).toBe(0);
});
it('schema 7 to 8 adds one empty table and preserves every previous table byte-for-byte',async()=>{
 await db.open();const name='family-upgrade-'+crypto.randomUUID(),old=new Dexie(name);
 old.version(7).stores(Object.fromEntries(db.tables.filter(t=>t.name!=='ingredientFamilies').map(t=>[t.name,[t.schema.primKey.src,...t.schema.indexes.map(i=>i.src)].join(',')])));
 const rows=new Map();for(const t of old.tables){const row=t.name==='settings'?{key:'language',value:'en'}:{...stamp(),name:'Original',lines:[],snapshot:{protein:7.123456}};await t.put(row);rows.set(t.name,row)}
 old.close();const upgraded=new LumiDB(name);
 try{await upgraded.open();expect(upgraded.verno).toBe(8);expect(await upgraded.ingredientFamilies.count()).toBe(0);
 for(const [table,row] of rows)expect(await upgraded.table(table).get(row.id??row.key)).toEqual(row);
 }finally{await upgraded.delete()}
});

it('keeps a session’s resolved Family replacement checked across a Pantry correction and restore',async()=>{
 const {a,b,f,r,line,c}=await setup();
 const chosen=familySnapshot(line,userChoice(a),c,'en');
 const started=await openCookingSession(r,true,{baseline:r,servings:1,lines:[chosen]});
 const replacement={...chosen,ingredientId:b.id,name:b.name,nutrition:{calories:88,protein:8,carbs:5,fat:3}};
 const replaced=replaceCookingIngredient(started,line.lineId,replacement);
 const adjusted=setCookingQuantity(replaced,line.lineId,125,'g');
 await saveCookingSession(started,{...adjusted,checked:[line.lineId]});
 await db.ingredients.update(b.id,{calories:55});
 await saveFamily({...f,inUseIds:[a.id]});
 await restoreAll(await exportAll());
 const session=await openCookingSession(r);
 expect(session.checked).toContain(line.lineId);
 const effective=livePreparation(effectiveCookingRecipe(r,session).lines,await db.ingredients.toArray(),{});
 expect(effective[0]).toMatchObject({lineId:line.lineId,ingredientId:b.id,quantity:125,unit:'g',nutrition:{calories:68.75}});
 expect((await recipes.get(r.id))?.lines).toEqual([line]);
});

it('round-trips independent Family tags in Backup 18 and removes deleted assignments',async()=>{
 const {a,f,r}=await setup();
 const {saveIngredientTag,deleteIngredientTag}=await import('./ingredient-tags');
 const {familyTagPrefix,readFamilyTags}=await import('./family-tags');
 const tag=await saveIngredientTag('Breakfast'),dairy='betterlumi:ingredient-tag:dairy-eggs';
 const read=async()=>readFamilyTags((await db.settings.get(familyTagPrefix+f.id))?.value??'[]');
 await saveFamily(f,[dairy,tag.id]);
 expect((await db.ingredients.get(a.id))?.tagIds).toBeUndefined();
 await db.ingredients.update(a.id,{tagIds:[tag.id]});
 const backup=await exportAll();expect(backup.version).toBe(20);
 await restoreAll({...JSON.parse(JSON.stringify(backup)),version:18});expect(await read()).toEqual([dairy,tag.id]);
 const current=(await db.ingredientFamilies.get(f.id))!;
 await saveFamily({...current,inUseIds:[]});expect(await read()).toEqual([dairy,tag.id]);
 await deleteIngredientTag(tag);expect(await read()).toEqual([dairy]);
 expect((await db.ingredients.get(a.id))?.tagIds).toEqual([]);
 await softDelete(recipes,r.id);await deleteFamily((await db.ingredientFamilies.get(f.id))!);
 expect(await db.settings.get(familyTagPrefix+f.id)).toBeUndefined();
});
