import 'fake-indexeddb/auto';
import {afterEach,expect,it} from 'vitest';
import {builtInFoods} from './data/builtInFoods';
import {ingredientTagOptions} from './data/builtInTags';
import {everydayFoodGroups,everydayFoodNames,visibleEverydayFood} from './everyday-foods';
import {builtInFoodLine,referenceName,searchFoodChoices} from './reference-library';
import {sortPantryFoods} from './pantry-foods';
import {builtInHouseholdUnits} from './household-units';
import {availableUnits,saveIngredientPreference,preferredFoodUnit,personalNutrition,ingredientPreferenceRows} from './ingredient-preferences';
import {db,stamp,exportAll,restoreAll,recipes,foodLogs} from './domain';
const tags=ingredientTagOptions([],'en');
const food=(fdc:string)=>builtInFoods.find(f=>f.fdcIdSnapshot===fdc)!;
const results=(q:string)=>searchFoodChoices([],q,'',tags);
afterEach(async()=>{for(const table of db.tables)await table.clear()});

it.each([
 ['梨','Pear','746773'],['苹果','Apple','1750341'],['芒果','Mango','2710833'],
 ['牛油果','Avocado','2710824'],['草莓','Strawberry','2346409'],['菠萝','Pineapple','2346398'],
 ['李子','Plum','2710837'],['大米','White rice (dry)','2512381'],['米饭','White rice (cooked)','168878'],
 ['糙米','Brown rice (dry)','2512380'],['糙米饭','Brown rice (cooked)','169704'],
 ['小米','Millet (dry)','169702'],['小米饭','Millet (cooked)','168871'],
 ['藜麦','Quinoa (dry)','168874'],['熟藜麦','Quinoa (cooked)','168917'],
])('offers concise %s / %s names and predictable generic search',(zh,en,fdc)=>{
 const f=food(fdc);expect(referenceName(f,'zh-CN')).toBe(zh);expect(referenceName(f,'en')).toBe(en);
 for(const q of [zh,en]){expect(results(q)[0].item.id).toBe(f.id);expect(sortPantryFoods(results(q),'name-asc','zh',q)[0].item.id).toBe(f.id)}
});
it.each([['Bartlett','746773'],['巴特利特','746773'],['Gala','1750341'],['Tommy Atkins','2710833'],['汤米阿特金斯','2710833'],['Hass','2710824'],['中粒','169760'],['中粒白米饭','168930'],['medium grain','168930'],['short-grain','168932'],['短粒白米','168931']])('retains explicit cultivar / grain search %s',(q,fdc)=>{expect(results(q).some(r=>r.item.id===food(fdc).id)).toBe(true)});
it('groups only two white-rice preparations and never deletes their variants',()=>{
 expect(everydayFoodGroups).toHaveLength(2);expect(builtInFoods).toHaveLength(206);expect(results('')).toHaveLength(202);
 for(const g of everydayFoodGroups){expect(visibleEverydayFood(food(g.representative),'')).toBe(true);for(const id of g.variants){expect(food(id)).toBeDefined();expect(visibleEverydayFood(food(id),'rice')).toBe(false);expect(results('米饭').some(r=>r.item.id===food(id).id)).toBe(false)}}
 const labels=results('').map(r=>referenceName(r.item as typeof builtInFoods[number],'zh'));
 expect(new Set(labels).size).toBe(labels.length);expect(labels.filter(name=>name==='梨')).toHaveLength(1);expect(results('芒果')).toHaveLength(1);
 expect(results('rice')[0].item.id).toBe(food('168878').id);expect(results('dry rice')[0].item.id).toBe(food('2512381').id);
 expect(results('rice').some(r=>r.item.id===food('2512381').id)).toBe(true);expect(results('rice').some(r=>r.item.id===food('168878').id)).toBe(true);
});
it('retains meaningful preparation, skin, fat, species and food distinctions',()=>{
 expect(results('鸡腿肉').map(r=>r.kind==='built-in'?r.item.fdcIdSnapshot:null)).toEqual(['2646171','172385','172388','173625']);
 for(const id of ['2646171','172388'])expect(referenceName(food(id),'zh')).toContain('去皮');
 for(const id of ['172385','173625'])expect(referenceName(food(id),'zh')).toContain('带皮');
 for(const id of ['171796','2514743','2514744'])expect(referenceName(food(id),'en')).toMatch(/(80|85|90)% lean/);
 expect(referenceName(food('2646170'),'zh')).toContain('生');expect(referenceName(food('171477'),'zh')).toContain('熟');
 expect(referenceName(food('169569'),'zh')).toContain('瘦肉');expect(referenceName(food('168665'),'zh')).toContain('炖熟');
 expect(referenceName(food('175159'),'zh')).toContain('黄鳍');expect(referenceName(food('171969'),'zh')).toContain('雪蟹');
 expect(referenceName(food('170071'),'zh')).toBe('薯蓣（生）');expect(referenceName(food('170685'),'zh')).toContain('烘焙');
});
it('changes only presentation and keeps exact USDA identities, nutrients, aliases and all 104 source units',()=>{
 const before=structuredClone(builtInFoods),units=builtInFoods.map(f=>structuredClone(builtInHouseholdUnits(f.id)));
 for(const id of Object.keys(everydayFoodNames))expect(food(id)).toBeDefined();
 for(const f of builtInFoods){referenceName(f,'zh');referenceName(f,'en');results(f.nameZh);results(f.nameEn);expect(builtInFoodLine(f,100,'zh').ingredientId).toBe(f.id)}
 expect(builtInFoods).toEqual(before);expect(new Set(builtInFoods.map(f=>f.id)).size).toBe(206);
 expect(builtInFoods.map(f=>builtInHouseholdUnits(f.id))).toEqual(units);expect(units.flat()).toHaveLength(104);
 expect(food('2710833').usdaDescription).toMatch(/tommy atkins/i);
});
it('keeps hidden variants resolvable with their custom units, archives, defaults and historical snapshots through Backup 9',async()=>{
 const f=food('168930'),choice={kind:'built-in' as const,item:f},official=builtInHouseholdUnits(f.id)[0];expect(official).toBeDefined();
 const pref={version:1 as const,units:[{quantity:1,name:'bowl',amount:177,unit:'g' as const}],preferred:official.name,archived:true};
 await saveIngredientPreference(choice,pref);const line={...builtInFoodLine(f,27.5,'en'),name:f.nameEn};
 const recipe={...stamp(),name:'Historical medium-grain recipe',servings:1,lines:[line],instructions:'Keep',stickyNote:''};
 const log={...stamp(),date:'2020-01-01',category:'lunch',name:f.nameEn,source:'pantry' as const,sourceId:f.id,quantity:27.5,unit:'g',nutrition:line.nutrition,baseNutrition:line.nutrition,lines:[],cookingNote:''};
 await recipes.put(recipe);await foodLogs.put(log);const before=await exportAll();results('rice');results('中粒');referenceName(f,'zh');
 expect(preferredFoodUnit(choice,pref)).toBe(official.name);expect(availableUnits(choice,pref)).toContainEqual(pref.units[0]);
 expect(personalNutrition(choice,1,'bowl',pref).calories).toBeCloseTo(f.kcalPer100g!*1.77,12);
 expect((await exportAll()).tables).toEqual(before.tables);await restoreAll(before);
 expect(await recipes.get(recipe.id)).toEqual(recipe);expect(await foodLogs.get(log.id)).toEqual(log);
 expect(ingredientPreferenceRows(await db.settings.toArray())[f.id]).toEqual(pref);expect(before.version).toBe(11);expect(db.verno).toBe(7);expect(db.name).toBe('BetterLumi');
});
