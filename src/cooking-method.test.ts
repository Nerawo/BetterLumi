import 'fake-indexeddb/auto';
import {afterEach,expect,it} from 'vitest';
import {db,stamp,recipes,foodLogs,exportAll,restoreAll,type Recipe} from './domain';
import {COOKING_PREFIX,setCookingQuantity} from './cooking-journal';
import {openCookingSession,saveCookingSession,updateCookingMethod} from './cooking-session';
import {FoodStorage} from './food-storage';
import {storedRecipeLine} from './recipe-storage';

afterEach(async()=>{for(const table of db.tables)await table.clear()});
async function setup(instructions='Original method.\n保持原样。'){
 const storage=new FoodStorage(),id=stamp().id,milk={lineId:'milk',ingredientId:'milk',name:'Soy milk',quantity:130,unit:'mL',nutrition:{calories:70,protein:6,carbs:null,fat:0}};
 await storage.makeBatch({operationId:stamp().id,id,name:'Prepared sauce',preparedOn:'2030-01-01',cookedYieldGrams:500,ingredients:[{source:'pantry',line:{...milk,unit:'g'}}]});
 const r:Recipe={...stamp(),name:'Method only',servings:2,ingredientGroups:[{id:'filling',name:'Filling'}],lines:[{...milk,groupId:'filling'},{...storedRecipeLine((await db.foodBatches.get(id))!),groupId:'filling'}],instructions,stickyNote:'Keep note',category:'Keep category',categoryIds:[],photo:''};
 await recipes.put(r);await foodLogs.put({...stamp(),source:'quick',sourceId:null,name:'Historical meal',date:'2030-01-01',category:'dinner',quantity:1,unit:'entry',lines:[],nutrition:{calories:55,protein:2,carbs:3,fat:4},cookingNote:'Keep history'});
 let s=await openCookingSession(r);s=await saveCookingSession(s,{...s,servings:4});s=await saveCookingSession(s,{...setCookingQuantity(setCookingQuantity(s,s.entries[0].id,0,'mL'),s.entries[1].id,150.125,'g'),checked:s.entries.map(e=>e.id)});return {r,s};
}
it.each(['Original method.\n保持原样。',''])('updates only Method and revision metadata while preserving complete preparation: %j',async instructions=>{
 const {r,s}=await setup(instructions),before=await exportAll(),text=' 1. Mix gently.\n\n保持精确文字与空行。\n',next=await updateCookingMethod(r,s,text);
 expect(next.recipe).toEqual({...r,instructions:text,revision:r.revision+1,updatedAt:expect.any(String)});
 expect(next.session).toEqual({...s,recipeRevision:next.recipe.revision});expect(await recipes.get(r.id)).toEqual(next.recipe);
 expect(await openCookingSession(next.recipe)).toEqual(next.session);
 const after=await exportAll();expect(after.version).toBe(20);for(const key of Object.keys(before.tables).filter(k=>!['recipeCards','settings'].includes(k)))expect(after.tables[key]).toEqual(before.tables[key]);
 await restoreAll(JSON.parse(JSON.stringify(after)));expect(await recipes.get(r.id)).toEqual(next.recipe);expect(await openCookingSession(next.recipe)).toEqual(next.session);
});
it('keeps ambiguous repeated legacy identities, checks and exact overrides without assigning permanent IDs',async()=>{
 const {r}=await setup(),line={ingredientId:'repeated',name:'Egg',quantity:16.667,unit:'g',nutrition:{calories:70,protein:6,carbs:null,fat:0}},legacy:Recipe={...r,lines:[line,{...line}],ingredientGroups:[]};await recipes.put(legacy);
 let s=await openCookingSession(legacy,true);s=await saveCookingSession(s,{...setCookingQuantity(setCookingQuantity(s,s.entries[0].id,17.123456,'g'),s.entries[1].id,0,'g'),checked:s.entries.map(e=>e.id)});
 const next=await updateCookingMethod(legacy,s,'New method');expect(next.recipe.lines).toEqual(legacy.lines);expect(next.recipe.lines.every(l=>l.lineId===undefined)).toBe(true);expect(next.session).toEqual({...s,recipeRevision:next.recipe.revision});expect(await openCookingSession(next.recipe)).toEqual(next.session);
});
it('rolls back the Method write if the paired session revision update fails',async()=>{
 const {r,s}=await setup(),before=await exportAll(),fail=()=>{throw Error('Injected settings failure')};db.settings.hook('updating',fail);
 try{await expect(updateCookingMethod(r,s,'Never commit partially')).rejects.toThrow('Injected settings failure')}finally{db.settings.hook('updating').unsubscribe(fail)}
 expect((await exportAll()).tables).toEqual(before.tables);
});
it('rejects stale recipe or session writes without overwriting another window',async()=>{
 const {r,s}=await setup(),changed={...r,instructions:'Another window',revision:r.revision+1};await recipes.put(changed);let before=await exportAll();await expect(updateCookingMethod(r,s,'Stale method')).rejects.toThrow('Recipe changed');expect((await exportAll()).tables).toEqual(before.tables);
 await recipes.put(r);await saveCookingSession(s,{...s,checked:[]});before=await exportAll();await expect(updateCookingMethod(r,s,'Stale preparation')).rejects.toThrow('Preparation changed');expect((await exportAll()).tables).toEqual(before.tables);
});
it('rejects invalid Method and wrong recipe associations without changing records',async()=>{
 const {r,s}=await setup(),before=await exportAll();await expect(updateCookingMethod(r,s,42 as unknown as string)).rejects.toThrow();await expect(updateCookingMethod(r,{...s,recipeId:'other'},'No')).rejects.toThrow();expect((await exportAll()).tables).toEqual(before.tables);expect((await db.settings.get(COOKING_PREFIX+r.id))!.value).toBe(JSON.stringify(s));
});
