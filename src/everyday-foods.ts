/** Display/discovery metadata only. USDA records, IDs and nutrition stay untouched. */
type FoodIdentity={nameZh:string;nameEn:string;fdcIdSnapshot?:string};
export const everydayFoodNames:Readonly<Record<string,readonly [string,string]>>={
 '1750341':['苹果','Apple'], '1999634':['番茄','Tomato'],
 '746773':['梨','Pear'], '746771':['橙子','Orange'], '2710832':['橘子','Mandarin'],
 '173033':['葡萄柚','Grapefruit'], '167746':['柠檬','Lemon'], '168155':['青柠','Lime'],
 '2346412':['葡萄','Grapes'], '2346410':['覆盆子','Raspberries'], '173946':['黑莓','Blackberries'],
 '2346399':['樱桃','Cherries'], '325430':['桃','Peach'], '327357':['油桃','Nectarine'],
 '2710837':['李子','Plum'], '2710815':['杏','Apricot'], '2710833':['芒果','Mango'],
 '2346398':['菠萝','Pineapple'], '2710831':['猕猴桃','Kiwifruit'], '167765':['西瓜','Watermelon'],
 '746770':['网纹甜瓜','Cantaloupe'], '2710816':['蜜露甜瓜','Honeydew melon'],
 '2710824':['牛油果','Avocado'], '169134':['石榴','Pomegranate'], '169941':['柿子','Persimmon'],
 '173021':['无花果','Fig'], '169086':['荔枝','Lychee'], '169089':['龙眼','Longan'],
 '169926':['木瓜','Papaya'], '170169':['椰肉','Coconut flesh'],
 '2685573':['花椰菜','Cauliflower'], '2346407':['卷心菜','Cabbage'], '169979':['大白菜','Napa cabbage'],
 '2685572':['小白菜','Bok choy'], '2346388':['球生菜','Iceberg lettuce'], '2346389':['罗马生菜','Romaine lettuce'],
 '323505':['羽衣甘蓝','Kale'], '1104647':['大蒜','Garlic'], '2258590':['红甜椒','Red bell pepper'],
 '170106':['红辣椒','Red chili pepper'], '2685577':['茄子','Eggplant'], '2685568':['西葫芦','Zucchini'],
 '2710823':['芦笋','Asparagus'], '2346400':['四季豆','Green beans'],
 '170419':['豌豆（生）','Green peas (raw)'], '168448':['南瓜','Pumpkin'],
 '2685570':['奶油南瓜','Butternut squash'], '2747665':['樱桃萝卜','Radish'], '168451':['白萝卜','Daikon'],
 '2685576':['甜菜根','Beetroot'], '2685575':['抱子甘蓝','Brussels sprouts'], '169246':['韭葱','Leek'],
 '170005':['小葱','Scallion'], '2710826':['甜玉米（生）','Sweet corn (raw)'],
 '169251':['白蘑菇','White mushrooms'], '169242':['鲜香菇','Fresh shiitake'],
 '168580':['平菇','Oyster mushrooms'], '169382':['金针菇','Enoki mushrooms'],
 '2646170':['鸡胸肉（生，去皮）','Chicken breast (raw, skinless)'],
 '171477':['鸡胸肉（熟，去皮）','Chicken breast (cooked, skinless)'],
 '2646171':['鸡腿肉（生，去皮）','Chicken thigh (raw, skinless)'],
 '172385':['鸡腿肉（生，带皮）','Chicken thigh (raw, skin-on)'],
 '172388':['鸡腿肉（烤熟，去皮）','Chicken thigh (roasted, skinless)'],
 '173625':['鸡腿肉（烤熟，带皮）','Chicken thigh (roasted, skin-on)'],
 '170826':['牛小排（生）','Beef short ribs (raw)'],
 '171796':['牛肉末（生，85% 瘦）','Ground beef (raw, 85% lean)'],
 '2514743':['牛肉末（生，90% 瘦）','Ground beef (raw, 90% lean)'],
 '2514744':['牛肉末（生，80% 瘦）','Ground beef (raw, 80% lean)'],
 '174031':['牛肉饼（烤熟，90% 瘦）','Beef patty (broiled, 90% lean)'],
 '168250':['猪里脊（烤熟）','Pork tenderloin (roasted)'],
 '167812':['五花肉（生）','Pork belly (raw)'],
 '171510':['鸭胸肉（烤熟，带皮）','Duck breast (roasted, skin-on)'],
 '171113':['鸭腿肉（炖熟，去皮）','Duck leg (braised, skinless)'],
 '2684441':['三文鱼（生）','Salmon (raw)'], '175168':['三文鱼（熟）','Salmon (cooked)'],
 '2684444':['鳕鱼（生）','Cod (raw)'], '171956':['鳕鱼（熟）','Cod (cooked)'],
 '2684442':['罗非鱼（生）','Tilapia (raw)'], '2684443':['虾（生）','Shrimp (raw)'],
 '175180':['虾（熟）','Shrimp (cooked)'],
 '175142':['海鲈（生）','Sea bass (raw)'], '173694':['海鲈（熟）','Sea bass (cooked)'],
 '173717':['虹鳟（生）','Rainbow trout (raw)'], '173718':['虹鳟（熟）','Rainbow trout (cooked)'],
 '175119':['鲭鱼（生）','Mackerel (raw)'], '175120':['鲭鱼（熟）','Mackerel (cooked)'],
 '174220':['扇贝（生）','Scallops (raw)'], '174219':['牡蛎（生）','Oyster (raw)'],
 '174250':['牡蛎（熟）','Oyster (cooked)'], '174214':['蛤蜊（生）','Clams (raw)'],
 '171975':['蛤蜊（熟）','Clams (cooked)'], '174216':['贻贝（生）','Mussels (raw)'],
 '174217':['贻贝（熟）','Mussels (cooked)'], '174223':['鱿鱼（生）','Squid (raw)'],
 '174218':['章鱼（生）','Octopus (raw)'], '174249':['章鱼（熟）','Octopus (cooked)'],
 '174208':['龙虾肉（生）','Lobster meat (raw)'], '174209':['龙虾肉（熟）','Lobster meat (cooked)'],
 '2512381':['大米','White rice (dry)'], '168878':['米饭','White rice (cooked)'],
 '2512380':['糙米','Brown rice (dry)'], '169704':['糙米饭','Brown rice (cooked)'],
 '168883':['糯米','Glutinous rice (dry)'], '169711':['糯米饭','Glutinous rice (cooked)'],
 '169702':['小米','Millet (dry)'], '168871':['小米饭','Millet (cooked)'],
 '168874':['藜麦','Quinoa (dry)'], '168917':['熟藜麦','Quinoa (cooked)'],
 '170093':['土豆（烤熟）','Potato (baked)'], '170028':['土豆（生）','Potato (raw)'],
 '168483':['红薯（烤熟）','Sweet potato (baked)'], '2346404':['红薯（生）','Sweet potato (raw)'],
 '169308':['芋头（生）','Taro (raw)'],
};

