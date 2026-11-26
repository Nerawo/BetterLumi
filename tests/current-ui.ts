import {expect,type Page,type Locator} from '@playwright/test';
import {createRequire} from 'node:module';

// This helper runs in Playwright's Node worker, outside Vite. Use its CommonJS
// transform path so the catalog's JSON dependency is loaded as JSON by require,
// rather than as an unannotated Node ESM import. The production catalog is shared.
const {builtInFoods}=createRequire(import.meta.url)('../src/data/builtInFoods.ts') as typeof import('../src/data/builtInFoods');

// Reference catalogs may grow; the UI must show every reference plus every
// matching user record, without copying either source into the other.
export const referenceFoodCount=builtInFoods.length;
const {everydayFoodGroups}=createRequire(import.meta.url)('../src/everyday-foods.ts') as typeof import('../src/everyday-foods');
export const browsableReferenceCount=referenceFoodCount-everydayFoodGroups.reduce((sum,group)=>sum+group.variants.length,0);
export const referenceCategoryCount=(category:string)=>builtInFoods.filter(food=>food.category===category).length;

export async function openPersonalGoalEditor(page:Page){
 await page.locator('#today-tab-more').click();
 const editor=page.locator('.goal-editor-inline'),view=page.getByTestId('current-goals');
 await expect(editor.or(view)).toBeVisible();
 if(!await editor.count())await view.getByRole('button').click();
 await expect(editor).toBeVisible();
 return editor;
}

export async function chooseJournalOption(trigger:Locator,value:string){
 await trigger.click();
 const menu=trigger.page().getByRole('menu');
 await menu.locator('[role=menuitemradio][data-unit="'+value+'"]').click();
}
export async function pickIngredient(page:Page,id:string){
 await page.locator('.ingredient-pick-trigger').click();
 const picker=page.locator('.ingredient-picker-modal');
 await expect(picker).toBeVisible();
 await picker.locator(`[data-ingredient-id="${id}"]`).click();
 await expect(picker).toHaveCount(0);
}

export async function selectIngredientDefinition(editor:Locator,field:'basis'|'referenceUnit',value:string){
 const trigger=field==='basis'?editor.locator('.ingredient-basis-choice button'):
   editor.locator('.ingredient-amount').filter({has:editor.page().locator('[name=referenceAmount]')}).getByRole('button');
 await trigger.click();
 await editor.getByRole('menu').locator('[data-unit="'+value+'"]').click();
}

export async function setDirectorySort(page:Page,order:string){
 const [field,direction]=order.split('-'),trigger=page.locator('.pantry-sort-trigger'),menu=page.locator('.pantry-sort-menu');
 const desired=direction==='asc'?'up':'down';
 if(await trigger.getAttribute('aria-expanded')!=='true')await trigger.click();
 await expect(menu.getByRole('menuitemradio')).toHaveCount(2);
 const option=menu.locator('[data-sort="'+field+'"]');
 if(await option.getAttribute('aria-checked')==='true'&&await option.locator('.lucide-arrow-'+desired).count()){await trigger.press('Escape');return}
 await option.click();
 if(!await trigger.locator('.lucide-arrow-'+desired).count()){await trigger.click();await option.click()}
 await expect(trigger.locator('.lucide-arrow-'+desired)).toHaveCount(1);
}
