import {useTranslation} from 'react-i18next';
/** Shared wordmark and one language control on each main page. */
export function JournalMasthead({onLanguageSwitch}:{onLanguageSwitch:()=>void}){
 const {i18n,t}=useTranslation();
 return <div className="graphic-masthead journal-masthead"><span className="journal-wordmark">BetterLumi</span><button type="button" className="language-toggle" aria-label={t("switchLanguage")} onClick={onLanguageSwitch}>{i18n.language==='zh'?'中文 / EN':'EN / 中文'}</button></div>;
}
