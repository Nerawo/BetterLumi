/** Legacy detail fields remain serializable; the UI only needs a unified mode. */
export interface ProfessionalGuidance {
 specialOrProfessionalGuidance?:boolean;
 pregnant?:boolean;breastfeeding?:boolean;pregnancy?:boolean;lactation?:boolean;professionalDiet?:boolean;otherSpecial?:boolean;professionalKcal?:number|null;
}
type CircumstanceInput=ProfessionalGuidance&{excluded:boolean;sex?:''|'female'|'male'};
/** An explicit new choice wins, so users can switch off migrated legacy flags
 * without deleting them. With no new choice, any legacy true flag enables manual mode. */
export function specialCircumstances(value:CircumstanceInput){
 return {active:value.specialOrProfessionalGuidance??(value.excluded||value.pregnant===true||value.breastfeeding===true||value.pregnancy===true||value.lactation===true||value.professionalDiet===true||value.otherSpecial===true)};
}
export function validProfessionalGuidance(value:ProfessionalGuidance){return ['specialOrProfessionalGuidance','pregnant','breastfeeding','pregnancy','lactation','professionalDiet','otherSpecial'].every(key=>value[key as keyof ProfessionalGuidance]===undefined||typeof value[key as keyof ProfessionalGuidance]==='boolean')&&(value.professionalKcal===undefined||value.professionalKcal===null||typeof value.professionalKcal==='number'&&Number.isFinite(value.professionalKcal))}
export function professionalCalorieTarget(value:CircumstanceInput){
 const kcal=value.professionalKcal;
 return specialCircumstances(value).active&&typeof kcal==='number'&&Number.isFinite(kcal)&&kcal>0&&Math.round(kcal)>0?Math.round(kcal):null;
}
