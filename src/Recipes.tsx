import {recipeListNutrition} from './recipe-list-nutrition';
import {recipeNutritionDisplay} from './recipe-nutrition-display';
import {RecipeNutritionStrip} from './RecipeNutritionStrip';
import {builtInRecipeItems,isBuiltInRecipe} from './data/builtInRecipes';
import {BuiltInRecipeSource} from './BuiltInRecipeSource';
import {DirectoryListHeader} from './DirectoryListHeader';
import {CollectionNavigation} from './CollectionNavigation';
import {orderedItems} from './collection-order';
import { RecipeLineEditor } from "./RecipeLineEditor";
import {RecipeCategoryManager} from "./RecipeCategoryManager";
import {NumberUnit} from "./NumberUnit";
import {confirmDelete} from "./DeleteConfirmation";
import {wholeRecipeNutrition,recipeYield} from "./recipe-nutrition";
import './recipe-yield-locale';
import { useLiveQuery } from "dexie-react-hooks";
import {
  categories,
  filterRecipes,
  assignCategoryRecipes,
  type RecipeCategory,
} from "./categories";
import { RecipeCategoryPicker } from "./RecipeCategoryPicker";
import { Fragment, useState, useRef, type FormEvent } from "react";
import { navigate, routeHref } from "./routing";
import { readLocalImage } from "./images";
import { useTranslation } from "react-i18next";
import {
  Search,
  Plus,
  Upload,
  X,
} from "lucide-react";
import {
  recipes,
  stamp,
  softDelete,
  type Recipe,
  type RecipeLine,
  type PantryItem,
} from "./domain";
import {
  Modal,
  Empty,
  Actions,
  changed,
  type Notice,
} from "./ui";
export function Recipes({
  items,
  pantry,
  notice,
}: {
  items: Recipe[];
  pantry: PantryItem[];
  notice: Notice;
}) {
  const { t,i18n } = useTranslation();
  const [editing, setEditing] = useState<Recipe | null | undefined>();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("");
  const categoryItems =
    useLiveQuery(async() => orderedItems(await categories.filter((c) => !c.deletedAt).toArray())) ?? [];
  const [manage, setManage] = useState(false);
  const categoryManagerTrigger=useRef<HTMLButtonElement>(null);
  const closeCategoryManager=()=>{setManage(false);requestAnimationFrame(()=>categoryManagerTrigger.current?.focus())};
  const [manageRecipes, setManageRecipes] = useState<RecipeCategory | null>(null);

  const filtered = filterRecipes(
    [...items,...builtInRecipeItems(i18n.language)],
    search,
    categoryItems.some((c) => c.id === tab) ? tab : "",
    categoryItems,
  );
  return (
    <>
      <div className="search">
        <Search size={18} />
        <input
          placeholder={t("searchRecipes")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <CollectionNavigation items={categoryItems} active={categoryItems.some(c=>c.id===tab)?tab:''} onChange={setTab} label={t('recipeCategory')} allLabel={t('allCategories')} manageLabel={t('manageCategories')} manage={()=>setManage(true)} managementRef={categoryManagerTrigger}/>
      <DirectoryListHeader count={t('recipeCount',{count:filtered.length})}>{categoryItems.filter(category=>category.id===tab).map(category=><span key={category.id}><button type="button" className="text-link manage-category-recipes" aria-label={t("manageCategoryRecipes",{name:category.name})} onClick={()=>setManageRecipes(category)}>{t("manageRecipes")}</button></span>)}</DirectoryListHeader>
      <button type="button" className="primary recipe-fab directory-fab" onClick={() => setEditing(null)} aria-label={t("directoryCreateRecipe")}><Plus size={18} aria-hidden="true"/><span>{t("directoryCreateRecipe")}</span></button>
      <div className="recipe-grid recipe-list">
        {filtered.map(r=>{const {nutrition,perServing}=recipeListNutrition(r),basis=t(perServing?"compactPerServing":"recipeListWholeBasis"),hasMacros=(["protein","carbs","fat"] as const).some(key=>nutrition[key]!==null);return <article className="recipe-card recipe-list-row" key={r.id} onClick={e=>{if(!(e.target as HTMLElement).closest("button,a,input,select,dialog"))navigate("/recipes/"+encodeURIComponent(r.id))}}>
          {r.photo&&<img className="recipe-thumbnail" src={r.photo} alt="" loading="lazy"/>}
          <div className="recipe-body"><h3><a href={routeHref("/recipes/"+encodeURIComponent(r.id))} onClick={e=>{e.preventDefault();navigate("/recipes/"+encodeURIComponent(r.id))}}>{r.name}</a></h3>
          {isBuiltInRecipe(r)&&<div className="recipe-reference-badge"><BuiltInRecipeSource/></div>}
          <p className="recipe-metadata">{nutrition.calories===null?t(hasMacros?'recipeListCaloriesMissing':'nutritionNotRecorded'):<NumberUnit value={recipeNutritionDisplay(nutrition.calories)} unit="kcal"/>} / {basis}</p>
          {hasMacros&&<p className="macro-summary recipe-macros">{(['protein','carbs','fat'] as const).map((key,index)=><Fragment key={key}>{index>0&&' · '}<span className="recipe-macro">{t(key==='carbs'?'recipeListCarbs':key)} {nutrition[key]===null?<span className="recipe-nutrient-unavailable">{t('notRecorded')}</span>:<NumberUnit value={recipeNutritionDisplay(nutrition[key]!)} unit="g"/>}</span></Fragment>)}</p>}</div>
          {!isBuiltInRecipe(r)&&<Actions edit={()=>setEditing(r)} remove={async()=>{await confirmDelete("recipe",r.name,async()=>{await softDelete(recipes,r.id)})}}/>}
        </article>})}
      </div>
      {!items.length && !builtInRecipeItems(i18n.language).length && (
        <Empty heading={t("noRecipesYet")} />
      )}
      {!filtered.length && <p className="collection-empty">{t("emptySearch")}</p>}
      {manage&&<RecipeCategoryManager items={categoryItems} close={closeCategoryManager} onDeleted={id=>{if(tab===id)setTab("")}}/>}
      {manageRecipes && <CategoryRecipeManager key={manageRecipes.id} category={manageRecipes} close={() => setManageRecipes(null)} notice={notice} />}
      {editing !== undefined && (
        <RecipeEditor
          item={editing}
          pantry={pantry}
          close={() => setEditing(undefined)}
          notice={notice}
        />
      )}
    </>
  );
}
function CategoryRecipeManager({ category, close, notice }: { category: RecipeCategory; close: () => void; notice: Notice }) {
  const { t } = useTranslation();
  const items = useLiveQuery(() => recipes.filter(recipe => !recipe.deletedAt).toArray());
  const [changes, setChanges] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <Modal title={t("manageCategoryRecipes", {name: category.name})} close={close} className="category-recipes-modal">
    <form onSubmit={async event => {
      event.preventDefault();
      setBusy(true);
      try {
        await assignCategoryRecipes(category.id, changes);
        close();
        notice(t("savedMessage"));
      } catch { setError(t("failedMessage")); }
      finally { setBusy(false); }
    }}>
      <div className="modal-scroll"><fieldset className="bulk-category-recipes" disabled={busy}>
        <legend>{category.name}</legend>
        {items?.map(recipe => <label key={recipe.id}>
          <input type="checkbox" checked={changes[recipe.id] ?? (recipe.categoryIds ?? []).includes(category.id)} onChange={event => setChanges({...changes, [recipe.id]: event.target.checked})} />
          <span>{recipe.name}</span>
        </label>)}
        {items?.length === 0 && <p className="muted">{t("emptyRecipes")}</p>}
      </fieldset>
      {error && <p role="alert">{error}</p>}</div>
      <div className="form-actions"><button type="button" onClick={close}>{t("cancel")}</button><button className="primary" disabled={busy || !items}>{t("save")}</button></div>
    </form>
  </Modal>;
}

export function RecipeEditor({
  item,
  pantry,
  close,
  notice,
}: {
  item: Recipe | null;
  pantry: PantryItem[];
  close: () => void;
  notice: Notice;
}) {
  const { t } = useTranslation();
  const [categoryIds, setCategoryIds] = useState(item?.categoryIds ?? []);
  const [lines, setLines] = useState<RecipeLine[]>(item?.lines ?? []);
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState(item?.photo ?? "");
  const [reading, setReading] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name")).trim();
    if (!name || !lines.length || lines.some((l) => l.quantity <= 0) || !Number.isFinite(Number(f.get('servings'))) || Number(f.get('servings'))<=0) {
      notice(t("emptyLines"));
      return;
    }
    setBusy(true);
    try {
      await recipes.put({
        ...(item ? changed(item) : stamp()),
        name,
        servings: Number(f.get('servings')),
        lines,
        instructions: String(f.get("instructions")).trim(),
        stickyNote: String(f.get("stickyNote")).trim(),
        category: item?.category ?? "",
        categoryIds,
        photo,
      });
      close();
      notice(t("savedMessage"));
    } catch {
      notice(t("failedMessage"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={t(item ? "editRecipe" : "newRecipe")} close={close} className="recipe-editor-modal">
      <form onSubmit={submit} className="recipe-editor-form">
        <div className="recipe-editor-scroll">
          <section className="recipe-editor-basic-section"><h3>{t("basicInformation")}</h3><div className="recipe-editor-identity"><label>
            {t("name")}
            <input name="name" required defaultValue={item?.name} />
          </label>        

        <div className={"recipe-photo-control "+(photo?"photo-field":"")}><label className="recipe-photo-upload" aria-label={t(photo?"replacePhoto":"uploadRecipePhoto")}>
          {photo&&<img src={photo} alt={t("recipePhoto")} />}<span className="photo-upload-prompt"><Upload size={20}/><span className="sr-only">{t(photo?"replacePhoto":"uploadRecipePhoto")}</span></span>
          <input
            className="sr-only" type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              const control=e.currentTarget;
              if (!file) return;
              setReading(true);
              try {
                setPhoto(await readLocalImage(file));
              } catch {
                notice(t("photoError"));
              } finally {
                control.value="";setReading(false);
              }
            }}
          />
        </label>{photo&&<button type="button" className="photo-remove" aria-label={t("removePhoto")} title={t("removePhoto")} onClick={()=>setPhoto("")}><X size={14}/></button>}</div>
</div>
        <div className="recipe-editor-basics">
        <label className="recipe-yield-editor">{t('recipeYield')}<span className="recipe-serving-input"><input name="servings" type="number" inputMode="decimal" min="0.01" step="any" required defaultValue={recipeYield(item??{})}/><span>{t('recipeYieldUnit')}</span></span><small className="muted">{t('recipeYieldHelp')}</small></label>
        <fieldset className="category-assignments">
          <legend>{t("recipeCategoriesMultiple")}</legend>
          <RecipeCategoryPicker value={categoryIds} onToggle={(id, included) => setCategoryIds(previous => included ? [...new Set([...previous, id])] : previous.filter(value => value !== id))} />
          {item?.category && (
            <small>
              {t("legacyCategory")}: {item.category}
            </small>
          )}
        </fieldset>
        </div></section>

        <section className="recipe-editor-section">
        <h3>{t("lines")}</h3>
        <RecipeLineEditor compact lines={lines} setLines={setLines} pantry={pantry} />
        </section>
        <section className="recipe-editor-section recipe-editor-nutrition">
          <h3>{t("recipeNutritionTotal")}</h3><RecipeNutritionStrip value={wholeRecipeNutrition(lines)}/>
        </section>
        <label className="recipe-editor-section recipe-editor-text">
          <span>{t("instructions")}</span>
          <textarea
            name="instructions"
            rows={4}
            defaultValue={item?.instructions}
          />
        </label>
        <label className="recipe-editor-section recipe-editor-text">
          <span>{t("stickyNote")}</span>
          <textarea
            name="stickyNote"
            className="sticky-input"
            rows={2}
            defaultValue={item?.stickyNote}
          />
        </label>
        </div>
        <div className="form-actions recipe-editor-footer">
          <button type="button" onClick={close}>
            {t("cancel")}
          </button>
          <button className="primary" disabled={busy || reading}>
            {t("save")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
