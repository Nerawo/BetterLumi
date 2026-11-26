import { Component, useEffect, useState, type ReactNode } from "react";
import {db} from './db';

/** Dexie live queries may stay pending when the browser refuses storage or blocks an upgrade. */
export function OpenLocalJournal({children}:{children:ReactNode}){
 const [state,setState]=useState<'opening'|'ready'|'failed'>('opening');
 useEffect(()=>{
  let active=true;
  const blocked=()=>{if(active)setState('failed')};
  db.on('blocked',blocked);
  Promise.resolve().then(()=>{
   if(!window.indexedDB)throw Error('IndexedDB unavailable');
   return db.open();
  }).then(()=>{if(active)setState('ready')},blocked);
  return ()=>{active=false;db.on('blocked').unsubscribe(blocked)};
 },[]);
 if(state==='failed')throw Error('Unable to open local journal');
 if(state==='opening')return <main role="status">正在打开本地手记… / Opening your local journal…</main>;
 return children;
}
export class StorageBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main style={{ margin: 0, padding: 40 }}>
        <h1>BetterLumi</h1>
        <p>
          无法打开本地数据。请确认浏览器允许网站存储，再刷新页面。请勿清除网站数据，以免丢失未备份的记录。
        </p>
        <p>
          Unable to open local data. Allow browser storage and reload. Avoid
          clearing site data if you have unexported records.
        </p>
        <button className="primary" onClick={() => location.reload()}>
          刷新 / Reload
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
