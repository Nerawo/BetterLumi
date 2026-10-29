import type {Nutrition} from './domain';
export const AI_MEAL_FORMAT='betterlumi-meal';
export const AI_MEAL_VERSION=1;
export const aiMealTypes=['breakfast','lunch','dinner','snack'] as const;
export type AIMealType=typeof aiMealTypes[number];
export interface AIConsumedPortion {name:string;amount:number|null;unit:string;weightG:number|null;nutrition:Nutrition;estimated:boolean}
/** Components never contain their own suggestions, dates or original-serving fractions. */
export type AISplitSuggestion=AIConsumedPortion;
export interface AIMealItem extends AIConsumedPortion {date:string|null;mealType:AIMealType|null;consumedFraction:number|null;notes:string|null;splitSuggestions:AISplitSuggestion[]}
export interface AIMealGroup {date:string|null;mealType:AIMealType|null;items:AIMealItem[]}
export interface AIMealDocument {format:typeof AI_MEAL_FORMAT;version:typeof AI_MEAL_VERSION;meals:AIMealGroup[]}
/** A deterministic path identifies a draft row; it is never a persistent meal ID. */
export interface ParsedAIMealItem extends AIMealItem {path:string}
export type AIWarningCode='missing-nutrition'|'zero-amount'|'zero-weight'|'zero-fraction'|'zero-nutrition'|'duplicate-looking';
export interface AIMealWarning {code:AIWarningCode;path:string;relatedPath?:string}
export interface AIMealTotals {nutrition:Nutrition;knownNutrition:Nutrition;missing:Record<keyof Nutrition,number>}
export interface ParsedAIMealResponse {document:AIMealDocument;items:ParsedAIMealItem[];totals:AIMealTotals;warnings:AIMealWarning[]}
