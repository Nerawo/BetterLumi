import type {RecipeLine} from './domain';
/** Display only. Never feeds scaling, sessions, snapshots or inventory. */
export function journalQuantity(line:Pick<RecipeLine,'unit'|'quantity'>):string{
 const amount=line.unit==='fraction'?line.quantity*100:line.quantity;
 const rounded=Math.round(amount);
 return rounded===0&&amount>0?journalEditValue(amount):String(rounded);
}

const editFormat=new Intl.NumberFormat('en-US',{useGrouping:false,maximumFractionDigits:1});
export const journalEditValue=(quantity:number)=>{
 const display=editFormat.format(quantity);
 return quantity>0&&display==='0'?String(quantity):display;
};
