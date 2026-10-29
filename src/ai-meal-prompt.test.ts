import {afterEach,expect,it,vi} from 'vitest';
import {localDate} from './db';
import {buildProposedMealPrompt,PROPOSED_MEAL_PROMPT_STATUS,PROPOSED_MEAL_PROMPT_REVISION} from './ai-meal-prompt';
afterEach(()=>vi.useRealTimers());
it('records review of the candidate without claiming recovery of the original tested prompt',()=>{expect(PROPOSED_MEAL_PROMPT_STATUS).toBe('reviewed-candidate');expect(PROPOSED_MEAL_PROMPT_REVISION).toBe('1.3-candidate')});
it.each(['zh','en'] as const)('includes the requested local context and version-one structure without sample foods or nutrition values: %s',language=>{
 const prompt=buildProposedMealPrompt(language,{date:'2026-10-30',timeZone:'Pacific/Kiritimati'});expect(prompt).toContain('2026-10-30');expect(prompt).toContain('Pacific/Kiritimati');const blocks=[...prompt.matchAll(/```json\n([\s\S]*?)\n```/g)].map(m=>JSON.parse(m[1]));expect(blocks).toHaveLength(2);expect(blocks[0]).toMatchObject({format:'betterlumi-meal',version:1});const item=blocks[0].meals[0].items[0];expect(item.name).toBe('');expect(item.nutrition).toEqual({calories:null,protein:null,carbs:null,fat:null});expect(item.consumedFraction).toBeNull();expect(item.splitSuggestions).toEqual([]);expect(blocks[1].nutrition).toEqual(item.nutrition);expect(blocks[1]).not.toHaveProperty('splitSuggestions');
 for(const word of ['consumedFraction','splitSuggestions','4/4/9','breakfast','lunch','dinner','snack','null'])expect(prompt).toContain(word);
 expect(prompt).not.toMatch(/\b\d+(?:\.\d+)?\s*(?:kcal|千卡|克)\b/);
});
it('specifies the core recognition safeguards in both languages',()=>{
 const zh=buildProposedMealPrompt('zh'),en=buildProposedMealPrompt('en');for(const phrase of ['多张照片时只计一次','实际食用','最多提出一个简短澄清','烹调用油','酒精','不能猜成今天','绝不能再乘一次','不加入食物总计'])expect(zh).toContain(phrase);for(const phrase of ['only once across multiple photos','actual amount consumed','at most one brief clarification','cooking oil','alcohol','never invent today','never be multiplied','do not contribute to the meal total'])expect(en).toContain(phrase);
});
it('captures current local calendar date and IANA timezone dynamically',()=>{vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-10-30T00:01:00Z'));const result=buildProposedMealPrompt('zh');expect(result).toContain(localDate());expect(result).toContain(Intl.DateTimeFormat().resolvedOptions().timeZone)});
it('rejects invalid calendar context instead of silently replacing it',()=>{expect(()=>buildProposedMealPrompt('en',{date:'2026-02-30'})).toThrow(/local date/);expect(()=>buildProposedMealPrompt('zh',{timeZone:'Invalid/Timezone'})).toThrow()});

it.each(['zh','en'] as const)('requires concise summaries, user-scoped photo evidence and real schema data: %s',language=>{
 const prompt=buildProposedMealPrompt(language);
 const phrases=language==='zh'?['每个食物只占一行','食物名称 · 实际食用量 · 热量 kcal','一行总热量','不得添加开场白','未经请求的建议','照片只是辅助证据','其他可见食物加入 JSON','仅为 schema 结构示意','所有占位字段必须替换','绝不输出空名称']:['one text-summary line per food','food name · actual consumed amount · calories in kcal','one total-calorie line','No introduction, unsolicited advice, or extra commentary','Photos are supporting evidence','do not add other visible foods to the JSON','schema illustration only','Replace all placeholders','Never output empty-name'];
 for(const phrase of phrases)expect(prompt).toContain(phrase);
});
