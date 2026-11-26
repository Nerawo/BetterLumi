import {JournalTextField} from './JournalTextField';
import {DraftMethod} from './RecipeDraftJournal';
import {JournalHeading} from './JournalHeading';
import {identifyRecipeLines,validateJournalRecipe,type IngredientGroup} from './cooking-journal';
import {FoodStorageList} from './FoodStorage';
import {PantrySortMenu,type PantrySort} from './PantrySortMenu';
import {sortRecipes} from './recipe-sort';
import {needsUnitReview} from './live-nutrition';
import {recipeCardRange,recipeNutritionRange,formatNutritionRange} from './recipe-nutrition-range';
import {RecipeNutritionStrip} from './RecipeNutritionStrip';
import {builtInRecipeItems,isBuiltInRecipe} from './data/builtInRecipes';
import {BuiltInRecipeSource} from './BuiltInRecipeSource';
import {DirectoryListHeader} from './DirectoryListHeader';
import {CollectionNavigation} from './CollectionNavigation';
import {orderedItems} from './collection-order';
import {stockViews} from './stock-view';
import {useFamilies} from "./FamilyUI";
import {saveFamilyRecipe} from "./families";
import {RecipeLineEditor} from './RecipeLineEditor';
import {templateEditorLine,templateLine,type EditorLine} from './family-preparation';
import {RecipeCategoryManager} from "./RecipeCategoryManager";
import {NumberUnit} from "./NumberUnit";
import {confirmDelete} from "./DeleteConfirmation";
import {recipeYield} from "./recipe-nutrition";
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
  X,
} from "lucide-react";
import {
  recipes,
  stamp,
  softDelete,
  type Recipe,
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
  const [view,setView]=useState<'recipes'|'storage'>('recipes');
  const [editing, setEditing] = useState<Recipe | null | undefined>();
  const [search, setSearch] = useState("");
  const [sort,setSort]=useState<PantrySort>('name-asc');
  const [tab, setTab] = useState("");
  const categoryItems =
    useLiveQuery(async() => orderedItems(await categories.filter((c) => !c.deletedAt).toArray())) ?? [];
  const [manage, setManage] = useState(false);
  const categoryManagerTrigger=useRef<HTMLButtonElement>(null);
  const closeCategoryManager=()=>{setManage(false);requestAnimationFrame(()=>categoryManagerTrigger.current?.focus())};
  const [manageRecipes, setManageRecipes] = useState<RecipeCategory | null>(null);

  const familyCatalog=useFamilies(pantry);
  const hasStockLines=items.some(recipe=>recipe.lines.some(line=>line.source==='batch'));
  const stock=useLiveQuery(()=>hasStockLines?stockViews():[],[hasStockLines]);
  const filtered = sortRecipes(filterRecipes(
    [...items,...builtInRecipeItems(i18n.language)],
    search,
    categoryItems.some((c) => c.id === tab) ? tab : "",
    categoryItems,
  ),sort,i18n.language,r=>recipeCardRange(r,familyCatalog,i18n.language,stock).nutrition.calories?.[0]??null);
  return (
    <>
      <div className="recipes-view-tabs" role="tablist" aria-label={t('recipes')}><button type="button" role="tab" aria-selected={view==='recipes'} aria-controls="recipes-library-panel" id="recipes-library-tab" className={view==='recipes'?'selected':''} onClick={()=>setView('recipes')}>{t('storageMyRecipes')}</button><button type="button" role="tab" aria-selected={view==='storage'} aria-controls="recipes-storage-panel" id="recipes-storage-tab" className={view==='storage'?'selected':''} onClick={()=>setView('storage')}>{t('storageTab')}</button></div>
      <div className="recipes-page-panel" id="recipes-storage-panel" role="tabpanel" aria-labelledby="recipes-storage-tab" hidden={view!=='storage'}><FoodStorageList recipes={[...items,...builtInRecipeItems(i18n.language)]} pantry={pantry} notice={notice}/></div>
      <div className="recipes-page-panel" id="recipes-library-panel" role="tabpanel" aria-labelledby="recipes-library-tab" hidden={view!=='recipes'}>
      <div className="search">
        <Search size={18} />
        <input
          placeholder={t("searchRecipes")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <CollectionNavigation items={categoryItems} active={categoryItems.some(c=>c.id===tab)?tab:''} onChange={setTab} label={t('recipeCategory')} allLabel={t('allCategories')} manageLabel={t('manageCategories')} manage={()=>setManage(true)} managementRef={categoryManagerTrigger}/>
      <DirectoryListHeader count={t('recipeCount',{count:filtered.length})}>{categoryItems.filter(category=>category.id===tab).map(category=><span key={category.id}><button type="button" className="text-link manage-category-recipes" aria-label={t("manageCategoryRecipes",{name:category.name})} onClick={()=>setManageRecipes(category)}>{t("manageRecipes")}</button></span>)}<PantrySortMenu value={sort} onChange={setSort} kind="recipes"/></DirectoryListHeader>
      <button type="button" className="primary recipe-fab directory-fab" onClick={() => setEditing(null)} aria-label={t("directoryCreateRecipe")}><Plus size={18} aria-hidden="true"/><span>{t("directoryCreateRecipe")}</span></button>
      <div className="recipe-grid recipe-list">
        {filtered.map(r=>{const {nutrition,perServing}=recipeCardRange(r,familyCatalog,i18n.language,stock),basis=t(perServing?"compactPerServing":"recipeListWholeBasis"),hasMacros=(["protein","carbs","fat"] as const).some(key=>nutrition[key]!==null);return <article className="recipe-card recipe-list-row" key={r.id} onClick={e=>{if(!(e.target as HTMLElement).closest("button,a,input,select,dialog"))navigate("/recipes/"+encodeURIComponent(r.id))}}>
          {r.photo&&<img className="recipe-thumbnail" src={r.photo} alt="" loading="lazy"/>}
          <div className="recipe-body"><h3><a href={routeHref("/recipes/"+encodeURIComponent(r.id))} onClick={e=>{e.preventDefault();navigate("/recipes/"+encodeURIComponent(r.id))}}>{r.name}</a></h3>
          {isBuiltInRecipe(r)&&<div className="recipe-reference-badge"><BuiltInRecipeSource/></div>}
          <p className="recipe-metadata">{nutrition.calories===null?t(r.lines.some(l=>l.source==='family')?'familyNutritionUnavailable':hasMacros?'recipeListCaloriesMissing':'nutritionNotRecorded'):<NumberUnit value={formatNutritionRange(nutrition.calories)} unit="kcal"/>} / {basis}</p>
          {hasMacros&&<p className="macro-summary recipe-macros">{(['protein','carbs','fat'] as const).map((key,index)=><Fragment key={key}>{index>0&&' · '}<span className="recipe-macro">{t(key==='carbs'?'recipeListCarbs':key)} {nutrition[key]===null?<span className="recipe-nutrient-unavailable">{t('notRecorded')}</span>:<NumberUnit value={formatNutritionRange(nutrition[key]!)} unit="g"/>}</span></Fragment>)}</p>}</div>
          {!isBuiltInRecipe(r)&&<Actions edit={()=>setEditing(r)} remove={async()=>{await confirmDelete("recipe",r.name,async()=>{await softDelete(recipes,r.id)})}}/>}
        </article>})}
      </div>
      {!items.length && !builtInRecipeItems(i18n.language).length && (
        <Empty heading={t("noRecipesYet")} />
      )}
      {!filtered.length && <p className="collection-empty">{t("emptySearch")}</p>}
      </div>
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
  const { t,i18n } = useTranslation();
  const familyCatalog=useFamilies(pantry);
  const [categoryIds, setCategoryIds] = useState(item?.categoryIds ?? []);
  const [lines, setLines] = useState<EditorLine[]>(()=>identifyRecipeLines((item?.lines ?? []).map(templateEditorLine)));
  const [instructions,setInstructions]=useState(item?.instructions??'');
  const [editingMethod,setEditingMethod]=useState(false);
  const [groups,setGroups]=useState<IngredientGroup[]>(item?.ingredientGroups??[]);
  const [busy, setBusy] = useState(false);
  const [draftName,setDraftName]=useState(item?.name??'');
  const [yieldText,setYieldText]=useState(String(recipeYield(item??{})));
  const adjustYield=(delta:number)=>setYieldText(value=>String(Math.max(0.01,Number(value)+delta)));
  const [photo, setPhoto] = useState(item?.photo ?? "");
  const [reading, setReading] = useState(false);
  const template=lines.map(templateLine);
  const hasStockLines=template.some(line=>line.source==='batch');
  const stock=useLiveQuery(()=>hasStockLines?stockViews():[],[hasStockLines]);
  const preview=recipeNutritionRange(template,familyCatalog,i18n.language,1,stock);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if(busy || editingMethod)return;
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name")).trim();
    if (!name || !lines.length || lines.some((l) => !Number.isFinite(l.quantity)||l.quantity < 0) || !Number.isFinite(Number(f.get('servings'))) || Number(f.get('servings'))<=0) {
      notice(t("emptyLines"));
      return;
    }
    setBusy(true);
    try {
      validateJournalRecipe({lines,ingredientGroups:groups});
      await saveFamilyRecipe({
        ...(item ? changed(item) : stamp()),
        name,
        servings: Number(f.get('servings')),
        lines:template,
        ingredientGroups:groups,
        instructions,
        stickyNote: String(f.get("stickyNote")).trim(),
        category: item?.category ?? "",
        categoryIds,
        photo,
      });
      close();
      notice(t("savedMessage"));
    } catch (e) {
      notice(t(e instanceof Error && e.message.startsWith("family")?e.message:"failedMessage"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={t(item ? "editRecipe" : "journalCreateRecipe")} close={close} className="recipe-editor-modal journal-recipe-editor">
      <form onSubmit={submit} className="recipe-editor-form">
        <div className="recipe-editor-scroll">
          <section className="recipe-editor-basic-section draft-basics">
            <h3><JournalHeading>{t("basicInformation")}</JournalHeading></h3>
            <JournalTextField name="name" label={t("name")} value={draftName} onChange={setDraftName}
              placeholder={t('draftNamePlaceholder')} required/>
            <div className="draft-yield">
              <label htmlFor="draft-recipe-yield">{t('draftRecipeYield')}</label>
              <div className="draft-yield-controls">
                <button type="button" aria-label={t('journalDecrease')} disabled={Number(yieldText)<=0.01} onClick={()=>adjustYield(-1)}>−</button>
                <input id="draft-recipe-yield" name="servings" type="number" inputMode="decimal" min="0.01" step="any" required
                  value={yieldText} style={{width:Math.max(3,yieldText.length+1)+'ch'}} onChange={e=>setYieldText(e.target.value)}
                  onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur()}}}/>
                <button type="button" aria-label={t('journalIncrease')} onClick={()=>adjustYield(1)}>＋</button>
                <span>{t('recipeYieldUnit')}</span>
              </div>
            </div>
        <fieldset className="category-assignments">
          <legend>{t("recipeCategoriesMultiple")}</legend>
          <RecipeCategoryPicker pills value={categoryIds} onToggle={(id, included) => setCategoryIds(previous => included ? [...new Set([...previous, id])] : previous.filter(value => value !== id))} />
          {item?.category && (
            <small>
              {t("legacyCategory")}: {item.category}
            </small>
          )}
        </fieldset>
            <div className={'draft-photo'+(photo?' photo-field':'')}>
              <label className="draft-photo-action">
                {photo?<img src={photo} alt={t('recipePhoto')}/>:<Plus size={15}/>}
                <span>{t(photo?'replacePhoto':'draftAddImage')}</span>
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
              </label>
              {photo&&<button type="button" className="photo-remove" aria-label={t('removePhoto')} onClick={()=>setPhoto('')}><X size={15}/></button>}
            </div>
          </section>

        <section className="recipe-editor-section">
        <RecipeLineEditor compact groups={groups} onGroupsChange={setGroups} lines={lines} setLines={setLines} pantry={pantry}
          familyDraft={{catalog:familyCatalog}} />
        </section>
        <section className="recipe-editor-section recipe-editor-nutrition">
          <h3>{t("recipeNutritionTotal")}</h3>
          {needsUnitReview(template.filter(line=>line.source!=='family'),pantry,familyCatalog.preferences)&&<small role="status">{t('liveUnitReview')}</small>}
          <RecipeNutritionStrip value={preview} unavailable={template.some(line=>line.source==='family')}/>
        </section>
        <DraftMethod value={instructions} onConfirm={setInstructions} editing={editingMethod} setEditing={setEditingMethod}/>
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
          <button className="primary" disabled={busy || reading || editingMethod}>
            {t("save")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
