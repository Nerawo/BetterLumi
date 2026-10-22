import {expect,type Page} from '@playwright/test';
/** Exercise the actual custom picker instead of a hidden native date input. */
export async function jumpToDate(page:Page,date:string){
 await page.locator('.date-jump-trigger').click();
 const panel=page.locator('.date-jump-panel');await expect(panel).toBeVisible();
 const current=await panel.getAttribute('data-month');
 const difference=(Number(date.slice(0,4))-Number(current!.slice(0,4)))*12+Number(date.slice(5,7))-Number(current!.slice(5,7));
 for(let n=0;n<Math.abs(difference);n++)await panel.locator('.date-jump-heading > button').nth(difference>0?1:0).click();
 await panel.locator(`[data-jump-date="${date}"]`).click();
 await expect(panel).toHaveCount(0);
}
