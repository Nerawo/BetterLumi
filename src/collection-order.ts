import type {Table} from 'dexie';
import type {RecordBase} from './db';
export type OrderedRecord=RecordBase&{sortOrder?:number};
/** Missing order uses the former IndexedDB primary-key order, without rewriting legacy rows. */
export function orderedItems<T extends OrderedRecord>(items:T[]):T[]{
 const legacy=[...items].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0),positions=new Map(legacy.filter(x=>x.sortOrder===undefined).map((x,i)=>[x.id,i]));
 return legacy.sort((a,b)=>(a.sortOrder??positions.get(a.id)!) -(b.sortOrder??positions.get(b.id)!) || (a.id<b.id?-1:a.id>b.id?1:0));
}
export function nextOrder(items:OrderedRecord[]){return Math.max(items.length-1,...items.map(x=>x.sortOrder??-1))+1}
export function validOrder(row:{sortOrder?:unknown}){return row.sortOrder===undefined||(typeof row.sortOrder==='number'&&Number.isFinite(row.sortOrder)&&row.sortOrder>=0)}
export async function moveOrderedItem<T extends OrderedRecord>(table:Table<T>,id:string,targetId:string|number){
 await table.db.transaction('rw',table,async()=>{const rows=orderedItems(await table.filter(x=>!x.deletedAt).toArray()),from=rows.findIndex(x=>x.id===id),to=typeof targetId==='number'?from+targetId:rows.findIndex(x=>x.id===targetId);if(from<0||to<0||to>=rows.length||from===to)return;const [row]=rows.splice(from,1);rows.splice(to,0,row);const now=new Date().toISOString();await table.bulkPut(rows.map((x,sortOrder)=>({...x,sortOrder,updatedAt:now,revision:x.revision+1})));});
}
export function associatedNameMatches(ids:string[]|undefined,items:{id:string;name:string;deletedAt?:string|null}[],query:string){const q=query.trim().toLowerCase();return items.some(x=>!x.deletedAt&&ids?.includes(x.id)&&x.name.toLowerCase().includes(q))}
