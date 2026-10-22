import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import { parseNutritionLabel,ocrBasisConflicts } from "./nutrition-label";
describe("conservative package-label parsing", () => {
  it('does not carry unmatched manual values across a changed nutrition basis',()=>{const current={basis:'100g' as const,servingGrams:null,nutrition:{calories:100,protein:20,carbs:null,fat:null}};const review=parseNutritionLabel('Nutrition Facts\nServing size 40g\nCalories 230');expect(ocrBasisConflicts(current,review)).toEqual(['protein']);expect(ocrBasisConflicts({...current,basis:'serving'},review)).toEqual([])});
  it("does not read partial OCR letters or decimal commas as a different number", () => {
    expect(
      parseNutritionLabel("每100克\nTotal Fat I0g").nutrition.fat,
    ).toBeNull();
    expect(
      parseNutritionLabel("每100克\nTotal Fat 1,5g").nutrition.fat,
    ).toBeNull();
    expect(parseNutritionLabel("每100克\nTotal Fat .5g").nutrition.fat).toBe(
      0.5,
    );
  });
  it("parses a US label without mistaking DV percentages or saturated fat for total fat", () => {
    const r = parseNutritionLabel(
      "Nutrition Facts\nServing size 2/3 cup (55g)\nAmount per serving\nCalories 230\nTotal Fat 8g 10%\nSaturated Fat 1g 5%\nTotal Carbohydrate 37g 13%\nDietary Fiber 4g 14%\nProtein 3g",
    );
    expect(r.basis).toBe("serving");
    expect(r.servingGrams).toBe(55);
    expect(r.nutrition).toEqual({
      calories: 230,
      fat: 8,
      carbs: 37,
      protein: 3,
    });
  });
  it("distinguishes serving size 100g from per-100g nutrition", () => {
    const r = parseNutritionLabel(
      "Nutrition Facts\nServing size 100g\nCalories 210\nTotal Fat 5g\nProtein 6g\nTotal Carbohydrate 35g",
    );
    expect(r.basis).toBe("serving");
    expect(r.servingGrams).toBe(100);
  });
  it("parses Chinese kJ, mg, grams and ignores NRV percent", () => {
    const r = parseNutritionLabel(
      "营养成分表\n项目 每100克 NRV%\n能量 840千焦 10%\n蛋白质 5000毫克 8%\n脂肪 3.0克 5%\n碳水化合物 20.0克 7%",
    );
    expect(r.basis).toBe("100g");
    expect(r.nutrition.calories).toBeCloseTo(840 / 4.184, 3);
    expect(r.nutrition.protein).toBe(5);
    expect(r.nutrition.fat).toBe(3);
    expect(r.nutrition.carbs).toBe(20);
  });
  it("leaves DV-only, ambiguous, less-than and low-confidence values unknown", () => {
    expect(
      parseNutritionLabel("每100克\n脂肪 10%\n蛋白质 <1克\n碳水化合物 10-15克")
        .nutrition,
    ).toEqual({ calories: null, fat: null, protein: null, carbs: null });
    expect(
      parseNutritionLabel("每100克\n脂肪 10克", 35).nutrition.fat,
    ).toBeNull();
    expect(
      parseNutritionLabel("每100克\n脂肪 10克", 90, [
        { text: "脂肪 10克", confidence: 40 },
      ]).nutrition.fat,
    ).toBeNull();
  });
  it("does not select a column or assume liquid density", () => {
    expect(
      parseNutritionLabel("每100克 每份\n脂肪 10克 5克").warnings,
    ).toContain("ocrMultiColumns");
    expect(parseNutritionLabel("每100毫升\n能量 200千卡").referenceUnit).toBe("mL");
    expect(parseNutritionLabel("每100毫升\n能量 200千卡").referenceAmount).toBe(100);
  });
  it("keeps explicit zero values and rejects conflicting nutrient rows", () => {
    expect(
      parseNutritionLabel("Amount per serving\nTotal Fat 0g 0%").nutrition.fat,
    ).toBe(0);
    expect(
      parseNutritionLabel("每100克\n脂肪 8克\n脂肪 12克").nutrition.fat,
    ).toBeNull();
  });
});
