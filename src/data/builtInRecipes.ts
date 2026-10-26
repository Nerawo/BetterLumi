import {builtInFoods} from './builtInFoods';
import {builtInFoodLine} from '../reference-library';
import type {Recipe} from '../domain';

export const bologneseRecipeId='builtin-recipe-tagliatelle-ragu-bolognese';
export const bologneseSourceUrl='https://www.accademiaitalianadellacucina.it/sites/default/files/Rag%C3%B9%20alla%20bolognese%20-%20ricetta%20aggiornata%2020%20aprile%202023.pdf';
/** Full canonical six-serving batch. Volumes are documented USDA portion conversions. */
export const bologneseIngredients=Object.freeze(([
 ['builtin-pasta-dry-enriched',480,'干宽面','Dry tagliatelle'],
 ['builtin-ground-beef-85-lean-raw',400,'粗绞牛肉','Coarsely ground beef'],
 ['builtin-pork-belly-raw',150,'鲜猪五花肉（pancetta）','Fresh pork pancetta'],
 ['builtin-onion-raw',60,'洋葱','Onion'],['builtin-carrot-raw',60,'胡萝卜','Carrot'],['builtin-celery-raw',60,'芹菜','Celery'],
 ['builtin-tomato-puree',200,'过滤番茄泥（passata）','Strained tomatoes (passata)'],
 ['builtin-tomato-paste',16,'浓缩番茄膏','Tomato paste'],['builtin-olive-oil',40.5,'特级初榨橄榄油','Extra virgin olive oil'],
 ['builtin-red-table-wine',117.6,'干红葡萄酒','Dry red wine'],['builtin-whole-milk',124.5,'全脂牛奶','Whole milk'],
] as const).map(line=>Object.freeze(line)));
export const bologneseCookingExtras=Object.freeze([
 {nameZh:'热水或清淡高汤',nameEn:'Hot water or light broth',amountZh:'按需添加',amountEn:'As needed'},
 {nameZh:'盐、黑胡椒',nameEn:'Salt and black pepper',amountZh:'适量',amountEn:'To taste'},
].map(item=>Object.freeze(item)));
const instructions={
 zh:'1. 切碎鲜五花肉，与橄榄油一起煸出香味。加入切细的洋葱、胡萝卜和芹菜，小火炒软，不要焦黄。\n2. 转大火加入牛肉，翻炒并拨散至褐色、发出滋滋声。倒入红酒，充分收浓。\n3. 加入番茄膏和番茄泥，按需加入热水或清淡高汤。盖上锅盖，小火炖约 2–3 小时，必要时补充液体。\n4. 炖煮中途加入牛奶，继续收浓至浓稠有光泽。用盐和黑胡椒调味。\n5. 按本次份数另煮宽面，拌入肉酱后享用。',
 en:'1. Finely chop the fresh pancetta and warm it in the olive oil. Add finely chopped onion, carrot and celery; soften gently without browning.\n2. Increase the heat, add beef and stir until browned and sizzling. Add wine and let it reduce fully.\n3. Stir in tomato paste and passata. Add hot water or light broth as needed, cover and simmer gently for about 2–3 hours, replenishing liquid when necessary.\n4. Add milk halfway through. Reduce to a thick, glossy sauce and season with salt and pepper.\n5. Cook the scaled tagliatelle separately and combine with the ragù.',
};
export function isBuiltInRecipe(recipe:{id:string}){return recipe.id===bologneseRecipeId}
/** Read-only UI composition; never insert these reference recipes into recipeCards. */
export function builtInRecipeItems(language:string):Recipe[]{
 const zh=language.startsWith('zh');
 return [{id:bologneseRecipeId,name:zh?'博洛尼亚肉酱宽面':'Tagliatelle al Ragù Bolognese',servings:6,
  createdAt:'2023-04-20T00:00:00.000Z',updatedAt:'2023-04-20T00:00:00.000Z',deletedAt:null,revision:1,
  lines:bologneseIngredients.map(([id,grams,nameZh,nameEn])=>{
   const food=builtInFoods.find(food=>food.id===id);if(!food)throw Error(`Missing recipe reference: ${id}`);
   return {...builtInFoodLine(food,grams,language),name:zh?nameZh:nameEn};
  }),instructions:zh?instructions.zh:instructions.en,stickyNote:'',categoryIds:[],
  photo:import.meta.env.BASE_URL+'images/recipes/tagliatelle-ragu-bolognese.webp',
 }];
}
