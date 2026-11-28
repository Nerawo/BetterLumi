import {useLiveQuery} from 'dexie-react-hooks';
import {stockViews,liveStockLines} from './stock-view';
import {livePreparation,needsUnitReview} from './live-nutrition';
import {useFamilies} from './FamilyUI';
import {concreteLines,saveMealRecipeVersion} from './families';
import {draftFromPrepared,resolveFamilyPreparation,templateEditorLine,templateLine,type EditorLine} from './family-preparation';
import {recipeNutritionRange} from './recipe-nutrition-range';
import {CookingMode} from './CookingMode';
import type {MealPreparation} from './cooking-effective';
import {JournalHeading} from './JournalHeading';
import {MealBasics,MealChoice,MealPhoto,mealCategories} from './MealJournal';
import {recipeUnitFactors} from './recipe-draft-units';
import {identifyRecipeLines} from './cooking-journal';
import {lineNutrition} from './line-nutrition';
import {RecipeSelection} from './RecipePicker';
import {needsFirstAllocationReview} from './recipe-storage';
import {StoredRecipeSources} from './StoredFoodPicker';
import {MealConsumptionControl} from './MealConsumptionControl';
import {StickyNotes,useStickyNotes,useStickyNoteChanges} from './StickyNotes';
import {commitStickyNoteChanges,assertMealNoteRevision,StickyNoteConflict} from './sticky-notes';
import {recipeNotes} from './goals';
import {StorageMealForm, BatchDetail, storageErrorMessage, useStorageOperation} from './FoodStorage';
import {FoodStorage} from './food-storage';
import {FoodStorageError,allocationNutrition,historicalBasisForLine,basisLineNutrition} from './food-storage-model';
import {useIngredientPreferences} from './useIngredientPreferences';
import {ingredientPreferenceRows,ingredientPreferencePrefix,foodUnitLabel,preferredFoodUnit,personalQuantity,personalNutrition,userChoice} from './ingredient-preferences';
import {builtInFoods} from './data/builtInFoods';
import {RecipeNutritionStrip} from './RecipeNutritionStrip';
import {isBuiltInRecipe} from './data/builtInRecipes';
import {referenceName,referencePreparation} from './reference-library';
import {IngredientPicker} from './IngredientPicker';
import {ReferenceSourceInfo} from './ReferenceSourceInfo';
import {NumberInput} from "./NumberInput";
import {NumberUnit} from "./NumberUnit";
import {confirmDelete} from "./DeleteConfirmation";
import {retainedRecipeNutrition,recipeServingLines,recipeYield,scaleRecipeLines} from "./recipe-nutrition";
import './recipe-yield-locale';
import { DateInput } from "./DateInput";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
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
  type PantryItem,
  type Nutrition,
} from "./domain";
import {RecipeLineEditor} from './RecipeLineEditor';
import { consumedNutrition, historicalConsumptionPercent } from "./consumption";
import {
  Modal,
  NutritionFields,
  Empty,
  Actions,
  changed,
  type Notice,
} from "./ui";
export const categories=mealCategories;
export interface MealDraft {
  fromCooking?:boolean;
  date: string;
  recipe?: Recipe;
  recipeServings?: number;
  preparationLines?:EditorLine[];
  /** UI notification only: invoked after a successful transaction, never during it. */
  onCommitted?: (date:string)=>void;
  log?: FoodLog;
  onSaved?: () => Promise<void>;
}
type AddFoodProps={
  draft: MealDraft;
  recipes: Recipe[];
  pantry: PantryItem[];
  close: () => void;
  notice: Notice;
};
export function AddFood({draft,recipes,pantry,close,notice:notify}:AddFoodProps){
  const { t,i18n } = useTranslation(),preferences=useIngredientPreferences();
  const familyCatalog=useFamilies(pantry);
  const [adjustOpen,setAdjustOpen]=useState(false),[invalidFamilyLine,setInvalidFamilyLine]=useState<string>();
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
  const [sourceBasis,setSourceBasis]=useState<"selected"|"historical">(initial?"historical":"selected");
  const startingServings=r&&typeof draft.recipeServings==='number'&&Number.isFinite(draft.recipeServings)&&draft.recipeServings>0?draft.recipeServings:1;
  const [quantity, setQuantity] = useState(initial?.quantity ?? startingServings);
  const [lineServings,setLineServings]=useState(initial?1:startingServings);
  const [unit, setUnit] = useState<string>(
    initial?.unit ?? "serving",
  );
  const [nutrition, setNutrition] = useState<Nutrition>(
    initial?.source==='quick'&&!initial.storageConsumption?retainedRecipeNutrition(initial.nutrition,initial.consumptionPercent,100,initial.baseNutrition):initial?.baseNutrition ?? initial?.nutrition ?? unknownNutrition(),
  );
  const quickOriginalNutrition=useRef(nutrition).current;
  const [preparation,setPreparation]=useState<MealPreparation>();
  const [mealDate,setMealDate]=useState(initial?.date??draft.date);
  const [baseline,setBaseline]=useState(()=>r?{...r,lines:identifyRecipeLines(r.lines)}:undefined);
  const [storedLines, setLines] = useState<EditorLine[]>(()=>
    initial?.lines ?? draft.preparationLines ??
      (baseline?recipeServingLines(baseline,startingServings).map(templateEditorLine):undefined) ??
      [],
  );
  const [name, setName] = useState(initial?.name ?? r?.name ?? "");
  const [photo, setPhoto] = useState(initial?.photo ?? r?.photo ?? "");
  const [readingPhoto, setReadingPhoto] = useState(false);
  const [busy, setBusy] = useState(false);
  const originalPercent = historicalConsumptionPercent(initial?.consumptionPercent);
  const [consumptionPercent, setConsumptionPercent] = useState(originalPercent);
  const rawStock=useLiveQuery(()=>storedLines.some(l=>l.source==="batch")?stockViews():Promise.resolve([]),[storedLines]);
  const resolveRecipe=source==="recipe"&&sourceBasis==="selected";
  const [reselectedStockLines,setReselectedStockLines]=useState<string[]>([]);
  const editorLines=useMemo(()=>{
    if(resolveRecipe)return liveStockLines(livePreparation(storedLines,pantry,preferences,i18n.language),rawStock??[]);
    return storedLines.map(line=>{
      if(line.lineId&&reselectedStockLines.includes(line.lineId))return liveStockLines([line],rawStock??[])[0];
      const basis=historicalBasisForLine(initial,line);
      if(!basis||line.quantity===0)return line;
      const batch=rawStock?.find(b=>b.id===basis.batchId);
      if(line.unit!=='g'&&!batch)return line;
      return {...line,nutrition:basisLineNutrition(basis,line.unit==='g'?line.quantity:line.quantity/batch!.fractionPerUnit)};
    });
  },[storedLines,resolveRecipe,pantry,preferences,i18n.language,rawStock,initial,reselectedStockLines]) as EditorLine[];
  const draftLines=useMemo(()=>identifyRecipeLines(editorLines),[editorLines]);
  const {lines,unresolved}=useMemo(()=>resolveFamilyPreparation(editorLines,familyCatalog,i18n.language),[editorLines,familyCatalog,i18n.language]);
  const hasFamily=storedLines.some(line=>line.draftFamilyId);
  useEffect(()=>{if(source==='recipe'&&hasFamily)setAdjustOpen(true)},[source,recipeId,hasFamily]);
  useEffect(()=>{if(invalidFamilyLine&&!unresolved.some(line=>line.lineId===invalidFamilyLine)){setInvalidFamilyLine(undefined);setMessage('')}},[invalidFamilyLine,unresolved]);
  const requireFamilyChoice=()=>{
    if(!unresolved.length)return false;
    const id=unresolved[0].lineId;
    setInvalidFamilyLine(id);setAdjustOpen(true);notice(t('familyDraftRequired'));
    requestAnimationFrame(()=>{
     const row=id?mealForm.current?.querySelector(`[data-line-id="${CSS.escape(id)}"]`):null;
     row?.scrollIntoView({block:'nearest'});
     row?.querySelector<HTMLElement>('.draft-family-trigger,.draft-family-unit-review')?.focus({preventScroll:true});
    });
    return true;
  };
  const [mealCategory,setMealCategory]=useState(initial?.category??"uncategorized");

  const [estimated, setEstimated] = useState(initial?.estimated ?? false);
  // Modal-local drafts only: switching source must not erase the user's edits.
  const tabDraft={recipeId,ingredientId,sourceBasis,quantity,lineServings,unit,nutrition,lines:initial?storedLines:draftLines,name,photo,consumptionPercent,estimated};
  const tabDrafts=useRef<Partial<Record<typeof source,typeof tabDraft>>>({});
  const switchSource=(key:typeof source)=>{
    if(key===source)return;
    if(key==='storage')setStorageOpened(true);
    tabDrafts.current[source]=tabDraft;
    const next:typeof tabDraft=tabDrafts.current[key]??{recipeId:'',ingredientId:'',sourceBasis:'selected',quantity:1,lineServings:1,unit:'serving',nutrition:unknownNutrition(),lines:[],name:'',photo:'',consumptionPercent:100,estimated:false};
    setSource(key);setRecipeId(next.recipeId);setIngredientId(next.ingredientId);setSourceBasis(next.sourceBasis);
    setQuantity(next.quantity);setLineServings(next.lineServings);setUnit(next.unit);setNutrition(next.nutrition);
    setLines(next.lines);setName(next.name);setPhoto(next.photo);setConsumptionPercent(next.consumptionPercent);
    setEstimated(next.estimated);setMessage('');setIngredientPicking(false);
  };
  const NutritionPreview=RecipeNutritionStrip;
  const saveRecipeVersion = async (update: boolean) => {
    if(isBuiltInRecipe({id:recipeId}))return;
    if(requireFamilyChoice())return;
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
      await saveMealRecipeVersion(original,{
        ...(original ?? { ...stamp(), instructions: "", stickyNote: "" }),
        ...(update ? changed(original!) : stamp()),
        name: variationName.trim(),
        servings: update?recipeYield(original!):sourceBasis==='selected'?lineServings:1,
        lines: structuredClone(update&&sourceBasis==='selected'?scaleRecipeLines(lines,recipeYield(original!)/lineServings):lines),
      },!!initial);
      notice(t(update ? "originalUpdated" : "variationSaved"));
    } catch(error) {
      notice(t(error instanceof Error&&error.message.startsWith('family')?error.message:'failedMessage'));
    }
  };
  const chooseRecipe = (id:string) => {
    const recipe = recipes.find((r) => r.id === id);
    setInvalidFamilyLine(undefined);setAdjustOpen(false);setMessage('');
    setSaveLeftovers(false);setCookedWeight('');
    setRecipeId(id);setSourceBasis("selected");setConsumptionPercent(100);
    if (recipe) {
      setName(recipe.name);
      setPhoto(recipe.photo ?? "");
      setQuantity(1);
      setLineServings(1);
      const next={...recipe,lines:identifyRecipeLines(recipe.lines)};
      setBaseline(next);setLines(recipeServingLines(next).map(templateEditorLine));
    }
  };
  const chooseIngredient = (id: string) => {
    setSourceBasis("selected");
    setIngredientId(id);
    setIngredientPicking(false);
    const reference=builtInFoods.find(item=>item.id===id);
    if(reference){const choice={kind:'built-in' as const,item:reference},next=preferredFoodUnit(choice,preferences[id]);setName(referenceName(reference,i18n.language));setUnit(next);setQuantity(personalQuantity(choice,next));return}
    const item = pantry.find((i) => i.id === id);
    if (item) {
      setName(item.name);
      const choice=userChoice(item),preferred=preferredFoodUnit(choice,preferences[id]);const next=recipeUnitFactors(choice,preferences[id]).has(preferred)?preferred:preferredFoodUnit(choice);setUnit(next);setQuantity(personalQuantity(userChoice(item),next));
    }
  };
  const ingredient = pantry.find((i) => i.id === ingredientId),builtIn=builtInFoods.find(item=>item.id===ingredientId);
  const choice=ingredient?userChoice(ingredient):builtIn?{kind:'built-in' as const,item:builtIn}:null;
  const factors=choice?recipeUnitFactors(choice,preferences[ingredientId]):new Map<string,number>();
  const unitLabel=(u:string)=>u==='g'?t('gramsUnit'):u==='serving'?t('servingUnit'):foodUnitLabel(choice,u,i18n.language,preferences[ingredientId]);
  const setServings=(amount:number)=>{setQuantity(amount);if(Number.isFinite(amount)&&amount>0){setLines(scaleRecipeLines(draftLines,amount/lineServings));setLineServings(amount)}};
  const selectedRecipe=recipes.find(item=>item.id===recipeId);
  const startPreparation=()=>{
    if(!selectedRecipe||!Number.isFinite(quantity)||quantity<=0)return;
    const current=baseline?.id===selectedRecipe.id&&baseline.revision===selectedRecipe.revision
      ?baseline:{...selectedRecipe,lines:identifyRecipeLines(selectedRecipe.lines)};
    setBaseline(current);
    setPreparation({baseline:current,servings:quantity,lines:identifyRecipeLines(lines)});
  };
  const returnPreparation=(prepared:Recipe)=>{
    const servings=recipeYield(prepared);
    setQuantity(servings);
    setLineServings(servings);
    setLines(draftFromPrepared(preparation!.baseline,concreteLines(prepared),familyCatalog));
    setPreparation(undefined);
  };
  const hasSource=source==="quick"||(source==="recipe"?!!recipeId||initial?.source==='recipe':!!ingredientId||initial?.source==="pantry");
  const legacyPantry = sourceBasis==="historical" && initial?.source === 'pantry' && source === 'pantry' &&
    (initial.sourceId ?? "") === ingredientId && !initial.baseNutrition;
  const retainedPantry = legacyPantry && quantity === initial.quantity && unit === initial.unit;
  const totals =
    source === "quick"
      ? nutrition
      : source === "recipe"
        ? sourceBasis==='selected'&&(!Number.isFinite(quantity)||quantity<=0)?unknownNutrition():sumNutrition(lines.map(line=>{const value=lineNutrition(line);return line.source==='batch'&&rawStock?.some(batch=>batch.id===line.sourceBatchId&&batch.stock)&&consumptionPercent>0?allocationNutrition(value):value}))
        : sourceBasis==="historical" && initial?.source === "pantry" &&
            (initial.sourceId === ingredientId || legacyPantry) &&
            (unit === initial.unit || (factors.has(unit)&&factors.has(initial.unit)))
          ? scaleNutrition(
              initial.baseNutrition ?? (legacyPantry
                ? retainedRecipeNutrition(initial.nutrition,initial.consumptionPercent,100)
                : initial.nutrition),
              quantity / initial.quantity * (unit===initial.unit?1:factors.get(unit)!/factors.get(initial.unit)!),
            )
          : legacyPantry ? unknownNutrition() : choice?personalNutrition(choice,quantity,unit,preferences[ingredientId])
            : unknownNutrition();
  const retained=source==="recipe"&&sourceBasis==="historical"&&initial&&(storedLines===initial.lines||(!initial.lines&&storedLines.length===0))&&!initial.historicalAllocationBases?.length&&!(consumptionPercent>0&&storedLines.some(line=>line.source==='batch'&&rawStock?.some(b=>b.id===line.sourceBatchId&&b.stock)));
  const retainedQuick=source==='quick'&&initial?.source==='quick'&&!initial.baseNutrition&&nutrition===quickOriginalNutrition;
  const retainSnapshot=retained||retainedQuick||retainedPantry;
  // Preserve the last recoverable full portion before replacing historical actuals with zero.
  const historicalBase = retainSnapshot && sourceBasis==='historical' && !initial.baseNutrition &&
    originalPercent>0 && consumptionPercent===0
    ? scaleNutrition(allocationNutrition(initial.nutrition),100/originalPercent)
    : initial?.baseNutrition;
  const preview=retainSnapshot?retainedRecipeNutrition(initial.nutrition,initial.consumptionPercent,consumptionPercent,historicalBase):consumedNutrition(totals,consumptionPercent);
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
                ? legacyPantry ? initial.sourceId : ingredientId
                : null,
          quantity,
          unit:
            source === "recipe"
              ? sourceBasis==="historical"?initial?.unit??"serving":"serving"
              : source === "quick"
                ? "entry"
                : unit,
          nutrition: preview,
          baseNutrition:retainSnapshot ? historicalBase : totals,
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
    if(source==='recipe'&&requireFamilyChoice())return;
    if(source==='recipe'&&draftLines.some(line=>needsFirstAllocationReview(initial,line,rawStock?.find(b=>b.id===line.sourceBatchId),consumptionPercent))){
      mealForm.current?.querySelector<HTMLElement>('[data-first-allocation-review] button')?.focus();return;
    }
    if(resolveRecipe&&needsUnitReview(lines,pantry,preferences)){notice(t('liveUnitReview'));return}
    if(((retainSnapshot||legacyPantry)&&originalPercent===0&&!initial.baseNutrition&&consumptionPercent!==0)
      || (legacyPantry && unit!==initial.unit && !(factors.has(unit)&&factors.has(initial.unit)))){notice(t("legacyNutritionUnavailable"));return}
    const f = new FormData(e.currentTarget);
    if (source !== "quick" && !name.trim()) {
      notice(t("requiredName"));
      return;
    }
    if (
      (source==='recipe'&&sourceBasis==='selected'&&(!Number.isFinite(quantity)||quantity<=0)) ||
      (source === "recipe" && !lines.length && !retained) ||
      (source === "pantry" && !ingredient && !builtIn && !initial)
    ) {
      notice(t("invalid"));
      return;
    }
    setBusy(true);submitLock.current=true;setOriginConflict(false);
    try {
      await db.transaction("rw", [foodLogs, plans, db.ingredients, db.settings, db.foodBatches, db.inventoryTransactions, recipeNotes, recipeTable], async () => {
        await assertMealNoteRevision(initial);
        const record=buildMealRecord(f);
        if(resolveRecipe){
          const ids=[...new Set(record.lines.filter(l=>l.source!=='batch').map(l=>l.ingredientId))];
          const items=(await db.ingredients.bulkGet(ids)).flatMap(item=>item?[item]:[]);
          const prefs=ingredientPreferenceRows((await db.settings.bulkGet(ids.map(id=>ingredientPreferencePrefix+id))).flatMap(row=>row?[row]:[]));
          if(needsUnitReview(record.lines,items,prefs))throw new FoodStorageError('UNIT_REVIEW','Review recipe conversion');
          record.lines=livePreparation(record.lines,items,prefs,i18n.language);
          record.baseNutrition=sumNutrition(record.lines.map(lineNutrition));
          record.nutrition=consumedNutrition(record.baseNutrition,consumptionPercent);
        }
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
          await storage.saveRecipeMeal({operationId:storageOperation({record,expectedRevision:initial?.revision,resolveRecipe}),meal:record,expectedRevision:initial?.revision},resolveRecipe,reselectedStockLines);
        }else{if(initial?.recipeAllocations)throw new FoodStorageError('CONFLICT','Change recipe allocations before changing meal source');await foodLogs.put(record);}
        await commitStickyNoteChanges(noteDraft.changes,record);
        await draft.onSaved?.();
      });
      close();
      notify(t("savedMessage"));
      draft.onCommitted?.(String(f.get("date")));
    } catch(error) {
      if(initial?.leftoverBatchId&&error instanceof FoodStorageError&&error.code==='CONFLICT'&&error.batchId===initial.leftoverBatchId){setOriginConflict(true);notice(t('storageOriginConflict'))}
      else notice(error instanceof StickyNoteConflict?t("noteConflict"):storageErrorMessage(error,t));
    } finally {
      setBusy(false);submitLock.current=false;
    }
  };
  const correctOrigin=async()=>{
    if(!initial||!originRetry.current||submitLock.current||!mealForm.current||!mealForm.current.reportValidity())return;submitLock.current=true;setBusy(true);
    try{const input={...originRetry.current,meal:buildMealRecord(new FormData(mealForm.current)),expectedMealRevision:initial.revision,strategy:'meal-only' as const};await db.transaction('rw',[foodLogs,plans,db.ingredients,db.foodBatches,db.inventoryTransactions,recipeNotes,recipeTable],async()=>{await assertMealNoteRevision(initial);await new FoodStorage().editLeftoverOrigin({...input,operationId:storageOperation(input)});await commitStickyNoteChanges(noteDraft.changes,input.meal);await draft.onSaved?.()});close();notify(t('savedMessage'))}catch(error){notice(error instanceof StickyNoteConflict?t("noteConflict"):storageErrorMessage(error,t));setCorrectingOrigin(false)}finally{submitLock.current=false;setBusy(false)}
  };
  return (
    <><Modal title={t(initial ? "editMeal" : "addFood")} close={close} className="add-food-modal meal-journal">
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
            <MealBasics category={mealCategory} onCategory={setMealCategory} date={<DateInput name="date" required value={mealDate} onChange={e=>setMealDate(e.target.value)}/>}/>
            {source === "recipe" && (
              <>
                <div className="meal-title-row"><RecipeSelection displayName={name} recipes={recipes} value={recipeId} onChange={chooseRecipe} label={t('selectRecipe')} disabled={!!initial?.leftoverBatchId&&initial.lines.some(l=>l.source==='batch')}/>{!initial&&!draft.fromCooking&&selectedRecipe&&<button type="button" className="primary start-cooking meal-start-cooking" disabled={!Number.isFinite(quantity)||quantity<=0} onClick={startPreparation}>{t("startCooking")}</button>}</div>
                {!recipes.length && <p>{t("noRecipes")}</p>}
              </>
            )}
            {source === "pantry" && (
              <>
                <div className="meal-title-row"><button type="button" className="ingredient-pick-trigger" aria-haspopup="dialog" aria-expanded={ingredientPicking} onClick={()=>setIngredientPicking(true)}>
                  <span>{ingredientId?name:t('selectIngredient')}</span><ChevronDown size={16} aria-hidden="true"/>
                </button></div>
                {ingredient?.brand&&<small>{ingredient.brand}</small>}
                {builtIn&&<><small>{referencePreparation(builtIn,i18n.language)}</small><ReferenceSourceInfo source={builtIn}/></>}
                {ingredientPicking&&<IngredientPicker items={pantry} close={()=>setIngredientPicking(false)} onSelect={item=>chooseIngredient(item.id)} onSelectBuiltIn={item=>chooseIngredient(item.id)}/>}
              </>
            )}
            {(source === "quick") && (<label>
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
            ) : hasSource && (
              <>
                <div className={"meal-amounts " + (source === "recipe" ? "recipe-amounts" : "")}>
                {source==='recipe'&&sourceBasis==='selected'&&<label>{t('recipeConsumedServings')}<span className="recipe-serving-input"><button type="button" aria-label={t("journalDecrease")} onClick={()=>setServings(Math.max(.01,(quantity||1)-1))}>−</button><input name="consumedServings" type="number" inputMode="decimal" required min="0.01" step="any" value={Number.isFinite(quantity)?quantity:''} onChange={e=>setServings(e.target.value===''?NaN:Number(e.target.value))}/><button type="button" aria-label={t('journalIncrease')} onClick={()=>setServings((quantity||0)+1)}>＋</button><span>{t('recipeYieldUnit')}</span></span></label>}
                {source!=="recipe"&&<>
                <div className="meal-pantry-amount">
                  <span className="meal-quantity-label">{t("quantity")}</span><div className="meal-quantity-phrase">
                    <NumberInput style={{width:Math.max(2,String(quantity).length+1)+"ch"}} aria-label={t("quantity")}
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
                  {source === "pantry" && (
                    <label>
                      <span className="sr-only">{t("unit")}</span>
                      <MealChoice name={name} value={unit} label={unitLabel(unit)} fixed={!factors.has(unit)||factors.size<2} options={[...factors.keys()].map(value=>({value,label:unitLabel(value)}))} change={next=>{const amount=quantity*(factors.get(unit)!/factors.get(next)!);if(Number.isFinite(amount)&&amount>0){setUnit(next);setQuantity(amount)}}}/>
                    </label>
                  )}
                </div></div>
                </>}
            {source==="recipe"&&sourceBasis==="historical"&&<p className="muted text-small">{t("legacyRecipeSnapshot")}</p>}
            {source==='recipe'&&lines.some(l=>l.source==='batch')&&<StoredRecipeSources lines={draftLines} setLines={setLines} onReselect={id=>setReselectedStockLines(ids=>ids.includes(id)?ids:[...ids,id])} percent={consumptionPercent} initial={initial} prepared={saveLeftovers||!!initial?.leftoverBatchId}/>}
            <MealConsumptionControl value={consumptionPercent} onChange={setConsumptionPercent}/>
            {source==='recipe'&&!initial&&consumptionPercent<100&&<div className="leftover-fields"><label className="leftover-option"><input type="checkbox" checked={saveLeftovers} onChange={e=>setSaveLeftovers(e.target.checked)}/><span>{t('storageSaveLeftovers')}</span></label>{saveLeftovers&&<label>{t('storageCompleteWeight')}<NumberInput name="leftoverCookedWeight" min="0.000001" step="any" value={cookedWeight} onChange={e=>setCookedWeight(e.target.value)}/></label>}</div>}
                </div>
                <div className="meal-nutrition-preview">
                <NutritionPreview
                  value={source==='recipe'&&unresolved.length?recipeNutritionRange([...lines,...unresolved.map(templateLine)],familyCatalog,i18n.language,consumptionPercent/100):preview}
                  unavailable={source==='recipe'&&unresolved.length>0}
                />
                </div>
                {source === "recipe" && !(initial?.leftoverBatchId&&initial.lines.some(l=>l.source==='batch')) && (
                  <details className="meal-advanced" key={recipeId} open={adjustOpen} onToggle={event=>setAdjustOpen(event.currentTarget.open)}>
                    <summary><JournalHeading>{t("advancedRecipe")}</JournalHeading></summary>
                    <div className="meal-adjust-help">
                      <span>{t("onceOnly")}</span>
                    </div>
                    <div className="journal-recipe-editor meal-lines"><RecipeLineEditor mealDraft groups={[]}
                      compact
                      lines={draftLines}
                      setLines={setLines}
                      allowStored={!initial?.leftoverBatchId}
                      pantry={pantry}
                      familyDraft={{catalog:familyCatalog,actual:true,invalidLine:invalidFamilyLine}}
                    /></div>
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

            {initial?.leftoverBatchId&&<p className="storage-footnote">{t('storageOriginLinked')}</p>}
            {originConflict&&<div className="storage-conflict-actions"><button type="button" onClick={()=>setCorrectingOrigin(true)}>{t('storageCorrectMeal')}</button><button type="button" onClick={()=>setReviewBatch(true)}>{t('storageReviewBatch')}</button></div>}
            <section className="meal-extras">
            <MealPhoto photo={photo} onPhoto={setPhoto} onReading={setReadingPhoto} onError={notice}/>
            {initial?.id.startsWith('ai-meal:')&&initial.cookingNote&&<div className="meal-note-details"><small>{t('noteDetails')}</small><div className="preserved-text">{initial.cookingNote}</div></div>}
            <StickyNotes notes={sharedNotes} recipeId={noteRecipeId} meal={{id:initial?.id??mealIdentity.id,date:mealDate}} changes={noteDraft.changes} onChange={noteDraft.stage} staged/>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={estimated}
                onChange={(e) => setEstimated(e.target.checked)}
              />
              {t("estimated")}
            </label>
            </section>
            </div>
            <div role="status" className="food-status">{message}</div>
            <div className="form-actions add-food-footer">
              <button type="button" onClick={close}>
                {t("cancel")}
              </button>
              <button className="primary" disabled={busy || readingPhoto || !hasSource}>
                {t("saveMealRecord")}
              </button>
            </div>
          </form>
      {storageOpened&&<StorageMealForm hidden={source!=='storage'} initial={initial?.storageConsumption?initial:undefined} date={draft.date} close={close} notice={notify} onSaved={draft.onSaved} onCommitted={draft.onCommitted}/>}
    </section>
    {correctingOrigin&&<Modal title={t('storageCorrectTitle')} close={()=>{if(!busy)setCorrectingOrigin(false)}} className="recipe-editor-modal food-storage-modal"><div className="modal-scroll"><p>{t('storageCorrectHelp')}</p></div><div className="form-actions"><button type="button" disabled={busy} onClick={()=>setCorrectingOrigin(false)}>{t('cancel')}</button><button type="button" className="primary" disabled={busy} onClick={()=>void correctOrigin()}>{t('storageConfirmCorrection')}</button></div></Modal>}
    {reviewBatch&&initial?.leftoverBatchId&&<BatchDetail batchId={initial.leftoverBatchId} close={()=>setReviewBatch(false)} notice={notify}/>}
    </Modal>
    {preparation&&selectedRecipe&&<CookingMode historicalSource={sourceBasis==='historical'} recipe={selectedRecipe} recipes={recipes} pantry={pantry} date={mealDate} preparation={preparation} selectionLines={draftLines} notice={notify} mealSaved={()=>setPreparation(undefined)} close={()=>setPreparation(undefined)} onReturnMeal={returnPreparation}/>}
    </>
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
                <div className="meal-amount-summary"><strong>{log.nutrition.calories===null?t("notRecorded"):Math.round(log.nutrition.calories)}{log.nutrition.calories!==null&&<small> kcal</small>}</strong>{historicalConsumptionPercent(log.consumptionPercent)!==100&&<span><NumberUnit value={log.consumptionPercent} unit="%"/></span>}</div>
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
