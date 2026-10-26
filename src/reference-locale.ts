import i18n from './locale';
const en={
 customExerciseName:'Custom exercise name',customExercisePlaceholder:'e.g. climbing, yoga, rowing machine',
 exerciseSnapshotWeight:'Weight used for saved estimate: {{weight}} kg',exerciseSnapshotFallback:'Saved estimate used a 70 kg reference weight',
 exerciseEnterDuration:'Enter duration to estimate calories',exerciseEditManually:'Edit manually',exerciseCalculationDetails:'Calculation details',exerciseFinalKcal:'Saved calories',exerciseFormula:'kcal = MET × 3.5 × weight (kg) ÷ 200 × minutes',exerciseEstimateUnavailable:'Enter a valid duration and wait for weight data to load before saving the estimate.',exerciseSavedEstimate:'Saved estimate (unchanged)',exerciseReferenceSearch:'Search built-in exercises',exerciseIntensity:'Intensity / type',exerciseEstimate:'Estimated burn',exerciseFallback:'No weight recorded; estimated using 70 kg',exerciseWeightHint:'Recording body weight improves this estimate.',exerciseRecordedWeight:'Estimated using current weight {{weight}} kg',exerciseManual:'Manually adjusted',exerciseRestore:'Restore automatic estimate',exerciseEstimateExplanation:'MET (metabolic equivalent) estimates activity energy expenditure. Built-in values come from the 2024 Adult Compendium of Physical Activities. Actual expenditure varies with fitness, effort and environment.',
 referenceMyFood:'My Food',referenceLegacyRelease:'April 2018 data',referencePublished:'FDC publication',referenceRetrieved:'Retrieved',
 referenceBuiltIn:'BetterLumi Built-in',referenceSource:'Reference source',referenceSourceName:'Source',referenceDataType:'Data type',referenceRelease:'Release',referenceDescription:'Description',referenceSourceLink:'View source',referenceNdb:'NDB number',referenceFdc:'FDC snapshot ID',referenceActivityCode:'Activity code',referencePreset:'Exercise',referenceCustomExercise:'Custom exercise',
 referenceFoodSourceTitle:'Data source',referenceFoodRelease:'April 2026 data',referenceFoodPortion:'General reference values per 100 g edible portion.',referenceFoodVariation:'Actual nutrition may vary by variety, brand, origin, ripeness, and preparation.',referenceFoodSourceLink:'View USDA source ↗',
};
const zh:Record<keyof typeof en,string>={
 customExerciseName:'自定义运动名称',customExercisePlaceholder:'例如：攀岩、瑜伽、划船机',
 exerciseEnterDuration:'填写时长后自动估算',exerciseSnapshotWeight:'原估算使用体重 {{weight}} kg',exerciseSnapshotFallback:'原估算使用参考体重 70 kg',
 exerciseEditManually:'手动修改',exerciseCalculationDetails:'计算详情',exerciseFinalKcal:'最终消耗热量',exerciseFormula:'kcal = MET × 3.5 × 体重（kg）÷ 200 × 分钟',
 exerciseEstimateUnavailable:'请填写有效时长，并等待体重数据加载后再保存估算。',exerciseSavedEstimate:'已保存估算（保持不变）',exerciseReferenceSearch:'搜索内置运动',exerciseIntensity:'强度／类型',exerciseEstimate:'预计消耗',exerciseFallback:'暂无体重记录，暂按 70 kg 粗略估算',exerciseWeightHint:'记录体重可改善估算。',exerciseRecordedWeight:'按当前体重 {{weight}} kg 估算',exerciseManual:'已手动调整',exerciseRestore:'恢复自动估算',exerciseEstimateExplanation:'MET（代谢当量）用于估算活动能量消耗。内置数据来自 2024 Adult Compendium of Physical Activities。实际消耗会因个人体能、动作强度和环境等因素有所不同。',
 referenceMyFood:'我的食材',referenceLegacyRelease:'2018 年 4 月数据',referencePublished:'FDC 发布',referenceRetrieved:'检索日期',
 referenceBuiltIn:'BetterLumi 内置',referenceSource:'参考来源',referenceSourceName:'来源',referenceDataType:'数据类型',referenceRelease:'版本',referenceDescription:'说明',referenceSourceLink:'查看来源',referenceNdb:'NDB 编号',referenceFdc:'FDC 快照编号',referenceActivityCode:'活动代码',referencePreset:'运动选择',referenceCustomExercise:'自定义运动',
 referenceFoodSourceTitle:'数据来源',referenceFoodRelease:'2026 年 4 月数据',referenceFoodPortion:'每 100 g 可食部分的通用参考值。',referenceFoodVariation:'不同品种、品牌、产地、成熟度与烹饪方式可能产生不同的实际营养值。',referenceFoodSourceLink:'查看 USDA 来源 ↗',
};
i18n.addResourceBundle('en','translation',en,true,true);i18n.addResourceBundle('zh','translation',zh,true,true);
