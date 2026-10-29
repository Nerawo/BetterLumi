import 'fake-indexeddb/auto';
import {it,expect,afterEach} from 'vitest';
import provenanceJson from '../docs/data/recipe-bolognese-usda-records.json?raw';
import {builtInFoods} from './data/builtInFoods';
import {builtInRecipeItems,bologneseIngredients,bologneseRecipeId} from './data/builtInRecipes';
import {recipeServingNutrition,recipeServingLines,wholeRecipeNutrition,recipeYield} from './recipe-nutrition';
import {db,recipes,foodLogs,stamp,exportAll,restoreAll} from './domain';
const provenance=JSON.parse(provenanceJson) as {records:{fdcId:number;ndbNumber:string;description:string;dataType:string;nutrients:{id:number;amount:number}[];portions:{amount:number;unit:string;modifier:string;gramWeight:number}[]}[]};
afterEach(async()=>{for(const table of db.tables)await table.clear()});
it.each(provenance.records.filter(r=>r.fdcId!==746782))('matches verified official USDA archive record $fdcId exactly',record=>{
 const food=builtInFoods.find(f=>f.fdcIdSnapshot===String(record.fdcId))!;expect(food).toBeDefined();expect(food.ndbNumber).toBe(record.ndbNumber);expect(food.usdaDescription).toBe(record.description);expect(food.sourceDataType).toBe(record.dataType);
 expect([food.kcalPer100g,food.proteinPer100g,food.carbsPer100g,food.fatPer100g]).toEqual([1008,1003,1005,1004].map(id=>record.nutrients.find(n=>n.id===id)!.amount));expect(new URL(food.sourceUrl).hostname).toBe('fdc.nal.usda.gov');
});
it('uses documented tablespoon/cup gram conversions, retaining existing Foundation milk nutrients',()=>{
 const portion=(id:number,unit:string)=>provenance.records.find(r=>r.fdcId===id)!.portions.find(p=>p.modifier===unit||p.unit===unit)!.gramWeight;
 expect(portion(170459,'tbsp')).toBe(16);expect(portion(171413,'tablespoon')*3).toBe(40.5);expect(portion(173190,'fl oz')*4).toBe(117.6);expect(portion(746782,'cup')/2).toBe(124.5);expect(builtInFoods.find(f=>f.id==='builtin-whole-milk')?.kcalPer100g).toBe(60);
});
it('defines one bilingual recipe of six canonical servings and no invented final totals',()=>{
 const zh=builtInRecipeItems('zh'),en=builtInRecipeItems('en');expect(zh).toHaveLength(1);expect(zh[0].id).toBe(bologneseRecipeId);expect(zh[0].name).toBe('博洛尼亚肉酱宽面');expect(en[0].name).toBe('Tagliatelle al Ragù Bolognese');expect(recipeYield(zh[0])).toBe(6);expect(zh[0].lines).toHaveLength(11);
 const total=wholeRecipeNutrition(zh[0].lines);for(const key of ['calories','protein','carbs','fat'] as const){const referenceKey={calories:'kcalPer100g',protein:'proteinPer100g',carbs:'carbsPer100g',fat:'fatPer100g'} as const;const expected=bologneseIngredients.reduce((sum,[id,g])=>sum+builtInFoods.find(f=>f.id===id)![referenceKey[key]]!*g/100,0);expect(total[key]).toBeCloseTo(expected,10);expect(recipeServingNutrition(zh[0])[key]).toBeCloseTo(expected/6,10)}
 for(const amount of [.5,1,3,6])expect(recipeServingLines(zh[0],amount)[0].quantity).toBe(80*amount);expect(zh[0].photo).toMatch(/images\/recipes\/tagliatelle-ragu-bolognese.webp$/);
});
it('never seeds references; cooking and logging keep user records and historical snapshots intact across backup',async()=>{
 const old={...stamp(),name:'Synthetic old recipe',lines:[],instructions:'Keep',stickyNote:''};await recipes.put(old as never);const log={...stamp(),date:'2020-02-02',name:'Synthetic meal',category:'lunch',source:'recipe' as const,sourceId:bologneseRecipeId,quantity:1,unit:'serving',nutrition:{calories:123,protein:4,carbs:null,fat:2},lines:[],cookingNote:'Keep'};await foodLogs.put(log);
 const before=await exportAll();for(const language of ['zh','en']){const reference=builtInRecipeItems(language)[0];recipeServingLines(reference,3);recipeServingNutrition(reference,.5)}expect((await exportAll()).tables).toEqual(before.tables);expect(await db.ingredients.count()).toBe(0);expect(await recipes.count()).toBe(1);expect(db.verno).toBe(7);expect(before.version).toBe(10);
 await restoreAll(before);expect(await recipes.get(old.id)).toEqual(old);expect(await foodLogs.get(log.id)).toEqual(log);expect(recipeYield((await recipes.get(old.id))!)).toBe(1);
});
