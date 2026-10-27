import i18n from "./locale";
const zh = {
  consumptionUnitClearHint:"清空数量、单位名称与对应总量可移除换算；收起不会删除已填写内容。",
  consumptionUnitConversion: "食用单位换算", enableConsumptionUnit: "启用自定义食用单位", customUnitName: "自定义单位名称", equivalentAmount: "对应的总量", invalidConsumptionUnit: "请填写大于零的数量和总量、非空单位名称，并与营养参考量使用相同的 g/mL 单位。单位名称不能使用 g、mL 或 serving。",
  customNutritionReference: "自定义参考量", perReference: "每", referenceAmount: "营养参考量", servingSizeOptional: "每份大小（可选）", invalidReferenceAmount: "参考量或每份大小必须大于零。",
  ocrExplain:
    "ChatGPT 营养估算截图导入尚未实现，请手动填写并标记为估算值。食材库的包装营养标签 OCR 是独立功能，不会把聊天估算当作包装数据。",
  nameZh: "其他名称（可选）",
  basis: "营养数据基准",
  servingGrams: "每份相当于多少克（可选）",
  aliasesHelp: "可输入多个别名，用英文逗号、中文逗号或顿号分隔。",
  basisHelp: "营养数值均对应所填参考量或每份；克与毫升不会自动互换。",
  servingWeightHelp: "每份重量用于克与份之间换算；不知道就留空，不会自动猜测。",
  servingWeightImportant:
    "当前按“每份”记录：若食谱按克称量，需要填写每份克重；未知时只按份计算。",
  frontPhotoPurpose: "包装正面作为本地缩略图和核对参考。",
  labelPhotoPurpose: "营养标签作为原始参考，可在本机识别文字。",
  recognizeLabel: "识别营养标签",
  ocrLanguage: "标签语言",
  ocrEnglish: "英语标签",
  ocrChinese: "中文及英语标签",
  ocrLocalHelp:
    "仅在本机处理，不上传照片。首次识别需下载语言及引擎资源，建议联网；成功加载后可尝试离线识别。",
  ocrBusy: "正在识别 {{progress}}%",
  ocrLoading: "正在准备本地识别资源…",
  ocrCancel: "取消识别",
  ocrFailed:
    "识别失败。请检查首次资源下载的网络连接，或换一张清晰、正对标签的照片后重试。也可手动输入并保存照片。",
  ocrRetry: "重新识别",
  ocrReview: "复核标签识别结果",
  ocrBasisConflict:'基准或每份重量发生变化，以下已有手填值不能直接保留：{{fields}}。请在复核区按新基准填写，或先清空原表单相关值；不会擅自改变数值含义。',
  ocrCloseReview: "关闭复核",
  ocrReviewHelp:
    "这是未经核实的包装标签识别，不是ChatGPT估算。请逐项对照原图，未知项保持空白。确认应用后仍需手动保存食材。",
  ocrRaw: "识别原文（可编辑后重新解析）",
  ocrReparse: "重新解析文字",
  ocrApply: "确认并应用到表单",
  ocrConfirm:
    "将已识别的非空数值应用到当前表单？对应手填值将被替换，未识别项保留当前值。应用不会保存食材。",
  ocrBasisUnknown: "营养基准不明确，请对照标签选择后再应用。",
  ocrMissing: "未识别或有歧义：{{fields}}",
  ocrLowConfidence: "识别置信度较低，这些值未自动采信。请核对原图并手动填写。",
  ocrConfidence: "文字置信度 {{value}}%",
  ocrBasisChoice: "请选择并确认营养基准",
  ocrReviewedSource: "包装标签 · OCR复核字段",
  ocrSourceManual: "手动录入",
  ocrNoValues: "没有可靠的营养数值可应用，请核对原文或手动填写。",
  ocrPhotoRequired: "请先选择营养标签照片。",
  ocrPer100ml:
    "识别到每100毫升，不能当作每100克。请选择按份记录或手动核实，不会假设密度。",
  ocrMultiColumns: "识别到多个营养基准列，未自动选取。请对照原图手动录入。",
  takePhoto: "拍摄照片",
  replacePhoto: "选择／替换照片",
  ringFood: "外环：已记录饮食",
  ringExercise: "内环：已记录运动",
  ringNeutral: "鼠尾草色：有记录，无适用目标",
  ringUnknown: "虚线：必要数值未记录或未知",
  ringFoodValue: "摄入 {{value}} kcal",
  ringExerciseValue: "时长 {{minutes}} 分钟，消耗 {{kcal}} kcal",
  consumptionPercent: "实际食用比例（%）",
  consumptionHelp:
    "100%表示全部，允许超过100%；只调整本次餐食的营养，不会改写食谱。",
  progressBurnedUnknown: "运动消耗热量未记录",
};
const en: Record<keyof typeof zh, string> = {
  consumptionUnitClearHint:"Clear quantity, unit name and total amount to remove the conversion. Collapsing keeps your entries.",
  consumptionUnitConversion: "Consumption Unit Conversion", enableConsumptionUnit: "Enable custom consumption unit", customUnitName: "Custom unit name", equivalentAmount: "Equivalent total amount", invalidConsumptionUnit: "Enter positive quantities, a unit name and the same g/mL unit as the nutrition reference. The name cannot be g, mL or serving.",
  customNutritionReference: "Custom reference", perReference: "Per", referenceAmount: "Nutrition reference amount", servingSizeOptional: "Serving size (optional)", invalidReferenceAmount: "Reference amount or serving size must be greater than zero.",
  ocrExplain:
    "ChatGPT nutrition-estimate screenshot import is not implemented. Enter the values manually and mark them as estimated. Pantry packaging-label OCR is separate and does not treat chat estimates as package data.",
  nameZh: "Other names (optional)",
  basis: "Nutrition Basis",
  servingGrams: "Grams per Serving (optional)",
  aliasesHelp:
    "Separate alternative names with commas, Chinese commas or enumeration commas.",
  basisHelp:
    "Nutrition values refer to the entered reference amount or one serving. Grams and mL are not interchangeable.",
  servingWeightHelp:
    "Serving weight converts grams and servings. Leave it blank when unknown; no conversion is guessed.",
  servingWeightImportant:
    "Per serving: enter the serving weight if recipes will use grams. Otherwise only serving-based amounts can be calculated.",
  frontPhotoPurpose:
    "Packaging front stays local as a thumbnail and reference.",
  labelPhotoPurpose:
    "The original label stays local for reference and on-device text recognition.",
  recognizeLabel: "Recognize nutrition label",
  ocrLanguage: "Label language",
  ocrEnglish: "English label",
  ocrChinese: "Chinese and English label",
  ocrLocalHelp:
    "Processed on your device; photos are not uploaded. The first recognition loads engine and language assets and needs connectivity. After a successful load, offline recognition can be attempted.",
  ocrBusy: "Recognizing {{progress}}%",
  ocrLoading: "Preparing on-device recognition…",
  ocrCancel: "Cancel recognition",
  ocrFailed:
    "Recognition failed. Check connectivity for the first asset load, or retry with a clear, straight-on label photo. Manual entry and reference photos still work.",
  ocrRetry: "Recognize again",
  ocrReview: "Review label recognition",
  ocrBasisConflict:'The basis or serving weight changed. Existing manual values need review: {{fields}}. Enter them using the new basis in the review, or clear those original form fields first. Their meaning will not be changed silently.',
  ocrCloseReview: "Close review",
  ocrReviewHelp:
    "Unverified package-label OCR, not a ChatGPT estimate. Compare every field with the image; leave unknown fields blank. Applying does not save the ingredient.",
  ocrRaw: "Recognized text (edit and reparse)",
  ocrReparse: "Reparse text",
  ocrApply: "Confirm & apply to form",
  ocrConfirm:
    "Apply recognized non-empty values to this form? Matching manual values will be replaced; unrecognized values stay unchanged. This does not save the ingredient.",
  ocrBasisUnknown:
    "The nutrition basis is ambiguous. Verify it on the label before applying.",
  ocrMissing: "Unrecognized or ambiguous: {{fields}}",
  ocrLowConfidence:
    "Text confidence is low; these values were not accepted automatically. Check the image and enter values manually.",
  ocrConfidence: "Text confidence: {{value}}%",
  ocrBasisChoice: "Choose and confirm the nutrition basis",
  ocrReviewedSource: "Package label · OCR-reviewed fields",
  ocrSourceManual: "Manual entry",
  ocrNoValues:
    "No reliable nutrition values to apply. Check the source text or enter them manually.",
  ocrPhotoRequired: "Choose a nutrition-label photo first.",
  ocrPer100ml:
    "Per 100 mL is not per 100 g. Review as a serving or enter manually; density is never assumed.",
  ocrMultiColumns:
    "Multiple nutrition-basis columns detected; no column was selected. Verify and enter values manually.",
  takePhoto: "Take photo",
  replacePhoto: "Choose / replace photo",
  ringFood: "Outer ring: logged food",
  ringExercise: "Inner ring: logged exercise",
  ringNeutral: "Sage: recorded, no applicable goal",
  ringUnknown: "Dashed: required value missing or unknown",
  ringFoodValue: "Intake: {{value}} kcal",
  ringExerciseValue: "Duration: {{minutes}} min; burned: {{kcal}} kcal",
  consumptionPercent: "Amount consumed (%)",
  consumptionHelp:
    "100% means all; values over 100% are allowed. Scales this meal’s nutrition without changing the recipe.",
  progressBurnedUnknown: "Exercise calories unrecorded",
};
i18n.addResourceBundle("zh", "translation", zh, true, true);
i18n.addResourceBundle("en", "translation", en, true, true);
