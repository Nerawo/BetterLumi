import type {Recipe} from './domain';
import type {PantrySort} from './PantrySortMenu';
import {recipeListNutrition} from './recipe-list-nutrition';
/** Presentation only. Unknown energy stays last in either direction. */
export function sortRecipes(items:readonly Recipe[],sort:PantrySort,language:string):Recipe[]{
 const direction=sort.endsWith('desc')?-1:1;
 return items.map(recipe=>({recipe,calories:recipeListNutrition(recipe).nutrition.calories})).sort((a,b)=>{
  if(sort.startsWith('calories')){
   if(a.calories===null&&b.calories!==null)return 1;
   if(b.calories===null&&a.calories!==null)return -1;
   if(a.calories!==null&&b.calories!==null){const delta=(a.calories-b.calories)*direction;if(delta)return delta;}
  }
  const names=a.recipe.name.localeCompare(b.recipe.name,language,{numeric:true,sensitivity:'base'});
  return names*(sort.startsWith('name')?direction:1)||a.recipe.id.localeCompare(b.recipe.id,'en');
 }).map(row=>row.recipe);
}
