import {DatePicker} from "./DatePicker";
export function CalendarDateJump({selected,onSelect}:{selected:string;onSelect:(date:string)=>void}) {
 return <DatePicker selected={selected} onSelect={onSelect}/>;
}
