import type {PantryItem,Recipe} from './domain';
import {searchFoodChoices,referenceName,type FoodChoice} from './reference-library';
import {everydaySearchAliases} from './everyday-foods';
import {builtInRecipeItems} from './data/builtInRecipes';
import {availableUnits,baseUnit,foodUnitLabel,personalNutrition,type IngredientPreference} from './ingredient-preferences';
import {recipeServingNutrition} from './recipe-nutrition';
import {canonicalAIMealUnit,type AIMealBaseline,type AIMealPortion} from './ai-meal-state';
import {validateAIMealNutrition} from './ai-meal-parser';

export interface AIMealCatalog {ingredients:PantryItem[];recipes:Recipe[];preferences:Record<string,IngredientPreference>}
export interface AIMealMatch {kind:'pantry'|'recipe';id:string;name:string;rank:0|1|2;reason:'exact-name'|'exact-alias'|'suggestion'}
const normalized=(s:string)=>s.normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ');
function rank(query:string,names:string[],aliases:string[]):0|1|2 {return names.some(name=>normalized(name)===query)?0:aliases.some(name=>normalized(name)===query)?1:2}
function pantryNames(choice:FoodChoice) {return choice.kind==='built-in'?[referenceName(choice.item,'zh'),referenceName(choice.item,'en')]:[choice.item.name,choice.item.nameZh]}
function pantryAliases(choice:FoodChoice) {return choice.kind==='built-in'?[choice.item.nameZh,choice.item.nameEn,...(choice.item.aliases??[]),...(everydaySearchAliases[choice.item.fdcIdSnapshot??'']??[])]:choice.item.aliases??[]}
const reasons=['exact-name','exact-alias','suggestion'] as const;
function recipes(catalog:AIMealCatalog,language:'zh'|'en') {
 const rows=[...catalog.recipes.filter(row=>!row.deletedAt),...builtInRecipeItems(language)];
 return [...new Map(rows.map(row=>[row.id,row])).values()];
}
/** Read-only candidates. Ambiguous matches always require a choice, including Pantry/Recipe ties. */
export function matchAIMealFood(name:string,catalog:AIMealCatalog,language:'zh'|'en'):{candidates:AIMealMatch[];automatic:AIMealMatch|null} {
 const query=normalized(name);if(!query)return {candidates:[],automatic:null};
 const active=catalog.ingredients.filter(item=>!item.deletedAt);
 const found:FoodChoice[]=[...searchFoodChoices(active,query,'',[]),...active.filter(item=>[item.name,item.nameZh,...(item.aliases??[])].some(value=>normalized(value).includes(query))).map(item=>({kind:'user' as const,item}))];
 const foods=[...new Map(found.map(choice=>[choice.kind+':'+choice.item.id,choice])).values()].filter(choice=>!catalog.preferences[choice.item.id]?.archived);
 const candidates:AIMealMatch[]=foods.map(choice=>{const r=rank(query,pantryNames(choice),pantryAliases(choice));return {kind:'pantry',id:choice.item.id,name:choice.kind==='built-in'?referenceName(choice.item,language):choice.item.name,rank:r,reason:reasons[r]}});
 const builtInOtherLanguage=builtInRecipeItems(language==='zh'?'en':'zh');
 for(const recipe of recipes(catalog,language)){
  const aliases=builtInOtherLanguage.filter(r=>r.id===recipe.id).map(r=>r.name);
  if(![recipe.name,...aliases].some(value=>normalized(value).includes(query)))continue;
  const r=rank(query,[recipe.name],aliases);candidates.push({kind:'recipe',id:recipe.id,name:recipe.name,rank:r,reason:reasons[r]});
 }
 candidates.sort((a,b)=>a.rank-b.rank||a.kind.localeCompare(b.kind)||a.id.localeCompare(b.id));
 const best=candidates.filter(c=>c.rank===candidates[0]?.rank&&c.rank<2);
 return {candidates,automatic:best.length===1?{...best[0]}:null};
}
/** Resolve actual units against current personal/official conversions without changing preferences. */
export function pantryAIMealSource(choice:FoodChoice,portion:AIMealPortion,p?:IngredientPreference):{baseline:AIMealBaseline;portion:AIMealPortion} {
 if(p?.archived||choice.kind==='user'&&choice.item.deletedAt)throw Error('Ingredient is unavailable');
 if(portion.amount===null||!Number.isFinite(portion.amount)||portion.amount<0)throw Error('Resolve consumed amount before using Pantry nutrition');
 const conversions=availableUnits(choice,p),units=[baseUnit(choice),...(choice.kind==='user'&&choice.item.basis==='serving'?['serving']:[]),...conversions.map(u=>u.name)];
 // Exact keys take precedence over translated labels, as in the existing picker.
 const exact=units.filter(unit=>unit===portion.unit);
 const matches=exact.length?exact:units.filter(unit=>[unit,foodUnitLabel(choice,unit,'zh',p),foodUnitLabel(choice,unit,'en',p)].some(label=>canonicalAIMealUnit(label)===canonicalAIMealUnit(portion.unit)));
 if(matches.length!==1)throw Error('Resolve unsupported or ambiguous ingredient unit; no density is assumed');
 const unit=matches[0],conversion=conversions.find(u=>u.name===unit);
 const grams=unit==='g'?1:conversion?.unit==='g'?conversion.amount/conversion.quantity:null;
 const nutrition=validateAIMealNutrition(personalNutrition(choice,1,unit,p));
 return {baseline:{kind:'pantry',id:choice.item.id,name:choice.kind==='built-in'?referenceName(choice.item,'en'):choice.item.name,amount:1,unit,weightG:grams,nutrition,estimated:false},portion:{amount:portion.amount,unit,weightG:grams===null?null:portion.amount*grams}};
}
export function recipeAIMealSource(recipe:Recipe,portion:AIMealPortion):{baseline:AIMealBaseline;portion:AIMealPortion} {
 if(recipe.deletedAt)throw Error('Recipe is unavailable');
 if(canonicalAIMealUnit(portion.unit)!=='serving'||portion.amount===null||!Number.isFinite(portion.amount)||portion.amount<0)throw Error('Resolve recipe servings explicitly; cooked weight is not available');
 return {baseline:{kind:'recipe',id:recipe.id,name:recipe.name,amount:1,unit:'serving',weightG:null,nutrition:validateAIMealNutrition(recipeServingNutrition(recipe,1)),estimated:false},portion:{amount:portion.amount,unit:'serving',weightG:null}};
}
