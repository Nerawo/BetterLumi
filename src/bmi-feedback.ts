import {bmiCategory} from './bmi-profile';

/** Adult categories are withheld for known ages under 20 (CDC reference).
 * No growth-percentile estimate is fabricated from an adult BMI number. */
export function bmiFeedback(value:number|null,age:number|null){
 const valid=value!==null&&Number.isFinite(value)&&value>0;
 const youth=age!==null&&Number.isFinite(age)&&age>=0&&age<20;
 const invalidAge=age!==null&&(!Number.isInteger(age)||age<0||age>120);
 const category=valid&&!youth&&!invalidAge?bmiCategory(value):null;
 return {category,useAdultCategories:!youth&&!invalidAge,comment:!valid?null:youth?'bmiCommentYouth':invalidAge?'bmiCommentAge':age===null?'bmiCommentAdultReference':'bmiComment_'+category};
}
