import {Fragment,type ReactNode} from "react";

/** Presentation only: callers retain their existing precision and conversion rules. */
export function NumberUnit({value,unit}:{value:ReactNode;unit:string}){
 return <span className="number-unit"><span className="number-value">{value}</span>{unit!=="%"&&" "}<small className="number-unit-label">{unit}</small></span>;
}
export function NumberLine({items}:{items:{value:ReactNode;unit:string;prefix?:string}[]}){
 return <>{items.map((item,index)=><Fragment key={index}>{index>0&&" · "}{item.prefix&&item.prefix+" "}<NumberUnit value={item.value} unit={item.unit}/></Fragment>)}</>;
}
