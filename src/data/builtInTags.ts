export interface BuiltInIngredientTag {
 readonly id: `betterlumi:ingredient-tag:${string}`;
 readonly nameZh: string;
 readonly nameEn: string;
}
/** Stable reference IDs, never seeded into the user's ingredientTags table. */
export const builtInTags: readonly BuiltInIngredientTag[] = Object.freeze([
 {id:'betterlumi:ingredient-tag:vegetables',nameZh:'蔬菜',nameEn:'Vegetables'},
 {id:'betterlumi:ingredient-tag:fruits',nameZh:'水果',nameEn:'Fruits'},
 {id:'betterlumi:ingredient-tag:meat',nameZh:'肉类',nameEn:'Meat'},
 {id:'betterlumi:ingredient-tag:seafood',nameZh:'海鲜',nameEn:'Seafood'},
 {id:'betterlumi:ingredient-tag:dairy-eggs',nameZh:'蛋奶',nameEn:'Dairy & Eggs'},
 {id:'betterlumi:ingredient-tag:grains-staples',nameZh:'谷物 / 主食',nameEn:'Grains & Staples'},
 {id:'betterlumi:ingredient-tag:legumes-soy',nameZh:'豆类 / 豆制品',nameEn:'Legumes & Soy'},
 {id:'betterlumi:ingredient-tag:nuts-seeds',nameZh:'坚果 / 种子',nameEn:'Nuts & Seeds'},
 {id:'betterlumi:ingredient-tag:condiments-other',nameZh:'调味 / 其他',nameEn:'Condiments & Other'},
].map(tag=>Object.freeze(tag as BuiltInIngredientTag)));
export const builtInTagIds: ReadonlySet<string> = new Set(builtInTags.map(tag=>tag.id));
export interface IngredientTagOption {id:string;name:string;builtIn?:boolean}
export function ingredientTagOptions(custom:readonly {id:string;name:string}[],language:string):IngredientTagOption[]{
 return [...builtInTags.map(tag=>({id:tag.id,name:language.startsWith('zh')?tag.nameZh:tag.nameEn,builtIn:true})),...custom.map(tag=>({id:tag.id,name:tag.name}))];
}
