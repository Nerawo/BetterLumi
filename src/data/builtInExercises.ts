export interface BuiltInExercise {
 readonly id:`betterlumi:exercise:${string}`;
 readonly nameZh:string;
 readonly nameEn:string;
 readonly category:string;
 readonly intensityLabelZh:string;
 readonly intensityLabelEn:string;
 readonly isDefault:boolean;
 readonly defaultTrainingTags:readonly string[];
 readonly defaultBodyParts:readonly string[];
 readonly met:number|null;
 readonly activityCode:string;
 readonly sourceName:string;
 readonly sourceDescription:string;
 readonly sourceUrl:string;
}
const defaultCodes:Readonly<Record<string,string>>=Object.freeze({walking:'16060',running:'12030',swimming:'18240',cycling:'01016',badminton:'15030',strength:'02054',bodyweight:'02022'});
const cardio=Object.freeze(['cardio']),strength=Object.freeze(['strength','anaerobic']),legs=Object.freeze(['preset:thighs','preset:calves']),noParts=Object.freeze([] as string[]);
const preset=(code:string,category:string,nameZh:string,nameEn:string,zh:string,en:string,met:number,sourceDescription:string,page:string):BuiltInExercise=>Object.freeze({id:`betterlumi:exercise:${code}`,category,nameZh,nameEn,isDefault:defaultCodes[category]===code,defaultTrainingTags:category==='strength'||category==='bodyweight'?strength:cardio,defaultBodyParts:['walking','running','cycling'].includes(category)?legs:noParts,intensityLabelZh:zh,intensityLabelEn:en,met,activityCode:code,sourceName:'2024 Adult Compendium of Physical Activities',sourceDescription,sourceUrl:`https://pacompendium.com/${page}/`});
/** Original 2024 Compendium entries; static references, never database seeds. */
export const builtInExercises:readonly BuiltInExercise[]=Object.freeze([
 preset('16060','walking','步行','Walking','中等速度','Moderate pace',3.5,'Walking for transportation, 2.8-3.2 mph, level, moderate pace, firm surface','transportation'),
 preset('12020','running','跑步','Running','慢跑','Easy',7.5,'Jogging, general, self-selected pace','running'),
 preset('12030','running','跑步','Running','一般','Moderate',8.5,'Running, 5.0 to 5.2 mph (12 min/mile)','running'),
 preset('12050','running','跑步','Running','较快','Faster',9.3,'Running, 6-6.3 mph (10 min/mile)','running'),
 preset('18240','swimming','游泳','Swimming','一般','Moderate',5.8,'Swimming laps, freestyle, slow, recreational','water-activities'),
 preset('18230','swimming','游泳','Swimming','高强度','Vigorous',9.8,'Swimming laps, freestyle, fast, vigorous effort','water-activities'),
 preset('01015','cycling','骑行','Cycling','轻松','Easy',4.3,'Bicycling, self-selected easy pace','bicycling'),
 preset('01016','cycling','骑行','Cycling','一般','Moderate',7,'Bicycling, self-selected moderate pace','bicycling'),
 preset('01017','cycling','骑行','Cycling','较快','Vigorous',9,'Bicycling, self-selected vigorous pace','bicycling'),
 preset('15030','badminton','羽毛球','Badminton','休闲','Recreational',5.5,'Badminton, social singles and doubles, general','sports'),
 preset('15025','badminton','羽毛球','Badminton','比赛','Competitive',9,'Badminton, competitive, match play','sports'),
 preset('02054','strength','力量训练','Strength training','一般','General',3.5,'Resistance (weight) training, multiple exercises, 8-15 reps at varied resistance','conditioning-exercise'),
 preset('02050','strength','力量训练','Strength training','高强度','Vigorous',6,'Resistance (weight lifting – free weight, nautilus or universal-type), power lifting or body building, vigorous effort (Taylor Code 210)','conditioning-exercise'),
 preset('02022','bodyweight','自重训练','Bodyweight training','一般','Moderate',3.8,'Calisthenics (e.g., pushups, sit ups, pull-ups, lunges), moderate effort','conditioning-exercise'),
 preset('02020','bodyweight','自重训练','Bodyweight training','高强度','Vigorous',7.5,'Calisthenics (e.g., pushups, sit ups, pull-ups, jumping jacks, burpees, battling ropes), vigorous effort','conditioning-exercise'),
]);

export const defaultBuiltInExercise=(category:string)=>builtInExercises.find(item=>item.category===category&&item.isDefault)??null;
