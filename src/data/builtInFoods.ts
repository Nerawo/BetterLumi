export interface FoodReferenceSource {
 readonly sourceName:string;
 readonly sourceDataType:string;
 readonly ndbNumber:string|null;
 readonly fdcIdSnapshot?:string;
 readonly sourceRelease:string;
 readonly sourceDescription:string;
 readonly sourceUrl:string;
 readonly sourceRetrievedAt?:string;
 readonly sourcePublishedAt?:string;
}
export interface BuiltInFood extends FoodReferenceSource {
 readonly id:`builtin-${string}`|`betterlumi:food:${string}`;
 readonly nameZh:string;
 readonly nameEn:string;
 readonly category:string;
 readonly tagIds:readonly string[];
 readonly preparationState:string;
 readonly preparationStateZh:string;
 readonly preparationStateEn:string;
 readonly usdaDescription:string;
 readonly kcalPer100g:number|null;
 readonly proteinPer100g:number|null;
 readonly carbsPer100g:number|null;
 readonly fatPer100g:number|null;
}
const source = {
 sourceName:'USDA FoodData Central',
 sourceDataType:'Foundation Foods',
 sourceRelease:'April 2026',
 sourceDescription:'USDA FoodData Central Foundation Foods reference value per 100 g edible portion.',
} as const;
const legacySource={
 sourceDataType:'SR Legacy',
 sourceRelease:'April 2018',
 sourceDescription:'USDA FoodData Central SR Legacy reference value per 100 g edible portion.',
 sourceRetrievedAt:'2026-10-22',
 sourcePublishedAt:'2019-04-01',
} as const;

/** Phase 2A supplied references and Phase 2B verified USDA SR Legacy records.
 * Never seeded into the personal database.
 * Preserve source precision; energy is the supplied USDA value, not a 4/4/9 calculation.
 */
