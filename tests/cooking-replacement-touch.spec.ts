import {expect,test} from '@playwright/test';
 test.use({browserName:'chromium',channel:'chrome',isMobile:true,hasTouch:true});
 test('held touch opens one confirmation; upward movement cancels the hold',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/recipes/builtin-recipe-tagliatelle-ragu-bolognese');await page.locator('.start-cooking').tap();
  const row=page.locator('.cooking-mode .journal-check-row').first(),name=row.locator('.journal-line-name');
  await name.scrollIntoViewIfNeeded();const box=(await name.boundingBox())!;
  const x=box.x+box.width/2,y=box.y+box.height/2;
  const touch=await page.context().newCDPSession(page);
  const start=()=>touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  const end=()=>touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const dialog=page.locator('.draft-confirmation');
  await start();await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-35}]});
  await page.waitForTimeout(620);await end();await expect(dialog).toHaveCount(0);
  await start();await expect(dialog).toBeVisible();await end();
  await expect(page.locator('.ingredient-picker-modal')).toHaveCount(0);await dialog.locator('.secondary').tap();
  await expect(row.locator('input[type=checkbox]')).not.toBeChecked();
  await name.focus();await name.press('Enter');await expect(dialog).toBeVisible();
 });
