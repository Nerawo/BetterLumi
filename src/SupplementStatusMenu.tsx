import {useState} from 'react';
import {useTranslation} from 'react-i18next';
import type {Check} from './db';
const values=['unconfirmed','taken','skipped'] as const;
export function SupplementStatusMenu({value,name,disabled,onChange}:{value:Check['status'];name:string;disabled:boolean;onChange:(value:Check['status'])=>Promise<void>}){
 const {t}=useTranslation(),[busy,setBusy]=useState(false);
 return <div className="supplement-status-segments" role="group" aria-label={name}>{values.map(status=><button type="button" key={status} data-status={status} aria-label={name+' · '+t(status)} aria-pressed={value===status} disabled={disabled||busy} onClick={async()=>{if(value===status||busy)return;setBusy(true);try{await onChange(status)}finally{setBusy(false)}}}>{t(status)}</button>)}</div>;
}
