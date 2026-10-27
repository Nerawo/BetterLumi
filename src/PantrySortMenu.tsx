import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowDownWideNarrow, ChevronDown, Check } from "lucide-react";
const options = [
  { value: "name-asc", label: "sortNameAsc", short: "sortNameAsc" },
  { value: "name-desc", label: "sortNameDesc", short: "sortNameDesc" },
  { value: "calories-asc", label: "sortCaloriesLowToHigh", short: "sortCaloriesAsc" },
  { value: "calories-desc", label: "sortCaloriesHighToLow", short: "sortCaloriesDesc" },
] as const;
export type PantrySort = (typeof options)[number]["value"];
export function PantrySortMenu({ value, onChange, kind='ingredients' }: { value:PantrySort; onChange:(value:PantrySort)=>void; kind?:'ingredients'|'recipes' }) {
  const { t } = useTranslation();
  const id=useId(),title=t(kind==='recipes'?'sortRecipes':'sortIngredients');
  const menuOptions=options.map(option=>kind==='recipes'&&option.value.startsWith('calories')?{...option,label:option.value==='calories-asc'?'sortRecipeCaloriesLowToHigh':'sortRecipeCaloriesHighToLow',short:option.value==='calories-asc'?'sortRecipeCaloriesAsc':'sortRecipeCaloriesDesc'}:option);
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const active = menuOptions.find(option => option.value === value)!;
  const close = () => { setOpen(false); trigger.current?.focus(); };
  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
    const outside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  return <div className="pantry-sort" ref={container} onBlur={event => {
    // WebKit touch can blur with no next target before the option click.
    // Outside pointerdown and the menu keyboard handler still dismiss it.
    if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false);
  }}>
    <button type="button" className="pantry-sort-trigger" ref={trigger} aria-label={title + ": " + t(active.short)} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined}
      onClick={() => setOpen(!open)} onKeyDown={event => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true); }
      }}>
      <ArrowDownWideNarrow size={15} /><span>{t(active.short)}</span><ChevronDown size={13} />
    </button>
    {open && <div id={id} className="pantry-sort-menu" role="menu" aria-label={title} ref={menu} onKeyDown={event => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); }
      if (event.key === "Tab") { close(); }
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next]?.focus();
    }}>
      {menuOptions.map(option => <button type="button" key={option.value} data-sort={option.value} role="menuitemradio" aria-checked={value === option.value} onClick={() => { onChange(option.value); close(); }}>
        <span>{t(option.label)}</span>{value === option.value && <Check size={14} aria-hidden="true" />}
      </button>)}
    </div>}
  </div>;
}
