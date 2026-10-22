import {orderedItems} from './collection-order';
import { useEffect, useId, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { Plus, Check } from "lucide-react";
import { categories, findOrCreateCategory } from "./categories";

export function RecipeCategoryPicker({ value, onToggle, className = "" }: {
  value: string[];
  onToggle: (id: string, included: boolean) => void | Promise<void>;
  className?: string;
}) {
  const { t } = useTranslation();
  const compact=className.split(" ").includes("detail-category-row");
  const items = useLiveQuery(async() => orderedItems(await categories.filter(category => !category.deletedAt).toArray()));
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false), [name, setName] = useState("");
  const newInput=useRef<HTMLInputElement>(null),pointerInside=useRef(false),createLock=useRef(false);
  useEffect(()=>{if(!creating)return;const reveal=()=>requestAnimationFrame(()=>newInput.current?.closest('.category-create-row')?.scrollIntoView({block:'nearest',inline:'nearest'}));newInput.current?.focus({preventScroll:true});reveal();window.visualViewport?.addEventListener('resize',reveal);return()=>window.visualViewport?.removeEventListener('resize',reveal)},[creating]);
  const create=async()=>{if(createLock.current||busy)return;if(!name.trim()){setError(t('categoryNameRequired'));return;}createLock.current=true;setBusy(true);setError("");try{const category=await findOrCreateCategory(name);await onToggle(category.id,true);setName("");setCreating(false);trigger.current?.focus({preventScroll:true})}catch{setError(t("failedMessage"))}finally{createLock.current=false;setBusy(false)}};
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const close = () => { setOpen(false); trigger.current?.focus(); };
  useEffect(() => {
    setPending(previous => Object.fromEntries(Object.entries(previous).filter(([id, included]) => value.includes(id) !== included)));
  }, [value]);
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLInputElement>("input")?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  return <div className={"recipe-category-picker " + className} data-inline-open={compact&&open||undefined} ref={root} onPointerDownCapture={()=>{pointerInside.current=true}} onKeyDown={event => {
    pointerInside.current=false;
    if (open && event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); }
  }} onBlur={event => {
    // Safari focuses the dialog, not the tapped button. Do not unmount that button before click.
    if (!pointerInside.current && event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false);
  }}>
    <div className="recipe-category-chips">
      {items?.filter(category => value.includes(category.id)).map(category => <span className="recipe-category-chip" key={category.id}>{category.name}</span>)}
      <button type="button" className="category-picker-trigger text-link" ref={trigger} aria-expanded={open} aria-controls={open ? id : undefined} aria-label={t("chooseRecipeCategories")} onClick={() => setOpen(!open)}><Plus size={14} />{t("categoryAction")}</button>
      {compact&&open&&<button type="button" className="category-picker-done text-link" onClick={close}>{t("categoryPickerDone")}</button>}
    </div>
    {open && <div className="category-picker-panel" id={id} role="group" aria-label={t("recipeCategoriesMultiple")} aria-busy={busy} ref={panel}>
      {!compact&&<div className="category-panel-heading"><span>{t("categoryChoices")}</span><button type="button" className="category-picker-done text-link" onClick={close}>{t("categoryPickerDone")}</button></div>}
      <div className="category-choice-list">{items?.map(category => <label key={category.id} data-selected={pending[category.id] ?? value.includes(category.id)}>
        <input type="checkbox" aria-disabled={busy} checked={pending[category.id] ?? value.includes(category.id)} onChange={async event => {
          if (busy) return;
          const included = event.target.checked;
          setPending(previous => ({...previous, [category.id]: included}));
          setBusy(true); setError("");
          try { await onToggle(category.id, included); }
          catch {
            setPending(previous => { const next = {...previous}; delete next[category.id]; return next; });
            setError(t("failedMessage"));
          }
          finally { setBusy(false); }
        }} />
        {compact&&<Check className="category-choice-check" size={13} aria-hidden="true"/>}<span>{category.name}</span>
      </label>)}{compact&&<button type="button" className="category-add-chip" disabled={busy} aria-expanded={creating} onClick={()=>setCreating(!creating)}><Plus size={13}/>{t("addCategoryChip")}</button>}</div>
      {(!compact||creating)&&<div className="category-create-section">{!creating?<button type="button" className="text-link" onClick={()=>setCreating(true)}><Plus size={14}/>{t("createCategory")}</button>:<div className="category-create-row"><input ref={newInput} aria-label={t("newCategoryName")} value={name} maxLength={100} onChange={event=>setName(event.target.value)} onKeyDown={event=>{if(event.key==="Enter"){event.preventDefault();event.stopPropagation();void create()}}}/><button type="button" disabled={busy||!name.trim()} onClick={()=>void create()}>{t("createAndAssign")}</button></div>}
      </div>}
      {error && <p role="alert">{error}</p>}
    </div>}
  </div>;
}
