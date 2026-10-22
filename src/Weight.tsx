import {useWeightData} from './WeightData';
import {useLocalToday} from './useLocalToday';
import {measurementDate,measurementMillis,formatMeasurementTime} from './weight-time';
import {NumberUnit} from "./NumberUnit";
import {confirmDelete} from "./DeleteConfirmation";
import { formatLocalDate } from "./dates";
import { WeightEntry } from "./WeightEntry";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Scale } from "lucide-react";
import {
  weights,
  localDate,
  displayWeight,
  softDelete,
  type Weight,
} from "./domain";
import { Empty, AddButton, Actions, type Notice } from "./ui";
export function WeightJournal({
  unit,
  setUnit,
  notice,
}: {
  unit: string;
  setUnit: (v: string) => void;
  notice: Notice;
}) {
  const { t, i18n } = useTranslation();
  const state=useWeightData(),items=state?.records??[],latestWeight=state?.latestWeight??null,today=useLocalToday();
  const [range, setRange] = useState(() => { try { const saved = Number(sessionStorage.getItem("betterlumi.weightRange")); return [7,30,90,365,0].includes(saved) && sessionStorage.getItem("betterlumi.weightRange") !== null ? saved : 30; } catch { return 30; } });
  useEffect(() => { try { sessionStorage.setItem("betterlumi.weightRange",String(range)); } catch { /* Session-only preference is optional. */ } },[range]);
  const [editing, setEditing] = useState<Weight | null | undefined>();
  const cutoff = new Date(today+'T12:00:00');
  cutoff.setDate(cutoff.getDate() - range + 1);
  const visible=items.filter(w=>range===0||measurementDate(w)>=localDate(cutoff)).slice().reverse();
  return (
    <section>
      <div className="section-heading">
        <AddButton onClick={() => setEditing(null)}>{t("addWeight")}</AddButton>
      </div>
      <div className="weight-toolbar">
        <div className="segments">
          {[7, 30, 90, 365, 0].map((n) => (
            <button
              className={range === n ? "selected" : ""}
              onClick={() => setRange(n)}
              key={n}
            >
              {n === 0 ? t("allFilter") : n === 365 ? "1Y" : `${n}D`}
            </button>
          ))}
        </div>
        <div className="segments" aria-label={t("weightUnit")}>
          {["kg", "lb"].map((u) => (
            <button
              className={unit === u ? "selected" : ""}
              onClick={() => setUnit(u)}
              key={u}
            >
              {u}
            </button>
          ))}
        </div>
      </div>
      <div className="weight-chart card">
        {visible.length ? (
          <>
            <div className="weight-value">
              {displayWeight(latestWeight!.kg, unit).toFixed(1)}
              <small> {unit}</small>
              <span>
                {t("latest")} · {formatLocalDate(measurementDate(latestWeight!),i18n.language)} · {formatMeasurementTime(latestWeight!,i18n.language)??t('weightTimeUnknown')}
              </span>
            </div>
            <WeightChart items={visible} unit={unit} language={i18n.language} />
            {visible.length === 1 && (
              <p className="muted text-small">{t("singleWeight")}</p>
            )}
          </>
        ) : (
          <Empty
            icon={<Scale />}
            heading={items.length ? t("emptyWeightRange") : t("weightEmpty")}
          />
        )}
        <p className="muted text-small">{t("weightPrivacy")}</p>
      </div>
      <div className="record-list weight-measurement-list">
        {[...new Set(visible.slice().reverse().map(measurementDate))].map(date=><section className="weight-measurement-group" key={date} data-weight-date={date}>
          <h3>{formatLocalDate(date,i18n.language)}</h3>
          {visible.filter(w=>measurementDate(w)===date).slice().reverse().map(w=><div className="simple-row" key={w.id} data-measurement-id={w.id}>
            <span><time dateTime={w.measuredAt}>{formatMeasurementTime(w,i18n.language)??t('weightTimeUnknown')}</time>{w.notes&&<small className="preserved-text">{w.notes}</small>}</span>
            <strong><NumberUnit value={displayWeight(w.kg,unit).toFixed(1)} unit={unit}/></strong>
            <Actions edit={()=>setEditing(w)} remove={async()=>{await confirmDelete('weight',displayWeight(w.kg,unit).toFixed(1)+' '+unit+' · '+formatLocalDate(date,i18n.language)+' · '+(formatMeasurementTime(w,i18n.language)??t('weightTimeUnknown')),async()=>{await softDelete(weights,w.id)})}}/>
          </div>)}
        </section>)}
      </div>
      {editing !== undefined && (
        <WeightEntry
          item={editing}
          initialUnit={unit}
          close={() => setEditing(undefined)}
          notice={notice}
        />
      )}
    </section>
  );
}
function WeightChart({
  items,
  unit,
  language,
}: {
  items: Weight[];
  unit: string;
  language: string;
}) {
  const vals = items.map((w) => displayWeight(w.kg, unit));
  const padding = Math.max(0.5, (Math.max(...vals) - Math.min(...vals)) * 0.2);
  const min = Math.min(...vals) - padding,
    max = Math.max(...vals) + padding;
  const times = items.map((w) => measurementMillis(w));
  const start = Math.min(...times),
    end = Math.max(...times);
  const x = (n: number) =>
    end === start ? 320 : 55 + ((n - start) / (end - start)) * 550;
  const y = (n: number) => 190 - ((n - min) / (max - min)) * 150;
  const points = items.map((w, n) => ({
    x: x(times[n]),
    y: y(vals[n]),
    w,
    value: vals[n],
  }));
  return (
    <svg
      className="line-chart"
      viewBox="0 0 640 240"
      role="img"
      aria-label={
        language === "zh"
          ? "真实体重记录折线图"
          : "Line chart of recorded weight measurements"
      }
    >
      {[0, 1, 2, 3].map((n) => {
        const v = min + ((max - min) * n) / 3;
        return (
          <g key={n}>
            <line
              x1="55"
              y1={y(v)}
              x2="605"
              y2={y(v)}
              stroke="var(--line)"
              strokeDasharray="3 5"
            />
            <text x="42" y={y(v) + 4} textAnchor="end">
              {v.toFixed(1)}
            </text>
          </g>
        );
      })}
      {points.length > 1 && (
        <polyline
          points={points.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke="var(--olive)"
          strokeWidth="2.5"
        />
      )}
      {points.map((p) => (
        <g key={p.w.id}>
          <circle
            cx={p.x}
            cy={p.y}
            r="5"
            fill="var(--olive)"
            stroke="var(--bg)"
            strokeWidth="2"
          >
            <title>
              {formatLocalDate(measurementDate(p.w),language)} {formatMeasurementTime(p.w,language)??''}: {p.value.toFixed(2)} {unit}
            </title>
          </circle>
        </g>
      ))}
      <text x="55" y="225">
        {formatLocalDate(measurementDate(items[0]),language,"short")}
      </text>
      {items.length > 1 && (
        <text x="605" y="225" textAnchor="end">
          {formatLocalDate(measurementDate(items[items.length - 1]),language,"short")}
        </text>
      )}
    </svg>
  );
}
