import './reference-locale';
import {useTranslation} from 'react-i18next';
import {builtInExercises,defaultBuiltInExercise,type BuiltInExercise} from './data/builtInExercises';
import {referenceName} from './reference-library';
import {ReferenceSourceInfo,type ReferenceSource} from './ReferenceSourceInfo';

/** Only static reference categories belong here; saved record names are not presets. */
export function BuiltInExerciseSelector({value,onChange,source}:{value:string;source?:ReferenceSource;onChange:(item:BuiltInExercise|null)=>void}){
 const {t,i18n}=useTranslation();
 if(!builtInExercises.length)return null;
 const selected=builtInExercises.find(item=>item.id===value);
 const groups=builtInExercises.filter((item,index)=>builtInExercises.findIndex(other=>other.category===item.category)===index);
 const variants=selected?builtInExercises.filter(item=>item.category===selected.category):[];
 return <div className="reference-exercise-selector">
  <label>{t('referencePreset')}<select aria-label={t('referencePreset')} value={selected?.category??''} onChange={event=>onChange(defaultBuiltInExercise(event.target.value))}>
   {groups.map(item=><option key={item.category} value={item.category}>{referenceName(item,i18n.language)}</option>)}
   <option value="">{t('referenceCustomExercise')}</option>
  </select></label>
  {selected&&<>
   {variants.length>1&&<><span className="exercise-reference-intensity-label">{t('exerciseIntensity')}</span><div className="exercise-reference-variants" role="group" aria-label={t('exerciseIntensity')}>{variants.map(item=><button type="button" key={item.id} aria-pressed={item.id===value} onClick={()=>onChange(item)}>{i18n.language.startsWith('zh')?item.intensityLabelZh:item.intensityLabelEn}</button>)}</div></>}
   <span className="exercise-source-inline"><ReferenceSourceInfo source={source??selected}/></span>
  </>}
 </div>;
}
