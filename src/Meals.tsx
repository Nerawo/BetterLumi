import {defaultIngredientQuantity} from "./consumption-units";
import {NumberInput} from "./NumberInput";
import { nutritionReference } from "./db";
import {NumberUnit} from "./NumberUnit";
import {confirmDelete} from "./DeleteConfirmation";
import {retainedRecipeNutrition} from "./recipe-nutrition";
import { DateInput } from "./DateInput";
import { readLocalImage } from "./images";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Utensils } from "lucide-react";
import {
  db,
  plans,
  recipes as recipeTable,
  foodLogs,
  stamp,
  localDate,
  ingredientNutrition,
  sumNutrition,
  scaleNutrition,
  unknownNutrition,
  softDelete,
  type FoodLog,
  type Recipe,
  type RecipeLine,
  type PantryItem,
  type Nutrition,
} from "./domain";
import { RecipeLineEditor } from "./RecipeLineEditor";
import { consumedNutrition } from "./consumption";
import {
  Modal,
  NutritionFields,
  NutritionStrip,
  Empty,
  Actions,
  changed,
  type Notice,
} from "./ui";
export const categories = [
  "uncategorized",
  "breakfast",
  "lunch",
  "dinner",
  "snack",
];
export interface MealDraft {
  date: string;
  recipe?: Recipe;
  log?: FoodLog;
  onSaved?: () => Promise<void>;
}
export function AddFood({
  draft,
  recipes,
  pantry,
  close,
  notice: notify,
}: {
  draft: MealDraft;
  recipes: Recipe[];
  pantry: PantryItem[];
  close: () => void;
  notice: Notice;
}) {
  const { t } = useTranslation();
  const [message, setMessage] = useState("");
  const notice: Notice = message => { setMessage(message); };
  const initial = draft.log;
  const r = draft.recipe ?? recipes.find((r) => r.id === initial?.sourceId);
  const [source, setSource] = useState<"quick" | "recipe" | "pantry">(
    initial?.source ?? (r ? "recipe" : "quick"),
  );
  const [recipeId, setRecipeId] = useState(r?.id ?? initial?.sourceId ?? "");
  const [ingredientId, setIngredientId] = useState(
    initial?.source === "pantry" ? (initial.sourceId ?? "") : "",
  );
  const [recipeBasis,setRecipeBasis]=useState<"recipe"|"snapshot">(initial?.source==="recipe"&&initial.unit!=="recipe"?"snapshot":"recipe");
  const [quantity, setQuantity] = useState(initial?.quantity ?? 1);
  const [unit, setUnit] = useState<string>(
    initial?.unit ?? "serving",
  );
  const [nutrition, setNutrition] = useState<Nutrition>(
    initial?.baseNutrition ?? initial?.nutrition ?? unknownNutrition(),
  );
  const [lines, setLines] = useState<RecipeLine[]>(
    initial?.lines ??
      r?.lines.map(line=>({...line,nutrition:{...line.nutrition}})) ??
      [],
  );
  const [name, setName] = useState(initial?.name ?? r?.name ?? "");
  const [photo, setPhoto] = useState(initial?.photo ?? r?.photo ?? "");
  const [readingPhoto, setReadingPhoto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [consumptionPercent, setConsumptionPercent] = useState(
    initial?.consumptionPercent ?? 100,
  );
  const [renaming, setRenaming] = useState(false);
  const [estimated, setEstimated] = useState(initial?.estimated ?? false);
  const saveRecipeVersion = async (update: boolean) => {
    if (!lines.length || quantity <= 0) {
      notice(t("emptyLines"));
      return;
    }
    const original = recipes.find((r) => r.id === recipeId);
    if (update && (!original || !confirm(t("confirmOriginal")))) return;
    const variationName = update
      ? original!.name
      : prompt(t("variationName"), name);
    if (!variationName?.trim()) return;
    try {
      await recipeTable.put({
        ...(original ?? { ...stamp(), instructions: "", stickyNote: "" }),
        ...(update ? changed(original!) : stamp()),
        name: variationName.trim(),
        servings: update?original!.servings:1,
        lines: structuredClone(lines),
      });
      notice(t(update ? "originalUpdated" : "variationSaved"));
    } catch {
      notice(t("failedMessage"));
    }
  };
  const chooseRecipe = (id: string) => {
    setRenaming(false);
    setRecipeId(id);setRecipeBasis("recipe");setConsumptionPercent(100);
    const recipe = recipes.find((r) => r.id === id);
    if (recipe) {
      setName(recipe.name);
      setPhoto(recipe.photo ?? "");
      setQuantity(1);
      setLines(
        recipe.lines.map(line=>({...line,nutrition:{...line.nutrition}})),
      );
    }
  };
  const chooseIngredient = (id: string) => {
    setIngredientId(id);
    const item = pantry.find((i) => i.id === id);
    if (item) {
      setName(item.name);
      setUnit(item.basis === "100g" ? nutritionReference(item).unit : "serving");
      setQuantity(item.basis === "100g" ? nutritionReference(item).amount : 1);
    }
  };
  const ingredient = pantry.find((i) => i.id === ingredientId);
  const totals =
    source === "quick"
      ? nutrition
      : source === "recipe"
        ? sumNutrition(lines.map((l) => l.nutrition))
        : initial?.source === "pantry" &&
            initial.sourceId === ingredientId &&
            unit === initial.unit
          ? scaleNutrition(
              initial.baseNutrition ?? initial.nutrition,
              quantity / initial.quantity,
            )
          : ingredient
            ? ingredientNutrition(ingredient, quantity, unit)
            : unknownNutrition();
  const retained=source==="recipe"&&recipeBasis==="snapshot"&&initial&&lines===initial.lines;
  const preview=retained?retainedRecipeNutrition(initial.nutrition,initial.consumptionPercent,consumptionPercent,initial.baseNutrition):consumedNutrition(totals,consumptionPercent);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if(retained&&(initial.consumptionPercent??100)===0&&!initial.baseNutrition&&consumptionPercent!==0){notice(t("legacyNutritionUnavailable"));return}
    const f = new FormData(e.currentTarget);
    const date = String(f.get("date"));
    if (date > localDate()) {
      notice(t("errorDate"));
      return;
    }
    if (source !== "quick" && !name.trim()) {
      notice(t("requiredName"));
      return;
    }
    if (
      (source === "recipe" && !lines.length && !retained) ||
      (source === "pantry" && !ingredient && !initial)
    ) {
      notice(t("invalid"));
      return;
    }
    setBusy(true);
    try {
      await db.transaction("rw", [foodLogs, plans], async () => {
        await foodLogs.put({
          ...(initial ? changed(initial) : stamp()),
          date,
          category: String(f.get("category")),
          name: name.trim(),
          source,
          sourceId:
            source === "recipe"
              ? recipeId
              : source === "pantry"
                ? ingredientId
                : null,
          quantity:source==="recipe"&&recipeBasis==="recipe"?1:quantity,
          unit:
            source === "recipe"
              ? recipeBasis==="snapshot"?initial?.unit??"serving":"recipe"
              : source === "quick"
                ? "entry"
                : unit,
          nutrition: preview,
          baseNutrition:retained?initial.baseNutrition:totals,
          consumptionPercent,
          lines: source === "recipe" ? lines : [],
          photo,
          cookingNote: String(f.get("cookingNote")).trim(),
          estimated,
        });
        await draft.onSaved?.();
      });
      close();
      notify(t("savedMessage"));
    } catch {
      notice(t("failedMessage"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={t(initial ? "editMeal" : "addFood")} close={close} className="add-food-modal">
    <section className="add-food">
      <div className="segments source-tabs">
        {(["recipe", "pantry", "quick"] as const).map((key, index) => (
          <button
            type="button"
            aria-pressed={source === key}
            className={source === key ? "selected" : ""}
            key={key}
            aria-label={t({recipe:"savedRecipe",pantry:"savedIngredient",quick:"quick"}[key])}
            onClick={() => {
              setRenaming(false);
              setSource(key);
              setName("");
              setQuantity(1);
              setConsumptionPercent(100);
              setLines([]);
              setRecipeId("");
              setIngredientId("");
              setNutrition(unknownNutrition());
            }}
          >
            {t(["foodTabRecipe", "foodTabPantry", "quick"][index])}
          </button>
        ))}
      </div>
          <form onSubmit={submit}>
            <div className="add-food-scroll">
            <div className="form-grid meal-date-row">
              <label>
                {t("date")}
                <DateInput
                  name="date"
                  max={localDate()}
                  required
                  defaultValue={initial?.date ?? draft.date}
                />
              </label>
              <label>
                {t("mealCategory")}
                <select
                  name="category"
                  defaultValue={initial?.category ?? "uncategorized"}
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {t(c)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {source === "recipe" && (
              <>
                <label>
                  {t("selectRecipe")}
                  <select
                    value={recipeId}
                    onChange={(e) => chooseRecipe(e.target.value)}
                  >
                    <option value="">{t("selectRecipe")}</option>
                    {recipes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </label>
                {!recipes.length && <p>{t("noRecipes")}</p>}
              </>
            )}
            {source === "pantry" && (
              <>
                <label>
                  {t("selectIngredient")}
                  <select
                    value={ingredientId}
                    onChange={(e) => chooseIngredient(e.target.value)}
                  >
                    <option value="">{t("selectIngredient")}</option>
                    {pantry.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} {i.nameZh}
                      </option>
                    ))}
                  </select>
                </label>
                {!pantry.length && <p>{t("noIngredients")}</p>}
              </>
            )}
            {source === "recipe" ? (
              <div className="recipe-rename">
                <button type="button" className="text-link" aria-expanded={renaming} onClick={() => setRenaming(!renaming)}>{t("renameFood")}</button>
                {renaming && <label>{t("foodName")}<input required value={name} onChange={e => setName(e.target.value)} /></label>}
              </div>
            ) : (<label>
              {t(source === "quick" ? "optionalFoodName" : "foodName")}
              <input
                required={source !== "quick"}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>)}
            {source === "quick" ? (
              <>
                <NutritionFields value={nutrition} onChange={setNutrition} />
            <label className="consumption-control">
              {t("consumptionPercent")}
              <NumberInput
                name="consumptionPercent"
                required
                type="number"
                min="0"
                step="any"
                value={consumptionPercent}
                onChange={(e) =>
                  e.target.value !== "" && setConsumptionPercent(Number(e.target.value))
                }
              />
            </label>

              </>
            ) : (
              <>
                <div className={"meal-amounts " + (source === "recipe" ? "recipe-amounts" : "")}>
                {source!=="recipe"&&<>
                <div className="form-grid">
                  <label>
                    {t("quantity")}
                    <NumberInput
                      required
                      min="0"
                      step="any"
                      type="number"
                      key={unit}
                      value={quantity}
                      onChange={(e) => {
                        e.currentTarget.setCustomValidity(e.target.value !== "" && Number(e.target.value) <= 0 ? t("invalid") : "");
                        const amount = Number(e.target.value);
                        if (!Number.isFinite(amount) || amount <= 0) return;
                        setQuantity(amount);
                      }}
                    />
                  </label>
                  {source === "pantry" && (
                    <label>
                      {t("unit")}
                      <select
                        value={unit}
                        onChange={(e) => {
                          const nextUnit=e.target.value;
                          if(nextUnit===unit)return;
                          setUnit(nextUnit);
                          setQuantity(defaultIngredientQuantity(ingredient,nextUnit));
                        }}
                      >
                        <option value="g">{t("gramsUnit")}</option><option value="mL">mL</option>
                        <option value="serving">{t("servingUnit")}</option>
                        {ingredient?.consumptionUnit && <option value={ingredient.consumptionUnit.name}>{ingredient.consumptionUnit.name}</option>}
                        {!["g","mL","serving",ingredient?.consumptionUnit?.name].includes(unit) && <option value={unit}>{unit}</option>}
                      </select>
                    </label>
                  )}
                </div>
                </>}
            {source==="recipe"&&recipeBasis==="snapshot"&&<p className="muted text-small">{t("legacyRecipeSnapshot")}</p>}
            <label className="consumption-control">
              {t("consumptionPercent")}
              <NumberInput
                name="consumptionPercent"
                required
                type="number"
                min="0"
                step="any"
                value={consumptionPercent}
                onChange={(e) =>
                  e.target.value !== "" && setConsumptionPercent(Number(e.target.value))
                }
              />
            </label>
                </div>
                <div className="meal-nutrition-preview">
                <NutritionStrip
                  value={preview}
                />
                </div>
                {source === "recipe" && (
                  <details className="meal-advanced" key={recipeId}>
                    <summary>{t("advancedRecipe")}</summary>
                    <div className="info-note">
                      <span>{t("onceOnly")}</span>
                    </div>
                    <RecipeLineEditor
                      compact
                      lines={lines}
                      setLines={setLines}
                      pantry={pantry}
                    />
                    <div className="explicit-recipe-actions">
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => saveRecipeVersion(false)}
                      >
                        {t("saveVariation")}
                      </button>
                      <button
                        type="button"
                        className="text-link"
                        disabled={!recipes.some((r) => r.id === recipeId)}
                        onClick={() => saveRecipeVersion(true)}
                      >
                        {t("updateOriginal")}
                      </button>
                    </div>
                  </details>
                )}

              </>
            )}
            <details className="meal-extras">
              <summary>{t("mealExtras")}</summary>
            <label className="meal-photo-input">
              {t("mealPhoto")}
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setReadingPhoto(true);
                  try {
                    setPhoto(await readLocalImage(file));
                  } catch {
                    notice(t("photoError"));
                  } finally {
                    setReadingPhoto(false);
                  }
                }}
              />
            </label>
            {photo && (
              <div className="photo-field">
                <img src={photo} alt={t("mealPhoto")} />
                <button type="button" onClick={() => setPhoto("")}>
                  {t("removePhoto")}
                </button>
              </div>
            )}
            <label>
              {t("cookingNote")}
              <textarea
                name="cookingNote"
                rows={2}
                defaultValue={initial?.cookingNote}
              />
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={estimated}
                onChange={(e) => setEstimated(e.target.checked)}
              />
              {t("estimated")}
            </label>
            </details>
            </div>
            <div role="status" className="food-status">{message}</div>
            <div className="form-actions add-food-footer">
              <button type="button" onClick={close}>
                {t("cancel")}
              </button>
              <button className="primary" disabled={busy || readingPhoto}>
                {t("saveMealRecord")}
              </button>
            </div>
          </form>
    </section>
    </Modal>
  );
}
export function MealList({
  logs,
  edit,
}: {
  logs: FoodLog[];
  edit: (l: FoodLog) => void;
}) {
  const { t } = useTranslation();
  return logs.length ? (
    <div className="meal-groups">
      {categories.map((category) => {
        const entries = logs.filter((l) => l.category === category);
        return entries.length ? (
          <div className="meal-group" key={category}>
            <span className="eyebrow">{t(category)}</span>
            {entries.map((log) => (
              <article className="meal-row" key={log.id}>
                <div className="grow">
                  <h3>
                    {log.name || t("unnamedFood")}
                    {log.estimated && (
                      <span className="badge">{t("estimated")}</span>
                    )}
                  </h3>
                  {log.lines.length>0&&<p className="meal-ingredients">{log.lines.map(line=>line.name).join(" · ")}</p>}
                  {log.cookingNote && (
                    <p className="cooking-note">{log.cookingNote}</p>
                  )}
                </div>
                <div className="meal-amount-summary"><strong>{log.nutrition.calories===null?t("notRecorded"):Math.round(log.nutrition.calories)}{log.nutrition.calories!==null&&<small> kcal</small>}</strong>{log.consumptionPercent!==undefined&&log.consumptionPercent!==100&&<span><NumberUnit value={log.consumptionPercent} unit="%"/></span>}</div>
                <Actions
                  edit={() => edit(log)}
                  remove={async () => {
                    await confirmDelete("meal",log.name,async()=>{await softDelete(foodLogs, log.id)});
                  }}
                />
              </article>
            ))}
          </div>
        ) : null;
      })}
    </div>
  ) : (
    <Empty icon={<Utensils />} heading={t("emptyFood")} />
  );
}
