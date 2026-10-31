import {expect,type Locator} from '@playwright/test';
/** Exercise the real shared picker; retain each caller's existing nutrition/inventory assertions. */
export async function chooseSavedRecipe(parent:Locator,id:string){
 await parent.locator('.recipe-selection-trigger').click();
 const picker=parent.page().locator('.recipe-picker-modal');
 await picker.locator('[data-recipe-id='+JSON.stringify(id)+']').click();
 await expect(picker).toHaveCount(0);
}
