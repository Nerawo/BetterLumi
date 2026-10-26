import i18n from './locale';
const en={
 macroScheme:'Nutrition Plan',macroBalanced:'Balanced',macroHighProtein:'High Protein',macroAbout:'Plan details',
 macroBalancedDescription:'Protein is based on body weight, fat provides about 30% of daily calories, and the remaining energy goes to carbohydrate. A balanced everyday reference for general adults.',
 macroHighProteinDescription:'Protein increases to about 1.6 g/kg/day, with fat at about 30% of calories and carbohydrate using the remainder. For people seeking more protein or doing regular strength training.',
 macroCaution:'Some nutrient proportions are outside general adult reference ranges',macroProportion:'{{nutrient}}: {{percent}}% of calories (reference {{min}}–{{max}}%).',
 macroNeedInputs:'Complete body data and a valid calorie estimate to preview nutrient targets.',
 macroCannotAllocate:'This calorie estimate cannot accommodate this allocation. Only eligible calorie goals will apply; existing nutrient targets stay unchanged.',
 macroManualMode:'No automatic macro targets in professional-guidance mode. Set your own protein, carbohydrate and fat targets in Personal Goals.',
 macroReferenceTitle:'Macronutrient targets',
 macroReferenceText:'BetterLumi estimates protein from body weight and allocates about 30% of daily calories to fat, with the remainder going to carbohydrate. Balanced uses about 1.4 g/kg/day of protein; High Protein uses about 1.6 g/kg/day.',
 macroReferenceAmdr:'Adult AMDR references: carbohydrate 45–65%, fat 20–35%, protein 10–35% of total calories. These are general adult planning references, not individualized medical or nutrition prescriptions.',
};
const zh:Record<keyof typeof en,string>={
 macroScheme:'营养方案',macroBalanced:'均衡方案',macroHighProtein:'高蛋白方案',macroAbout:'方案说明',
 macroBalancedDescription:'以体重计算蛋白质需求，脂肪约占每日热量的 30%，其余热量分配给碳水化合物。适合作为一般成人的日常均衡参考。',
 macroHighProteinDescription:'将蛋白质提高至约 1.6 g/kg/day，脂肪维持约 30% 热量，其余分配给碳水化合物。适合希望提高蛋白质摄入或进行规律力量训练的用户。',
 macroCaution:'部分营养比例超出一般成人参考范围',macroProportion:'{{nutrient}}：{{percent}}% 热量（参考 {{min}}–{{max}}%）。',
 macroNeedInputs:'填写身体数据并获得有效热量估算后，可预览宏量营养目标。',
 macroCannotAllocate:'当前热量无法分配此宏量方案。应用时仅更新符合条件的热量目标，现有宏量目标保持不变。',
 macroManualMode:'专业指导模式不自动分配宏量营养素。可在个人目标中手动设置蛋白质、碳水与脂肪目标。',
 macroReferenceTitle:'宏量营养目标',
 macroReferenceText:'BetterLumi 的默认均衡方案以体重估算蛋白质目标，并将约 30% 的每日热量分配给脂肪，其余热量分配给碳水化合物。均衡方案使用约 1.4 g/kg/day 蛋白质；高蛋白方案使用约 1.6 g/kg/day。',
 macroReferenceAmdr:'成人宏量营养素比例同时参考 National Academies 的 AMDR：碳水化合物 45–65%、脂肪 20–35%、蛋白质 10–35% 总热量。这些数值用于一般成人的规划参考，并非个体化医疗或营养处方。',
};
i18n.addResourceBundle('en','translation',en,true,true);i18n.addResourceBundle('zh','translation',zh,true,true);
