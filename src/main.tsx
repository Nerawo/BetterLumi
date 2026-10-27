import {PwaUpdatePrompt} from './PwaUpdatePrompt';
import './recipe-yield.css';
import {builtInRecipeItems} from './data/builtInRecipes';
import {WeightDataProvider,useWeightData} from './WeightData';
import {weightsOnDate} from './weight-state';
import {pageSessionKey,readSession,validPageSession,restoreInitialPage} from './session-state';
import {usePageSession} from './usePageSession';
import {parseToleranceEvents} from './goal-tolerance-model';
import {JournalMasthead} from "./JournalMasthead";
import {NumberUnit} from "./NumberUnit";
import {DeleteConfirmationHost} from "./DeleteConfirmation";
import {confirmDelete} from "./DeleteConfirmation";
import {dailyAggregation} from "./aggregation";
import {PlannedMovement} from "./PlannedMovement";
import { formatLocalDate } from "./dates";
import { TodayHeader } from "./TodayHeader";
import "./review-locale";
import { applyTheme } from "./themes";
import "./update-locale";
import "./homepage-locale";
import "./pantry-locale";
import "./editorial-locale";
import "./today-locale";
import { TodayProgress, todayOverview } from "./TodayProgress";
import { TodayTabs, type TodayTab } from "./TodayTabs";
import {HealthGoalCalculator} from './HealthGoalCalculator';
import { useLocalToday } from "./useLocalToday";
import { useRoute, navigate, backToOrigin, validLocalDate, currentRoute } from "./routing";
import { goalTable } from "./goals";
import { GoalCard } from "./GoalCards";
import { RecipeDetail } from "./RecipeDetail";
import {measurementDate,formatMeasurementTime} from './weight-time';
import { WeightEntry } from "./WeightEntry";
import { ActivityCard, ActivityEditor, type ActivityDraft } from "./Activity";
import { StorageBoundary } from "./StorageBoundary";
import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import {
  Home,
  Hexagon,
  Leaf,
  CircleDot,
  ArrowUpRight,
  Plus,
  Scale,
  Utensils,
  ArrowLeft,
  CalendarDays,
  ChevronDown,
} from "lucide-react";
import "./locale";
import {
  db,
  foodLogs,
  recipes,
  plans,
  weights,
  displayWeight,
  softDelete,
  type PantryItem,
  type Weight,
} from "./domain";
import { Recipes } from "./Recipes";
import { More } from "./More";
import { AddFood, MealList, type MealDraft } from "./Meals";
import { WeightJournal } from "./Weight";
import { ExercisePlans } from "./ExercisePlans";
import { PlanList } from "./Journal";
import { Journal } from "./JournalView";
import { SupplementCard } from "./Rituals";
import { Actions } from "./ui";
import "./fonts.css";
import "./olive.css";
import "./editorial.css";
import "./graphic-today.css";
import "./editorial-directories.css";
import "./editorial-more.css";
import "./journal-shared.css";
const Pantry = React.lazy(async () => ({
  default: (await import("./Pantry")).Pantry,
}));
type Page = "today" | "recipes" | "pantry" | "journal" | "more" | "weight";
const navigation = [
  ["today", Home],
  ["recipes", CircleDot],
  ["pantry", Leaf],
  ["more", Hexagon],
] as const;
function App() {
  const { t, i18n } = useTranslation();
  const today = useLocalToday();
  const route = useRoute();
  const page = (route.page === "journal" ? "today" : route.page) as Page;
  const selected = route.selectedDate;
  const setSelected = (date: string) => navigate("/today?date=" + date, false, true);
  useEffect(() => {
    const current = new URL(currentRoute(), 'http://local');
    if (current.pathname === "/") navigate("/today" + current.search, true);
    else if (route.page === "journal")
      navigate("/today?date=" + selected, true);
    else if(page==='today'&&!validLocalDate(new URL(currentRoute(),'http://local').searchParams.get('date')))navigate('/today?date='+selected,true,true);
  }, [page, selected, route.page]);
  const [todayTab, setTodayTab] = useState<TodayTab>(()=>(readSession(pageSessionKey,validPageSession)?.tab as TodayTab)??'food');
  const [draft, setDraft] = useState<MealDraft | null>(null);
  const [activityDraft, setActivityDraft] = useState<ActivityDraft | null>(
    null,
  );
  const [toast,setToastState]=useState<{message:string;duration:number}|null>(null);
  const setToast=useCallback((message:string,duration=5000)=>setToastState(message?{message,duration}:null),[]);

  const [weightEntry, setWeightEntry] = useState<Weight | null | undefined>();
  const storedGoals = useLiveQuery(() =>
    goalTable.filter((g) => !g.deletedAt).toArray(),
  );


  const pantry = useLiveQuery(() =>
    db.ingredients.filter((i) => !i.deletedAt).toArray(),
  ) as PantryItem[] | undefined;
  const recipeItems = useLiveQuery(() =>
    recipes.filter((r) => !r.deletedAt).toArray(),
  );
  const logs = useLiveQuery(() =>
    foodLogs.filter((l) => !l.deletedAt).toArray(),
  );
  const planItems = useLiveQuery(() =>
    plans.filter((p) => !p.deletedAt).toArray(),
  );
  const weightState=useWeightData();
  const weightItems=weightState?.records;
  const activities = useLiveQuery(() =>
    db.activities.filter((a) => !a.deletedAt).toArray(),
  );
  const supplements = useLiveQuery(() =>
    db.supplements.filter((s) => !s.deletedAt).toArray(),
  );
  const checks = useLiveQuery(() =>
    db.checks.filter((c) => !c.deletedAt).toArray(),
  );
  const settings = useLiveQuery(() => db.settings.toArray());
  const prefs = Object.fromEntries(
    (settings ?? []).map((s) => [s.key, s.value]),
  );
  const goals=useMemo(()=>{const events=parseToleranceEvents(prefs.goalTolerances);return (storedGoals??[]).map(goal=>({...goal,evaluationToleranceEvents:events}))},[storedGoals,prefs.goalTolerances]);
  useLayoutEffect(() => {
    applyTheme(prefs.theme);
  }, [prefs.theme]);
  const unit = prefs.weightUnit === "lb" ? "lb" : "kg";
  useLayoutEffect(() => {
    if (settings) i18n.changeLanguage(prefs.language === "en" ? "en" : "zh");
  }, [prefs.language, !!settings]);
  useLayoutEffect(() => {
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToastState(null), toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  const preference = async (key: string, value: string) => {
    try {
      await db.settings.put({ key, value });
    } catch {
      setToast(t("failedMessage"));
    }
  };
  const go = (next: Page) => {
    persistPageSession();
    const date=page==='today'?selected:readSession(pageSessionKey,validPageSession)?.todayDate??today;
    navigate(next==='today'?'/today?date='+date:'/'+next,false,true);
    setDraft(null);
  };
  const openMeal = (meal: MealDraft) => {
    setDraft(meal);
    setTodayTab("food");
    if (page !== "today") navigate("/today");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const dailyTotals=dailyAggregation(selected,logs??[],activities??[]);
  const todayLogs=dailyTotals.food;
  const overview=useMemo(()=>todayOverview(goals,selected,logs??[],activities??[]),[goals,selected,logs,activities]);
  const displayedWeights=weightState?weightsOnDate(weightState,selected):[];
  const loaded = [
    pantry,
    recipeItems,
    logs,
    planItems,
    weightItems,
    activities,
    supplements,
    checks,
    settings,
    storedGoals,
  ].every(Boolean);
  const persistPageSession=usePageSession({ready:loaded&&i18n.language===(prefs.language==='en'?'en':'zh'),tab:todayTab,date:selected,page});
  const titles = {
    today: ["todayTitle", "todaySub"],
    recipes: ["recipeTitle", "recipeSub"],
    pantry: ["pantryTitle", "pantrySub"],
    journal: ["journalTitle", "journalSub"],
    more: ["moreTitle", "moreSub"],
    weight: ["weightJournal", "weightPrivacy"],
  } as const;
  return (
    <div className="app">
      <main>
        {page !== "today" && !["recipes","pantry","more"].includes(page) && (
          <header className="editorial-masthead">
            {page === "weight" ? <button className="secondary-back" onClick={() => backToOrigin("/more")}><ArrowLeft size={19}/><span>{t("backNavigation")}</span></button> : <span>BETTERLUMI</span>}
            <button
              className="language-toggle"
              onClick={() =>
                preference("language", i18n.language === "zh" ? "en" : "zh")
              }
            >
              {i18n.language === "zh" ? "中文 / EN" : "EN / 中文"}
            </button>
          </header>
        )}
        <div className={"page page-" + page}>
          {["recipes","pantry","more"].includes(page)&&<JournalMasthead onLanguageSwitch={()=>{void preference("language",i18n.language==="zh"?"en":"zh")}}/>}
          {page !== "today" && (
            <div className="page-title">
              <h1>{t(titles[page][0])}</h1>
            </div>
          )}
          {!loaded ? (
            <div className="card">
              {i18n.language === "zh"
                ? "正在打开本地手记…"
                : "Opening your local journal…"}
            </div>
          ) : (
            <>
              {page === "today" && (
                <>
                  <TodayHeader date={selected} onLanguageSwitch={()=>{void preference("language",i18n.language==="zh"?"en":"zh")}}/>
                  <TodayProgress model={overview}/>
                  {draft && (
                    <AddFood
                      key={
                        (draft.log?.id ?? draft.recipe?.id ?? "new") +
                        draft.date
                      }
                      draft={draft}
                      recipes={[...recipeItems!,...builtInRecipeItems(i18n.language)]}
                      pantry={pantry!}
                      close={() => setDraft(null)}
                      notice={setToast}
                    />
                  )}
                  <Journal logs={logs!} activity={activities!} planItems={planItems!} selected={selected} setSelected={setSelected} goals={goals}/>
                  <TodayTabs active={todayTab} onChange={setTodayTab}>
                   {{
                    food: <div className="today-layout"><div>
                      <section className="card meal-card">
                        <div className="section-heading">
                          <div>
                            <h2>
                              <Utensils size={18}/>{t(selected === today ? "whatIAteToday" : "whatIAteOnDate")}
                            </h2>
                          </div>
                          <button
                            className="primary"
                            onClick={() => setDraft({ date: selected })}
                            disabled={selected > today}
                          >
                            <Plus size={15} />
                            {t("addFood")}
                          </button>
                        </div>
                        {dailyTotals.foodCount>0&&<p className="section-totals" data-testid="meal-section-total">{dailyTotals.nutrition.calories===null?t("notRecorded"):<NumberUnit value={dailyTotals.nutrition.calories.toLocaleString(undefined,{maximumFractionDigits:1})} unit="kcal"/>}{dailyTotals.nutrients.calories.missing>0&&dailyTotals.nutrition.calories!==null&&" · "+t("partialData")}</p>}
                        <MealList
                          logs={todayLogs}
                          edit={(log) => setDraft({ date: log.date, log })}
                        />
                      </section></div></div>,
                    activity: <><div className="today-layout"><div><ActivityCard items={activities!.filter(activity => activity.date === selected)} date={selected} notice={setToast} open={setActivityDraft} prominent planned={<PlannedMovement date={selected} open={setActivityDraft} notice={setToast}/>} title={t(selected === today ? "howIMovedToday" : "howIMovedOnDate")}/></div></div><ExercisePlans notice={setToast}/></>,
                    supplements: <div className="today-support"><SupplementCard items={supplements!} checks={checks!} date={selected} notice={setToast}/></div>,
                    weight: <div className="today-support">
                      <section className="card weight-mini">
                        <div className="section-heading">
                          <h3>
                            <Scale size={18} />
                            {t("weight")}
                          </h3>
                        <button
                          className="primary record-weight-button"
                          onClick={() => setWeightEntry(null)}
                          disabled={selected > today}
                        >
                          <Plus size={16} />
                          {t("recordWeight")}
                        </button>
                        </div>
                        <div className="weight-content">
                          <div className="weight-records">
                            {displayedWeights.map(weight => <div className="weight-record" key={weight.id} data-measurement-id={weight.id}>
                              <div className="grow"><strong className="weight-value">{displayWeight(weight.kg,unit).toFixed(1)}<small>{unit}</small></strong>
                                <p className="weight-date"><time dateTime={weight.measuredAt}>{formatMeasurementTime(weight,i18n.language)??t("weightTimeUnknown")}</time></p>
                                {weight.notes&&<p className="text-small preserved-text weight-note">{weight.notes}</p>}
                              </div>
                              <Actions edit={() => setWeightEntry(weight)} remove={async () => {await confirmDelete("weight",displayWeight(weight.kg, unit).toFixed(1)+" "+unit+" · "+formatLocalDate(measurementDate(weight),i18n.language)+" · "+(formatMeasurementTime(weight,i18n.language)??t("weightTimeUnknown")),async()=>{await softDelete(weights,weight.id)})}}/>
                            </div>)}
                            {!displayedWeights.length&&<p className="muted weight-empty">{t("weightDateEmpty")}</p>}
                          </div>
                          <button className="text-link weight-diary-row" onClick={() => navigate("/weight")}>{t("seeWeight")}<ArrowUpRight size={15}/></button>
                        </div>
                      </section></div>,
                    more: <div className="today-utilities">
                    <GoalCard goals={goals} date={selected} notice={setToast} />
                    <details className="other-daily-plans"><summary><CalendarDays size={17}/><span>{t("otherDailyPlans")}</span><small className="todo-count">{planItems!.filter(plan=>plan.date===selected).length}</small><ChevronDown size={15}/></summary><PlanList items={planItems!.filter(plan => plan.date === selected)} notice={setToast} defaultDate={selected}/></details>
                  </div>,
                    calculator: <HealthGoalCalculator notice={setToast}/>
                   }}
                  </TodayTabs>
                </>
              )}
              {page === "recipes" && (
                <Recipes
                  items={recipeItems!}
                  pantry={pantry!}
                  notice={setToast}
                />
              )}
              {page === "recipes" && route.recipeId && (
                <RecipeDetail
                  key={route.recipeId}
                  recipe={[...(recipeItems??[]),...builtInRecipeItems(i18n.language)].find((r) => r.id === route.recipeId)}
                  pantry={pantry ?? []}
                  notice={setToast}
                  addMeal={(recipe) => openMeal({ date: today, recipe })}
                />
              )}
              {page === "weight" && (
                <WeightJournal
                  unit={unit}
                  setUnit={(u) => preference("weightUnit", u)}
                  notice={setToast}
                />
              )}
              {page === "pantry" && (
                <React.Suspense
                  fallback={<div className="card">{t("pantry")}…</div>}
                >
                  <Pantry items={pantry!} notice={setToast} />
                </React.Suspense>
              )}
              {page === "more" && (
                <More
                  weight={() => navigate("/weight")}
                  preference={preference}
                  prefs={prefs}
                  notice={setToast}
                />
              )}
            </>
          )}
        </div>
      </main>
      <nav className="mobile-nav" aria-label={t("primaryNavigation")}>
        {navigation.map(([key, Icon]) => (
          <button
            key={key}
            className={
              page === key || (page === "weight" && key === "more")
                ? "active"
                : ""
            }
            onClick={() => go(key)}
            aria-label={t(key)}
            aria-current={
              page === key || (page === "weight" && key === "more")
                ? "page"
                : undefined
            }
          >
            <Icon size={20} />
          </button>
        ))}
      </nav>
      {weightEntry !== undefined && (
        <WeightEntry
          item={weightEntry}
          initialUnit={unit}
          close={() => setWeightEntry(undefined)}
          notice={setToast}
        />
      )}
      {activityDraft && (
        <ActivityEditor
          draft={activityDraft}
          close={() => setActivityDraft(null)}
          notice={setToast}
        />
      )}

      {toast && (
        <div role="status" className="toast">
          {toast.message}
        </div>
      )}
    </div>
  );
}
restoreInitialPage();
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <StorageBoundary>
      <WeightDataProvider><App /></WeightDataProvider>
      <DeleteConfirmationHost />
      <PwaUpdatePrompt />
    </StorageBoundary>
  </React.StrictMode>,
);
