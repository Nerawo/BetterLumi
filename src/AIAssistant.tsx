import {useMemo,useState,useEffect,useRef} from 'react';
import {useTranslation} from 'react-i18next';
import {ArrowLeft,ArrowUpRight} from 'lucide-react';
import {navigate,routeHref,backToOrigin} from './routing';
import type {PantryItem,Recipe} from './domain';
import {ingredientPreferenceRows} from './ingredient-preferences';
import {buildProposedMealPrompt} from './ai-meal-prompt';
import {parseAIMealDraft,type AIMealDraftRow} from './ai-meal-state';
import {acceptAIMealSplit} from './ai-meal-preview';
import {useAIMealDraft} from './useAIMealDraft';
import {AIMealFoodEditor} from './AIMealFoodEditor';
import {AIMealPreview} from './AIMealPreview';
import {AIImportError,type AIImportReceipt} from './ai-meal-import';
import {copyAIMealText} from './ai-meal-clipboard';
import {Modal} from './ui';
import chatgptIcon from './assets/ai-platforms/chatgpt.svg';
import doubaoIcon from './assets/ai-platforms/doubao.png';
import deepseekIcon from './assets/ai-platforms/deepseek.png';
import qwenIcon from './assets/ai-platforms/qwen.png';
import './ai-meal-locale';
import './ai-assistant.css';
const shortcuts=[['ChatGPT','https://chatgpt.com/',chatgptIcon],['aiDoubao','https://www.doubao.com/',doubaoIcon],['DeepSeek','https://chat.deepseek.com/',deepseekIcon],['aiQwen','https://www.qianwen.com/',qwenIcon]] as const;
export function AIAssistant({meals,pantry,recipes,settings,onImported}:{onImported:(receipt:AIImportReceipt)=>void;meals:boolean;pantry:PantryItem[];recipes:Recipe[];settings:{key:string;value:string}[]}) {
 const {t}=useTranslation();return <div className="ai-assistant"><header className="ai-page-heading"><button type="button" className="secondary-back" aria-label={t('aiBack')} onClick={()=>meals?navigate('/assistant'):backToOrigin('/today')}><ArrowLeft size={18}/></button><h1>{t(meals?'aiMeals':'aiAssistant')}</h1></header>
  {meals?<AIMealEntry pantry={pantry} recipes={recipes} settings={settings} onImported={onImported}/>:<div className="ai-landing">
   <a className="ai-feature ai-feature-primary" href={routeHref('/assistant/meals')} onClick={e=>{e.preventDefault();navigate('/assistant/meals')}}><small>01</small><div><h2>{t('aiMeals')}</h2><p>{t('aiMealAbout')}</p></div><ArrowUpRight size={20}/></a>
   <section className="ai-feature ai-coming"><small>02</small><div><h2>{t('aiRecipe')}</h2></div><small className="ai-coming-label">{t('aiComing')}</small></section>
  </div>}
 </div>;
}
function AIMealEntry({pantry,recipes,settings,onImported}:{onImported:(receipt:AIImportReceipt)=>void;pantry:PantryItem[];recipes:Recipe[];settings:{key:string;value:string}[]}) {
 const {t,i18n}=useTranslation(),{draft,status,error,change,chooseRecovery,recoveries,importDraft}=useAIMealDraft();
 const [manualTemplate,setManualTemplate]=useState<string|null>(null);
 const [copied,setCopied]=useState(false),[copyMessage,setCopyMessage]=useState(''),[editing,setEditing]=useState<AIMealDraftRow|null>(null),[pasteError,setPasteError]=useState('');
 const [importError,setImportError]=useState(''),[duplicates,setDuplicates]=useState<string[]>([]);
 useEffect(()=>{setImportError('');setDuplicates([])},[draft?.rows]);
 const apply=async(allowDuplicates=false)=>{setImportError('');try{const result=await importDraft(i18n.language.startsWith('zh')?'zh':'en',allowDuplicates);onImported(result.receipt)}catch(error){if(error instanceof AIImportError&&error.code==='duplicate')setDuplicates(error.paths);else setImportError(t(error instanceof AIImportError&&error.code==='conflict'?'aiImportConflict':'aiImportFailed'))}};
 const catalog=useMemo(()=>({ingredients:pantry,recipes,preferences:ingredientPreferenceRows(settings)}),[pantry,recipes,settings]);
 const safeChange=(fn:Parameters<typeof change>[0])=>{try{change(fn);setPasteError('')}catch{setPasteError(t('aiPreviewError'))}};
 const copy=async()=>{const template=buildProposedMealPrompt(i18n.language.startsWith('zh')?'zh':'en');if(await copyAIMealText(template)){setCopied(true);setCopyMessage(t('aiCopied'))}else{setCopyMessage(t('aiCopyManualHint'));setManualTemplate(template)}};
 const preview=()=>{if(draft?.rows.length&&!window.confirm(t('aiReplacePreview')))return;safeChange(parseAIMealDraft)};
 if(!draft)return <p role={error?'alert':'status'}>{error?t('aiDraftBlocked'):t('aiDraftSaving')}</p>;
 return <div className="ai-meal-entry"><fieldset disabled={status==='importing'}>
  <section className="ai-entry-step"><header><small>01</small><h2>{t('aiCopy')}</h2></header><div className="ai-copy-actions"><button type="button" className="primary" onClick={()=>void copy()}>{t('aiCopy')}</button>{copyMessage&&<small role="status">{copyMessage}</small>}</div>
   {copied&&<div className="ai-platforms"><nav className="ai-shortcuts" aria-label={t('aiPlatforms')}>{shortcuts.map(([name,url,icon])=><a key={name} href={url} target="_blank" rel="noopener noreferrer"><span className="ai-platform-icon"><img src={icon} alt="" width="34" height="34"/></span><span>{t(name)}</span></a>)}</nav><p className="ai-platform-hint">{t('aiOtherPlatforms')}</p></div>}
  </section>
  <section className="ai-entry-step"><header><small>02</small><h2>{t('aiPaste')}</h2></header><label><span className="sr-only">{t('aiPaste')}</span><textarea className="ai-paste" aria-label={t('aiPaste')} placeholder={t('aiPasteHint')} value={draft.raw} maxLength={200000} readOnly={!!error} onChange={e=>{const raw=e.target.value;safeChange(d=>({...d,raw,parseError:null}))}}/></label>
   <div className="ai-entry-actions"><button type="button" onClick={preview} disabled={!!error||!draft.raw.trim()}>{t('aiPreview')}</button><small role="status">{error?t('aiDraftBlocked'):t(status==='saving'?'aiDraftSaving':'aiDraftSaved')}</small></div>
   {((draft.parseError&&draft.raw.trim())||pasteError)&&<p role="alert" className="ai-helper">{pasteError||t('aiPreviewError')}</p>}
   {error&&<div className="ai-recovery"><p role="alert">{t('aiDraftBlocked')}</p><button type="button" onClick={()=>void navigator.clipboard.writeText(JSON.stringify(draft)).catch(()=>setCopyMessage(t('aiCopyFailed')))}>{t('aiExportDraft')}</button>{recoveries.length>1&&<label>{t('aiRecovery')}<select aria-label={t('aiRecovery')} defaultValue="" onChange={e=>{if(e.target.value)chooseRecovery(e.target.value)}}><option value="">{t('aiUnresolved')}</option>{recoveries.map((key,index)=><option key={key} value={key}>{t('aiRecoveryNumber',{number:index+1})}</option>)}</select></label>}</div>}
  </section>
  {(!!draft.rows.length||!!Object.keys(draft.splits??{}).length)&&<AIMealPreview preferences={catalog.preferences} draft={draft} change={safeChange} edit={setEditing} importing={status==='importing'} blocked={!!error} importError={importError} duplicates={duplicates} reviewDuplicates={()=>{const row=draft.rows.find(r=>duplicates.includes(r.item.path));setDuplicates([]);if(row)setEditing(row)}} importMeals={allow=>void apply(allow)}/>}
  </fieldset>{manualTemplate!==null&&<ManualTemplate text={manualTemplate} close={()=>setManualTemplate(null)} confirm={()=>{setCopied(true);setCopyMessage(t('aiManualReady'));setManualTemplate(null)}}/>}{editing&&<AIMealFoodEditor key={editing.item.path} initial={editing} catalog={catalog} component={!!editing.splitParent} close={()=>setEditing(null)} save={(row,parts)=>{change(d=>parts?acceptAIMealSplit(d,row,parts):{...d,rows:d.rows.map(r=>r.item.path===row.item.path?row:r)});setEditing(null)}} remove={()=>{change(d=>({...d,rows:d.rows.filter(r=>r.item.path!==editing.item.path)}));setEditing(null)}}/>}
 </div>;
}

function ManualTemplate({text,close,confirm}:{text:string;close:()=>void;confirm:()=>void}){
 const {t}=useTranslation(),field=useRef<HTMLTextAreaElement>(null);
 return <Modal title={t('aiManualTitle')} close={close} className="goal-editor-modal ai-food-editor ai-copy-dialog"><div className="ai-editor-body"><p className="ai-helper" role="status">{t('aiCopyManualHint')}</p><label>{t('aiFullTemplate')}<textarea ref={field} readOnly value={text} spellCheck={false}/></label></div><div className="form-actions"><button type="button" onClick={()=>{const el=field.current;if(el){el.focus({preventScroll:true});el.select();el.setSelectionRange(0,text.length)}}}>{t('aiSelectTemplate')}</button><button type="button" className="primary" onClick={confirm}>{t('aiManualConfirm')}</button></div></Modal>;
}
