import {IngredientManagement} from './IngredientManagement';
import {useIngredientPreferences} from './useIngredientPreferences';
import {parseIngredientPreference,saveIngredientPreference,ingredientPreferencePrefix,userChoice,type IngredientPreference} from './ingredient-preferences';
import type {FoodChoice} from './reference-library';
import {DirectoryListHeader} from './DirectoryListHeader';
import {IngredientTagNavigation,IngredientTagAssignment,IngredientTagManager,useIngredientTags} from "./IngredientTags";
import {putTaggedIngredient} from "./ingredient-tags";
import {searchFoodChoices,referenceName,referencePreparation,referenceCategory} from './reference-library';
import {sortPantryFoods} from './pantry-foods';
import {ReferenceSourceInfo} from './ReferenceSourceInfo';
import {NumberInput} from "./NumberInput";
import { validConsumptionUnit, ingredientBaseUnit } from "./consumption-units";
import { nutritionReference } from "./db";
import {Fragment,type ReactNode} from "react";
import {NumberUnit} from "./NumberUnit";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Search, Plus } from "lucide-react";
import {
  ingredientSecondaryNames,
  ingredientAliases,
  splitAliases,
} from "./pantry-names";
import { PantrySortMenu, type PantrySort } from "./PantrySortMenu";
import {
  db,
  stamp,
  unknownNutrition,
  type PantryItem,
  type Nutrition,
} from "./domain";
import {
  Modal,
  NutritionFields,
  changed,
  type Notice,
} from "./ui";
export function Pantry({
  items,
  notice,
}: {
  items: PantryItem[];
  notice: Notice;
}) {
  const { t, i18n } = useTranslation();
  const preferences=useIngredientPreferences(),[managingIngredient,setManagingIngredient]=useState<FoodChoice|null>(null);
  const [search, setSearch] = useState("");
  const tags=useIngredientTags();
  const [tag,setTag]=useState(''),[tagPanel,setTagPanel]=useState<'manage'|null>(null);
  const activeTag=tags.some(item=>item.id===tag)?tag:'';
  const [sort, setSort] = useState<PantrySort>("name-asc");
  const filtered=sortPantryFoods(searchFoodChoices(items,search,activeTag,tags).filter(c=>!preferences[c.item.id]?.archived),sort,i18n.language);
  const [editing, setEditing] = useState<PantryItem | null | undefined>();
  return (
    <>
      <div className="search">
        <Search size={18} />
        <input
          placeholder={t("searchPantry")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

      </div>
      <IngredientTagNavigation items={tags} active={activeTag} onChange={setTag} manage={()=>setTagPanel("manage")}/>
      {tagPanel==="manage"&&<IngredientTagManager close={()=>setTagPanel(null)} onDeleted={id=>{if(tag===id)setTag("")}}/>}
      <DirectoryListHeader count={t('ingredientCount',{count:filtered.length})}><PantrySortMenu value={sort} onChange={setSort}/></DirectoryListHeader>
      <button type="button" className="primary pantry-fab directory-fab" onClick={() => setEditing(null)} aria-label={t("directoryAddIngredient")}><Plus size={18} aria-hidden="true"/><span>{t("directoryAddIngredient")}</span></button>
      <div className="pantry-list">
        {filtered.map((choice) => {
          if(choice.kind==='built-in'){
            const food=choice.item;
            return <article className="pantry-row pantry-reference-row" key={food.id} data-reference-id={food.id}>
              <PantryRowContent
                title={<button type="button" className="ingredient-name" onClick={()=>setManagingIngredient(choice)}>{referenceName(food,i18n.language)}</button>}
                actions={<button className="pantry-manage-units" onClick={()=>setManagingIngredient(choice)}>{t("customizeIngredient")}</button>}
                energy={<><NumberUnit value={food.kcalPer100g===null?'—':Math.round(food.kcalPer100g)} unit="kcal"/> / 100 g</>}
                metadata={<>{referencePreparation(food,i18n.language)} · {referenceCategory(food,i18n.language)} · <ReferenceSourceInfo source={food}/></>}
                macros={(['protein','carbs','fat'] as const).map((key,index)=><Fragment key={key}>{index>0&&' · '}{t(key)} <NumberUnit value={food[`${key}Per100g`]?.toFixed(1)??'—'} unit="g"/></Fragment>)}
              />
            </article>;
          }
          const i=choice.item;
          const secondary=ingredientSecondaryNames(i);
          return (
          <article
            className="pantry-row"
            key={i.id}
            data-user-food-id={i.id}
            onClick={(e) => {
              if (!(e.target as HTMLElement).closest("button")) setEditing(i);
            }}
          >
            <PantryRowContent
              titleDescription={[i.name,...secondary].join(' · ')}
              title={<button type="button" className="ingredient-name" onClick={()=>setEditing(i)}><span className="ingredient-primary">{i.name}</span>{secondary.length>0&&<> <small className="ingredient-secondary">{secondary.join(' · ')}</small></>}</button>}
              energy={<>{i.calories!=null&&<><NumberUnit value={i.calories} unit="kcal"/> / </>}{i.basis==='serving'?t('servingUnit'):<NumberUnit value={nutritionReference(i).amount} unit={nutritionReference(i).unit}/ >}{i.basis==='serving'&&i.servingGrams!=null&&<> (<NumberUnit value={i.servingGrams} unit={i.servingUnit??'g'}/>)</>}</>}
              metadata={[...tags.filter(tag=>i.tagIds?.includes(tag.id)).map(tag=>tag.name),t('referenceMyFood')].join(' · ')}
              macros={(['protein','carbs','fat'] as const).some(k=>i[k]!=null)?(['protein','carbs','fat'] as const).filter(k=>i[k]!=null).map((k,index)=><Fragment key={k}>{index>0&&' · '}{t(k)} <NumberUnit value={i[k]} unit="g"/></Fragment>):t('nutritionNotRecorded')}
              actions={<div className="actions"><button type="button" onClick={()=>setEditing(i)}>{t('edit')}</button><button type="button" className="pantry-manage-units" onClick={()=>setManagingIngredient(choice)}>{t('customizeIngredient')}</button></div>}
            />
          </article>
        );})}
      </div>
      {!filtered.length && <p className="collection-empty">{t("emptySearch")}</p>}
      {managingIngredient&&<IngredientManagement choice={managingIngredient} preference={preferences[managingIngredient.item.id]} close={()=>setManagingIngredient(null)} notice={notice}/>}
      {editing !== undefined && (
        <PantryEditor
          item={editing}
          preference={editing?preferences[editing.id]:undefined}
          close={() => setEditing(undefined)}
          notice={notice}
        />
      )}
    </>
  );
}
function PantryRowContent({title,titleDescription,energy,metadata,macros,actions}:{title:ReactNode;titleDescription?:string;energy:ReactNode;metadata:ReactNode;macros:ReactNode;actions?:ReactNode}){
 return <div className={'grow pantry-row-content'+(actions?' has-secondary-actions':'')}><div className="ingredient-title-line"><h3 title={titleDescription}>{title}</h3><span className="ingredient-energy">{energy}</span></div><div className="pantry-secondary-line"><div className="pantry-source-line">{metadata}</div>{actions}</div><p className="macro-summary">{macros}</p></div>;
}
function PantryEditor({
  item,
  preference,
  close,
  notice,
}: {
  item: PantryItem | null;
  preference?:IngredientPreference;
  close: () => void;
  notice: Notice;
}) {
  const { t, i18n } = useTranslation();
  const [nutrition, setNutrition] = useState<Nutrition>(
    item
      ? {
          calories: item.calories,
          protein: item.protein,
          carbs: item.carbs,
          fat: item.fat,
        }
      : unknownNutrition(),
  );
  const [tagIds,setTagIds]=useState<string[]>(item?.tagIds??[]);
  const [basis, setBasis] = useState<"100g" | "serving">(item?.basis ?? "100g");
  const [referenceAmount,setReferenceAmount]=useState<number|null>(item?.referenceAmount??100);
  const [referenceUnit,setReferenceUnit]=useState<"g"|"mL">(item?.referenceUnit??"g");
  const [servingUnit,setServingUnit]=useState<"g"|"mL">(item?.servingUnit??"g");
  const [servingGrams, setServingGrams] = useState<number | null>(
    item?.servingGrams ?? null,
  );
  const [nutritionSource, setNutritionSource] = useState<
    PantryItem["nutritionSource"]
  >(item?.nutritionSource ?? "manual");
  const [recognition, setRecognition] = useState(item?.labelRecognition);
  const initialConversion=preference?preference.units[0]:item?.consumptionUnit;
  const [conversionOpen,setConversionOpen]=useState(!!initialConversion);
  const [conversionQuantity,setConversionQuantity]=useState<number|null>(initialConversion?.quantity??null);
  const [conversionName,setConversionName]=useState(initialConversion?.name??"");
  const [conversionAmount,setConversionAmount]=useState<number|null>(initialConversion?.amount??null);
  const [conversionUnitChoice,setConversionUnitChoice]=useState<"g"|"mL">(initialConversion?.unit??ingredientBaseUnit({basis,referenceUnit,servingUnit}));
  const [conversionUnitOverridden,setConversionUnitOverridden]=useState(!!initialConversion);
  const conversionUnit=conversionUnitOverridden?conversionUnitChoice:ingredientBaseUnit({basis,referenceUnit,servingUnit});
  const conversionEnabled=conversionQuantity!==null||conversionName.trim()!==''||conversionAmount!==null;
  const conversion={quantity:conversionQuantity!,name:conversionName.trim(),amount:conversionAmount!,unit:conversionUnit};
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name")).trim();
    if (!name) {
      notice(t("requiredName"));
      return;
    }
    if (basis === "100g" && (referenceAmount == null || !Number.isFinite(referenceAmount) || referenceAmount <= 0)) { notice(t("invalidReferenceAmount")); return; }
    if (servingGrams != null && (!Number.isFinite(servingGrams) || servingGrams <= 0)) { notice(t("invalidReferenceAmount")); return; }
    if (conversionEnabled && (!validConsumptionUnit(conversion) || conversion.unit !== ingredientBaseUnit({basis,referenceUnit,servingUnit}))) { setConversionOpen(true); notice(t("invalidConsumptionUnit")); return; }
    setBusy(true);
    try {
      const row: PantryItem = {
        ...(item ? changed(item) : stamp()),
        ...nutrition,
        name,
        nameZh: String(f.get("nameZh")).trim(),
        aliases: splitAliases(String(f.get("nameZh"))),
        brand: String(f.get("brand")).trim(),
        tagIds,
        basis,
        servingGrams,
        referenceAmount: referenceAmount ?? undefined, referenceUnit, servingUnit,
        consumptionUnit: conversionEnabled ? conversion : null,
        nutritionSource,
        labelRecognition: recognition,
      };
      await db.transaction('rw',[db.settings,db.ingredients,db.table('ingredientTags')],async()=>{
        await putTaggedIngredient(row);
        const saved=parseIngredientPreference((await db.settings.get(ingredientPreferencePrefix+row.id))?.value);
        if(saved){const units=[...(conversionEnabled?[conversion]:[]),...saved.units.slice(1)];const preferred=[row.basis==='serving'?'serving':row.referenceUnit??'g',...units.map(u=>u.name)].includes(saved.preferred)?saved.preferred:row.basis==='serving'?'serving':row.referenceUnit??'g';await saveIngredientPreference(userChoice(row),{...saved,units,preferred})}
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
    <Modal title={t(item ? "edit" : "newItem")} close={close} className="pantry-editor-modal">
      <form onSubmit={submit}>
        <div className="pantry-editor-body"><section className="ingredient-form-section"><h3>{t("basicInformation")}</h3>
        <div className="form-grid">
          <label>
            {t("name")}
            <input name="name" required defaultValue={item?.name} />
          </label>
          <label>
            {t("nameZh")}
            <input
              name="nameZh"
              defaultValue={item ? ingredientAliases(item).join("、") : ""}
            />
          </label>
          <label>
            {t("brand")}
            <input name="brand" defaultValue={item?.brand} />
          </label>
        </div></section><IngredientTagAssignment value={tagIds} onChange={setTagIds}/><section className="ingredient-form-section"><h3>{t("basis")}</h3><div className="form-grid ingredient-basis-grid">
          <label>
            <span className="sr-only">{t("basis")}</span>
            <select
              name="basis"
              aria-label={t("basis")}
              value={basis}
              onChange={(e) => setBasis(e.target.value as typeof basis)}
            >
              <option value="100g">{t("customNutritionReference")}</option>
              <option value="serving">{t("serving")}</option>
            </select>
          </label>
          {basis === "100g" && <><label>{t("perReference")}<NumberInput aria-label={t("referenceAmount")} name="referenceAmount" type="number" required min="0" step="any" value={referenceAmount??""} onChange={e=>setReferenceAmount(e.target.value===""?null:Number(e.target.value))}/></label><label>{t("unit")}<select name="referenceUnit" value={referenceUnit} onChange={e=>setReferenceUnit(e.target.value as "g"|"mL")}><option value="g">g</option><option value="mL">mL</option></select></label></>}
          {basis === "serving" && <label
            className={
              "serving-weight " +
              (basis === "serving" ? "emphasized" : "secondary-field")
            }
          >
            {t("servingSizeOptional")}
            <NumberInput
              type="number"
              min="0"
              step="any"
              name="servingGrams"
              value={servingGrams ?? ""}
              onChange={(e) =>
                setServingGrams(e.target.value ? Number(e.target.value) : null)
              }
            />
          </label>}
          {basis === "serving" && <label>{t("unit")}<select name="servingUnit" value={servingUnit} onChange={e=>setServingUnit(e.target.value as "g"|"mL")}><option value="g">g</option><option value="mL">mL</option></select></label>}
        </div>
        </section><section className="ingredient-form-section"><h3>{t("ingredientNutrition")}</h3>
        {nutritionSource === "package-label-ocr" && (
          <p className="source-badge">
            {t("ocrReviewedSource")}
            {recognition?.appliedFields?.length
              ? " · " + recognition.appliedFields.map((k) => t(k)).join("、")
              : ""}
          </p>
        )}
        <NutritionFields
          value={nutrition}
          onChange={(next) => {
            if (recognition?.appliedFields) {
              const fields = recognition.appliedFields.filter(
                (k) => next[k] === nutrition[k],
              );
              setRecognition({ ...recognition, appliedFields: fields });
              if (!fields.length) setNutritionSource("manual");
            }
            setNutrition(next);
          }}
        />
        </section>
        <details className="ingredient-form-section consumption-unit-editor" open={conversionOpen} onToggle={e=>setConversionOpen(e.currentTarget.open)}>
          <summary>{t("consumptionUnitConversion")}</summary>
            <div className="form-grid">
              <label>{t("quantity")}<NumberInput name="conversionQuantity" type="number" min="0" step="any" value={conversionQuantity??""} onChange={e=>setConversionQuantity(e.target.value===""?null:Number(e.target.value))}/></label>
              <label>{t("customUnitName")}<input name="conversionName" maxLength={40} value={conversionName} onChange={e=>setConversionName(e.target.value)}/></label>
              <label>{t("equivalentAmount")}<NumberInput name="conversionAmount" type="number" min="0" step="any" value={conversionAmount??""} onChange={e=>setConversionAmount(e.target.value===""?null:Number(e.target.value))}/></label>
              <label>{t("unit")}<select name="conversionUnit" value={conversionUnit} onChange={e=>{setConversionUnitChoice(e.target.value as "g"|"mL");setConversionUnitOverridden(true)}}><option value="g">g</option><option value="mL">mL</option></select></label>
            </div>
            {validConsumptionUnit(conversion) && <p className="text-small muted" aria-live="polite">1 {conversion.name} ≈ {(conversion.amount/conversion.quantity).toLocaleString(i18n.language==="zh"?"zh-CN":"en-US",{maximumFractionDigits:2})} {conversion.unit}</p>}
          <p className="text-small muted">{t("consumptionUnitClearHint")}</p>
        </details>
        </div>
        <div className="form-actions">
          <button type="button" onClick={close}>
            {t("cancel")}
          </button>
          <button className="primary" disabled={busy}>
            {t("save")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
