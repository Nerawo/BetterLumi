import {NumberInput} from "./NumberInput";
import {useModalKeyboard} from "./useModalKeyboard";
import { useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { X, Plus, Pencil, Trash2 } from "lucide-react";
import { nutrientKeys, type Nutrition } from "./domain";
export function Modal({
  title,
  close,
  children,
  className = "",
  descriptionId,
  eyebrow,
}: {
  className?: string;
  title: string;
  close: () => void;
  children: ReactNode;
  descriptionId?: string;
  eyebrow?: string;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);
  const standard=["reference-source-modal","calculator-risk-modal","weight-entry-modal","goal-settings-modal","goal-tolerance-reset-modal","ingredient-picker-modal","recipe-detail-modal","recipe-editor-modal","category-manager-modal","category-recipes-modal","pantry-editor-modal","exercise-record-editor","exercise-plan-editor","goal-editor-modal"].some(name=>className.split(" ").includes(name));
  useModalKeyboard(ref);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      aria-describedby={descriptionId}
      className={"modal " + className+(standard?" standard-modal":"")}
      onKeyDown={e=>{
        const input=e.target;
        if(e.key==='Enter'&&!e.defaultPrevented&&!e.nativeEvent.isComposing&&input instanceof HTMLInputElement&&
          input.closest('dialog')===ref.current&&input.form?.querySelector(':scope > .form-actions,:scope > .recipe-editor-footer')&&
          /^(text|number|email|tel|url|password)$/.test(input.type)){
          e.preventDefault();input.blur();
        }
      }}
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
        {eyebrow?<div className="modal-title-group"><span className="journal-mode-label">{eyebrow}</span><h2>{title}</h2></div>:<h2>{title}</h2>}
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
