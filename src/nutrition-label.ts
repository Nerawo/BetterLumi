import { unknownNutrition, type Nutrition, type Nutrient } from "./domain";
export interface RecognizedLine {
  text: string;
  confidence: number;
}
export interface ParsedLabel {
  text: string;
  confidence: number;
  nutrition: Nutrition;
  basis: "100g" | "serving" | null;
  servingGrams: number | null;
  referenceAmount?: number;
  referenceUnit?: "g"|"mL";
  servingUnit?: "g"|"mL";
  warnings: string[];
}
export function ocrBasisConflicts(current:{basis:'100g'|'serving';servingGrams:number|null;nutrition:Nutrition;referenceAmount?:number;referenceUnit?:'g'|'mL';servingUnit?:'g'|'mL'},review:ParsedLabel){
 const changed=review.basis!==null&&(review.basis!==current.basis || (review.basis==='100g' && ((review.referenceAmount??100)!==(current.referenceAmount??100)||(review.referenceUnit??'g')!==(current.referenceUnit??'g'))) || review.basis==='serving'&&((current.servingGrams!==null&&review.servingGrams!==null&&current.servingGrams!==review.servingGrams)||(current.servingUnit??'g')!==(review.servingUnit??'g')));
 return changed?(Object.keys(current.nutrition) as Nutrient[]).filter(k=>current.nutrition[k]!==null&&review.nutrition[k]===null):[];
}
const normalize = (v: string) =>
  v
    .replace(/[０-９]/g, (c) => String(c.charCodeAt(0) - 0xff10))
    .replace(/％/g, "%")
    .replace(/[：]/g, ":")
    .replace(/[　\t]/g, " ")
    .replace(/([\u4e00-\u9fff]) +(?=[\u4e00-\u9fff])/g, "$1");