/** Only near-equivalent grain-length variants share a browsing representative.
 * Retained cooked long-grain has the familiar existing ID and verified cup unit;
 * dry long-grain is the existing 大米 alias. No nutrient averages are created.
 */
export const everydayFoodGroups=[
 {representative:'2512381',variants:['169760','168931']},
 {representative:'168878',variants:['168930','168932']},
] as const;
export const everydaySearchAliases:Readonly<Record<string,readonly string[]>>={
 '168878':['rice','cooked rice','steamed rice'], '2512381':['dry rice','raw rice'],
};
const variantQueries:Readonly<Record<string,readonly string[]>>={
 '169760':['中粒','medium grain','medium-grain'], '168930':['中粒','medium grain','medium-grain'],
 '168931':['短粒','short grain','short-grain'], '168932':['短粒','short grain','short-grain'],
};
export const everydayFoodName=(food:FoodIdentity,language:string)=>
 everydayFoodNames[food.fdcIdSnapshot??'']?.[language.startsWith('zh')?0:1]??(language.startsWith('zh')?food.nameZh:food.nameEn);
export const normalizedFoodQuery=(text:string)=>text.normalize('NFKC').trim().toLowerCase().replace(/[-‐‑]/g,' ');
export function visibleEverydayFood(food:FoodIdentity,query:string){
 const terms=variantQueries[food.fdcIdSnapshot??''];
 return !terms||terms.some(term=>normalizedFoodQuery(query).includes(term));
}
