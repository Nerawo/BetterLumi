import type {Page} from '@playwright/test';
/** Calculator fixtures edit real measurements rather than an independent UI override. */
export async function setRecordedWeight(page:Page,kg:number){await page.evaluate(async kg=>{
 const d=await import('/src/domain.ts'),s=await import('/src/weight-state.ts'),r=await import('/src/weight-records.ts'),time=await import('/src/weight-time.ts');const latest=(await s.readWeightState()).latestWeight;
 await r.saveWeightMeasurement({date:latest?time.measurementDate(latest):d.localDate(),kg,notes:latest?.notes??'',...(latest?{}:{measuredAt:new Date().toISOString()})},latest);
},kg)}
