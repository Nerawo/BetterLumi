import {describe,it,expect} from 'vitest';
import {todayMacroBound,todayMacroRange} from './today-macro-format';
describe('Today adaptive macro target labels',()=>{
 it.each([[74,'74'],[94.5,'94.5'],[99.8,'99.8'],[99.94,'99.9'],[99.96,'100'],[100,'100'],[100.04,'100'],[108.2,'108'],[138.2,'138'],[123.9,'124'],[34.5,'34.5']])('formats %s as %s',(input,output)=>expect(todayMacroBound(input as number)).toBe(output));
 it('formats each bound independently and retains one-sided/equal/empty ranges',()=>{expect(todayMacroRange(74,94)).toBe('74–94');expect(todayMacroRange(108.2,138.2)).toBe('108–138');expect(todayMacroRange(34.5,44.5)).toBe('34.5–44.5');expect(todayMacroRange(99.8,123.9)).toBe('99.8–124');expect(todayMacroRange(null,123.9)).toBe('≤ 124');expect(todayMacroRange(94.5,null)).toBe('≥ 94.5');expect(todayMacroRange(100,100)).toBe('100');expect(todayMacroRange(null,null)).toBe('')});
});
