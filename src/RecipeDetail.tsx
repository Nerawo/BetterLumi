import {householdUnitLabel} from './household-units';
import {useIngredientPreferences} from './useIngredientPreferences';
import {RecipeDetailImage} from "./RecipeDetailImage";
import {isBuiltInRecipe,bologneseCookingExtras} from './data/builtInRecipes';
import {BuiltInRecipeSource} from './BuiltInRecipeSource';
import {confirmDelete} from "./DeleteConfirmation";
import {recipeYield,recipeServingLines,recipeServingNutrition} from "./recipe-nutrition";
import './recipe-yield-locale';
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import {
  recipes,
  stamp,
  softDelete,
  type Recipe,
  type PantryItem,
} from "./domain";
import { recipeNotes } from "./goals";
import { navigate } from "./routing";
import { RecipeCategoryPicker } from "./RecipeCategoryPicker";
import { assignCategoryRecipes } from "./categories";
import { RecipeEditor } from "./Recipes";
import { Modal, changed, type Notice } from "./ui";
import {RecipeNutritionStrip} from './RecipeNutritionStrip';
export function RecipeDetail({
  recipe,
  pantry,
  notice,
  addMeal,
}: {
  recipe: Recipe | undefined;
  pantry: PantryItem[];
  notice: Notice;
  addMeal: (r: Recipe) => void;
}) {
  const { t,i18n } = useTranslation(),preferences=useIngredientPreferences();
  const close = () => {
    if (history.state?.recipeOverlay) history.back();
    else navigate("/recipes", true);
  };
  const notes =
    useLiveQuery(
      () =>
        recipeNotes
          .where("recipeId")
          .equals(recipe?.id ?? "")
          .filter((n) => !n.deletedAt)
          .toArray(),
      [recipe?.id],
    ) ?? [];
  const [edit, setEdit] = useState(false);
  const [cookingServings,setCookingServings]=useState('1');
  const [note, setNote] = useState<{ id?: string; text: string } | null>(null);
  if (!recipe)
    return (
      <Modal
        title={t("recipeMissing")}
        close={close}
        className="recipe-detail-modal"
      >
        <></>
      </Modal>
    );
  const allNotes = [
    ...(recipe.stickyNote ? [{ id: "legacy", text: recipe.stickyNote }] : []),
    ...notes,
  ];
  const amount=Number(cookingServings),validAmount=Number.isFinite(amount)&&amount>0;
  const cookingLines=validAmount?recipeServingLines(recipe,amount):[];
  const builtIn=isBuiltInRecipe(recipe),zh=i18n.language.startsWith('zh');
  const removeNote = (id: string) => confirmDelete("note",allNotes.find(note=>note.id===id)?.text??recipe.name,async()=>{
    if(id==="legacy") await recipes.put({...changed(recipe),stickyNote:""});
    else await softDelete(recipeNotes,id);
  });
  return (
    <Modal title={recipe.name} close={close} className="recipe-detail-modal">
      <div className="recipe-detail-scroll">{builtIn?<div className="recipe-reference-detail"><span>{t('recipeCanonicalYield',{count:recipeYield(recipe)})}</span><span> · </span><BuiltInRecipeSource/></div>:<RecipeCategoryPicker className="detail-category-row" value={recipe.categoryIds ?? []} onToggle={(categoryId, included) => assignCategoryRecipes(categoryId, {[recipe.id]: included})} />}
      <article className="recipe-detail">
        <div className="recipe-hero">
          {builtIn?<img className="detail-photo built-in-recipe-photo" src={recipe.photo} alt={recipe.name} width={800} height={800}/>:<RecipeDetailImage key={recipe.id} recipe={recipe} notice={notice}/>}
          <section className="hero-nutrition">
            <span className="eyebrow">{t("recipePerServing")}</span>
            <RecipeNutritionStrip
              value={recipeServingNutrition(recipe)}
            />
          </section>
        </div>
        <div className="detail-title">
          {recipe.category && (
            <span className="eyebrow">{recipe.category}</span>
          )}

        </div>
        <div className="recipe-reading-grid">
          <section className="card">
            <div className="recipe-yield-detail"><label>{t('recipeCookingServings')}<span className="recipe-serving-input"><span className="recipe-serving-stepper"><button type="button" aria-label="−" disabled={!validAmount||amount<=0.5} onClick={()=>setCookingServings(String(Math.max(0.5,amount-0.5)))}>−</button><input type="number" inputMode="decimal" min="0.01" step="any" value={cookingServings} onChange={e=>setCookingServings(e.target.value)}/><button type="button" aria-label="+" onClick={()=>setCookingServings(String((validAmount?amount:0)+0.5))}>+</button></span><span>{t('recipeYieldUnit')}</span></span></label><small className="muted">{t('recipeCanonicalYield',{count:recipeYield(recipe)})}</small></div>
            <h2>{t("lines")}</h2>
            <ul className="detail-ingredients">
              {cookingLines.map((l, i) => (
                <li key={i}>
                  <strong>{l.name}</strong>
                  <span>
                    {Number(l.quantity.toFixed(3))}{" "}
                    {l.unit === "g" ? t("gramsUnit") : l.unit === "serving" ? t("servingUnit") : householdUnitLabel(l.ingredientId,l.unit,i18n.language,preferences[l.ingredientId]?.units)}
                  </span>
                </li>
              ))}
              {builtIn&&bologneseCookingExtras.map(extra=><li key={extra.nameEn}><strong>{zh?extra.nameZh:extra.nameEn}</strong><span>{zh?extra.amountZh:extra.amountEn}</span></li>)}
            </ul>
            {validAmount&&<section className="recipe-cooking-nutrition"><span className="eyebrow">{t('recipeCookingTotal')}</span><RecipeNutritionStrip value={recipeServingNutrition(recipe,amount)}/></section>}
          </section>
          <section className="card method-card">
            <h2>{t("instructions")}</h2>
            <div className="recipe-method preserved-text">
              {recipe.instructions || t("notRecorded")}
            </div>
          </section>
        </div>
        <section className="little-notes">
          <button className="text-link" onClick={() => setNote({ text: "" })}>
            {t("writeNote")}
          </button>
          <div className="notes-grid">
            {allNotes.map((n) => (
              <div className="paper-note" key={n.id}>
                <button
                  className="note-text preserved-text"
                  onClick={() => setNote(n)}
                >
                  {n.text}
                </button>
                <details className="note-menu">
                  <summary aria-label={t("noteMenu")}>⋯</summary>
                  <button onClick={() => removeNote(n.id)}>
                    {t("delete")}
                  </button>
                </details>
              </div>
            ))}
          </div>
        </section>
        {edit && (
          <RecipeEditor
            item={recipe}
            pantry={pantry}
            close={() => setEdit(false)}
            notice={notice}
          />
        )}
        {note && (
          <Modal
            title={t(note.id ? "edit" : "addNote")}
            close={() => setNote(null)}
          >
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const text = String(f.get("text")).trim();
                if (!text) return;
                try {
                  if (note.id === "legacy")
                    await recipes.put({ ...changed(recipe), stickyNote: text });
                  else {
                    const old = note.id ? await recipeNotes.get(note.id) : null;
                    await recipeNotes.put({
                      ...(old ? changed(old) : stamp()),
                      recipeId: recipe.id,
                      text,
                    });
                  }
                  setNote(null);
                  notice(t("savedMessage"));
                } catch {
                  notice(t("failedMessage"));
                }
              }}
            >
              <label>
                {t("noteText")}
                <textarea
                  name="text"
                  rows={5}
                  required
                  defaultValue={note.text}
                />
              </label>
              <div className="form-actions">
                <button type="button" onClick={() => setNote(null)}>
                  {t("cancel")}
                </button>
                <button className="primary">{t("save")}</button>
              </div>
            </form>
          </Modal>
        )}
      </article></div>
        <div className="form-actions recipe-detail-actions detail-toolbar">
          {!builtIn&&<button className="secondary" onClick={() => setEdit(true)}>
            {t("editRecipe")}
          </button>}
          <button className="primary" onClick={() => addMeal(recipe)}>
            <Plus size={15} />
            {t("addTodayMeals")}
          </button>
        </div>
    </Modal>
  );
}
