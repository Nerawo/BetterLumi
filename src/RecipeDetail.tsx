import {journalQuantity} from './journal-quantity';
import {JournalMethod} from './JournalMethod';
import {JournalHeading} from './JournalHeading';
import {CookingMode} from './CookingMode';
import {recipeSections} from './cooking-journal';
import './cooking-journal-locale';
import {StickyNotes,useStickyNotes} from './StickyNotes';
import {commitStickyNoteChanges} from './sticky-notes';
import {householdUnitLabel} from './household-units';
import {useIngredientPreferences} from './useIngredientPreferences';
import {RecipeDetailImage} from "./RecipeDetailImage";
import {isBuiltInRecipe,bologneseCookingExtras} from './data/builtInRecipes';
import {BuiltInRecipeSource} from './BuiltInRecipeSource';
import {recipeYield,recipeServingLines,recipeServingNutrition} from "./recipe-nutrition";
import './recipe-yield-locale';
import { Fragment,useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Pencil } from "lucide-react";
import {
  unknownNutrition,
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
  addMeal, recipes, mealDate, onCookingMealSaved,
}: {
  recipe: Recipe | undefined;
  pantry: PantryItem[];
  notice: Notice;
  addMeal: (r: Recipe) => void;
  recipes: Recipe[]; mealDate: string; onCookingMealSaved: (date:string)=>void;
}) {
  const { t,i18n } = useTranslation(),preferences=useIngredientPreferences();
  const close = () => {
    if (history.state?.recipeOverlay) history.back();
    else navigate("/recipes", true);
  };
  const notes=useStickyNotes(recipe?.id??'');
  const [edit, setEdit] = useState(false);
  const [cooking,setCooking]=useState(false);
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
  if(cooking)return <CookingMode recipe={recipe} recipes={recipes} pantry={pantry} date={mealDate} notice={notice} mealSaved={onCookingMealSaved} close={()=>setCooking(false)}/>;
  return (
    <Modal title={recipe.name} close={close} className={"recipe-detail-modal journal-recipe-detail"+(recipe.photo?"":" journal-no-photo")}>
      <div className="recipe-detail-scroll">{builtIn?<div className="recipe-reference-detail"><span>{t('recipeCanonicalYield',{count:recipeYield(recipe)})}</span><span> · </span><BuiltInRecipeSource/></div>:<RecipeCategoryPicker className="detail-category-row" value={recipe.categoryIds ?? []} onToggle={(categoryId, included) => assignCategoryRecipes(categoryId, {[recipe.id]: included})} />}
      <article className="recipe-detail">
        <div className="recipe-hero">
          {builtIn?<img className="detail-photo built-in-recipe-photo" src={recipe.photo} alt={recipe.name} width={800} height={800}/>:<RecipeDetailImage key={recipe.id} recipe={recipe} notice={notice}/>}
          <section className="hero-nutrition">
            <span className="eyebrow">{t(validAmount&&amount===1?'recipePerServing':'recipeCookingTotal')}</span>
            <RecipeNutritionStrip
              value={validAmount?recipeServingNutrition(recipe,amount):unknownNutrition()}
            />
          </section>
        </div>
        <div className="detail-title">
          {recipe.category && (
            <span className="eyebrow">{recipe.category}</span>
          )}

        </div>
            <div className="recipe-yield-detail"><label>{t('recipeCookingServings')}<span className="recipe-serving-input"><span className="recipe-serving-stepper"><button type="button" aria-label="−" disabled={!validAmount||amount<=0.5} onClick={()=>setCookingServings(String(Math.max(0.5,amount-0.5)))}>−</button><input type="number" inputMode="decimal" min="0.01" step="any" value={cookingServings} onChange={e=>setCookingServings(e.target.value)}/><button type="button" aria-label="+" onClick={()=>setCookingServings(String((validAmount?amount:0)+0.5))}>+</button></span><span>{t('recipeYieldUnit')}</span></span></label><small className="muted">{t('recipeCanonicalYield',{count:recipeYield(recipe)})}</small></div>
        <div className="recipe-reading-grid">
          <section className="card">

            <h2><JournalHeading>Ingredients</JournalHeading></h2>
            <ul className="detail-ingredients">
              {recipeSections({...recipe,lines:cookingLines}).map(group=><Fragment key={group.id}>{group.lines.length>0&&(recipe.ingredientGroups?.length??0)>0&&<li className="journal-overview-group"><h3><JournalHeading>{group.name||t('journalUngrouped')}</JournalHeading></h3></li>}{group.lines.map((l, i) => (
                <li key={i}>
                  <strong>{l.name}</strong>
                  <span>
                    {journalQuantity(l)}{" "}
                    {l.source==='batch'&&l.unit==='fraction'?'% '+t('storageReference'):l.unit === "g" ? t("gramsUnit") : l.unit === "serving" ? t("servingUnit") : householdUnitLabel(l.ingredientId,l.unit,i18n.language,preferences[l.ingredientId]?.units)}
                  </span>
                </li>
              ))}</Fragment>)}
              {builtIn&&bologneseCookingExtras.map(extra=><li key={extra.nameEn}><strong>{zh?extra.nameZh:extra.nameEn}</strong><span>{zh?extra.amountZh:extra.amountEn}</span></li>)}
            </ul>

          </section>
          <section className="card method-card">
            <h2><JournalHeading>Method</JournalHeading></h2>
            <div className="recipe-method"><JournalMethod text={recipe.instructions||t('notRecorded')}/></div>
          </section>
        </div>
        {!builtIn&&<div className="journal-content-actions"><button type="button" className="secondary recipe-edit-trigger" onClick={()=>setEdit(true)}><Pencil size={13}/>{t('editRecipe')}</button></div>}
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
          <button type="button" className="primary start-cooking" onClick={()=>setCooking(true)}>{t('startCooking')}</button>
          <button className="secondary journal-add-meal" onClick={() => addMeal(recipe)}>
            <Plus size={15} />
            {t("journalAddMeal")}
          </button>

        </div>
    </Modal>
  );
}
