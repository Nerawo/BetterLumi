import {useTranslation} from 'react-i18next';
import type {RecipeLine} from './domain';
import {requantifyLine} from './cooking-effective';
import {JournalQuantityInput} from './JournalQuantityInput';

export function JournalDraftQuantity({line,onChange,required=false}:{required?:boolean;line:RecipeLine;onChange:(line:RecipeLine)=>void}){
  const {t}=useTranslation();
  return <JournalQuantityInput required={required} validateOnSubmit={required} quantity={line.quantity} label={line.name+' '+t('quantity')}
    onCommit={value=>{
      let updated:RecipeLine;
      try{updated=requantifyLine(line,value)}catch{return false}
      onChange(updated);
    }}/>;
}
