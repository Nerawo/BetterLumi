/** User-triggered copying only. HTTP LAN Safari may have no async Clipboard API. */
export async function copyAIMealText(text:string):Promise<boolean>{
 try{if(typeof navigator.clipboard?.writeText==='function'){await navigator.clipboard.writeText(text);return true}}catch{/* A denied/expired async gesture can still try the legacy path. */}
 return legacyCopy(text);
}
function legacyCopy(text:string):boolean{
 const active=document.activeElement instanceof HTMLElement?document.activeElement:null;
 const field=active instanceof HTMLInputElement||active instanceof HTMLTextAreaElement?active:null;
 const start=field?.selectionStart,end=field?.selectionEnd,direction=field?.selectionDirection;
 const selection=window.getSelection(),ranges:Range[]=[];
 if(selection)for(let i=0;i<selection.rangeCount;i++)ranges.push(selection.getRangeAt(i).cloneRange());
 const scrolls:{el:HTMLElement;top:number;left:number}[]=[];for(let el=active?.parentElement;el;el=el.parentElement)scrolls.push({el,top:el.scrollTop,left:el.scrollLeft});
 const x=window.scrollX,y=window.scrollY,textarea=document.createElement('textarea');
 textarea.value=text;textarea.readOnly=true;textarea.tabIndex=-1;
 textarea.style.cssText='position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:0;opacity:0;font-size:16px;';
 try{
  (active?.closest('dialog[open]')??document.body).append(textarea);
  textarea.focus({preventScroll:true});textarea.select();textarea.setSelectionRange(0,text.length);
  return typeof document.execCommand==='function'&&document.execCommand('copy')===true;
 }catch{return false}finally{
  textarea.remove();
  if(active?.isConnected){try{active.focus({preventScroll:true})}catch{/* Detached/unsupported focus must not break the manual fallback. */}}
  try{if(selection){selection.removeAllRanges();ranges.forEach(range=>selection.addRange(range))}if(field&&start!==null&&start!==undefined&&end!==null&&end!==undefined)field.setSelectionRange(start,end,direction??undefined)}catch{/* Some input types cannot expose text selection. */}
  scrolls.forEach(({el,top,left})=>{if(el.scrollTop!==top)el.scrollTop=top;if(el.scrollLeft!==left)el.scrollLeft=left});
  if(window.scrollX!==x||window.scrollY!==y)window.scrollTo({top:y,left:x,behavior:'instant'});
 }
}
