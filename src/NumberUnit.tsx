import type {ReactNode} from "react";

/** Presentation only: callers retain their existing precision and conversion rules. */
export function NumberUnit({value,unit}:{value:ReactNode;unit:string}){
 return <span className="number-unit"><span className="number-value">{value}</span>{unit!=="%"&&" "}<small className="number-unit-label">{unit}</small></span>;
}
