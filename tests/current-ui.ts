import {expect,type Page} from '@playwright/test';
import {createRequire} from 'node:module';

// This helper runs in Playwright's Node worker, outside Vite. Use its CommonJS
// transform path so the catalog's JSON dependency is loaded as JSON by require,
// rather than as an unannotated Node ESM import. The production catalog is shared.
const {builtInFoods}=createRequire(import.meta.url)('../src/data/builtInFoods.ts') as typeof import('../src/data/builtInFoods');

// Reference catalogs may grow; the UI must show every reference plus every
// matching user record, without copying either source into the other.
export const referenceFoodCount=builtInFoods.length;
export const referenceCategoryCount=(category:string)=>builtInFoods.filter(food=>food.category===category).length;

export async function openPersonalGoalEditor(page:Page){
 await page.locator('#today-tab-more').click();
 const editor=page.locator('.goal-editor-inline'),view=page.getByTestId('current-goals');
 await expect(editor.or(view)).toBeVisible();
 if(!await editor.count())await view.getByRole('button').click();
 await expect(editor).toBeVisible();
 return editor;
}

export async function pickIngredient(page:Page,id:string){
 await page.locator('.ingredient-pick-trigger').click();
 const picker=page.locator('.ingredient-picker-modal');
 await expect(picker).toBeVisible();
 await picker.locator(`[data-ingredient-id="${id}"]`).click();
 await expect(picker).toHaveCount(0);
}
