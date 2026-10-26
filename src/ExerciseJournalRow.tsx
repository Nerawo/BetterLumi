import type {ReactNode} from "react";
import {useTranslation} from "react-i18next";
import {NumberLine} from "./NumberUnit";
import {ExerciseRowDetails,type ExerciseMetadataValue} from "./ExerciseMetadata";
import type {Notice} from "./ui";
import {ReferenceSourceInfo} from './ReferenceSourceInfo';
import type {ExerciseEstimateSnapshot} from './exercise-estimate';
/** One record presentation for scheduled items and independent actual logs. */
export function ExerciseJournalRow({className,name,items,values,actions,notice,occurrence,prefix,role}:{className:string;name:ReactNode;items:{value:ReactNode;unit:string;prefix?:string}[];values:ExerciseMetadataValue & {notes?:string;exerciseEstimate?:ExerciseEstimateSnapshot;calorieSource?:'automatic'|'manual';caloriesBurned?:number|null};actions:ReactNode;notice:Notice;occurrence?:string;prefix?:ReactNode;role?:"listitem"}){
 const {t,i18n}=useTranslation(),snapshot=values.exerciseEstimate,intensity=i18n.language.startsWith('zh')?snapshot?.intensityLabelZh:snapshot?.intensityLabelEn;
 const displayed=values.calorieSource==='automatic'?items.map(item=>item.unit==='kcal'?{...item,value:typeof item.value==='number'?Math.round(item.value):item.value,prefix:'≈'}:item):items;
 return <div className={className+" exercise-journal-row"} data-occurrence={occurrence} role={role}><div className="simple-row exercise-row-main"><div className="grow"><strong className="exercise-row-name">{name}</strong><small className="exercise-row-values">{prefix}{intensity&&<span>{intensity} · </span>}{items.length?<NumberLine items={displayed}/>:t("notRecorded")}{snapshot&&<span className="exercise-source-inline"><ReferenceSourceInfo iconOnly label={t('exerciseCalculationDetails')} source={{...snapshot,historical:true,finalKcal:values.caloriesBurned,calorieSource:values.calorieSource}}/></span>}</small><ExerciseRowDetails value={values} notice={notice}/></div><div className="exercise-row-actions">{actions}</div></div></div>;
}
