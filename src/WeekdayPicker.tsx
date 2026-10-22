import {useTranslation} from "react-i18next";
import {formatLocalDate} from "./dates";
export function WeekdayPicker({days,onChange}:{days:number[];onChange:(days:number[])=>void}) {
 const {t,i18n}=useTranslation();const order=[1,2,3,4,5,6,0];
 return <fieldset className="weekday-toggles"><legend>{t("customDays")}</legend><div>{order.map((day,index)=><label key={day} data-selected={days.includes(day)}><input type="checkbox" aria-label={new Date("2026-10-"+(12+index)+"T12:00:00").toLocaleDateString(i18n.language==="zh"?"zh-CN":"en-US",{weekday:"long"})} checked={days.includes(day)} onChange={event=>onChange(event.target.checked?[...days,day]:days.filter(value=>value!==day))}/><span>{formatLocalDate("2026-10-"+(12+index),i18n.language,"weekday")}</span></label>)}</div><small className="muted">{order.filter(day=>days.includes(day)).map(day=>formatLocalDate("2026-10-"+(12+order.indexOf(day)),i18n.language,"weekday")).join(" · ")||t("scheduleEmpty")}</small></fieldset>;
}
