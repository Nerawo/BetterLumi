import {RecipeDetailImage} from "./RecipeDetailImage";
import {confirmDelete} from "./DeleteConfirmation";
import {wholeRecipeNutrition} from "./recipe-nutrition";
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
import { Modal, NutritionStrip, changed, type Notice } from "./ui";
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
  const { t } = useTranslation();
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
  const removeNote = (id: string) => confirmDelete("note",allNotes.find(note=>note.id===id)?.text??recipe.name,async()=>{
    if(id==="legacy") await recipes.put({...changed(recipe),stickyNote:""});
    else await softDelete(recipeNotes,id);
  });
  return (
    <Modal title={recipe.name} close={close} className="recipe-detail-modal">
      <div className="recipe-detail-scroll"><RecipeCategoryPicker className="detail-category-row" value={recipe.categoryIds ?? []} onToggle={(categoryId, included) => assignCategoryRecipes(categoryId, {[recipe.id]: included})} />
      <article className="recipe-detail">
        <div className="recipe-hero">
          <RecipeDetailImage key={recipe.id} recipe={recipe} notice={notice}/>
          <section className="hero-nutrition">
            <span className="eyebrow">{t("recipeNutritionTotal")}</span>
            <NutritionStrip
              value={wholeRecipeNutrition(recipe.lines)}
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
            <h2>{t("lines")}</h2>
            <ul className="detail-ingredients">
              {recipe.lines.map((l, i) => (
                <li key={i}>
                  <strong>{l.name}</strong>
                  <span>
                    {Number(l.quantity.toFixed(3))}{" "}
                    {l.unit === "g" ? t("gramsUnit") : l.unit === "serving" ? t("servingUnit") : l.unit}
                  </span>
                </li>
              ))}
            </ul>
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
          <button className="secondary" onClick={() => setEdit(true)}>
            {t("editRecipe")}
          </button>
          <button className="primary" onClick={() => addMeal(recipe)}>
            <Plus size={15} />
            {t("addTodayMeals")}
          </button>
        </div>
    </Modal>
  );
}
