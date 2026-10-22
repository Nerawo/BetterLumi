import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowDownWideNarrow, ChevronDown, Check } from "lucide-react";
const options = [
  { value: "name-asc", label: "sortNameAsc", short: "sortNameAsc" },
  { value: "name-desc", label: "sortNameDesc", short: "sortNameDesc" },
  { value: "calories-asc", label: "sortCaloriesLowToHigh", short: "sortCaloriesAsc" },
  { value: "calories-desc", label: "sortCaloriesHighToLow", short: "sortCaloriesDesc" },
] as const;
export type PantrySort = (typeof options)[number]["value"];
export function PantrySortMenu({ value, onChange }: { value: PantrySort; onChange: (value: PantrySort) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const active = options.find(option => option.value === value)!;
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
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }}>
    <button type="button" className="pantry-sort-trigger" ref={trigger} aria-label={t("sortIngredients") + ": " + t(active.short)} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? "pantry-sort-options" : undefined}
      onClick={() => setOpen(!open)} onKeyDown={event => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true); }
      }}>
      <ArrowDownWideNarrow size={15} /><span>{t(active.short)}</span><ChevronDown size={13} />
    </button>
    {open && <div id="pantry-sort-options" className="pantry-sort-menu" role="menu" aria-label={t("sortIngredients")} ref={menu} onKeyDown={event => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); }
      if (event.key === "Tab") { close(); }
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next]?.focus();
    }}>
      {options.map(option => <button type="button" key={option.value} data-sort={option.value} role="menuitemradio" aria-checked={value === option.value} onClick={() => { onChange(option.value); close(); }}>
        <span>{t(option.label)}</span>{value === option.value && <Check size={14} aria-hidden="true" />}
      </button>)}
    </div>}
  </div>;
}
