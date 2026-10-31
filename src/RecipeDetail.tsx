import {StickyNotes,useStickyNotes} from './StickyNotes';
import {commitStickyNoteChanges} from './sticky-notes';
import {householdUnitLabel} from './household-units';
import {useIngredientPreferences} from './useIngredientPreferences';
import {RecipeDetailImage} from "./RecipeDetailImage";
import {isBuiltInRecipe,bologneseCookingExtras} from './data/builtInRecipes';
import {BuiltInRecipeSource} from './BuiltInRecipeSource';
import {recipeYield,recipeServingLines,recipeServingNutrition} from "./recipe-nutrition";
import './recipe-yield-locale';
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import {
  type Recipe,
  type PantryItem,
} from "./domain";
import { navigate } from "./routing";
import { RecipeCategoryPicker } from "./RecipeCategoryPicker";
import { assignCategoryRecipes } from "./categories";
import { RecipeEditor } from "./Recipes";
import { Modal, type Notice } from "./ui";
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
  const notes=useStickyNotes(recipe?.id??'');
  const [edit, setEdit] = useState(false);
  const [cookingServings,setCookingServings]=useState('1');
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
  const amount=Number(cookingServings),validAmount=Number.isFinite(amount)&&amount>0;
  const cookingLines=validAmount?recipeServingLines(recipe,amount):[];
  const builtIn=isBuiltInRecipe(recipe),zh=i18n.language.startsWith('zh');
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
                    {Number((l.source==='batch'&&l.unit==='fraction'?l.quantity*100:l.quantity).toFixed(3))}{" "}
                    {l.source==='batch'&&l.unit==='fraction'?'% '+t('storageReference'):l.unit === "g" ? t("gramsUnit") : l.unit === "serving" ? t("servingUnit") : householdUnitLabel(l.ingredientId,l.unit,i18n.language,preferences[l.ingredientId]?.units)}
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
        <StickyNotes notes={notes} recipeId={recipe.id} onChange={async change=>{await commitStickyNoteChanges([change]);notice(t('savedMessage'))}}/>
        {edit && (
          <RecipeEditor
            item={recipe}
            pantry={pantry}
            close={() => setEdit(false)}
            notice={notice}
          />
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
