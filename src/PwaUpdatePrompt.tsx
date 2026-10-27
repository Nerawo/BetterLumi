import {useEffect,useRef,useState} from 'react';
import {useTranslation} from 'react-i18next';
import {watchForAppUpdate} from './pwa-updates';
import './pwa-update.css';

export function PwaUpdatePrompt() {
  const {i18n} = useTranslation();
  const zh = i18n.language.startsWith('zh');
  const [available,setAvailable] = useState(false);
  const [applying,setApplying] = useState(false);
  const [error,setError] = useState(false);
  const controller = useRef<ReturnType<typeof watchForAppUpdate> | null>(null);
  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
    const start = () => {
      controller.current = watchForAppUpdate({
        serviceWorkers: navigator.serviceWorker,
        base: import.meta.env.BASE_URL,
        onAvailable: () => {setAvailable(true);setError(false)},
        onError: () => {setApplying(false);setError(true)},
        reload: () => location.reload(),
      });
    };
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, {once:true});
    return () => {window.removeEventListener('load',start);controller.current?.dispose();controller.current=null};
  }, []);
  if (!available) return null;
  return <aside className="pwa-update-prompt" aria-label={zh?'BetterLumi 更新':'BetterLumi update'}>
    <div role="status"><strong>{zh?'有新版本可用':'A new version is available'}</strong><p>{error?(zh?'更新未完成，请稍后重试。':'The update did not complete. Please try again.'):(zh?'请先保存正在编辑的内容，再刷新更新。':'Save your edits before reloading to update.')}</p></div>
    <div className="pwa-update-actions"><button type="button" onClick={()=>setAvailable(false)}>{zh?'稍后':'Later'}</button><button type="button" className="primary" disabled={applying} onClick={()=>{setApplying(true);setError(false);void controller.current?.applyUpdate()}}>{applying?(zh?'正在更新…':'Updating…'):(zh?'更新并刷新':'Update and reload')}</button></div>
  </aside>;
}
