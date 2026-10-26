import {BuiltInExerciseSelector} from './BuiltInExerciseSelector';
import {builtInExercises} from './data/builtInExercises';
import {exerciseEstimateSnapshot} from './exercise-estimate';
import {useWeightData} from './WeightData';
import {ReferenceSourceInfo} from './ReferenceSourceInfo';
import {referenceName} from './reference-library';
import {NumberInput} from "./NumberInput";
import {ExerciseJournalRow} from "./ExerciseJournalRow";
import {NumberUnit} from "./NumberUnit";
import {ExerciseMetadataEditor} from "./ExerciseMetadata";
import {confirmDelete} from "./DeleteConfirmation";
import {useLiveQuery} from "dexie-react-hooks";
import {occurrenceId} from "./exercise-schedule";
import {exercisePlans,exerciseOccurrences,saveActivity,deleteActivity} from "./exercise-plans";
import {dailyAggregation,measurement} from "./aggregation";
import { formatLocalDate } from "./dates";
import { DateInput } from "./DateInput";
import { useState, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Footprints, Plus, ChevronDown } from "lucide-react";
import { db, plans, stamp, localDate, round } from "./domain";
import {plannedActivityId} from "./exercise-plans";
import type { Activity } from "./db";
import { Modal, Actions, changed, type Notice } from "./ui";
export interface ActivityDraft {
  item?: Activity;
  plannedKey?: string;
  date: string;
  notes?: string;
  prefill?: { name: string; duration: number | null; distance: number | null; notes: string; caloriesBurned?:number|null;trainingTags?:string[];bodyParts?:string[] };
  onSaved?: () => Promise<void>;
}
export function ActivityCard({
  items,
  notice,
  open,
  date = localDate(),
  title,
  prominent = false,
  planned,
}: {
  title?: string;
  prominent?: boolean;
  planned?: ReactNode;
  items: Activity[];
  notice: Notice;
  open: (d: ActivityDraft) => void;
  date?: string;
}) {
  const { t, i18n } = useTranslation();
  const totals=dailyAggregation(date,[],items);
  const parentPlans=useLiveQuery(()=>exercisePlans.filter(plan=>!plan.deletedAt).toArray())??[];
  if(planned){const visible=new Set(parentPlans.flatMap(plan=>plan.exercises.map(item=>occurrenceId(plan.id,date,item.id))));items=items.filter(item=>!item.planOccurrenceId||!visible.has(item.planOccurrenceId));}
  const displayedBurned=measurement(items.map(item=>item.caloriesBurned)),otherTotals=dailyAggregation(date,[],items);
  const Heading = prominent ? "h2" : "h3";
  return (
    <section className="card ritual-card exercise-card">
      <div className="section-heading">
        <Heading>
          <Footprints size={18} />
          {title ?? t("activity")}
        </Heading>
        <button
          className={prominent ? "primary" : ""}
          disabled={date > localDate()}
          aria-label={t("activityLog")}
          onClick={() => open({ date })}
        >
          <Plus size={18} />{prominent && t("addExerciseShort")}
        </button>
      </div>
      {prominent&&totals.activityCount>0&&<p className="section-totals" data-testid="exercise-section-total">{totals.burned.value===null?<span>{t("notRecorded")}</span>:<NumberUnit value={round(totals.burned.value)} unit="kcal"/>}{totals.minutes.value!==null&&<NumberUnit value={round(totals.minutes.value)} unit={t("minutes")}/>}<small className="summary-coverage">{(totals.burned.value!==null&&!totals.burned.complete||totals.minutes.value!==null&&!totals.minutes.complete)&&t("partialData")}</small></p>}
      {planned}
      <details className="other-exercise" open>
      <summary className="exercise-disclosure-heading"><strong className="exercise-group-heading">{t("otherExercise")}</strong><span className="other-exercise-summary exercise-disclosure-stats">{otherTotals.activityCount>0?<>{otherTotals.burned.value!==null&&<span className="summary-stat"><NumberUnit value={round(otherTotals.burned.value)} unit="kcal"/></span>}{otherTotals.minutes.value!==null&&<span className="summary-stat"><NumberUnit value={round(otherTotals.minutes.value)} unit={t("minutes")}/></span>}{otherTotals.burned.value===null&&otherTotals.minutes.value===null&&t("notRecorded")}{(otherTotals.burned.value!==null||otherTotals.minutes.value!==null)&&(otherTotals.burned.missing>0||otherTotals.minutes.missing>0)&&<small>{t("partialData")}</small>}</>:t("noMovement")}</span><ChevronDown size={16}/></summary>
      {!items.length ? null : (
        <>
          {!prominent&&<p className="muted text-small">
            {t("loggedExpenditure")}:{" "}
            {displayedBurned.value===null?t("notRecorded"):round(displayedBurned.value)+" kcal"}{displayedBurned.value!==null&&displayedBurned.missing>0&&" · "+t("partialData")}
          </p>}
          <div className="exercise-record-list" role="list">
          {items.map((a) => (
            <ExerciseJournalRow className="activity-row" role="listitem" key={a.id} name={a.name||t(a.type)} values={a} notice={notice} prefix={a.date!==date?formatLocalDate(a.date,i18n.language)+" · ":undefined} items={[...(a.duration!=null?[{value:a.duration,unit:t("minutes")}]:[]),...(a.caloriesBurned!=null?[{value:a.caloriesBurned,unit:"kcal"}]:[]),...(a.distance!=null?[{value:a.distance,unit:"km"}]:[])]} actions={<Actions edit={()=>open({date:a.date,item:a})} remove={async()=>{await confirmDelete("exercise",a.name||t(a.type),async()=>{await deleteActivity(a.id)})}}/>}/>
          ))}
          </div>
        </>
      )}
      </details>
    </section>
  );
}
export function ActivityEditor({
  draft,
  close,
  notice,
}: {
  draft: ActivityDraft;
  close: () => void;
  notice: Notice;
}) {
  const { t,i18n } = useTranslation();
  const old = draft.item;
  const initialPreset=builtInExercises.find(item=>item.id===old?.exerciseEstimate?.builtInId);
  const [preset,setPreset]=useState(old?.exerciseEstimate?.builtInId??'');
  const [presetName,setPresetName]=useState(initialPreset?old?.name??'':'');
  // Only user-authored custom data belongs to this draft, never a preset label or estimate.
  const [customDraft,setCustomDraft]=useState(()=>({
    name:initialPreset?'':old?.name??draft.prefill?.name??(old?t(old.type):''),
    kcal:initialPreset?'':String(old?old.caloriesBurned??'':draft.prefill?.caloriesBurned??''),
    tags:initialPreset?[] as string[]:old?.trainingTags??draft.prefill?.trainingTags??[],
    parts:initialPreset?[] as string[]:old?.bodyParts??draft.prefill?.bodyParts??[],
  }));
  const weightState=useWeightData();
  const [duration,setDuration]=useState(String(old?old.duration??'':draft.prefill?.duration??''));
  // Opening a saved log never refreshes its snapshot; explicit input edits can opt in.
  const [manual,setManual]=useState(!!old||draft.prefill?.caloriesBurned!=null);
  const [manualEdited,setManualEdited]=useState(old?.calorieSource!=='automatic');
  const [manualKcal,setManualKcal]=useState(String(old?old.caloriesBurned??'':draft.prefill?.caloriesBurned??''));
  const selectedPreset=builtInExercises.find(item=>item.id===preset);
  const name=selectedPreset?presetName||referenceName(selectedPreset,i18n.language):customDraft.name;
  const savedEstimate=old?.exerciseEstimate?.builtInId===preset?old.exerciseEstimate:undefined;
  const estimate=selectedPreset&&weightState?exerciseEstimateSnapshot(selectedPreset,duration===''?null:Number(duration),weightState.latestWeight):undefined;
  const kcal=!selectedPreset?customDraft.kcal:manual?manualKcal:estimate?.estimatedKcal??'';
  const [tags, setTags] = useState(old ? old.trainingTags ?? [] : draft.prefill?.trainingTags ?? []);
  const [parts, setParts] = useState(old ? old.bodyParts ?? [] : draft.prefill?.bodyParts ?? []);
  const source=selectedPreset?{...selectedPreset,...(manual?savedEstimate??estimate:estimate),historical:!!(manual&&savedEstimate),finalKcal:kcal===''?null:Number(kcal),calorieSource:(manual&&manualEdited?'manual':'automatic') as 'manual'|'automatic'}:undefined;
  const selectPreset=(item:typeof selectedPreset|null)=>{
    // Only an explicit exercise-type change loads defaults; intensity and rerenders never do.
    if(!item){
      setPreset('');setTags([...customDraft.tags]);setParts([...customDraft.parts]);
      setManual(true);setManualEdited(true);setManualKcal('');
      return;
    }
    if(item.category!==selectedPreset?.category){setTags([...item.defaultTrainingTags]);setParts([...item.defaultBodyParts])}
    setPreset(item.id);setPresetName(referenceName(item,i18n.language));
    if(!selectedPreset){setManual(false);setManualEdited(false);setManualKcal('')}
    else if(!manualEdited)setManual(false);
  };
  const editKcal=()=>{setManualKcal(kcal===''?'':String(Number(Number(kcal).toFixed(2))));setManual(true);setManualEdited(true)};
  const editableKcal=!selectedPreset||manual&&manualEdited;
  const [busy, setBusy] = useState(false);
  const saving=useRef(false);
  return (
    <Modal title={t(old ? "edit" : "activityLog")} close={close} className="exercise-record-editor exercise-editor">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if(saving.current)return;
          const f = new FormData(e.currentTarget);
          const name = String(f.get("name")).trim();
          const date = String(f.get("date"));
          if (!name) return;
          if(selectedPreset&&!manual&&!estimate){notice(t('exerciseEstimateUnavailable'));return;}
          if (date > localDate()) {
            notice(t("errorDate"));
            return;
          }
          saving.current=true;setBusy(true);
          try {
            await db.transaction("rw", [db.activities, plans,exercisePlans,exerciseOccurrences], async () => {
              const check=draft.plannedKey?await exerciseOccurrences.get(draft.plannedKey):undefined;
              const linked=check?.activityId?await db.activities.get(check.activityId):undefined;
              if(linked&&!linked.deletedAt&&!old)throw Error("PLAN_ACTUAL_EXISTS");
              const metadata=old?changed(old):stamp();
              if(!old&&draft.plannedKey){let id=plannedActivityId(draft.plannedKey),suffix=0;while(await db.activities.get(id))id=plannedActivityId(draft.plannedKey)+":generated:"+(++suffix);metadata.id=id;}
              await saveActivity({
                ...metadata,
                calorieSource:(manual&&manualEdited)||(!selectedPreset&&!savedEstimate)?'manual':'automatic',
                exerciseEstimate:manual&&savedEstimate?savedEstimate:selectedPreset?estimate:undefined,
                name,
                type: !selectedPreset&&old?.exerciseEstimate&&preset!==old.exerciseEstimate.builtInId?'other':old?.type??"other",
                date,
                duration: f.get("duration")===""?null:Number(f.get("duration")),
                distance: f.get("distance") ? Number(f.get("distance")) : null,
                notes: String(f.get("notes")).trim(),
                trainingTags: tags,
                bodyParts: parts,
                caloriesBurned:
                  kcal === ""
                    ? null
                    : Number(kcal),
              },draft.plannedKey,!old);
              await draft.onSaved?.();
            });
            close();
            notice(t("savedMessage"));
          } catch(error) {
            notice(t(error instanceof Error&&error.message==="PLAN_ACTUAL_EXISTS"?"actualAlreadyRecorded":"failedMessage"));
          } finally {
            saving.current=false;setBusy(false);
          }
        }}
      >
        <div className="exercise-editor-scroll">
        <BuiltInExerciseSelector value={preset} source={source} onChange={selectPreset}/>
        {!selectedPreset?<label>
          {t("customExerciseName")}
          <input
            name="name"
            required
            placeholder={t('customExercisePlaceholder')}
            value={customDraft.name} onChange={event=>setCustomDraft(previous=>({...previous,name:event.target.value}))}
          />
        </label>:<input type="hidden" name="name" value={name}/>}
        <div className="form-grid">
          <label>
            {t("date")}
            <DateInput
              name="date"
              required
              max={localDate()}
              defaultValue={old?.date ?? draft.date}
            />
          </label>
          <label>
            {t("duration")}
            <NumberInput
              name="duration"
              type="number"
              min="0"
              step="any"
              required={!!selectedPreset}
              value={duration} onChange={event=>{setDuration(event.target.value);if(!manualEdited)setManual(false)}}
            />
          </label>
          {editableKcal?<label>
            {t("caloriesBurned")}
            <NumberInput
              name="caloriesBurned"
              type="number"
              min="0"
              step="any"
              value={kcal===''?'':manual||!selectedPreset?kcal:Math.round(Number(kcal))}
              onChange={event=>{const value=event.target.value;if(!selectedPreset)setCustomDraft(previous=>({...previous,kcal:value}));else{setManual(true);setManualEdited(true);setManualKcal(value)}}}
            />
          </label>:<input type="hidden" name="caloriesBurned" value={kcal===''?'':manual?kcal:Math.round(Number(kcal))}/>}
          <label>
            {t("distance")}
            <NumberInput
              name="distance"
              type="number"
              min="0"
              step="any"
              defaultValue={old ? old.distance ?? "" : draft.prefill?.distance ?? ""}
            />
          </label>
        </div>
        {selectedPreset&&<div className="exercise-estimate-note" aria-live="polite">
         {!editableKcal&&(kcal===''?<p className="exercise-estimate-prompt">{t('exerciseEnterDuration')}</p>:<><span className="exercise-reference-result-label">{t('exerciseEstimate')}</span><p className="exercise-reference-result" data-testid="exercise-estimated-kcal">≈ {Math.round(Number(kcal))}<small>kcal</small></p></>)}
         {source?.weightKg!==undefined&&<span className="exercise-weight-source">{source.weightSource==='reference'?t(source.historical?'exerciseSnapshotFallback':'exerciseFallback'):t(source.historical?'exerciseSnapshotWeight':'exerciseRecordedWeight',{weight:source.weightKg.toLocaleString(i18n.language,{maximumFractionDigits:1})})}<ReferenceSourceInfo iconOnly label={t('exerciseCalculationDetails')} source={source}/></span>}
         {manual&&<small>{t(manualEdited?'exerciseManual':'exerciseSavedEstimate')}</small>}
         <div className="exercise-estimate-actions">{!editableKcal&&<button type="button" onClick={editKcal}>{t('exerciseEditManually')}</button>}{manual&&<button type="button" onClick={()=>{setManual(false);setManualEdited(false)}}>{t('exerciseRestore')}</button>}</div>
        </div>}
        <ExerciseMetadataEditor value={{trainingTags:tags,bodyParts:parts}} onChange={v=>{setTags(v.trainingTags??[]);setParts(v.bodyParts??[]);if(!selectedPreset)setCustomDraft(previous=>({...previous,tags:v.trainingTags??[],parts:v.bodyParts??[]}))}}/>
        <label>
          {t("notes")}
          <textarea name="notes" rows={2} defaultValue={old?.notes ?? draft.prefill?.notes ?? draft.notes} />
        </label>
        </div><div className="form-actions">
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
