import {JournalServingUnits,asConversion,type UnitDraft} from './JournalServingUnits';
import {PantryRowContent} from './PantryRowContent';
import {FamilyEditor,PantryFamilyRow,useFamilies} from './FamilyUI';
import {familyMembers} from './families';
import type {IngredientFamily} from './db';
import {useEffect,useRef} from 'react';
import {IngredientManagement} from './IngredientManagement';
import {normalizeIngredientNutrition} from './ingredient-nutrition';
import {useIngredientPreferences} from './useIngredientPreferences';
import {validIngredientPreference,parseIngredientPreference,saveIngredientPreference,ingredientPreferencePrefix,userChoice,type IngredientPreference} from './ingredient-preferences';
import type {FoodChoice} from './reference-library';
import {DirectoryListHeader} from './DirectoryListHeader';
import {IngredientTagNavigation,IngredientTagAssignment,IngredientTagManager,useIngredientTags} from "./IngredientTags";
import {putTaggedIngredient} from "./ingredient-tags";
import {searchFoodChoices,referenceName} from './reference-library';
import {pantryListNutrition,sortPantryFoods} from './pantry-foods';
import {ReferenceSourceInfo} from './ReferenceSourceInfo';
import {JournalHeading} from './JournalHeading';
import {JournalTextField} from './JournalTextField';
import {IngredientAmount,IngredientChoice} from './IngredientJournalFields';
import './ingredient-journal.css';
import { validConsumptionUnit, ingredientBaseUnit } from "./consumption-units";
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
  round,
  stamp,
  unknownNutrition,
  nutrientKeys,
  type PantryItem,
  type Nutrition,
} from "./domain";
import {
  Modal,

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
  const matchedFoods=searchFoodChoices(items,search,"",tags).filter(c=>!preferences[c.item.id]?.archived);
  const [editing, setEditing] = useState<PantryItem | null | undefined>();
  const catalog=useFamilies(items),[familyEditor,setFamilyEditor]=useState<IngredientFamily|null>();
  const [adding,setAdding]=useState(false),addRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{
   if(!adding)return;
   const outside=(e:PointerEvent)=>{if(!addRef.current?.contains(e.target as Node))setAdding(false)};
   const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){setAdding(false);addRef.current?.querySelector('button')?.focus()}};
   document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key);
   return ()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key)};
  },[adding]);
  const matchesTag=(choice:FoodChoice)=>!activeTag||choice.item.tagIds?.includes(activeTag);
  const matches=new Set(matchedFoods.map(choice=>choice.item.id));
  const familyRows:{family:IngredientFamily;visible:FoodChoice[]}[]=[];
  const nestedIds=new Set<string>();
  const query=search.trim().toLocaleLowerCase();
  for(const family of catalog.families){
    if(activeTag&&!catalog.familyTags[family.id]?.includes(activeTag))continue;
    const byName=[family.name,family.alternateName].some(name=>name.toLocaleLowerCase().includes(query));
    const members=familyMembers(family,catalog);
    // Tags select the Family as a whole; only the independent text search narrows its members.
    const visible=byName?members:members.filter(choice=>matches.has(choice.item.id));
    if(!byName&&!visible.length)continue;
    familyRows.push({family,visible});
    for(const choice of visible)nestedIds.add(choice.item.id);
  }
  const familyNames=new Intl.Collator(i18n.language,{numeric:true,sensitivity:'base'});
  familyRows.sort((a,b)=>familyNames.compare(a.family.name,b.family.name)*(sort==='name-desc'?-1:1));
  const standaloneFoods=sortPantryFoods(matchedFoods.filter(choice=>matchesTag(choice)&&!nestedIds.has(choice.item.id)),sort,i18n.language);
  const foodCount=new Set([...nestedIds,...standaloneFoods.map(choice=>choice.item.id)]).size;
  const familyCount=familyRows.length;
  const renderFood=(choice:FoodChoice,familyAction?:ReactNode)=>{
          if(choice.kind==='built-in'){
            const food=choice.item;
            return <article className="pantry-row pantry-reference-row" key={food.id} data-reference-id={food.id} onClick={event=>{if(event.currentTarget.contains(event.target as Node)&&!(event.target as HTMLElement).closest('button,a,summary,details,input,select,textarea,[role=button]'))setManagingIngredient(choice)}}>
              <PantryRowContent
                title={<button type="button" className="ingredient-name" onClick={()=>setManagingIngredient(choice)}>{referenceName(food,i18n.language)}</button>}
                energy={<><NumberUnit value={food.kcalPer100g===null?'—':Math.round(food.kcalPer100g)} unit="kcal"/> / 100 g</>}
                metadata={<ReferenceSourceInfo source={food}/>}
                actions={familyAction&&<div className="actions">{familyAction}</div>}
                macros={(['protein','carbs','fat'] as const).map((key,index)=><Fragment key={key}>{index>0&&' · '}{t(key)} <NumberUnit value={food[`${key}Per100g`]?.toFixed(1)??'—'} unit="g"/></Fragment>)}
              />
            </article>;
          }
          const i=choice.item;
          const {basis,nutrition}=pantryListNutrition(i);
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
              energy={<>{nutrition.calories!=null&&<><NumberUnit value={Math.round(nutrition.calories)} unit="kcal"/> / </>}{basis.unit==='serving'?t('servingUnit'):<NumberUnit value={basis.amount} unit={basis.unit}/>}</>}
              metadata={[...tags.filter(tag=>i.tagIds?.includes(tag.id)).map(tag=>tag.name),t('referenceMyFood')].join(' · ')}
              macros={(['protein','carbs','fat'] as const).some(k=>nutrition[k]!=null)?(['protein','carbs','fat'] as const).filter(k=>nutrition[k]!=null).map((k,index)=><Fragment key={k}>{index>0&&' · '}{t(k)} <NumberUnit value={round(nutrition[k])} unit="g"/></Fragment>):t('nutritionNotRecorded')}
              actions={familyAction&&<div className="actions">{familyAction}</div>}
            />
          </article>
        );};
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
      <DirectoryListHeader count={[t('ingredientCount',{count:foodCount}),familyCount?t('directoryFamilyCount',{count:familyCount}):''].filter(Boolean).join(' · ')}><PantrySortMenu value={sort} onChange={setSort}/></DirectoryListHeader>
      <div ref={addRef} className="pantry-add-actions"><button type="button" className="primary pantry-fab directory-fab" aria-controls={adding?'pantry-add-menu':undefined} aria-expanded={adding} aria-label={t('add')} onClick={()=>setAdding(!adding)}><Plus size={20}/></button>
       {adding&&<div id="pantry-add-menu" className="pantry-add-menu"><button className="pantry-add-ingredient" onClick={()=>{setAdding(false);setEditing(null)}}>{t('directoryAddIngredient')}</button><button className="family-create-action" onClick={()=>{setAdding(false);setFamilyEditor(null)}}>{t('familyCreate')}</button></div>}</div>
      <div className="pantry-list">
        {familyRows.map(({family,visible})=><PantryFamilyRow key={family.id} family={family} catalog={catalog} autoExpand={!!query} visible={visible} edit={()=>setFamilyEditor(family)} render={renderFood}/>)}
        {standaloneFoods.map(food=>renderFood(food))}
      </div>
      {familyEditor!==undefined&&<FamilyEditor initialTags={familyEditor?catalog.familyTags[familyEditor.id]:undefined} family={familyEditor??undefined} catalog={catalog} items={items} close={()=>setFamilyEditor(undefined)}/>}
      {!familyCount&&!standaloneFoods.length && <p className="collection-empty">{t("emptySearch")}</p>}
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
export function PantryEditor({
  item,
  preference,
  statusMessage="",
  initialName="",
  onCreated,
  close,
  notice,
}: {
  item: PantryItem | null;
  preference?:IngredientPreference;
  statusMessage?:string;
  initialName?:string;
  onCreated?:(item:PantryItem)=>void;
  close: () => void;
  notice: Notice;
}) {
  const { t } = useTranslation();
  const [draftName,setDraftName]=useState(item?.name??initialName);
  const [aliases,setAliases]=useState(item?ingredientAliases(item).join("、"):"");
  const [brand,setBrand]=useState(item?.brand??"");
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
  const [openingPreference]=useState(preference);
  const initialUnits=openingPreference?.units??(item?.consumptionUnit?[item.consumptionUnit]:[]);
  const [unitRows,setUnitRows]=useState<UnitDraft[]>(()=>initialUnits.map((unit,id)=>({...unit,id})));
  const baseUnit=ingredientBaseUnit({basis,referenceUnit,servingUnit});
  const initialPreferred=initialUnits.findIndex(unit=>unit.name===preference?.preferred);
  const [preferred,setPreferred]=useState(initialPreferred>=0?String(initialPreferred):preference?.preferred??(basis==='serving'?'serving':baseUnit));
  const units=unitRows.map(row=>asConversion(row,baseUnit));
  const invalidUnits=units.some(unit=>!validConsumptionUnit(unit)||unit.unit!==baseUnit)||new Set(units.map(unit=>unit.name.toLowerCase())).size!==units.length;
  const [showUnitError,setShowUnitError]=useState(false);
  const selectedUnit=unitRows.find(row=>String(row.id)===preferred)?.name.trim()??(preferred==='serving'&&basis==='serving'?'serving':baseUnit);
  const [busy, setBusy] = useState(false);
  const saveLock=useRef(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if(saveLock.current)return;
    const name = draftName.trim();
    if (!name) {
      notice(t("requiredName"));
      return;
    }
    if (basis === "100g" && (referenceAmount == null || !Number.isFinite(referenceAmount) || referenceAmount <= 0)) { notice(t("invalidReferenceAmount")); return; }
    if (servingGrams != null && (!Number.isFinite(servingGrams) || servingGrams <= 0)) { notice(t("invalidReferenceAmount")); return; }
    if (invalidUnits) { setShowUnitError(true); return; }
    saveLock.current=true;setBusy(true);
    try {
      const row: PantryItem = {
        ...(item ? changed(item) : stamp()),
        ...normalizeIngredientNutrition(nutrition),
        name,
        nameZh: aliases.trim(),
        aliases: splitAliases(aliases),
        brand: brand.trim(),
        tagIds,
        basis,
        servingGrams,
        referenceAmount: referenceAmount ?? undefined, referenceUnit, servingUnit,
        consumptionUnit: units[0]??null,
        nutritionSource,
        labelRecognition: recognition,
      };
      const settings={version:1 as const,units,preferred:selectedUnit,archived:preference?.archived??false};
      if(!validIngredientPreference(userChoice(row),settings)){notice(t('unitInvalid'));return}
      await db.transaction('rw',[db.settings,db.ingredients,db.ingredientFamilies,db.table('ingredientTags')],async()=>{
        const saved=parseIngredientPreference((await db.settings.get(ingredientPreferencePrefix+row.id))?.value);
        if(JSON.stringify(saved)!==JSON.stringify(openingPreference??null))throw Error('Ingredient preference changed');
        await putTaggedIngredient(row);
        if(saved||units.length||selectedUnit!==(basis==='serving'?'serving':baseUnit))await saveIngredientPreference(userChoice(row),settings);
      });
      // Keep the disabled creation dialog over the editor during a double-tap sequence.
      if(!item&&onCreated){await new Promise(resolve=>setTimeout(resolve,350));onCreated(row)}
      close();
      notice(t("savedMessage"));
    } catch {
      notice(t("failedMessage"));
    } finally {
      saveLock.current=false;setBusy(false);
    }
  };
  // These are the two supported dimensions for authoring a label, not a conversion.
  const labelUnits=[{value:"g",label:"g"},{value:"mL",label:"mL"}] as const;
  const basisOptions=[{value:"100g",label:t("customNutritionReference")},{value:"serving",label:t("serving")}] as const;
  const changeNutrient=(key:keyof Nutrition,value:number|null)=>{
    if(nutrition[key]===value)return;
    if(recognition?.appliedFields){
      const fields=recognition.appliedFields.filter(k=>k!==key);
      setRecognition({...recognition,appliedFields:fields});
      if(!fields.length)setNutritionSource("manual");
    }
    setNutrition({...nutrition,[key]:value});
  };
  return (
    <Modal title={t(item?"pantryEditTitle":"newItem")} close={close} className="pantry-editor-modal ingredient-journal">
      <form onSubmit={submit}>
        <div className="pantry-editor-body">
          {statusMessage&&<p role="alert">{statusMessage}</p>}
          <section className="ingredient-form-section ingredient-basics">
            <h3><JournalHeading>{t("basicInformation")}</JournalHeading></h3>
            <JournalTextField name="name" label={t("name")} required value={draftName} onChange={setDraftName} placeholder={t("pantryEnterName")}/>
            <div className="ingredient-secondary-fields">
              <JournalTextField name="nameZh" label={t("pantryAliases")} value={aliases} onChange={setAliases} placeholder={'＋ '+t('add')} showPencil={false}/>
              <JournalTextField name="brand" label={t("pantryBrand")} value={brand} onChange={setBrand} placeholder={'＋ '+t('add')} showPencil={false}/>
            </div>
            <IngredientTagAssignment value={tagIds} onChange={setTagIds}/>
          </section>
          <section className="ingredient-form-section">
            <h3><JournalHeading>{t("basis")}</JournalHeading></h3>
            <div className="ingredient-journal-row ingredient-basis-choice">
              <span>{t("pantryReferenceMethod")}</span>
              <IngredientChoice label={t("basis")} value={basis} options={basisOptions} onChange={setBasis}/>
            </div>
            {basis==="100g"
              ? <IngredientAmount compact key="reference" name="referenceAmount" label={t("perReference")} inputLabel={t("referenceAmount")} value={referenceAmount} onChange={setReferenceAmount}
                  unit={<IngredientChoice label={t("unit")} value={referenceUnit} options={labelUnits} onChange={setReferenceUnit}/>}/>
              : <IngredientAmount key="serving" name="servingGrams" label={t("servingSizeOptional")} value={servingGrams} onChange={setServingGrams}
                  unit={<IngredientChoice label={t("unit")} value={servingUnit} options={labelUnits} onChange={setServingUnit}/>}/>}
          </section>
          <section className="ingredient-form-section">
            <h3><JournalHeading>{t("ingredientNutrition")}</JournalHeading></h3>
            {nutritionSource==="package-label-ocr"&&<p className="source-badge">{t("ocrReviewedSource")}
              {recognition?.appliedFields?.length?" · "+recognition.appliedFields.map(k=>t(k)).join("、"):""}</p>}
            <div className="nutrition-fields">{nutrientKeys.map(key=><IngredientAmount key={key} name={key} label={t(key==="calories"?"energy":key)}
              value={nutrition[key]} onChange={value=>changeNutrient(key,value)} unit={<span>{key==="calories"?"kcal":"g"}</span>}/>)}</div>
          </section>
          <JournalServingUnits rows={unitRows} change={setUnitRows} base={baseUnit} serving={basis==='serving'} preferred={preferred} choose={setPreferred}/>
          {item&&<div className="ingredient-archive-action"><button type="button" disabled={busy} onClick={async()=>{
            if(!window.confirm(t('archiveConfirm')))return;
            try{await saveIngredientPreference(userChoice(item),{...(preference??{version:1,units:initialUnits,preferred:item.basis==='serving'?'serving':ingredientBaseUnit(item)}),archived:true});close()}
            catch{notice(t('failedMessage'))}
          }}>{t('archiveIngredient')}</button></div>}
        </div>
        {showUnitError&&invalidUnits&&<p className="ingredient-unit-error" role="alert">{t('unitInvalid')}</p>}
        <div className="form-actions recipe-editor-footer">
          <button type="button" onClick={close}>{t("cancel")}</button>
          <button type="submit" className="primary" disabled={busy}>{t("save")}</button>
        </div>
      </form>
    </Modal>
  );
}
