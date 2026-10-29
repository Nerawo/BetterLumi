import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, expect, it } from "vitest";
import { db, stamp, LumiDB, type ExercisePlan } from "./db";
import { exportAll, restoreAll } from "./domain";
import { scheduledExercise, weekDates, shiftDay } from "./exercise-schedule";
import { exercisePlans, exerciseOccurrences, completeExerciseOccurrence,saveActivity,saveExercisePlan } from "./exercise-plans";
import { todayProgress } from "./today-progress";
afterEach(async()=>{for(const table of db.tables)await table.clear()});
const plan=():ExercisePlan=>({...stamp(),name:"Daily movement",enabled:true,notes:"Keep",schedule:"daily",days:[1,3,5],dates:["2026-10-17","2026-10-20"],exercises:[{id:"walk",name:"Walk",duration:45,distance:2,notes:"Target only"}]});
it("retains edited zero/unknown actuals and completion links across backup restore and later plan changes", async () => {
 const p=plan(),date="2026-10-17";
 await saveExercisePlan(p);
 await completeExerciseOccurrence(p.id,"walk",date,true);
 const generated=(await db.activities.toArray())[0];
 await saveActivity({...generated,duration:0,distance:0,caloriesBurned:null,trainingTags:["strength"],bodyParts:["custom:Recorded"],notes:"Actual only"});
 const recorded=(await db.activities.get(generated.id))!;
 const before=await exportAll();
 await restoreAll(before);
 expect((await exportAll()).tables).toEqual(before.tables);
 await saveExercisePlan({...p,exercises:[{...p.exercises[0],duration:60,estimatedCalories:300,trainingTags:["cardio"]}]});
 await completeExerciseOccurrence(p.id,"walk",date,true);
 expect(await db.activities.get(recorded.id)).toEqual(recorded);
 expect(await db.activities.count()).toBe(1);
 expect(todayProgress([],date,[],await db.activities.toArray())).toMatchObject({minutes:0,burned:null});
 await completeExerciseOccurrence(p.id,"walk",date,false);
 expect(await db.activities.get(recorded.id)).toMatchObject({duration:0,distance:0,caloriesBurned:null,trainingTags:["strength"],bodyParts:["custom:Recorded"],notes:"Actual only",deletedAt:null,planOccurrenceId:null});
 // A new completion links one new actual; the independently edited record stays independent.
 await completeExerciseOccurrence(p.id,"walk",date,true);
 await completeExerciseOccurrence(p.id,"walk",date,true);
 expect(await db.activities.count()).toBe(2);
 expect(todayProgress([],date,[],await db.activities.toArray()).minutes).toBe(60);
 expect((await exerciseOccurrences.toArray())[0].activityId).not.toBe(recorded.id);
});
it("copies optional plan metadata once without rewriting independently edited actuals",async()=>{
 const p=plan();p.exercises[0].trainingTags=["cardio"];p.exercises[0].bodyParts=["preset:arms","custom:Mobility"];await saveExercisePlan(p);
 await completeExerciseOccurrence(p.id,"walk","2026-10-17",true);const actual=(await db.activities.toArray())[0];expect(actual).toMatchObject({trainingTags:["cardio"],bodyParts:["preset:arms","custom:Mobility"]});
 await saveActivity({...actual,trainingTags:["strength"],bodyParts:["custom:Actual only"],duration:12});const edited=await db.activities.get(actual.id);
 await saveExercisePlan({...p,exercises:[{...p.exercises[0],trainingTags:["anaerobic"],bodyParts:[]}]});await completeExerciseOccurrence(p.id,"walk","2026-10-17",true);
 expect(await db.activities.count()).toBe(1);expect(await db.activities.get(actual.id)).toEqual(edited);
 const backup=await exportAll();await restoreAll(backup);expect((await exercisePlans.get(p.id))!.exercises[0].trainingTags).toEqual(["anaerobic"]);expect(await db.activities.get(actual.id)).toEqual(edited);
});
it("rejects invalid optional metadata without modifying a saved plan",async()=>{
 const p=plan();await saveExercisePlan(p);await expect(saveExercisePlan({...p,exercises:[{...p.exercises[0],bodyParts:123 as any}]})).rejects.toThrow();expect(await exercisePlans.get(p.id)).toEqual(p);
});
it("schedules daily, weekdays, custom weekdays and explicit dates independently using local dates",()=>{
 const p=plan();expect(scheduledExercise(p,"2026-10-18")).toBe(true);expect(scheduledExercise({...p,schedule:"weekdays"},"2026-10-18")).toBe(false);expect(scheduledExercise({...p,schedule:"weekdays"},"2026-10-19")).toBe(true);expect(scheduledExercise({...p,schedule:"custom"},"2026-10-19")).toBe(true);expect(scheduledExercise({...p,schedule:"custom"},"2026-10-20")).toBe(false);expect(scheduledExercise({...p,schedule:"dates"},"2026-10-20")).toBe(true);expect(scheduledExercise({...p,enabled:false},"2026-10-20")).toBe(false);
 expect(weekDates("2027-01-01")).toEqual(["2026-12-28","2026-12-29","2026-12-30","2026-12-31","2027-01-01","2027-01-02","2027-01-03"]);expect(shiftDay("2026-03-08",1)).toBe("2026-03-09");
});
it("new occurrence checklists create one actual and round trip independently per date",async()=>{
 const p=plan();await exercisePlans.put(p);await completeExerciseOccurrence(p.id,"walk","2026-10-17",true);await completeExerciseOccurrence(p.id,"walk","2026-10-18",false);expect(await db.activities.count()).toBe(1);expect(todayProgress([],"2026-10-17",[],await db.activities.toArray()).minutes).toBe(45);const backup=await exportAll();expect(backup.version).toBe(10);await restoreAll(backup);expect(await exercisePlans.get(p.id)).toEqual(p);expect((await exerciseOccurrences.where("date").equals("2026-10-17").first())?.completed).toBe(true);expect(await db.activities.count()).toBe(1);
 const old={...backup,version:4,tables:{...backup.tables}};delete old.tables.exercisePlans;delete old.tables.exerciseOccurrences;await restoreAll(old);expect(await exercisePlans.count()).toBe(0);expect(await exerciseOccurrences.count()).toBe(0);
});
it("version 4 to 7 adds five empty stores and preserves every prior row byte-for-byte",async()=>{
 await db.open();const name="preserve-v4-"+crypto.randomUUID(),old=new Dexie(name);old.version(4).stores(Object.fromEntries(db.tables.filter(t=>!["exercisePlans","exerciseOccurrences","ingredientTags","foodBatches","inventoryTransactions"].includes(t.name)).map(t=>[t.name,[t.schema.primKey.src,...t.schema.indexes.map(i=>i.src)].join(",")])));const rows=new Map();for(const table of old.tables){const value=table.name==="settings"?{key:"language",value:"zh"}:{...stamp(),name:"Unchanged",photo:"data:image/png;base64,ORIGINAL",notes:"Keep all fields"};await table.put(value);rows.set(table.name,value)}old.close();const upgraded=new LumiDB(name);await upgraded.open();try{expect(upgraded.verno).toBe(7);for(const [table,row]of rows)expect(await upgraded.table(table).get(row.id??row.key)).toEqual(row);expect(await upgraded.table("exercisePlans").count()).toBe(0);expect(await upgraded.table("exerciseOccurrences").count()).toBe(0);expect(await upgraded.foodBatches.count()).toBe(0);expect(await upgraded.inventoryTransactions.count()).toBe(0)}finally{await upgraded.delete()}
});
it("rejects malformed new plan backup rows before changing any existing record",async()=>{
 const p=plan();await exercisePlans.put(p);const backup=await exportAll();(backup.tables.exercisePlans[0] as any).exercises=[null];await expect(restoreAll(backup)).rejects.toThrow();expect(await exercisePlans.get(p.id)).toEqual(p);
});
