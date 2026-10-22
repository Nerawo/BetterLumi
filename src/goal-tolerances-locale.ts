import i18n from './locale';
const en={
 saveGoals:'Save Goals',goalEditConflict:'Goals changed elsewhere. Reload the editor before saving.',
 goalLimitDates:'Limit dates',goalNoDateLimit:'No date limits',goalExerciseDuration:'Duration',goalExerciseBurned:'Calories burned',
 goalTooltipCalorieTitle:'Calorie Goal',goalTooltipMacroTitle:'Macronutrient Goals',
 goalTooltipExplanation:'The acceptable range is automatically calculated around the value you enter.',
 goalTooltipCalorieTolerance:'Default tolerance: ±{{value}} kcal',goalTooltipMacroTolerances:'Default tolerances:',
 goalTooltipMacroValue:'{{metric}}: ±{{value}} g',goalTooltipProtein:'Protein',goalTooltipCarbs:'Carbohydrates',goalTooltipFat:'Fat',
 goalTooltipCalorieFooter:'You can change this in More → Goal Tolerance Settings.',
 goalTooltipMacroFooter:'You can change these in More → Goal Tolerance Settings.',goalTolerancePurpose:'These ranges are for goal tracking, not medical safety thresholds.',goalTolerances:'Goal Tolerances',goalTarget:'Target',goalAcceptableRange:'Acceptable range',goalToleranceInfo:'About {{metric}}',goalToleranceExplanation:'Configured tolerance: ±{{value}} {{unit}}. This range is for goal tracking, not a medical safety threshold.',goalToleranceTiming:'Changes apply from today to target-based goals. Earlier dates and saved historical ranges stay unchanged.',goalToleranceLegacy:'Saved range: {{range}} {{unit}}. Saving creates a new target-based version; history is preserved.',goalRestoreDefaults:'Restore Defaults',goalRestoreConfirm:'Restore default tolerances?',goalRestoreDescription:'Use ±50 kcal, ±10 g protein, ±15 g carbohydrates and ±5 g fat from today. Saved goal versions remain unchanged.',goalToleranceRequired:'Enter a nonnegative target for each enabled nutrient.',goalToleranceInvalid:'Enter a nonnegative value for every tolerance.',goalTolerancePlusMinus:'Plus/minus tolerance',goalToleranceHistorical:'Saved goal ranges remain unchanged.'};
const zh:Record<keyof typeof en,string>={
 saveGoals:'保存目标',goalEditConflict:'目标已在其他位置修改，请重新打开编辑器后保存。',
 goalLimitDates:'限定日期',goalNoDateLimit:'不限日期',goalExerciseDuration:'运动时长',goalExerciseBurned:'运动消耗',
 goalTooltipCalorieTitle:'热量目标',goalTooltipMacroTitle:'营养素目标',
 goalTooltipExplanation:'以填写的数值为中心，自动计算允许范围。',
 goalTooltipCalorieTolerance:'默认偏差：±{{value}} kcal',goalTooltipMacroTolerances:'默认偏差：',
 goalTooltipMacroValue:'{{metric}}：±{{value}} g',goalTooltipProtein:'蛋白质',goalTooltipCarbs:'碳水化合物',goalTooltipFat:'脂肪',
 goalTooltipCalorieFooter:'可在「更多 → 目标偏差设置」中修改。',
 goalTooltipMacroFooter:'可在「更多 → 目标偏差设置」中修改。',goalTolerancePurpose:'这些范围仅用于目标追踪，不是医疗安全阈值。',goalTolerances:'目标允许偏差',goalTarget:'目标值',goalAcceptableRange:'允许范围',goalToleranceInfo:'查看{{metric}}说明',goalToleranceExplanation:'当前允许偏差：±{{value}} {{unit}}。此范围仅用于目标追踪，不是医疗安全阈值。',goalToleranceTiming:'调整从今天起用于目标值模式的目标；此前日期和已保存的历史范围保持不变。',goalToleranceLegacy:'已保存范围：{{range}} {{unit}}。保存将创建新的目标值版本，历史记录不变。',goalRestoreDefaults:'恢复默认值',goalRestoreConfirm:'恢复默认允许偏差？',goalRestoreDescription:'从今天起使用热量 ±50 kcal、蛋白质 ±10 g、碳水 ±15 g、脂肪 ±5 g。已保存的目标版本保持不变。',goalToleranceRequired:'请为每个启用的营养素填写非负目标值。',goalToleranceInvalid:'请为每项允许偏差填写非负数值。',goalTolerancePlusMinus:'正负允许偏差',goalToleranceHistorical:'已保存的历史目标范围保持不变。'};
i18n.addResourceBundle('en','translation',en,true,true);i18n.addResourceBundle('zh','translation',zh,true,true);
