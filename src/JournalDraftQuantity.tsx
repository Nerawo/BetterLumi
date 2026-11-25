import {useTranslation} from 'react-i18next';
import type {RecipeLine} from './domain';
import {requantifyLine} from './cooking-effective';
import {JournalQuantityInput} from './JournalQuantityInput';

export function JournalDraftQuantity({line,onChange}:{line:RecipeLine;onChange:(line:RecipeLine)=>void}){
  const {t}=useTranslation();
  return <JournalQuantityInput quantity={line.quantity} label={line.name+' '+t('quantity')}
    onCommit={value=>{
      let updated:RecipeLine;
      try{updated=requantifyLine(line,value)}catch{return false}
      onChange(updated);
    }}/>;
}
