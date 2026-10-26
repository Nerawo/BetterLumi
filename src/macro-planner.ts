export type NutritionPlan='balanced'|'highProtein';
export type MacroNutrient='protein'|'carbs'|'fat';
export const adultAmdr:Record<MacroNutrient,readonly [number,number]>={protein:[10,35],carbs:[45,65],fat:[20,35]};
export interface MacroPlan {
 protein:number;carbs:number;fat:number;
 proportions:Record<MacroNutrient,number>;
 cautions:{nutrient:MacroNutrient;percent:number;min:number;max:number}[];
}
/** Preview-only arithmetic. No calorie safety decisions, rounding, clamping or writes. */
export function calculateMacroPlan(weightKg:number|null,calories:number|null,scheme:NutritionPlan='balanced'):MacroPlan|null{
 if(weightKg===null||calories===null||!Number.isFinite(weightKg)||weightKg<=0||!Number.isFinite(calories)||calories<=0||!['balanced','highProtein'].includes(scheme))return null;
 const protein=weightKg*(scheme==='highProtein'?1.6:1.4),fatCalories=calories*.3;
 const carbCalories=calories-protein*4-fatCalories;
 // Negative grams are not a usable allocation; never fabricate them by clamping.
 if(carbCalories<0)return null;
 const carbs=carbCalories/4,fat=fatCalories/9;
 if(![protein,carbs,fat].every(Number.isFinite))return null;
 const proportions={protein:protein*4/calories*100,carbs:carbCalories/calories*100,fat:fatCalories/calories*100};
 const cautions=(['protein','carbs','fat'] as const).flatMap(nutrient=>{const [min,max]=adultAmdr[nutrient],percent=proportions[nutrient];return percent<min-1e-8||percent>max+1e-8?[{nutrient,percent,min,max}]:[]});
 return {protein,carbs,fat,proportions,cautions};
}
