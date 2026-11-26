import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowDownWideNarrow, ChevronDown, ArrowUp, ArrowDown } from "lucide-react";
const fields = ['name','calories'] as const;
type SortField = typeof fields[number];
type Direction = 'asc'|'desc';
export type PantrySort = `${SortField}-${Direction}`;
function DirectionArrow({direction}:{direction:Direction}){
  const Icon=direction==='asc'?ArrowUp:ArrowDown;
  return <Icon className="sort-direction" size={14} aria-hidden="true"/>;
}
export function PantrySortMenu({ value, onChange, kind='ingredients' }: { value:PantrySort; onChange:(value:PantrySort)=>void; kind?:'ingredients'|'recipes' }) {
  const { t } = useTranslation();
  const id=useId(),title=t(kind==='recipes'?'sortRecipes':'sortIngredients');
  const [field,direction]=value.split('-') as [SortField,Direction];
  const [directions,setDirections]=useState<Record<SortField,Direction>>({name:'asc',calories:'asc'});
  const label=(key:SortField)=>t(key==='name'?'name':'directorySortCalories');
  const select=(key:SortField)=>{
    const next=key===field?(direction==='asc'?'desc':'asc'):directions[key];
    setDirections({...directions,[field]:direction,[key]:next});
    onChange(`${key}-${next}`);close();
  };
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
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
    <button type="button" className="pantry-sort-trigger" ref={trigger} aria-label={title + ": " + label(field) + (direction==="asc"?" ↑":" ↓")} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined}
      onClick={() => setOpen(!open)} onKeyDown={event => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true); }
      }}>
      <ArrowDownWideNarrow size={15} /><span>{label(field)}</span><DirectionArrow direction={direction}/><ChevronDown size={13} />
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
      {fields.map(key=><button type="button" key={key} data-sort={key} role="menuitemradio" aria-checked={field===key}
        aria-label={label(key)+(directions[key]==='asc'?' ↑':' ↓')} onClick={()=>select(key)}>
        <span>{label(key)}</span><DirectionArrow direction={field===key?direction:directions[key]}/>
      </button>)}
    </div>}
  </div>;
}
