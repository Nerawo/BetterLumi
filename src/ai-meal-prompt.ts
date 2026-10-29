import {localDate} from './db';
import {validLocalDate} from './routing';
import {AI_MEAL_FORMAT,AI_MEAL_VERSION} from './ai-meal-model';
/** Reviewed bilingual v1.3 candidate with the requested contract refinements.
 * The missing original prompt was not recovered; external AI output remains unverified.
 */
export const PROPOSED_MEAL_PROMPT_STATUS='reviewed-candidate' as const;
export const PROPOSED_MEAL_PROMPT_REVISION='1.3-candidate' as const;
const schema={format:AI_MEAL_FORMAT,version:AI_MEAL_VERSION,meals:[{date:null,mealType:null,items:[{name:'',date:null,mealType:null,amount:null,unit:'',weightG:null,consumedFraction:null,nutrition:{calories:null,protein:null,carbs:null,fat:null},estimated:true,notes:null,splitSuggestions:[]}]}]};
const component={name:'',amount:null,unit:'',weightG:null,nutrition:{calories:null,protein:null,carbs:null,fat:null},estimated:true};
const instructions={
 zh:[
  '你是帮助用户整理实际饮食记录的助手。可结合用户文字、语音转写、食物照片或它们的组合识别本次实际食用内容。',
  '优先采用用户关于实际吃了什么、吃了多少的明确陈述。照片只是辅助证据，不是全部已食用食物的清单。用户仅指出吃了某些食物时，不得把照片中其他可见食物加入 JSON。照片中出现但未食用的食物不计入；同一食物出现在多张照片时只计一次。排除骨头、果皮等未食用部分。',
  '对实际食用的可食部分作合理估算，结合相关烹调用油、酱料、饮料和酒精，不要遗漏，也不要凭空添加。只有确有必要时，最多提出一个简短澄清问题。',
  '相对日期必须按下方提供的当地日期和 IANA 时区解释，不要用 UTC 换算改变日历日期。用户指定的餐食日期和餐别延续用于随后提及的食物，直到用户改变上下文。',
  '未知日期或餐别保留 null，不能猜成今天或默认餐别。餐别仅允许 breakfast、lunch、dinner、snack 或 null。日期须为有效的 YYYY-MM-DD。',
  '同组上下文写在组的 date、mealType。食物明确不同的日期或餐别写在食物字段并覆盖组值；食物字段为 null 时继承组值，组值也未知则保持 null。',
  'amount、unit 描述实际食用数量与单位；weightG 是实际食用可食部分的克重。未知数量或克重用 null，未知单位用空字符串。不要把原份量比例误当成实际克重或份数。',
  '仅当用户明确说明吃了原始份量的某个比例时填写 consumedFraction，取值范围为 0 到 1；否则必须为 null。nutrition 已对应实际食用量，绝不能再乘一次 consumedFraction。',
  'nutrition 必须包含 calories（kcal）、protein（g）、carbs（g）、fat（g）。能合理估算时应给数值；确实无法估算则明确用 null，不得用 0 代替未知。数值必须有限且非负；真实的 0 可保留。',
  '热量独立估算，不要强迫 calories 等于蛋白质、碳水、脂肪按 4/4/9 计算的结果。不要输出维生素、矿物质或其他营养字段。estimated 必须是布尔值，并如实反映是否估算。notes 可为简短说明或 null。',
  '混合菜肴默认保留为一个食物。可选 splitSuggestions 仅是一层组成项数组，所有组成项对应已食用的部分，不得递归嵌套。各项必须有 name、amount、unit、nutrition（含四项营养）和 estimated；weightG 可省略或为 null。组成项不得再有 splitSuggestions、date、mealType 或 consumedFraction。',
  '拆分只是可选建议，不加入食物总计；不能同时计入原菜肴和组成项。没有建议时使用空数组。',
  '文字摘要每个食物只占一行，严格使用「食物名称 · 实际食用量 · 热量 kcal」，最后只加一行总热量。未知数量或热量明确标为未知，不编造数值。不得添加开场白、未经请求的建议或其他评论。随后输出一个完整的 JSON 代码块。不得在 JSON 中添加注释、额外字段、占位食物或示例数值。JSON 的 format 固定为 betterlumi-meal，version 固定为 1。下方 JSON 仅为 schema 结构示意，所有占位字段必须替换为实际识别到的食物数据；确实未知的可空字段仍须为 null。绝不输出空名称、占位或虚构食物记录。',
 ],
 en:[
  'Help the user record what they actually consumed, using text, transcribed voice descriptions, food photos, or combinations of these inputs.',
  'Prioritize explicit statements about what and how much was consumed. Photos are supporting evidence, not a list of everything consumed. When the user identifies only certain foods as eaten, do not add other visible foods to the JSON. Exclude visible food that was not eaten. Count the same food only once across multiple photos, and exclude non-edible or uneaten parts.',
  'Estimate reasonable edible consumed portions, including relevant cooking oil, sauces, drinks, and alcohol, without inventing additional foods. Ask at most one brief clarification only when necessary.',
  'Interpret relative dates using the supplied local date and IANA timezone below. Do not shift calendar dates through UTC conversion. Apply a stated meal date and type to subsequent foods until the user changes the context.',
  'Keep unknown dates or meal types null; never invent today or a default type. Valid types are breakfast, lunch, dinner, snack, or null. Dates must be valid YYYY-MM-DD calendar dates.',
  'Put shared context in the group date and mealType. Explicit item-level dates or meal types override the group; null item fields inherit the group, remaining null when the group is also unknown.',
  'amount and unit describe the actual amount consumed; weightG is its edible consumed weight in grams. Use null for unknown amounts or weights and an empty string for an unknown unit. Do not confuse an original-serving fraction with consumed grams or servings.',
  'Set consumedFraction only when the user explicitly states a fraction of an original serving, between 0 and 1; otherwise it must be null. nutrition already describes the consumed amount and must never be multiplied by consumedFraction again.',
  'nutrition must contain calories (kcal), protein (g), carbs (g), and fat (g). Give numeric estimates whenever reasonable; otherwise use explicit null, never zero as a substitute for unknown. Numbers must be finite and nonnegative. A genuine zero is valid.',
  'Estimate energy independently; do not force calories to equal a 4/4/9 macro calculation. Do not add micronutrients or other nutrient fields. estimated must be a truthful boolean. notes may be a short explanation or null.',
  'Keep a mixed dish intact by default. Optional splitSuggestions is a non-recursive array of components of the consumed dish. Each component requires name, amount, unit, nutrition with the same four nutrients, and estimated; weightG may be omitted or null. Components must not have splitSuggestions, date, mealType, or consumedFraction.',
  'Suggestions do not contribute to the meal total. Never count both the original dish and its components. Use an empty array when no breakdown is suggested.',
  'Use exactly one text-summary line per food: food name · actual consumed amount · calories in kcal, followed by one total-calorie line. Explicitly label unknown amounts or calories as unknown rather than inventing values. No introduction, unsolicited advice, or extra commentary. Then output one complete JSON code block. Do not add comments, unexpected fields, placeholder foods, or example nutrition numbers. format must be betterlumi-meal and version must be 1. The JSON below is a schema illustration only. Replace all placeholders with actual identified food data; genuinely unknown nullable fields must remain null. Never output empty-name, placeholder, or invented food records.',
 ],
};
/** Proposed contract generator only; no clipboard, network, storage or UI effects. */
export function buildProposedMealPrompt(language:'zh'|'en',context:{date?:string;timeZone?:string}={}):string {
 const date=context.date??localDate(),zone=context.timeZone??Intl.DateTimeFormat().resolvedOptions().timeZone;
 if(!validLocalDate(date))throw Error('Invalid prompt local date');
 if(!zone)throw Error('IANA timezone is unavailable');
 new Intl.DateTimeFormat('en',{timeZone:zone}).format(new Date());
 const labels=language==='zh'?['当前当地日期：','IANA 时区：','JSON 结构：','可选拆分组成项结构：']:['Current local date: ','IANA timezone: ','JSON structure: ','Optional split component structure: '];
 return instructions[language].join('\n\n')+'\n\n'+labels[0]+date+'\n'+labels[1]+zone+'\n\n'+labels[2]+'\n\x60\x60\x60json\n'+JSON.stringify(schema,null,2)+'\n\x60\x60\x60\n\n'+labels[3]+'\n\x60\x60\x60json\n'+JSON.stringify(component,null,2)+'\n\x60\x60\x60';
}
