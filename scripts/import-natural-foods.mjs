import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const selection=read('scripts/data/natural-food-selection.json'),baseline=read('docs/data/natural-food-baseline.json');
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const directory=path.join(root,'work/usda-import');
const output=(p,value)=>{const text=JSON.stringify(value,null,2)+'\n',file=path.join(root,p);if(process.argv.includes('--check')){if(fs.readFileSync(file,'utf8')!==text)throw Error('Outdated generated file: '+p)}else fs.writeFileSync(file,text)};
const selectNutrients=record=>{
 const nutrients=record.foodNutrients;
 for(const id of [1003,1004,1005,1008,2047,2048])if(nutrients.filter(n=>n.nutrient.id===id).length>1)throw Error("Ambiguous duplicate nutrient ID: "+record.fdcId+" / "+id);
 // Use published USDA energy, never compute it. Modern Foundation specific factors
 // take precedence, then legacy Energy, then official general-factor energy.
 const ids=[2048,1008,2047],energy=ids.map(id=>nutrients.find(n=>n.nutrient.id===id)).find(n=>n&&Number.isFinite(n.amount));
 const selected=[energy,...[1003,1005,1004].map(id=>nutrients.find(n=>n.nutrient.id===id))];
 if(selected.some(n=>!n||typeof n.amount!=='number'||!Number.isFinite(n.amount)||n.amount<0))throw Error('Missing/invalid core nutrient: '+record.fdcId);
 return selected.map(n=>({id:n.nutrient.id,name:n.nutrient.name,unit:n.nutrient.unitName,amount:n.amount}));
};
if(process.argv.includes('--download')){
 fs.mkdirSync(directory,{recursive:true});
 for(const source of selection.sources){const zip=path.join(directory,source.key+'.zip');const response=await fetch(source.url);if(!response.ok)throw Error('Official download unavailable: '+response.status);const bytes=Buffer.from(await response.arrayBuffer());if(digest(bytes)!==source.zipSha256)throw Error('Official archive changed; review before importing');fs.writeFileSync(zip,bytes);const destination=path.join(directory,source.key);if(process.platform==='win32')execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',`Expand-Archive -LiteralPath '${zip.replaceAll("'","''")}' -DestinationPath '${destination.replaceAll("'","''")}' -Force`]);else{fs.mkdirSync(destination,{recursive:true});execFileSync('unzip',['-o',zip,'-d',destination])}}
}
let provenance;
if(process.argv.includes('--download')||process.argv.includes('--from-archives')){
 const byId=new Map(),archiveRows=[];
 for(const source of selection.sources){const bytes=fs.readFileSync(path.join(directory,source.key,source.jsonFile));if(digest(bytes)!==source.jsonSha256)throw Error('Extracted official dataset changed');const obj=JSON.parse(bytes),rows=Object.values(obj)[0];archiveRows.push({source:source.key,rows:rows.length,nullRows:rows.filter(r=>!r).length});for(const row of rows.filter(Boolean))byId.set(row.fdcId,{row,source})}
 const foods=selection.selections.map(chosen=>{const {row,source}=byId.get(chosen.fdcId)??{};if(!row||row.description!==chosen.expectedDescription)throw Error('Description mismatch: '+chosen.fdcId);return{fdcId:row.fdcId,description:row.description,dataType:row.dataType,sourceKey:source.key,ndbNumber:String(row.ndbNumber),publicationDate:row.publicationDate,basis:'100 g edible portion',nutrients:selectNutrients(row)}});
 // Preserve only the four core nutrients; the full source archives stay ignored.
 const reviewedExclusions=[...selection.excluded,...selection.gaps.filter(r=>r.fdcId)].map(candidate=>{const found=byId.get(candidate.fdcId);return {...candidate,...(found?{description:found.row.description,sourceKey:found.source.key,availableCoreNutrients:found.row.foodNutrients.filter(n=>[1003,1004,1005,1008,2047,2048].includes(n.nutrient.id)).map(n=>({id:n.nutrient.id,name:n.nutrient.name,unit:n.nutrient.unitName,amount:n.amount}))}:{})}});provenance={retrievedAt:selection.retrievedAt,sources:selection.sources,archiveRows,foods,reviewedExclusions};output('docs/data/natural-food-provenance.json',provenance);
}else provenance=read('docs/data/natural-food-provenance.json');
const seen=new Set(baseline.map(r=>r.id)),fdcIds=new Set(baseline.map(r=>Number(r.fdcIdSnapshot))),descriptions=new Set(baseline.map(r=>r.usdaDescription));
const generated=selection.selections.map(chosen=>{
 const r=provenance.foods.find(r=>r.fdcId===chosen.fdcId),source=selection.sources.find(s=>s.key===r?.sourceKey);if(!r||!source||r.description!==chosen.expectedDescription)throw Error('Unverified candidate');
 if(fdcIds.has(r.fdcId)||descriptions.has(r.description))throw Error('Duplicate official record: '+r.fdcId);
 const id=`betterlumi:food:usda-fdc-${r.fdcId}`;if(seen.has(id))throw Error('ID collision');seen.add(id);fdcIds.add(r.fdcId);descriptions.add(r.description);
 const energy=r.nutrients.find(n=>[1008,2047,2048].includes(n.id)),nutrient=id=>{const n=r.nutrients.find(n=>n.id===id);if(!n||n.unit.toLowerCase()!=='g'||typeof n.amount!=='number'||!Number.isFinite(n.amount)||n.amount<0||n.amount>100)throw Error('Invalid macro: '+r.fdcId);return n.amount};
 if(!energy||energy.unit.toLowerCase()!=='kcal'||typeof energy.amount!=='number'||!Number.isFinite(energy.amount)||energy.amount<0||energy.amount>900||r.nutrients.length!==4)throw Error('Invalid energy/core fields');
 if(!['raw','dry','cooked'].includes(chosen.state)||!chosen.nameZh||!chosen.nameEn)throw Error('Missing classification/name');
 if(chosen.state==='cooked'&&!/\b(cooked|boiled|steamed|roasted|grilled|broiled|braised)\b/i.test(r.description))throw Error('Cooked label mismatch');
 if(chosen.state!=='cooked'&&/\b(cooked|boiled|steamed|grilled|broiled|braised)\b/i.test(r.description))throw Error('Raw/dry label mismatch');
 const protein=nutrient(1003),carbs=nutrient(1005),fat=nutrient(1004);if(protein+carbs+fat>101)throw Error('Implausible macro mass');
 const date=new Date(r.publicationDate);if(!Number.isFinite(date.valueOf()))throw Error('Invalid publication date');
 return{id,nameZh:chosen.nameZh,nameEn:chosen.nameEn,category:chosen.category,tagIds:[`betterlumi:ingredient-tag:${chosen.category}`],preparationState:chosen.preparationStateEn,preparationStateZh:chosen.preparationStateZh,preparationStateEn:chosen.preparationStateEn,aliases:chosen.aliases,usdaDescription:r.description,kcalPer100g:energy.amount,proteinPer100g:protein,carbsPer100g:carbs,fatPer100g:fat,sourceName:'USDA FoodData Central',sourceDataType:source.name,ndbNumber:r.ndbNumber,fdcIdSnapshot:String(r.fdcId),sourceRelease:source.release,sourceDescription:`USDA ${source.name}; per 100 g edible portion; carbohydrate by difference (1005); published energy nutrient ${energy.id}.`,sourceUrl:`https://fdc.nal.usda.gov/food-details/${r.fdcId}/nutrients`,sourceRetrievedAt:selection.retrievedAt,sourcePublishedAt:date.toISOString().slice(0,10)};
});
output('src/data/natural-foods.generated.json',generated);
const counts=key=>Object.fromEntries([...new Set(selection.selections.map(r=>r[key]))].map(v=>[v,selection.selections.filter(r=>r[key]===v).length]));
const audit={baselineCommit:selection.baselineCommit,existingCount:baseline.length,newCount:generated.length,totalCount:baseline.length+generated.length,byCategory:counts('category'),byPreparation:counts('state'),byDataset:Object.fromEntries(selection.sources.map(s=>[s.name,provenance.foods.filter(r=>r.sourceKey===s.key).length])),energyNutrientCounts:Object.fromEntries([1008,2048,2047].map(id=>[id,provenance.foods.filter(r=>r.nutrients.some(n=>n.id===id)).length])),existingRecordsRetained:baseline.map(r=>({id:r.id,fdcId:r.fdcIdSnapshot,description:r.usdaDescription})),excluded:selection.excluded,gaps:selection.gaps,archiveRows:provenance.archiveRows};
output('docs/data/natural-food-import-audit.json',audit);console.log(JSON.stringify({existing:audit.existingCount,added:audit.newCount,total:audit.totalCount,categories:audit.byCategory,preparation:audit.byPreparation,datasets:audit.byDataset,energy:audit.energyNutrientCounts},null,2));
