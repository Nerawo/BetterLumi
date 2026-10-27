import {NumberInput} from "./NumberInput";
import { useEffect, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { X, Plus, Pencil, Trash2 } from "lucide-react";
import { nutrientKeys, round, type Nutrition } from "./domain";
export function Modal({
  title,
  close,
  children,
  className = "",
  descriptionId,
}: {
  className?: string;
  title: string;
  close: () => void;
  children: ReactNode;
  descriptionId?: string;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);
  const standard=["reference-source-modal","calculator-risk-modal","weight-entry-modal","goal-settings-modal","goal-tolerance-reset-modal","ingredient-picker-modal","recipe-detail-modal","recipe-editor-modal","category-manager-modal","category-recipes-modal","pantry-editor-modal","exercise-record-editor","exercise-plan-editor","goal-editor-modal"].some(name=>className.split(" ").includes(name));
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  useEffect(() => {
    if (!standard&&!className.includes("add-food-modal")) return;
    const viewport = window.visualViewport,dialog=ref.current;
    let frame=0;
    // Scroll only the focused control's own modal body, never its ancestors/page.
    const revealFocused = () => {
      const field=document.activeElement;
      if(!dialog||!(field instanceof HTMLElement)||!dialog.contains(field)||!field.matches('input,textarea,select,[contenteditable=true]'))return;
      let body=field.parentElement;
      while(body&&body!==dialog){
        if(/auto|scroll/.test(getComputedStyle(body).overflowY)&&body.scrollHeight>body.clientHeight){
          const box=body.getBoundingClientRect(),control=field.getBoundingClientRect();
          const top=Math.max(box.top,viewport?.offsetTop??0)+12;
          const bottom=Math.min(box.bottom,(viewport?.offsetTop??0)+(viewport?.height??innerHeight))-12;
          if(bottom<=top)return;
          const delta=control.height>bottom-top?control.top-top:control.bottom>bottom?control.bottom-bottom:control.top<top?control.top-top:0;
          if(Math.abs(delta)>1)body.scrollTo({top:body.scrollTop+delta,behavior:'instant'});
          return;
        }
        body=body.parentElement;
      }
    };
    const update = () => {
      dialog?.style.setProperty("--food-viewport-height", (viewport?.height ?? window.innerHeight) + "px");
      dialog?.style.setProperty("--food-viewport-top", (viewport?.offsetTop ?? 0) + "px");
      cancelAnimationFrame(frame);frame=requestAnimationFrame(revealFocused);
    };
    update();
    dialog?.addEventListener('focusin',update);
    window.addEventListener('resize',update);
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    return () => {
      cancelAnimationFrame(frame);
      dialog?.removeEventListener('focusin',update);
      window.removeEventListener('resize',update);
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
    };
  }, [className,standard]);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      aria-describedby={descriptionId}
      className={"modal " + className+(standard?" standard-modal":"")}
      onCancel={(e) => {
        e.preventDefault();
        e.stopPropagation();
        close();
      }}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="icon-button" aria-label={t("close")} onClick={close}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function NutritionFields({
  value,
  onChange,
}: {
  value: Nutrition;
  onChange: (n: Nutrition) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="nutrition-fields">
      {nutrientKeys.map((k) => (
        <label key={k}>
          {t(k === "calories" ? "energy" : k)} <small>{k === "calories" ? "kcal" : "g"}</small>
          <NumberInput
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={value[k] ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                [k]: e.target.value === "" ? null : Number(e.target.value),
              })
            }
          />
        </label>
      ))}
    </div>
  );
}
export function NutritionStrip({ value }: { value: Nutrition }) {
  const { t } = useTranslation();
  return (
    <div className="nutrition-strip">
      {nutrientKeys.map((k) => (
        <div key={k}>
          <span>{t(k === "calories" ? "energy" : k)}</span>
          <strong>
            {value[k] === null ? <span className="nutrition-missing">{t("notRecorded")}</span> : <>{round(value[k])}<small> {k === "calories" ? "kcal" : "g"}</small></>}
          </strong>
        </div>
      ))}
    </div>
  );
}
export function Empty({
  icon,
  heading,
  body,
  action,
}: {
  icon?: ReactNode;
  heading: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      {icon && <span className="empty-icon">{icon}</span>}
      <h3>{heading}</h3>
      {body && <p>{body}</p>}
      {action}
    </div>
  );
}
export function AddButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="primary" onClick={onClick}>
      <Plus size={16} />
      {children}
    </button>
  );
}
export function Actions({
  edit,
  remove,
}: {
  edit: () => void;
  remove: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="actions">
      <button aria-label={t("edit")} onClick={edit}>
        <Pencil size={15} />
      </button>
      <button aria-label={t("delete")} onClick={remove}>
        <Trash2 size={15} />
      </button>
    </div>
  );
}
export function changed<T extends { revision: number }>(old: T) {
  return {
    ...old,
    updatedAt: new Date().toISOString(),
    revision: old.revision + 1,
  };
}
export type Notice = (message: string, durationMs?:number) => void;
