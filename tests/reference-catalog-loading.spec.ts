import {test,expect} from '@playwright/test';
import {referenceFoodCount,referenceCategoryCount} from './current-ui';

test('Node reference helper matches the Vite-served catalog without copying USDA fixtures',async({page})=>{
 await page.goto('/today');
 const catalog=await page.evaluate(async()=>{
  const {builtInFoods}=await import('/src/data/builtInFoods.ts');
  return {count:builtInFoods.length,categories:[...new Set(builtInFoods.map(food=>food.category))].map(category=>({category,count:builtInFoods.filter(food=>food.category===category).length}))};
 });
 expect(referenceFoodCount).toBeGreaterThan(0);
 expect(referenceFoodCount).toBe(catalog.count);
 for(const {category,count} of catalog.categories)expect(referenceCategoryCount(category)).toBe(count);
 expect(referenceCategoryCount('not-a-food-category')).toBe(0);
});
