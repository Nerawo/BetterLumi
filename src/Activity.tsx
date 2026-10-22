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
  const { t } = useTranslation();
  const old = draft.item;
  const [tags, setTags] = useState(old ? old.trainingTags ?? [] : draft.prefill?.trainingTags ?? []);
  const [parts, setParts] = useState(old ? old.bodyParts ?? [] : draft.prefill?.bodyParts ?? []);
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
                name,
                type: old?.type ?? "other",
                date,
                duration: f.get("duration")===""?null:Number(f.get("duration")),
                distance: f.get("distance") ? Number(f.get("distance")) : null,
                notes: String(f.get("notes")).trim(),
                trainingTags: tags,
                bodyParts: parts,
                caloriesBurned:
                  f.get("caloriesBurned") === ""
                    ? null
                    : Number(f.get("caloriesBurned")),
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
        <label>
          {t("exerciseName")}
          <input
            name="name"
            required
            list="exercise-presets"
            defaultValue={old?.name ?? draft.prefill?.name ?? (old ? t(old.type) : "")}
          />
          <datalist id="exercise-presets">
            {["walking", "swimming", "badminton"].map((k) => (
              <option key={k} value={t(k)} />
            ))}
          </datalist>
        </label>
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
              defaultValue={old ? old.duration ?? "" : draft.prefill?.duration ?? ""}
            />
          </label>
          <label>
            {t("caloriesBurned")}
            <NumberInput
              name="caloriesBurned"
              type="number"
              min="0"
              step="any"
              defaultValue={old ? old.caloriesBurned ?? "" : draft.prefill?.caloriesBurned ?? ""}
            />
          </label>
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
        <ExerciseMetadataEditor value={{trainingTags:tags,bodyParts:parts}} onChange={v=>{setTags(v.trainingTags??[]);setParts(v.bodyParts??[])}}/>
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
