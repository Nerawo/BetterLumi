import type {ReactNode} from "react";
import {useTranslation} from "react-i18next";
import {NumberLine} from "./NumberUnit";
import {ExerciseRowDetails,type ExerciseMetadataValue} from "./ExerciseMetadata";
import type {Notice} from "./ui";
/** One record presentation for scheduled items and independent actual logs. */
export function ExerciseJournalRow({className,name,items,values,actions,notice,occurrence,prefix,role}:{className:string;name:ReactNode;items:{value:ReactNode;unit:string;prefix?:string}[];values:ExerciseMetadataValue & {notes?:string};actions:ReactNode;notice:Notice;occurrence?:string;prefix?:ReactNode;role?:"listitem"}){
 const {t}=useTranslation();
 return <div className={className+" exercise-journal-row"} data-occurrence={occurrence} role={role}><div className="simple-row exercise-row-main"><div className="grow"><strong className="exercise-row-name">{name}</strong><small className="exercise-row-values">{prefix}{items.length?<NumberLine items={items}/>:t("notRecorded")}</small><ExerciseRowDetails value={values} notice={notice}/></div><div className="exercise-row-actions">{actions}</div></div></div>;
}
