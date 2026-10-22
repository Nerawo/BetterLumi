import {NumberInput} from "./NumberInput";
import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ScanText } from "lucide-react";
import { parseNutritionLabel, ocrBasisConflicts, type ParsedLabel } from "./nutrition-label";
import { NutritionFields } from "./ui";
import { nutrientKeys,type Nutrition } from "./domain";
export type LabelReview = ParsedLabel & {
  language: string;
  basis: "100g" | "serving";
};
export function LabelOcrPanel({
  photo,
  onApply,
  current,
}: {
  photo: string;
  onApply: (review: LabelReview) => void;
  current:{basis:'100g'|'serving';servingGrams:number|null;nutrition:Nutrition;referenceAmount?:number;referenceUnit?:'g'|'mL';servingUnit?:'g'|'mL'};
}) {
  const { t } = useTranslation();
  const [language, setLanguage] = useState<"eng" | "eng+chi_sim">("eng");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [review, setReview] = useState<ParsedLabel | null>(null);
  const stop = useRef<(() => void) | null>(null);
  const generation = useRef(0);
  const conflicts=review?ocrBasisConflicts(current,review):[];
  const cancel = () => {
    generation.current++;
    stop.current?.();
    stop.current = null;
    setBusy(false);
  };
  useEffect(() => {
    generation.current++;
    stop.current?.();
    stop.current = null;
    setBusy(false);
    setReview(null);
    setError("");
    return () => {
      generation.current++;
      stop.current?.();
    };
  }, [photo]);
  const recognize = async () => {
    if (!photo) return;
    const id = ++generation.current;
    setBusy(true);
    setError("");
    setReview(null);
    setProgress(null);
    try {
      const { recognizeLabel } = await import("./label-ocr");
      if (id !== generation.current) return;
      const job = recognizeLabel(photo, language, (p) => {
        if (id === generation.current) setProgress(p);
      });
      stop.current = job.cancel;
      const result = await job.result;
      if (id === generation.current) {
        if (!result.text.trim()) throw Error("No text");
        setReview(result);
      }
    } catch {
      if (id === generation.current) setError(t("ocrFailed"));
    } finally {
      if (id === generation.current) {
        setBusy(false);
        stop.current = null;
      }
    }
  };
  return (
    <section className="label-ocr-panel" aria-label={t("recognizeLabel")}>
      <div className="ocr-action-row">
        <label>
          {t("ocrLanguage")}
          <select
            value={language}
            disabled={busy}
            onChange={(e) => {
              setLanguage(e.target.value as typeof language);
              setReview(null);
            }}
          >
            <option value="eng">{t("ocrEnglish")}</option>
            <option value="eng+chi_sim">{t("ocrChinese")}</option>
          </select>
        </label>
        <button
          className="secondary"
          type="button"
          disabled={!photo || busy}
          onClick={recognize}
        >
          <ScanText size={16} />
          {t(error ? "ocrRetry" : "recognizeLabel")}
        </button>
      </div>
      <p className="text-small muted">
        {photo ? t("ocrLocalHelp") : t("ocrPhotoRequired")}
      </p>
      {busy && (
        <div className="ocr-loading" role="status">
          <span>
            {progress === null ? t("ocrLoading") : t("ocrBusy", { progress })}
          </span>
          <progress max="100" value={progress ?? undefined} />
          <button type="button" onClick={cancel}>
            {t("ocrCancel")}
          </button>
        </div>
      )}
      {error && (
        <p className="ocr-error" role="alert">
          {error}
        </p>
      )}
      {review && (
        <div className="ocr-review">
          <h3>{t("ocrReview")}</h3>
          <p>{t("ocrReviewHelp")}</p>
          <small>
            {t("ocrConfidence", { value: Math.round(review.confidence) })}
          </small>
          {review.warnings.map((w) => (
            <p className="ocr-warning" key={w}>
              {t(w)}
            </p>
          ))}
          <label>
            {t("ocrBasisChoice")}
            <select
              value={review.basis ?? ""}
              onChange={(e) =>
                setReview({
                  ...review,
                  basis: (e.target.value || null) as ParsedLabel["basis"],
                })
              }
            >
              <option value="">{t("ocrBasisUnknown")}</option>
              <option value="100g">{t("customNutritionReference")}</option>
              <option value="serving">{t("serving")}</option>
            </select>
          </label>
          {review.basis === "100g" && <div className="form-grid"><label>{t("perReference")}<NumberInput aria-label={t("referenceAmount")} type="number" min="0" step="any" value={review.referenceAmount??""} onChange={e=>setReview({...review,referenceAmount:e.target.value?Number(e.target.value):undefined})}/></label><label>{t("unit")}<select value={review.referenceUnit??"g"} onChange={e=>setReview({...review,referenceUnit:e.target.value as 'g'|'mL'})}><option value="g">g</option><option value="mL">mL</option></select></label></div>}
          <label>
            {t("servingSizeOptional")} ({review.servingUnit??"g"})
            <NumberInput
              type="number"
              min="0"
              step="any"
              value={review.servingGrams ?? ""}
              onChange={(e) =>
                setReview({
                  ...review,
                  servingGrams: e.target.value ? Number(e.target.value) : null,
                })
              }
            />
          </label>
          {review.basis === "serving" && <label>{t("unit")}<select value={review.servingUnit??"g"} onChange={e=>setReview({...review,servingUnit:e.target.value as "g"|"mL"})}><option value="g">g</option><option value="mL">mL</option></select></label>}
          <NutritionFields
            value={review.nutrition}
            onChange={(nutrition) => setReview({ ...review, nutrition })}
          />
          {nutrientKeys.some((k) => review.nutrition[k] === null) && (
            <p className="text-small ocr-warning">
              {t("ocrMissing", {
                fields: nutrientKeys
                  .filter((k) => review.nutrition[k] === null)
                  .map((k) => t(k))
                  .join("、"),
              })}
            </p>
          )}
          <details>
            <summary>{t("ocrRaw")}</summary>
            <textarea
              rows={8}
              value={review.text}
              onChange={(e) => setReview({ ...review, text: e.target.value })}
            />
            <button
              type="button"
              onClick={() =>
                setReview(parseNutritionLabel(review.text, review.confidence))
              }
            >
              {t("ocrReparse")}
            </button>
          </details>
          <button
            type="button"
            className="primary ocr-apply"
            disabled={
              conflicts.length>0 ||
              !review.basis ||
              (review.basis === "100g" && (review.referenceAmount == null || !Number.isFinite(review.referenceAmount) || review.referenceAmount <= 0)) ||
              !nutrientKeys.some((k) => review.nutrition[k] !== null) ||
              nutrientKeys.some(
                (k) =>
                  review.nutrition[k] !== null &&
                  (!Number.isFinite(review.nutrition[k]) ||
                    Number(review.nutrition[k]) < 0),
              ) ||
              (review.servingGrams !== null &&
                (!Number.isFinite(review.servingGrams) ||
                  review.servingGrams <= 0))
            }
            onClick={() => {
              if (!review.basis || !confirm(t("ocrConfirm"))) return;
              onApply({ ...review, basis: review.basis, referenceUnit: review.referenceUnit??"g", servingUnit: review.servingUnit??"g", language });
            }}
          >
            {t("ocrApply")}
          </button>
          {conflicts.length>0&&<p className="ocr-warning" role="alert">{t('ocrBasisConflict',{fields:conflicts.map(k=>t(k)).join('、')})}</p>}
          <button type="button" onClick={() => setReview(null)}>
            {t("ocrCloseReview")}
          </button>
        </div>
      )}
    </section>
  );
}
