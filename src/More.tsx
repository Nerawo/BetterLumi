import {currentTolerances,parseToleranceEvents} from './goal-tolerance-model';
import './goal-tolerances-locale';
import {GoalTolerancePanel} from './GoalTolerancePanel';
import {History,SlidersHorizontal} from 'lucide-react';
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { themeOptions, resolvedTheme } from "./themes";
import { useTranslation } from "react-i18next";
import {
  ShieldCheck,
  Download,
  Upload,
  Scale,
  Palette,
  Languages,
  Database,
  ChevronRight,
  Info,
} from "lucide-react";
import { exportAll, restoreAll, localDate } from "./domain";
import { Modal, type Notice } from "./ui";
import { goalTable } from "./goals";
import { GoalHistory } from "./GoalCards";
export function More({
  weight,
  preference,
  prefs,
  notice,
}: {
  weight: () => void;
  preference: (k: string, v: string) => Promise<void>;
  prefs: Record<string, string>;
  notice: Notice;
}) {
  const { t, i18n } = useTranslation();
  const [panel, setPanel] = useState("");
  const goals =
    useLiveQuery(() => goalTable.filter((g) => !g.deletedAt).toArray()) ?? [];
  const rows = [
    { key: "weight", icon: Scale, title: "weightJournal", action: weight },
    {key:"tolerances",icon:SlidersHorizontal,title:"goalTolerances",action:()=>setPanel("tolerances")},
    {key:"history",icon:History,title:"goalHistory",action:()=>setPanel("history")},
    {
      key: "appearance",
      icon: Palette,
      title: "appearanceLabel",
      action: () => setPanel("appearance"),
    },
    {
      key: "language",
      icon: Languages,
      title: "language",
      action: () => setPanel("language"),
    },
    {
      key: "data",
      icon: Database,
      title: "backup",
      action: () => setPanel("data"),
    },
    {
      key: "about",
      icon: Info,
      title: "privacyAbout",
      action: () => setPanel("about"),
    },
  ];
  return (
    <div className="more-directory">
      <section className="settings-group" aria-labelledby="more-settings-heading"><h2 id="more-settings-heading">{t("settings")}</h2>
        {rows.map(({ key, icon: Icon, title, action }) => (
          <button
            type="button"
            key={key}
            data-setting={key}
            className="settings-row"
            aria-label={t(title)}
            onClick={action}
          >
            <Icon size={20} strokeWidth={1.35} />
            <span>
              {t(title)}
              {key === "appearance" && (
                <small>{t(resolvedTheme(prefs.theme).name)}</small>
              )}
              {key === "language" && (
                <small>{i18n.language === "zh" ? "简体中文" : "English"}</small>
              )}
            </span>
            <ChevronRight size={18} />
          </button>
        ))}
      </section>

      {panel && (
        <Modal
          title={t(
            panel === "tolerances" ? "goalTolerances" : panel === "history" ? "goalHistory" : panel === "appearance"
              ? "themeTitle"
              : panel === "language"
                ? "language"
                : panel === "data"
                  ? "backup"
                  : "privacyAbout",
          )}
          close={() => setPanel("")}
          className={"settings-modal"+(["tolerances","history"].includes(panel)?" goal-settings-modal":"")}
        >
          {panel === "tolerances"&&<GoalTolerancePanel initial={currentTolerances(parseToleranceEvents(prefs.goalTolerances))} close={()=>setPanel("")}/>}
          {panel === "history"&&<div className="modal-scroll"><GoalHistory goals={goals} embedded/></div>}
          {panel === "appearance" && (
            <div className="theme-choices">
              {themeOptions.map((theme) => (
                <button
                  key={theme.id}
                  aria-pressed={resolvedTheme(prefs.theme).id === theme.id}
                  onClick={() => preference("theme", theme.id)}
                >
                  <span
                    className="theme-preview"
                    style={{
                      background: theme.bg,
                      color: theme.ink,
                      borderColor: theme.line,
                    }}
                  >
                    <i style={{ background: theme.color }} />
                    <strong>Aa</strong>
                    <span style={{ background: theme.soft }} />
                  </span>
                  <span>{t(theme.name)}</span>
                  <span className="theme-radio">
                    {resolvedTheme(prefs.theme).id === theme.id ? "●" : "○"}
                  </span>
                </button>
              ))}
            </div>
          )}
          {panel === "language" && (
            <div className="segments">
              {[
                ["zh", "简体中文"],
                ["en", "English"],
              ].map(([id, name]) => (
                <button
                  key={id}
                  aria-pressed={i18n.language === id}
                  className={i18n.language === id ? "selected" : ""}
                  onClick={() => preference("language", id)}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
          {panel === "data" && (
            <>
              <p className="muted">{t("backupDescription")}</p>
              <div className="backup-buttons">
                <button
                  className="primary"
                  onClick={async () => {
                    try {
                      const data = await exportAll();
                      const url = URL.createObjectURL(
                        new Blob([JSON.stringify(data)], {
                          type: "application/json",
                        }),
                      );
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "BetterLumi-" + localDate() + ".json";
                      a.click();
                      setTimeout(() => URL.revokeObjectURL(url), 1000);
                      await preference("lastBackup", new Date().toISOString());
                      notice(t("exportMessage"));
                    } catch {
                      notice(t("failedMessage"));
                    }
                  }}
                >
                  <Download size={18} />
                  {t("export")}
                </button>
                <label className="secondary file-button">
                  <Upload size={18} />
                  {t("import")}
                  <input
                    className="visually-hidden"
                    type="file"
                    accept="application/json,.json"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file || !confirm(t("restoreConfirm"))) return;
                      try {
                        await restoreAll(JSON.parse(await file.text()));
                        notice(t("restoredMessage"));
                      } catch {
                        notice(t("restoreFailed"));
                      }
                    }}
                  />
                </label>
              </div>
              <p className="muted text-small">
                {t("lastBackup")}:{" "}
                {prefs.lastBackup
                  ? new Date(prefs.lastBackup).toLocaleString(i18n.language)
                  : t("never")}
              </p>
            </>
          )}
          {panel === "about" && (
            <section className="privacy-info">
              <ShieldCheck size={28} />
              <h3>BetterLumi · 0.1.0</h3>
              <p>{t("storageNote")}</p>
              <p>{t("offline")}</p>
            </section>
          )}
        </Modal>
      )}
    </div>
  );
}