export const builtInFoods:readonly BuiltInFood[]=Object.freeze([
 {id:'builtin-broccoli-raw',nameZh:'西兰花',nameEn:'Broccoli',preparationStateZh:'生',preparationStateEn:'Raw',category:'vegetables',usdaDescription:'Broccoli, raw',ndbNumber:'11090',fdcIdSnapshot:'747447',kcalPer100g:31,proteinPer100g:2.57,carbsPer100g:6.27,fatPer100g:0.34},
 {id:'builtin-carrot-raw',nameZh:'胡萝卜',nameEn:'Carrot',preparationStateZh:'生',preparationStateEn:'Raw',category:'vegetables',usdaDescription:'Carrots, mature, raw',ndbNumber:'11124',fdcIdSnapshot:'2258586',kcalPer100g:44.979,proteinPer100g:0.941,carbsPer100g:10.3,fatPer100g:0.351},
 {id:'builtin-spinach-raw',nameZh:'菠菜',nameEn:'Spinach',preparationStateZh:'生',preparationStateEn:'Raw',category:'vegetables',usdaDescription:'Spinach, mature',ndbNumber:'11457',fdcIdSnapshot:'1999633',kcalPer100g:21.6,proteinPer100g:2.91,carbsPer100g:2.64,fatPer100g:0.604},
 {id:'builtin-roma-tomato-raw',nameZh:'罗马番茄',nameEn:'Roma Tomato',preparationStateZh:'生',preparationStateEn:'Raw',category:'vegetables',usdaDescription:'Tomato, roma',ndbNumber:'100261',fdcIdSnapshot:'1999634',kcalPer100g:19,proteinPer100g:0.696,carbsPer100g:3.84,fatPer100g:0.425},
 {id:'builtin-cucumber-raw',nameZh:'黄瓜',nameEn:'Cucumber',preparationStateZh:'带皮，生',preparationStateEn:'With peel, raw',category:'vegetables',usdaDescription:'Cucumber, with peel, raw',ndbNumber:'11205',fdcIdSnapshot:'2346406',kcalPer100g:13.935,proteinPer100g:0.625,carbsPer100g:2.953,fatPer100g:0.178},
 {id:'builtin-banana-raw',nameZh:'香蕉',nameEn:'Banana',preparationStateZh:'成熟，生',preparationStateEn:'Ripe, raw',category:'fruits',usdaDescription:'Bananas, ripe and slightly ripe, raw',ndbNumber:'9040',fdcIdSnapshot:'1105314',kcalPer100g:97,proteinPer100g:0.74,carbsPer100g:23,fatPer100g:0.29},
 {id:'builtin-gala-apple-raw',nameZh:'Gala 苹果',nameEn:'Gala Apple',preparationStateZh:'带皮，生',preparationStateEn:'With skin, raw',category:'fruits',usdaDescription:'Apples, gala, with skin, raw',ndbNumber:'9503',fdcIdSnapshot:'1750341',kcalPer100g:54.867,proteinPer100g:0.133,carbsPer100g:14.768,fatPer100g:0.15},
 {id:'builtin-strawberry-raw',nameZh:'草莓',nameEn:'Strawberry',preparationStateZh:'生',preparationStateEn:'Raw',category:'fruits',usdaDescription:'Strawberries, raw',ndbNumber:'9316',fdcIdSnapshot:'2346409',kcalPer100g:32.666,proteinPer100g:0.641,carbsPer100g:7.964,fatPer100g:0.22},
 {id:'builtin-blueberry-raw',nameZh:'蓝莓',nameEn:'Blueberry',preparationStateZh:'生',preparationStateEn:'Raw',category:'fruits',usdaDescription:'Blueberries, raw',ndbNumber:'9050',fdcIdSnapshot:'2346411',kcalPer100g:57.385,proteinPer100g:0.703,carbsPer100g:14.572,fatPer100g:0.306},
 {id:'builtin-whole-egg',nameZh:'鸡蛋',nameEn:'Egg',preparationStateZh:'整蛋',preparationStateEn:'Whole egg',category:'dairyEggs',usdaDescription:'Eggs, Grade A, Large, egg whole',ndbNumber:'1123',fdcIdSnapshot:'748967',kcalPer100g:148,proteinPer100g:12.4,carbsPer100g:0.96,fatPer100g:9.96},
 {id:'builtin-whole-milk',nameZh:'全脂牛奶',nameEn:'Whole Milk',preparationStateZh:'3.25% 乳脂',preparationStateEn:'3.25% milkfat',category:'dairyEggs',usdaDescription:'Milk, whole, 3.25% milkfat, with added vitamin D',ndbNumber:'1077',fdcIdSnapshot:'746782',kcalPer100g:60,proteinPer100g:3.27,carbsPer100g:4.63,fatPer100g:3.2},
 {id:'builtin-greek-yogurt-whole-plain',nameZh:'原味全脂希腊酸奶',nameEn:'Plain Whole-Milk Greek Yogurt',preparationStateZh:'原味，全脂',preparationStateEn:'Plain, whole milk',category:'dairyEggs',usdaDescription:'Yogurt, Greek, plain, whole milk',ndbNumber:'1293',fdcIdSnapshot:'2259794',kcalPer100g:94.5071,proteinPer100g:8.78,carbsPer100g:4.754,fatPer100g:4.39},
 { ...legacySource,id:'builtin-chicken-breast-roasted',nameZh:'鸡胸肉',nameEn:'Chicken Breast',preparationStateZh:'烤熟 · 去皮，仅肉',preparationStateEn:'Roasted · skinless, meat only',category:'meat',usdaDescription:'Chicken, broilers or fryers, breast, meat only, cooked, roasted',ndbNumber:'5064',fdcIdSnapshot:'171477',kcalPer100g:165,proteinPer100g:31.02,carbsPer100g:0,fatPer100g:3.57},
 { ...legacySource,id:'builtin-ground-beef-90-lean-broiled',nameZh:'90% 瘦牛肉末',nameEn:'90% Lean Ground Beef',preparationStateZh:'熟 · 烤制肉饼，90% 瘦肉 / 10% 脂肪',preparationStateEn:'Cooked · broiled patty, 90% lean / 10% fat',category:'meat',usdaDescription:'Beef, ground, 90% lean meat / 10% fat, patty, cooked, broiled',ndbNumber:'23563',fdcIdSnapshot:'174031',kcalPer100g:217,proteinPer100g:26.11,carbsPer100g:0,fatPer100g:11.75},
 { ...legacySource,id:'builtin-pork-tenderloin-roasted',nameZh:'猪里脊肉',nameEn:'Pork Tenderloin',preparationStateZh:'烤熟 · 可分离瘦肉',preparationStateEn:'Roasted · separable lean only',category:'meat',usdaDescription:'Pork, fresh, loin, tenderloin, separable lean only, cooked, roasted',ndbNumber:'10061',fdcIdSnapshot:'168250',kcalPer100g:143,proteinPer100g:26.17,carbsPer100g:0,fatPer100g:3.51},
 { ...legacySource,id:'builtin-atlantic-salmon-farmed-cooked',nameZh:'大西洋三文鱼（养殖）',nameEn:'Atlantic Salmon (farmed)',preparationStateZh:'熟 · 干热烹调，养殖',preparationStateEn:'Cooked · dry heat, farmed',category:'seafood',usdaDescription:'Fish, salmon, Atlantic, farmed, cooked, dry heat',ndbNumber:'15237',fdcIdSnapshot:'175168',kcalPer100g:206,proteinPer100g:22.1,carbsPer100g:0,fatPer100g:12.35},
 { ...legacySource,id:'builtin-shrimp-cooked',nameZh:'虾',nameEn:'Shrimp',preparationStateZh:'熟 · 原味，可食部分',preparationStateEn:'Cooked · plain, edible portion',category:'seafood',usdaDescription:'Crustaceans, shrimp, cooked',ndbNumber:'15271',fdcIdSnapshot:'175180',kcalPer100g:99,proteinPer100g:23.98,carbsPer100g:0.2,fatPer100g:0.28},
 { ...legacySource,id:'builtin-white-rice-cooked',nameZh:'白米饭',nameEn:'White Rice',preparationStateZh:'熟 · 长粒白米，强化',preparationStateEn:'Cooked · long-grain, enriched',category:'grains-staples',usdaDescription:'Rice, white, long-grain, regular, enriched, cooked',ndbNumber:'20045',fdcIdSnapshot:'168878',kcalPer100g:130,proteinPer100g:2.69,carbsPer100g:28.17,fatPer100g:0.28},
 { ...legacySource,id:'builtin-oats-dry',nameZh:'燕麦',nameEn:'Oats',preparationStateZh:'干重 · 普通或快熟，未强化',preparationStateEn:'Dry · regular or quick, unfortified',category:'grains-staples',usdaDescription:'Cereals, oats, regular and quick, not fortified, dry',ndbNumber:'8120',fdcIdSnapshot:'173904',kcalPer100g:379,proteinPer100g:13.15,carbsPer100g:67.7,fatPer100g:6.52},
 { ...legacySource,id:'builtin-potato-baked',nameZh:'土豆',nameEn:'Potato',preparationStateZh:'烤熟 · 带皮，无盐',preparationStateEn:'Baked · flesh and skin, without salt',category:'grains-staples',usdaDescription:'Potatoes, baked, flesh and skin, without salt',ndbNumber:'11674',fdcIdSnapshot:'170093',kcalPer100g:93,proteinPer100g:2.5,carbsPer100g:21.15,fatPer100g:0.13},
 { ...legacySource,id:'builtin-sweet-potato-baked',nameZh:'红薯',nameEn:'Sweet Potato',preparationStateZh:'带皮烤熟，仅薯肉 · 无盐',preparationStateEn:'Baked in skin, flesh only · without salt',category:'grains-staples',usdaDescription:'Sweet potato, cooked, baked in skin, flesh, without salt',ndbNumber:'11508',fdcIdSnapshot:'168483',kcalPer100g:90,proteinPer100g:2.01,carbsPer100g:20.71,fatPer100g:0.15},
 { ...legacySource,id:'builtin-edamame-prepared',nameZh:'毛豆',nameEn:'Edamame',preparationStateZh:'制熟 · 冷冻毛豆仁，去荚可食部分',preparationStateEn:'Prepared · frozen, shelled edible beans',category:'legumes-soy',usdaDescription:'Edamame, frozen, prepared',ndbNumber:'11212',fdcIdSnapshot:'168411',kcalPer100g:121,proteinPer100g:11.91,carbsPer100g:8.91,fatPer100g:5.2},
 { ...legacySource,id:'builtin-tofu-firm-calcium-set',nameZh:'硬豆腐（硫酸钙凝固）',nameEn:'Firm Tofu (calcium-set)',preparationStateZh:'生，硬质 · 硫酸钙凝固',preparationStateEn:'Raw, firm · prepared with calcium sulfate',category:'legumes-soy',usdaDescription:'Tofu, raw, firm, prepared with calcium sulfate',ndbNumber:'16426',fdcIdSnapshot:'172475',kcalPer100g:144,proteinPer100g:17.27,carbsPer100g:2.78,fatPer100g:8.72},
 { ...legacySource,id:"builtin-pasta-dry-enriched",nameZh:"干意大利面",nameEn:"Dry Pasta",preparationStateZh:"干重 · 强化，通用意大利面",preparationStateEn:"Dry · enriched, generic pasta",category:"grains-staples",usdaDescription:"Pasta, dry, enriched",ndbNumber:"20120",fdcIdSnapshot:"169736",kcalPer100g:371,proteinPer100g:13,carbsPer100g:74.7,fatPer100g:1.51},
 { ...legacySource,id:"builtin-ground-beef-85-lean-raw",nameZh:"85% 瘦牛肉末",nameEn:"85% Lean Ground Beef",preparationStateZh:"生 · 85% 瘦肉 / 15% 脂肪",preparationStateEn:"Raw · 85% lean / 15% fat",category:"meat",usdaDescription:"Beef, ground, 85% lean meat / 15% fat, raw (Includes foods for USDA's Food Distribution Program)",ndbNumber:"23567",fdcIdSnapshot:"171796",kcalPer100g:215,proteinPer100g:18.6,carbsPer100g:0,fatPer100g:15},
 { ...legacySource,id:"builtin-pork-belly-raw",nameZh:"鲜猪五花肉",nameEn:"Fresh Pork Belly",preparationStateZh:"生 · 未腌制，鲜 pancetta 参考",preparationStateEn:"Raw · uncured, fresh pancetta reference",category:"meat",usdaDescription:"Pork, fresh, belly, raw",ndbNumber:"10005",fdcIdSnapshot:"167812",kcalPer100g:518,proteinPer100g:9.34,carbsPer100g:0,fatPer100g:53},
 { ...legacySource,id:"builtin-onion-raw",nameZh:"洋葱",nameEn:"Onion",preparationStateZh:"生",preparationStateEn:"Raw",category:"vegetables",usdaDescription:"Onions, raw",ndbNumber:"11282",fdcIdSnapshot:"170000",kcalPer100g:40,proteinPer100g:1.1,carbsPer100g:9.34,fatPer100g:0.1},
 { ...legacySource,id:"builtin-celery-raw",nameZh:"芹菜",nameEn:"Celery",preparationStateZh:"生",preparationStateEn:"Raw",category:"vegetables",usdaDescription:"Celery, raw",ndbNumber:"11143",fdcIdSnapshot:"169988",kcalPer100g:14,proteinPer100g:0.69,carbsPer100g:2.97,fatPer100g:0.17},
 { ...legacySource,id:"builtin-tomato-puree",nameZh:"番茄泥",nameEn:"Tomato Purée",preparationStateZh:"罐装 · 无添加盐，passata 参考",preparationStateEn:"Canned · no added salt, passata reference",category:"vegetables",usdaDescription:"Tomato products, canned, puree, without salt added",ndbNumber:"11547",fdcIdSnapshot:"170460",kcalPer100g:38,proteinPer100g:1.65,carbsPer100g:8.98,fatPer100g:0.21},
 { ...legacySource,id:"builtin-tomato-paste",nameZh:"浓缩番茄膏",nameEn:"Tomato Paste",preparationStateZh:"罐装 · 无添加盐，通用番茄膏",preparationStateEn:"Canned · no added salt, generic paste",category:"condiments-other",usdaDescription:"Tomato products, canned, paste, without salt added (Includes foods for USDA's Food Distribution Program)",ndbNumber:"11546",fdcIdSnapshot:"170459",kcalPer100g:82,proteinPer100g:4.32,carbsPer100g:18.9,fatPer100g:0.47},
 { ...legacySource,id:"builtin-olive-oil",nameZh:"橄榄油",nameEn:"Olive Oil",preparationStateZh:"通用烹调用油",preparationStateEn:"Generic salad or cooking oil",category:"condiments-other",usdaDescription:"Oil, olive, salad or cooking",ndbNumber:"4053",fdcIdSnapshot:"171413",kcalPer100g:884,proteinPer100g:0,carbsPer100g:0,fatPer100g:100},
 { ...legacySource,id:"builtin-red-table-wine",nameZh:"红葡萄酒",nameEn:"Red Table Wine",preparationStateZh:"餐酒 · 干红参考，烹调前",preparationStateEn:"Table wine · dry red reference, before cooking",category:"condiments-other",usdaDescription:"Alcoholic beverage, wine, table, red",ndbNumber:"14096",fdcIdSnapshot:"173190",kcalPer100g:85,proteinPer100g:0.07,carbsPer100g:2.61,fatPer100g:0},
].map(item=>Object.freeze({
 ...source,...item,id:item.id as BuiltInFood['id'],
 preparationState:item.preparationStateEn,
 tagIds:Object.freeze([`betterlumi:ingredient-tag:${item.category==='dairyEggs'?'dairy-eggs':item.category}`]),
 sourceUrl:`https://fdc.nal.usda.gov/food-search?query=${item.ndbNumber}`,
})));
