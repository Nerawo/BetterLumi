import {expect,it} from 'vitest';
import {journalQuantity} from './journal-quantity';
it('formats grams only without modifying original quantities',()=>{
 for(const [quantity,expected]of [[629.936305732484,'629.9'],[200,'200'],[200.56,'200.6'],[0.01,'<0.1']] as const){const line={quantity,unit:'g'};expect(journalQuantity(line)).toBe(expected);expect(line.quantity).toBe(quantity)}
});
it('preserves meaningful precision for other units',()=>{expect(journalQuantity({quantity:0.000125,unit:'tsp'})).toBe('0.000125');expect(journalQuantity({quantity:0.000125,unit:'fraction'})).toBe('0.0125')});
