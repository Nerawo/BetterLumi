import './ingredient-management-locale';
import './ingredient-management.css';
import {NumberInput} from "./NumberInput";
import {confirmDelete} from "./DeleteConfirmation";
import {SupplementStatusMenu} from "./SupplementStatusMenu";
import { useState, useEffect } from "react";
import { isScheduled } from "./goals";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { db, stamp, localDate, softDelete } from "./domain";
import type { Supplement, Check as SupplementCheck } from "./db";
import {WeekdayPicker} from "./WeekdayPicker";
import { Modal, Actions, changed, type Notice } from "./ui";
export function SupplementCard({
  items,
  checks,
  date,
  notice,
}: {
  items: Supplement[];
  checks: SupplementCheck[];
  date: string;
  notice: Notice;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<Supplement | null | undefined>();
  const [managing, setManaging] = useState(false);
  const [schedule, setSchedule] = useState<Supplement["schedule"]>("daily");
  const [days, setDays] = useState<number[]>([]);
  useEffect(() => {
    setSchedule(editing?.schedule ?? "daily");
    setDays(editing?.days ?? []);
  }, [editing]);
  const due = items.filter((s) => isScheduled(s, date));
  return (
    <section className="card ritual-card supplement-section">
      <div className="section-heading supplement-heading"><button type="button" className="primary" onClick={()=>setManaging(true)}>{t('manageSupplements')}</button></div>
      <div id="supplement-entries">
       {!due.length&&<p className="muted text-small">{t(date===localDate()?"supplementNoScheduleToday":"supplementNoScheduleDate")}</p>}
       {due.map(s=><div className="supplement-row" key={s.id}>
        <div className="supplement-row-heading"><div className="grow"><strong>{s.name}</strong><small>{s.dosage} {s.unit}</small></div></div>
        <SupplementStatusMenu name={s.name} value={checks.find(c=>c.date===date&&c.supplementId===s.id)?.status??"unconfirmed"} disabled={date>localDate()} onChange={async status=>{
          try{const id=s.id+":"+date;const old=await db.checks.get(id);await db.checks.put({...old?changed(old):stamp(),id,supplementId:s.id,date,status})}catch{notice(t("failedMessage"))}
        }}/>
       </div>)}
      </div>
      {managing&&<Modal title={t("manageSupplements")} close={()=>setManaging(false)} className="supplement-manager">
       <button type="button" className="text-link" onClick={()=>{setManaging(false);setEditing(null)}}><Plus size={16}/>{t("addProfile")}</button>
       {items.map(s=><div className="simple-row" key={s.id}><div className="grow"><strong>{s.name}</strong><small>{s.dosage} {s.unit} · {t(s.schedule==="daily"?"dailySchedule":s.schedule==="weekdays"?"weekdays":"customDays")}</small></div><Actions edit={()=>{setManaging(false);setEditing(s)}} remove={async()=>{await confirmDelete("supplement",s.name,async()=>{await softDelete(db.supplements,s.id)})}}/></div>)}
      </Modal>}
      {editing !== undefined && (
        <Modal
          title={t(editing ? "edit" : "addProfile")}
          className="pantry-editor-modal supplement-editor"
          close={() => setEditing(undefined)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const name = String(f.get("name")).trim();
              if (!name) return;
              if (schedule === "custom" && !days.length) {
                notice(t("scheduleEmpty"));
                return;
              }
              try {
                await db.supplements.put({
                  ...(editing ? changed(editing) : stamp()),
                  name,
                  dosage: Number(f.get("dosage")),
                  unit: String(f.get("unit")).trim(),
                  schedule,
                  days:
                    schedule === "daily"
                      ? [1, 2, 3, 4, 5, 6, 0]
                      : schedule === "weekdays"
                        ? [1, 2, 3, 4, 5]
                        : days,
                });
                setEditing(undefined);
                notice(t("savedMessage"));
              } catch {
                notice(t("failedMessage"));
              }
            }}
          >
            <div className="pantry-editor-body">
            <label>
              {t("name")}
              <input name="name" required defaultValue={editing?.name} />
            </label>
            <div className="form-grid">
              <label>
                {t("dosage")}
                <NumberInput
                  name="dosage"
                  type="number"
                  min="0.01"
                  step="any"
                  required
                  defaultValue={editing?.dosage}
                />
              </label>
              <label>
                {t("unit")}
                <input name="unit" required defaultValue={editing?.unit} />
              </label>
            </div>
            <fieldset className="supplement-schedule-options"><legend>{t("schedule")}</legend><div role="group" aria-label={t("schedule")}>{(["daily","weekdays","custom"] as const).map(value=><button type="button" key={value} aria-pressed={schedule===value} onClick={()=>setSchedule(value)}>{t(value==="daily"?"dailySchedule":value==="weekdays"?"weekdays":"customDays")}</button>)}</div></fieldset>
            {schedule === "custom" && (
              <WeekdayPicker days={days} onChange={setDays}/>
            )}
            </div><div className="form-actions">
              <button type="button" onClick={() => setEditing(undefined)}>
                {t("cancel")}
              </button>
              <button className="primary">{t("save")}</button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}

/** Presentation only: completion counts taken; skipped resolves the reminder without counting as taken. */
export function SupplementHeadingStatus({items,checks,date}:{items:Supplement[];checks:SupplementCheck[];date:string}){
 const {t}=useTranslation(),due=items.filter(s=>isScheduled(s,date));
 const status=(id:string)=>checks.find(c=>c.date===date&&c.supplementId===id)?.status;
 const pending=date===localDate()&&due.some(s=>status(s.id)===undefined||status(s.id)==='unconfirmed');
 return <>{due.length>0&&<small className="supplement-count">{due.filter(s=>status(s.id)==='taken').length}/{due.length}</small>}{pending&&<span className="supplement-reminder-dot" role="img" aria-label={t('supplementPendingToday')}/>}</>;
}
