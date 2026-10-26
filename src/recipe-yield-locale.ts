import i18n from './locale';
const en={recipeYield:'Recipe yield',recipeYieldUnit:'servings',recipeYieldHelp:'Ingredient quantities describe the full recipe.',recipePerServing:'Per serving',recipeCookingServings:'Cooking this time',recipeCookingTotal:'Prepared batch',recipeConsumedServings:'How much did you eat?',recipeCanonicalYield:'Full recipe: {{count}} servings'};
const zh:Record<keyof typeof en,string>={recipeYield:'这份配方可以做几份？',recipeYieldUnit:'份',recipeYieldHelp:'食材用量为完整配方的用量。',recipePerServing:'每份营养',recipeCookingServings:'本次制作',recipeCookingTotal:'本次共计',recipeConsumedServings:'吃了多少？',recipeCanonicalYield:'完整配方：{{count}} 份'};
i18n.addResourceBundle('en','translation',en,true,true);i18n.addResourceBundle('zh','translation',zh,true,true);
