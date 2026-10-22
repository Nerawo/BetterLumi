import {describe,it,expect} from 'vitest';
import {formatLocalDate} from './dates';
describe('local date presentation',()=>{
 it('formats both languages at local noon without shifting the stored date',()=>{
  const value='2026-10-18';
  expect(['full','month','short','weekday'].map(style=>formatLocalDate(value,'zh',style as 'full'))).toEqual(['2026年10月18日','2026年10月','10月18日','周日']);
  expect(['full','month','short','weekday'].map(style=>formatLocalDate(value,'en',style as 'full'))).toEqual(['Oct 18, 2026','October 2026','Oct 18','Sun']);
  expect(formatLocalDate('2026-03-08','en')).toBe('Mar 8, 2026');expect(formatLocalDate('','zh')).toBe('');
 });
});