export function parseNutritionLabel(
  raw: string,
  confidence = 100,
  recognizedLines?: RecognizedLine[],
): ParsedLabel {
  const text = normalize(raw);
  const lines = recognizedLines?.length
    ? recognizedLines.map((l) => ({ ...l, text: normalize(l.text) }))
    : text.split(/\r?\n/).map((text) => ({ text, confidence }));
  const warnings: string[] = [];
  let basis: ParsedLabel["basis"] = null;
  let servingGrams: number | null = null;
  let referenceAmount: number|undefined, referenceUnit: 'g'|'mL'|undefined, servingUnit: 'g'|'mL'|undefined;
  const references=lines.filter(l=>l.confidence>=60).flatMap(l=>[...l.text.matchAll(/(?:per|每|\/)\s*(\d+(?:\.\d+)?)\s*(mL\b|毫升|g\b|克)/gi)]).filter(m=>Number(m[1])>0);
  const perServing=/(?:per\s+serving|每\s*(?:一\s*)?份)/i.test(text);
  if ((references.length && perServing) || new Set(references.map(m=>m[1]+m[2].toLowerCase())).size>1) warnings.push('ocrMultiColumns');
  else if(references.length){basis='100g';referenceAmount=Number(references[0][1]);referenceUnit=/ml|毫升/i.test(references[0][2])?'mL':'g';}
  else if(perServing || (/nutrition\s*facts/i.test(text)&&/serving\s*size/i.test(text))) basis='serving';
  else warnings.push('ocrBasisUnknown');
  const servingLine = lines.find((l) =>
    /serving\s*size|每份(?:重量|含量|大小)?|每一份|一份/i.test(l.text),
  );
  if (servingLine && servingLine.confidence >= 60) {
    const m = servingLine.text.match(
      /(?:serving\s*size|每(?:一)?份(?:重量|含量|大小)?)[^\n]*?([\d]+(?:\.\d+)?)\s*(mg|毫克|ml\b|毫升|g\b|克)/i,
    );
    if (m && Number(m[1]) > 0 && !/[<≤<>~～至\-–]/.test(m[0])) {
      servingGrams = Number(m[1]) * (/mg|毫克/i.test(m[2]) ? 0.001 : 1);
      servingUnit = /ml|毫升/i.test(m[2]) ? "mL" : "g";
    }
  }
  const nutrition = unknownNutrition();
  const candidates: Record<Nutrient, number[]> = {
    calories: [],
    protein: [],
    carbs: [],
    fat: [],
  };
  const uncertain = new Set<Nutrient>();
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    let key: Nutrient | null = null;
    let pattern: RegExp;
    if (/^\s*(?:total\s+fat\b|fat\b|脂肪)/i.test(line.text)) key = "fat";
    else if (
      /^\s*(?:total\s+carbohydrates?\b|carbohydrates?\b|carbs\b|碳水化合物)/i.test(
        line.text,
      )
    )
      key = "carbs";
    else if (/^\s*(?:protein\b|蛋白质)/i.test(line.text)) key = "protein";
    else if (
      /^\s*(?:calories\b(?!\s+from)|energy\b|热量|能量)/i.test(line.text)
    )
      key = "calories";
    if (!key) continue;
    if (line.confidence < 60) {
      uncertain.add(key);
      continue;
    }
    let valueText = line.text.replace(
      /^\s*(?:total\s+carbohydrates?|total\s+fat|carbohydrates?|protein|calories|energy|carbs|fat|碳水化合物|蛋白质|脂肪|热量|能量)\s*:?\s*/i,
      "",
    );
    if (
      !/\d/.test(valueText) &&
      lines[index + 1]?.confidence >= 60 &&
      /^\s*\d/.test(lines[index + 1].text)
    )
      valueText = lines[index + 1].text;
    valueText = valueText.replace(/\d+(?:\.\d+)?\s*%/g, "");
    if (/\d[ ,]+\d/.test(valueText)) {
      uncertain.add(key);
      continue;
    }
    if (/[<≤>≥~～]|\d\s*[-–至]\s*\d/.test(valueText)) {
      uncertain.add(key);
      continue;
    }
    if (key === "calories") {
      const explicit = [
        ...valueText.matchAll(
          /(?:^|[^\p{L}\d.,])((?:\d+(?:\.\d+)?|\.\d+))\s*(kcal|千卡|大卡|千焦(?:耳)?|kJ)/giu,
        ),
      ];
      // Calories on a US Nutrition Facts row are kcal; %DV is never accepted.
      if (explicit.length) {
        for (const m of explicit)
          candidates.calories.push(
            Number(m[1]) * (/kj|千焦/i.test(m[2]) ? 1 / 4.184 : 1),
          );
      } else if (
        /^\s*calories\b/i.test(line.text) &&
        /^\d+(?:\.\d+)?\s*$/.test(valueText.trim())
      )
        candidates.calories.push(Number(valueText));
    } else {
      pattern =
        /(?:^|[^\p{L}\d.,])((?:\d+(?:\.\d+)?|\.\d+))\s*(mg|毫克|g\b|克)(?!\s*%)/giu;
      for (const m of valueText.matchAll(pattern))
        candidates[key].push(
          Number(m[1]) * (/mg|毫克/i.test(m[2]) ? 0.001 : 1),
        );
    }
  }
  for (const key of Object.keys(candidates) as Nutrient[]) {
    const values = candidates[key];
    if (
      values.length &&
      !uncertain.has(key) &&
      values.every((v) => Math.abs(v - values[0]) < 0.05)
    )
      nutrition[key] = Number(values[0].toFixed(4));
  }
  if (warnings.includes("ocrMultiColumns"))
    for (const key of Object.keys(nutrition) as Nutrient[])
      nutrition[key] = null;
  if (confidence < 60) {
    warnings.push("ocrLowConfidence");
    basis = null;
    referenceAmount = undefined; referenceUnit = undefined; servingUnit = undefined;
    servingGrams = null;
    for (const key of Object.keys(nutrition) as Nutrient[])
      nutrition[key] = null;
  }
  return {
    text: raw,
    confidence: Math.max(
      0,
      Math.min(100, Number.isFinite(confidence) ? confidence : 0),
    ),
    nutrition,
    basis,
    servingGrams,
    referenceAmount, referenceUnit, servingUnit,
    warnings,
  };
}
export function linesFromTsv(tsv: string): RecognizedLine[] {
  const groups = new Map<string, { words: string[]; confidence: number }>();
  for (const row of tsv.split("\n").slice(1)) {
    const c = row.split("\t");
    if (c.length < 12 || c[0] !== "5" || !c[11]?.trim()) continue;
    const key = c.slice(1, 5).join(":");
    const old = groups.get(key) ?? { words: [], confidence: 100 };
    const word = c.slice(11).join("\t");
    old.words.push(word);
    if (
      !/%/.test(word) &&
      (/\d/.test(word) || /^(?:g|mg|kcal|kj|克|毫克|千焦|千卡)$/i.test(word))
    )
      old.confidence = Math.min(old.confidence, Number(c[10]));
    groups.set(key, old);
  }
  return [...groups.values()].map((g) => ({
    text: g.words.join(" "),
    confidence: g.confidence,
  }));
}
