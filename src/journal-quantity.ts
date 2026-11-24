import type {RecipeLine} from './domain';
/** Display only. Never feeds scaling, sessions, snapshots or inventory. */
export function journalQuantity(line:Pick<RecipeLine,'unit'|'quantity'>):string{
 if(line.unit==='g')return line.quantity>0&&line.quantity<0.05?'<0.1':String(Number(line.quantity.toFixed(1)));
 return String(line.unit==='fraction'?line.quantity*100:line.quantity);
}
