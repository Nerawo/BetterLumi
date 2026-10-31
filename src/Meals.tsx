import {RecipeSelection} from './RecipePicker';
import {StoredRecipeSources} from './StoredFoodPicker';
import {MealConsumptionControl} from './MealConsumptionControl';
import {StickyNotes,useStickyNotes,useStickyNoteChanges} from './StickyNotes';
import {commitStickyNoteChanges,assertMealNoteRevision,StickyNoteConflict} from './sticky-notes';
import {recipeNotes} from './goals';
import {StorageMealForm, BatchDetail, storageErrorMessage, useStorageOperation} from './FoodStorage';
import {FoodStorage} from './food-storage';
import {FoodStorageError} from './food-storage-model';
import {useIngredientPreferences} from './useIngredientPreferences';
import {availableUnits,foodUnitLabel,preferredFoodUnit,personalQuantity,personalNutrition,userChoice} from './ingredient-preferences';
import {builtInFoods} from './data/builtInFoods';
import {RecipeNutritionStrip} from './RecipeNutritionStrip';
import {isBuiltInRecipe} from './data/builtInRecipes';
import {referenceName,referencePreparation} from './reference-library';
import {IngredientPicker} from './IngredientPicker';
import {ReferenceSourceInfo} from './ReferenceSourceInfo';
import {defaultIngredientQuantity} from "./consumption-units";
import {NumberInput} from "./NumberInput";
import {NumberUnit} from "./NumberUnit";
import {confirmDelete} from "./DeleteConfirmation";
import {retainedRecipeNutrition,recipeServingLines,recipeYield,scaleRecipeLines} from "./recipe-nutrition";
import './recipe-yield-locale';
import { DateInput } from "./DateInput";
import { readLocalImage } from "./images";
import { useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Utensils, ChevronDown } from "lucide-react";
import {
  db,
  plans,
  recipes as recipeTable,
  foodLogs,
  stamp,
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
  const { t,i18n } = useTranslation(),preferences=useIngredientPreferences();
  const storageOperation=useStorageOperation();
  const [mealIdentity]=useState(stamp),[leftoverIdentity]=useState(stamp);
  const [storageOpened,setStorageOpened]=useState(!!draft.log?.storageConsumption);
  const [saveLeftovers,setSaveLeftovers]=useState(false),[cookedWeight,setCookedWeight]=useState(''),[originConflict,setOriginConflict]=useState(false),[correctingOrigin,setCorrectingOrigin]=useState(false),[reviewBatch,setReviewBatch]=useState(false);
  const originRetry=useRef<{meal:FoodLog;expectedBatchRevision:number}|null>(null);
  const submitLock=useRef(false),mealForm=useRef<HTMLFormElement>(null);
  const [ingredientPicking,setIngredientPicking]=useState(false);
  const [message, setMessage] = useState("");
  const notice: Notice = message => { setMessage(message); };
  const initial = draft.log;
  const r = draft.recipe ?? recipes.find((r) => r.id === initial?.sourceId);
  const [source, setSource] = useState<"quick" | "recipe" | "pantry" | "storage">(
    initial?.storageConsumption?"storage":initial?.source ?? "recipe",
  );
  const [recipeId, setRecipeId] = useState(r?.id ?? initial?.sourceId ?? "");
  const [ingredientId, setIngredientId] = useState(
    initial?.source === "pantry" ? (initial.sourceId ?? "") : "",
  );
  const noteRecipeId=source==='recipe'?recipeId:'';
  const sharedNotes=useStickyNotes(noteRecipeId,initial?.id??mealIdentity.id);
  const noteDraft=useStickyNoteChanges();
  const [recipeBasis,setRecipeBasis]=useState<"recipe"|"snapshot">(initial?.source==="recipe"?"snapshot":"recipe");
  const [quantity, setQuantity] = useState(initial?.quantity ?? 1);
  const [lineServings,setLineServings]=useState(1);
  const [unit, setUnit] = useState<string>(
    initial?.unit ?? "serving",
  );
  const [nutrition, setNutrition] = useState<Nutrition>(
    initial?.source==='quick'&&!initial.storageConsumption?retainedRecipeNutrition(initial.nutrition,initial.consumptionPercent,100,initial.baseNutrition):initial?.baseNutrition ?? initial?.nutrition ?? unknownNutrition(),
  );
  const quickOriginalNutrition=useRef(nutrition).current;
  const [lines, setLines] = useState<RecipeLine[]>(
    initial?.lines ??
      (r?recipeServingLines(r):undefined) ??
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
  // Modal-local drafts only: switching source must not erase the user's edits.
  const tabDraft={recipeId,ingredientId,recipeBasis,quantity,lineServings,unit,nutrition,lines,name,photo,consumptionPercent,renaming,estimated};
  const tabDrafts=useRef<Partial<Record<typeof source,typeof tabDraft>>>({});
  const switchSource=(key:typeof source)=>{
    if(key===source)return;
    if(key==='storage')setStorageOpened(true);
    tabDrafts.current[source]=tabDraft;
    const next:typeof tabDraft=tabDrafts.current[key]??{recipeId:'',ingredientId:'',recipeBasis:'recipe',quantity:1,lineServings:1,unit:'serving',nutrition:unknownNutrition(),lines:[],name:'',photo:'',consumptionPercent:100,renaming:false,estimated:false};
    setSource(key);setRecipeId(next.recipeId);setIngredientId(next.ingredientId);setRecipeBasis(next.recipeBasis);
    setQuantity(next.quantity);setLineServings(next.lineServings);setUnit(next.unit);setNutrition(next.nutrition);
    setLines(next.lines);setName(next.name);setPhoto(next.photo);setConsumptionPercent(next.consumptionPercent);
    setRenaming(next.renaming);setEstimated(next.estimated);setMessage('');setIngredientPicking(false);
  };
  const NutritionPreview=RecipeNutritionStrip;
  const saveRecipeVersion = async (update: boolean) => {
    if(isBuiltInRecipe({id:recipeId}))return;
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
        servings: update?recipeYield(original!):recipeBasis==='recipe'?lineServings:1,
        lines: structuredClone(update&&recipeBasis==='recipe'?scaleRecipeLines(lines,recipeYield(original!)/lineServings):lines),
      });
      notice(t(update ? "originalUpdated" : "variationSaved"));
    } catch {
      notice(t("failedMessage"));
    }
  };
  const chooseRecipe = (id: string) => {
    setRenaming(false);setSaveLeftovers(false);setCookedWeight('');
    setRecipeId(id);setRecipeBasis("recipe");setConsumptionPercent(100);
    const recipe = recipes.find((r) => r.id === id);
    if (recipe) {
      setName(recipe.name);
      setPhoto(recipe.photo ?? "");
      setQuantity(1);
      setLineServings(1);
      setLines(
        recipeServingLines(recipe),
      );
    }
  };
  const chooseIngredient = (id: string) => {
    setIngredientId(id);
    setIngredientPicking(false);
    const reference=builtInFoods.find(item=>item.id===id);
    if(reference){const choice={kind:'built-in' as const,item:reference},next=preferredFoodUnit(choice,preferences[id]);setName(referenceName(reference,i18n.language));setUnit(next);setQuantity(personalQuantity(choice,next));return}
    const item = pantry.find((i) => i.id === id);
    if (item) {
      setName(item.name);
      const next=preferredFoodUnit(userChoice(item),preferences[id]);setUnit(next);setQuantity(personalQuantity(userChoice(item),next));
    }
  };
  const ingredient = pantry.find((i) => i.id === ingredientId),builtIn=builtInFoods.find(item=>item.id===ingredientId);
  const choice=ingredient?userChoice(ingredient):builtIn?{kind:'built-in' as const,item:builtIn}:null,units=choice?availableUnits(choice,preferences[ingredientId]):[];
  const totals =
    source === "quick"
      ? nutrition
      : source === "recipe"
        ? recipeBasis==='recipe'&&(!Number.isFinite(quantity)||quantity<=0)?unknownNutrition():sumNutrition(lines.map((l) => l.nutrition))
        : initial?.source === "pantry" &&
            initial.sourceId === ingredientId &&
            unit === initial.unit
          ? scaleNutrition(
              initial.baseNutrition ?? initial.nutrition,
              quantity / initial.quantity,
            )
          : choice?personalNutrition(choice,quantity,unit,preferences[ingredientId])
            : unknownNutrition();
  const retained=source==="recipe"&&recipeBasis==="snapshot"&&initial&&lines===initial.lines;
  const retainedQuick=source==='quick'&&initial?.source==='quick'&&!initial.baseNutrition&&nutrition===quickOriginalNutrition;
  const preview=(retained||retainedQuick)?retainedRecipeNutrition(initial.nutrition,initial.consumptionPercent,consumptionPercent,initial.baseNutrition):consumedNutrition(totals,consumptionPercent);
  const buildMealRecord=(f:FormData):FoodLog=>{
    if(source==='storage')throw new FoodStorageError('INVALID','Use the storage form');
    const date=String(f.get('date'));
    return {
          ...(initial ? changed(initial) : mealIdentity),
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
          quantity,
          unit:
            source === "recipe"
              ? recipeBasis==="snapshot"?initial?.unit??"serving":"serving"
              : source === "quick"
                ? "entry"
                : unit,
          nutrition: preview,
          baseNutrition:retained||retainedQuick?initial.baseNutrition:totals,
          consumptionPercent,
          lines: source === "recipe" ? lines : [],
          photo,
          cookingNote: initial?.cookingNote??"",
          estimated,
        };
  };
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if(source==='storage'||submitLock.current)return;
    if((retained||retainedQuick)&&(initial.consumptionPercent??100)===0&&!initial.baseNutrition&&consumptionPercent!==0){notice(t("legacyNutritionUnavailable"));return}
    const f = new FormData(e.currentTarget);
    if (source !== "quick" && !name.trim()) {
      notice(t("requiredName"));
      return;
    }
    if (
      (source==='recipe'&&recipeBasis==='recipe'&&(!Number.isFinite(quantity)||quantity<=0)) ||
      (source === "recipe" && !lines.length && !retained) ||
      (source === "pantry" && !ingredient && !builtIn && !initial)
    ) {
      notice(t("invalid"));
      return;
    }
    setBusy(true);submitLock.current=true;setOriginConflict(false);
    try {
      await db.transaction("rw", [foodLogs, plans, db.foodBatches, db.inventoryTransactions, recipeNotes, recipeTable], async () => {
        await assertMealNoteRevision(initial);
        const record=buildMealRecord(f);
        const storage=new FoodStorage();
        if(initial?.leftoverBatchId){
          const batch=await storage.batches.get(initial.leftoverBatchId);
          if(!batch)throw new FoodStorageError('NOT_FOUND','Missing leftover batch');
          originRetry.current={meal:record,expectedBatchRevision:batch.revision};
          await storage.editLeftoverOrigin({operationId:storageOperation({record,batchRevision:batch.revision,strategy:'sync'}),meal:record,expectedMealRevision:initial.revision,expectedBatchRevision:batch.revision,strategy:'sync'});
        }else if(!initial&&source==='recipe'&&saveLeftovers&&consumptionPercent<100){
          const input={meal:record,saveLeftovers:true,batchId:leftoverIdentity.id,cookedWeightGrams:cookedWeight===''?undefined:Number(cookedWeight)};
          await storage.saveMealWithLeftovers({...input,operationId:storageOperation(input)});
        }else if(source==='recipe'&&(record.lines.some(l=>l.source==='batch')||initial?.recipeAllocations)){
          await storage.saveRecipeMeal({operationId:storageOperation({record,expectedRevision:initial?.revision}),meal:record,expectedRevision:initial?.revision});
        }else{if(initial?.recipeAllocations)throw new FoodStorageError('CONFLICT','Change recipe allocations before changing meal source');await foodLogs.put(record);}
        await commitStickyNoteChanges(noteDraft.changes,record);
        await draft.onSaved?.();
      });
      close();
      notify(t("savedMessage"));
    } catch(error) {
      if(initial?.leftoverBatchId&&error instanceof FoodStorageError&&error.code==='CONFLICT'&&error.batchId===initial.leftoverBatchId){setOriginConflict(true);notice(t('storageOriginConflict'))}
      else notice(error instanceof StickyNoteConflict?t("noteConflict"):storageErrorMessage(error,t));
    } finally {
      setBusy(false);submitLock.current=false;
    }
  };
  const correctOrigin=async()=>{
    if(!initial||!originRetry.current||submitLock.current||!mealForm.current||!mealForm.current.reportValidity())return;submitLock.current=true;setBusy(true);
    try{const input={...originRetry.current,meal:buildMealRecord(new FormData(mealForm.current)),expectedMealRevision:initial.revision,strategy:'meal-only' as const};await db.transaction('rw',[foodLogs,plans,db.foodBatches,db.inventoryTransactions,recipeNotes,recipeTable],async()=>{await assertMealNoteRevision(initial);await new FoodStorage().editLeftoverOrigin({...input,operationId:storageOperation(input)});await commitStickyNoteChanges(noteDraft.changes,input.meal);await draft.onSaved?.()});close();notify(t('savedMessage'))}catch(error){notice(error instanceof StickyNoteConflict?t("noteConflict"):storageErrorMessage(error,t));setCorrectingOrigin(false)}finally{submitLock.current=false;setBusy(false)}
  };
  return (
    <Modal title={t(initial ? "editMeal" : "addFood")} close={close} className="add-food-modal">
    <section className="add-food">
      <div className="segments source-tabs">
        {(["recipe", "pantry", "storage", "quick"] as const).map((key, index) => (
          <button
            type="button"
            aria-pressed={source === key}
            className={source === key ? "selected" : ""}
            key={key}
            aria-label={t({recipe:"savedRecipe",pantry:"savedIngredient",storage:"storageTab",quick:"quick"}[key])}
            disabled={!!initial&&(initial.storageConsumption?key!=="storage":key==="storage"||!!(initial.leftoverBatchId||initial.recipeAllocations)&&key!=="recipe")}
            onClick={() => switchSource(key)}
          >
            {t(["storageMealRecipes", "storageMealPantry", "storageTab", "storageMealQuick"][index])}
          </button>
        ))}
      </div>
          <form ref={mealForm} onSubmit={submit} hidden={source==='storage'}>
            <div className="add-food-scroll">
            <div className="form-grid meal-date-row">
              <label>
                {t("date")}
                <DateInput
                  name="date"
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
                      {t(c==='uncategorized'?'aiUnresolved':c)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {source === "recipe" && (
              <>
                <RecipeSelection recipes={recipes} value={recipeId} onChange={chooseRecipe} label={t('selectRecipe')} disabled={!!initial?.leftoverBatchId&&initial.lines.some(l=>l.source==='batch')}/>

                {!recipes.length && <p>{t("noRecipes")}</p>}
              </>
            )}
            {source === "pantry" && (
              <>
                {builtInFoods.length===0?<>
                <label>
                  {t("selectIngredient")}
                  <span className="meal-selection-control">
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
                  <ChevronDown className="meal-selection-chevron" size={16} aria-hidden="true"/>
                  </span>
                </label>
                {!pantry.length && <p>{t("noIngredients")}</p>}
                </>:<><label>{t('selectIngredient')}<span className="meal-selection-control"><button type="button" className="ingredient-pick-trigger" aria-haspopup="dialog" aria-expanded={ingredientPicking} onClick={()=>setIngredientPicking(true)}><span className="meal-selection-value">{ingredientId?(ingredient?.name??(builtIn?referenceName(builtIn,i18n.language):name))||t('selectIngredient'):t('selectIngredient')}</span></button><ChevronDown className="meal-selection-chevron" size={16} aria-hidden="true"/></span></label>{builtIn&&<><small>{referencePreparation(builtIn,i18n.language)}</small><ReferenceSourceInfo source={builtIn}/></>}{ingredientPicking&&<IngredientPicker items={pantry} close={()=>setIngredientPicking(false)} onSelect={item=>chooseIngredient(item.id)} onSelectBuiltIn={item=>chooseIngredient(item.id)}/>}</>}
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
            <MealConsumptionControl value={consumptionPercent} onChange={setConsumptionPercent}/>
            <div className="meal-nutrition-preview"><NutritionPreview value={preview}/></div>

              </>
            ) : (
              <>
                <div className={"meal-amounts " + (source === "recipe" ? "recipe-amounts" : "")}>
                {source==='recipe'&&recipeBasis==='recipe'&&<label>{t('recipeConsumedServings')}<span className="recipe-serving-input"><input name="consumedServings" type="number" inputMode="decimal" required min="0.01" step="any" value={Number.isFinite(quantity)?quantity:''} onChange={e=>{const amount=e.target.value===''?NaN:Number(e.target.value);setQuantity(amount);if(Number.isFinite(amount)&&amount>0){setLines(scaleRecipeLines(lines,amount/lineServings));setLineServings(amount)}}}/><span>{t('recipeYieldUnit')}</span></span></label>}
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
                          setQuantity(choice?personalQuantity(choice,nextUnit):defaultIngredientQuantity(ingredient,nextUnit));
                        }}
                      >
                        <option value="g">{t("gramsUnit")}</option>{!builtIn&&<option value="mL">mL</option>}
                        {!builtIn&&<option value="serving">{t("servingUnit")}</option>}
                        {units.map(u=><option key={u.name} value={u.name}>{foodUnitLabel(choice,u.name,i18n.language,preferences[ingredientId])}</option>)}
                        {!["g","mL","serving",...units.map(u=>u.name)].includes(unit) && <option value={unit}>{foodUnitLabel(choice,unit,i18n.language,preferences[ingredientId])}</option>}
                      </select>
                    </label>
                  )}
                </div>
                </>}
            {source==="recipe"&&recipeBasis==="snapshot"&&<p className="muted text-small">{t("legacyRecipeSnapshot")}</p>}
            {source==='recipe'&&lines.some(l=>l.source==='batch')&&<StoredRecipeSources lines={lines} setLines={setLines} percent={consumptionPercent} initial={initial} prepared={saveLeftovers||!!initial?.leftoverBatchId}/>}
            <MealConsumptionControl value={consumptionPercent} onChange={setConsumptionPercent}/>
                </div>
                <div className="meal-nutrition-preview">
                <NutritionPreview
                  value={preview}
                />
                </div>
                {source === "recipe" && !(initial?.leftoverBatchId&&initial.lines.some(l=>l.source==='batch')) && (
                  <details className="meal-advanced" key={recipeId}>
                    <summary>{t("advancedRecipe")}</summary>
                    <div className="info-note">
                      <span>{t("onceOnly")}</span>
                    </div>
                    <RecipeLineEditor
                      compact
                      lines={lines}
                      setLines={setLines}
                      allowStored={!initial?.leftoverBatchId}
                      pantry={pantry}
                    />
                    {!isBuiltInRecipe({id:recipeId})&&<div className="explicit-recipe-actions">
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
                    </div>}
                  </details>
                )}

              </>
            )}
            {source==='recipe'&&!initial&&consumptionPercent<100&&<div className="leftover-fields"><label className="leftover-option"><input type="checkbox" checked={saveLeftovers} onChange={e=>setSaveLeftovers(e.target.checked)}/><span>{t('storageSaveLeftovers')}</span></label>{saveLeftovers&&<label>{t('storageCompleteWeight')}<NumberInput name="leftoverCookedWeight" min="0.000001" step="any" value={cookedWeight} onChange={e=>setCookedWeight(e.target.value)}/></label>}</div>}
            {initial?.leftoverBatchId&&<p className="storage-footnote">{t('storageOriginLinked')}</p>}
            {originConflict&&<div className="storage-conflict-actions"><button type="button" onClick={()=>setCorrectingOrigin(true)}>{t('storageCorrectMeal')}</button><button type="button" onClick={()=>setReviewBatch(true)}>{t('storageReviewBatch')}</button></div>}
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
            {initial?.id.startsWith('ai-meal:')&&initial.cookingNote&&<div className="meal-note-details"><small>{t('noteDetails')}</small><div className="preserved-text">{initial.cookingNote}</div></div>}
            <StickyNotes notes={sharedNotes} recipeId={noteRecipeId} meal={{id:initial?.id??mealIdentity.id,date:initial?.date??draft.date}} changes={noteDraft.changes} onChange={noteDraft.stage} staged/>
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
      {storageOpened&&<StorageMealForm hidden={source!=='storage'} initial={initial?.storageConsumption?initial:undefined} date={draft.date} close={close} notice={notify} onSaved={draft.onSaved}/>}
    </section>
    {correctingOrigin&&<Modal title={t('storageCorrectTitle')} close={()=>{if(!busy)setCorrectingOrigin(false)}} className="recipe-editor-modal food-storage-modal"><div className="modal-scroll"><p>{t('storageCorrectHelp')}</p></div><div className="form-actions"><button type="button" disabled={busy} onClick={()=>setCorrectingOrigin(false)}>{t('cancel')}</button><button type="button" className="primary" disabled={busy} onClick={()=>void correctOrigin()}>{t('storageConfirmCorrection')}</button></div></Modal>}
    {reviewBatch&&initial?.leftoverBatchId&&<BatchDetail batchId={initial.leftoverBatchId} close={()=>setReviewBatch(false)} notice={notify}/>}
    </Modal>
  );
}
export function MealList({
  logs,
  edit,
  highlightedIds=[],
}: {
  logs: FoodLog[];
  highlightedIds?:string[];
  edit: (l: FoodLog) => void;
}) {
  const { t } = useTranslation();
  const [deleteConflict,setDeleteConflict]=useState<{batchId:string;log:FoodLog}|null>(null),[reviewSource,setReviewSource]=useState<string|null>(null);
  return logs.length ? (
    <>
    <div className="meal-groups">
      {categories.map((category) => {
        const entries = logs.filter((l) => l.category === category);
        return entries.length ? (
          <div className="meal-group" key={category}>
            <span className="eyebrow">{t(category==='uncategorized'?'unclassifiedMeals':category)}</span>
            {entries.map((log) => (
              <article className={"meal-row"+(highlightedIds.includes(log.id)?" ai-import-highlight":"")} data-food-log-id={log.id} key={log.id}>
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
                    await confirmDelete("meal",log.name,async()=>{try{await softDelete(foodLogs, log.id)}catch(error){if(error instanceof FoodStorageError&&error.code==='CONFLICT'&&error.batchId&&log.leftoverBatchId){setDeleteConflict({batchId:error.batchId,log});return}throw error}});
                  }}
                />
              </article>
            ))}
          </div>
        ) : null;
      })}
    </div>
    {deleteConflict&&<Modal title={t('storageOriginConflict')} close={()=>setDeleteConflict(null)} className="recipe-detail-modal food-storage-modal storage-origin-conflict"><div className="modal-scroll"><p>{t('storageDeleteOriginConflict')}</p></div><div className="form-actions"><button type="button" className="primary" onClick={()=>{setReviewSource(deleteConflict.batchId);setDeleteConflict(null)}}>{t('storageReviewBatch')}</button><button type="button" onClick={async()=>{const input={operationId:stamp().id,mealId:deleteConflict.log.id,expectedRevision:deleteConflict.log.revision,strategy:'meal-only' as const},name=deleteConflict.log.name;setDeleteConflict(null);await confirmDelete('meal',name,()=>new FoodStorage().deleteMeal(input))}}>{t('storageDeleteMealOnly')}</button></div></Modal>}
    {reviewSource&&<BatchDetail batchId={reviewSource} close={()=>setReviewSource(null)} notice={()=>undefined}/>}
    </>
  ) : (
    <Empty icon={<Utensils />} heading={t("emptyFood")} />
  );
}
