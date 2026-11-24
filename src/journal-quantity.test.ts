import {expect,it} from 'vitest';
import {journalQuantity} from './journal-quantity';
it.each([[150.125,'mL','150'],[16.667,'g','17'],[3.333,'g','3'],[40.4,'g','40'],[40.5,'g','41'],[0.4,'g','0'],[0,'mL','0'],[1.5,'piece','2'],[0.000125,'tsp','0'],[0.16667,'fraction','17']] as const)('displays %s %s as %s without modifying source precision',(quantity,unit,expected)=>{
 const line={quantity,unit};expect(journalQuantity(line)).toBe(expected);expect(line.quantity).toBe(quantity);
});
