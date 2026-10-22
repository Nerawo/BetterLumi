import {test,expect,type Locator} from '@playwright/test';
for(const width of [390,430])for(const language of ['en','zh'])test(`all-page theme accents ${width} ${language}`,async({page})=>{
 await page.setViewportSize({width,height:844});await page.goto('/today');await page.evaluate(async language=>{const {db}=await import('/src/domain.ts');await db.settings.put({key:'language',value:language});},language);await page.reload();
 const check=async(locator:Locator,property:string,token:string)=>{await expect(locator).toBeVisible();await page.mouse.move(0,0);const colors=await locator.evaluate((e,{property,token})=>{const probe=document.createElement('i');probe.style.color=token;e.append(probe);const expected=getComputedStyle(probe).color;probe.remove();return [getComputedStyle(e).getPropertyValue(property),expected];},{property,token});expect(colors[0]).toBe(colors[1]);};
 for(const theme of ['misty','apricot','lavender','olive']){
  await page.locator('.mobile-nav button').nth(3).click();await page.locator('[data-setting=appearance]').click();await page.locator('.theme-choices button').nth(['misty','apricot','lavender','olive'].indexOf(theme)).click();await expect(page.locator('html')).toHaveAttribute('data-theme',theme);await page.keyboard.press('Escape');
  const action=theme==='olive'?'color-mix(in srgb,#183d30 82%,var(--action))':'var(--action)';const heading=theme==='olive'?action:'var(--ink)';
  for(const [index,name]of ['today','recipes','pantry','more'].entries()){
   await page.locator('.mobile-nav button').nth(index).click();const root=page.locator('.page-'+name);await expect(root).toBeVisible();if(index>0)await check(root.locator('.page-title h1'),'color',heading);
   if(index<3){await check(root.locator(index===0?'.today-tab-bar button[aria-selected=true]':index===1?'.category-tabs button[aria-selected=true]':'.directory-fab'),'background-color',action);const trigger=root.locator(index===0?'.meal-card .section-heading .primary':'.directory-fab');await trigger.click();const dialog=page.locator('dialog[open]');await expect(dialog).toBeVisible();await check(dialog,'background-color','var(--surface)');const save=dialog.locator('.primary').last();await check(save,'background-color',index===0?'var(--action)':action);await page.keyboard.press('Escape');}
   else{await check(root.locator('.settings-row').first(),'color','var(--ink)');await root.locator('[data-setting=data]').click();await check(page.locator('.backup-buttons .primary'),'background-color','var(--action)');await page.keyboard.press('Escape');}
   if(index===1){await root.locator('.category-bar > button').click();await check(page.locator('.category-manager-modal .primary').first(),'background-color','var(--action)');await page.keyboard.press('Escape');}
   if(theme==='lavender'&&width===390)await page.screenshot({path:`./work/screenshots/theme-audit-${name}-${language}.png`});
   expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  }
 }
});
