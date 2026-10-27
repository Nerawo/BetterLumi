import {openPersonalGoalEditor} from './current-ui';
import {test,expect} from '@playwright/test';
const base='/BetterLumi/';
const app=(route:string)=>base+'#'+route;

test('entry, default, hash navigation, dates, back/forward and refresh work without server rewrites',async({page,request})=>{
  expect((await request.get(base+'recipes')).status()).toBe(404);
  await page.goto(base);
  await expect(page).toHaveURL(/\/BetterLumi\/#\/today(?:\?date=\d{4}-\d{2}-\d{2})?$/);
  for(const route of ['recipes','pantry','more']) {
    await page.locator('.mobile-nav button').nth({recipes:1,pantry:2,more:3}[route]!).click();
    await expect(page).toHaveURL(new RegExp('/BetterLumi/#/'+route+'$'));
  }
  await page.goBack();await expect(page).toHaveURL(app('/pantry'));
  await page.goForward();await expect(page).toHaveURL(app('/more'));
  await page.goto(app('/today?date=2037-10-20'));
  await expect(page.locator('[data-date="2037-10-20"]')).toHaveAttribute('aria-pressed','true');
  await page.reload();await expect(page.locator('[data-date="2037-10-20"]')).toHaveAttribute('aria-pressed','true');
  for(const route of ['recipes','pantry']) {
    await page.goto(app('/'+route));
    await expect(page.locator('.page-'+route)).toBeVisible();
    expect((await page.reload())?.status()).toBe(200);await expect(page.locator('.page-'+route)).toBeVisible();
  }
  await page.goto(app('/recipes'));
  const link=page.locator('.recipe-list-row a').first();const href=await link.getAttribute('href');
  expect(href).toMatch(/^\/BetterLumi\/#\/recipes\//);
  await link.click();await expect(page.locator('.recipe-detail-modal')).toBeVisible();
  await page.reload();await expect(page.locator('.recipe-detail-modal')).toBeVisible();
  await page.locator('.recipe-detail-modal > .modal-head button').click();await expect(page).toHaveURL(app('/recipes'));
  await page.goto(app('/recipes?date=2037-10-20'));
  await page.locator('.recipe-list-row a').first().click();
  await expect(page.locator('.recipe-detail-modal')).toBeVisible();
  await page.locator('.recipe-detail-modal > .modal-head button').click();
  await expect(page).toHaveURL(app('/recipes?date=2037-10-20'));

});

test('manifest, worker, assets, fonts, OCR and recipe images stay inside the project path',async({page,request})=>{
  const requested:string[]=[];const failures:string[]=[];
  page.on('request',r=>requested.push(r.url()));page.on('response',r=>{if(r.status()>=400)failures.push(r.url())});
  await page.goto(app('/recipes'));
  const manifest=await (await request.get(base+'manifest.webmanifest')).json();
  expect(manifest.start_url).toBe(base);expect(manifest.scope).toBe(base);
  for(const icon of manifest.icons){expect(icon.src).toMatch(/^\/BetterLumi\//);expect((await request.get(icon.src)).ok()).toBe(true);}
  const image=page.locator('.recipe-thumbnail').first();await expect(image).toHaveJSProperty('naturalWidth',800);
  expect(await image.getAttribute('src')).toMatch(/^\/BetterLumi\/images\/recipes\//);
  await page.evaluate(()=>document.fonts.ready);
  const html=await (await request.get(base)).text();
  expect(html).not.toMatch(/(?:src|href)="\/(?:assets|icon|manifest|registerSW)/);
  for(const url of [...html.matchAll(/(?:src|href)="(\/BetterLumi\/[^"#]+)"/g)].map(x=>x[1]))expect((await request.get(url)).ok()).toBe(true);
  expect((await request.get(base+'ocr/worker.min.js')).ok()).toBe(true);
  expect((await request.get(base+'ocr/lang/eng.traineddata.gz')).ok()).toBe(true);
  expect((await request.get(base+'ocr/core/tesseract-core-lstm.wasm')).ok()).toBe(true);
  const sw=await (await request.get(base+'sw.js')).text();
  expect(sw).toContain('/BetterLumi/index.html');
  const registration=await page.evaluate(async()=>{const r=await navigator.serviceWorker.ready;return {scope:r.scope,script:r.active?.scriptURL}});
  expect(registration.scope).toBe(new URL(base,page.url()).href);expect(registration.script).toBe(new URL(base+'sw.js',page.url()).href);
  expect(requested.filter(url=>url.startsWith(new URL(page.url()).origin)).every(url=>new URL(url).pathname.startsWith(base))).toBe(true);
  expect(failures).toEqual([]);
  await page.reload();await page.evaluate(()=>navigator.serviceWorker.ready);
  expect(await page.evaluate(async()=>{await fetch('/BetterLumi/ocr/worker.min.js');return !!await (await caches.open('betterlumi-ocr-v7')).match('/BetterLumi/ocr/worker.min.js')})).toBe(true);
  await page.context().setOffline(true);await page.reload();await expect(page.locator('.page-recipes')).toBeVisible();await expect(page.locator('.recipe-thumbnail').first()).toHaveJSProperty('naturalWidth',800);
  await page.context().setOffline(false);
});

test('a real worker update preserves edits in both tabs until each user chooses to reload',async({page,context,request},info)=>{
  test.setTimeout(60000);
  await page.goto(app('/today?date=2037-10-20'));await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();
  await openPersonalGoalEditor(page);
  const target=page.locator('[data-goal-metric=calories] input[type=number]');
  await page.locator('[data-goal-metric=calories] input[type=checkbox]').check();await target.fill('1475');
  await page.evaluate(()=>{(window as any).__updateDocument=performance.timeOrigin});
  // A fictional committed setting proves cache activation does not erase IndexedDB.
  await page.evaluate(()=>new Promise<void>((resolve,reject)=>{const open=indexedDB.open('BetterLumi');open.onsuccess=()=>{const db=open.result;const tx=db.transaction('settings','readwrite');tx.objectStore('settings').put({key:'pagesSyntheticSentinel',value:'retained'});tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error)}}));
  const other=await context.newPage();await other.goto(app('/pantry'));await other.evaluate(()=>navigator.serviceWorker.ready);
  await request.post('/__test__/revision');
  await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r?.update()});
  const prompt=page.locator('.pwa-update-prompt');await expect(prompt).toBeVisible();await expect(other.locator('.pwa-update-prompt')).toBeVisible();
  await expect(target).toHaveValue('1475');
  await expect(prompt.locator('strong')).toHaveText('有新版本可用');
  await prompt.screenshot({path:info.outputPath('update-zh-mobile.png')});
  await page.locator('.language-toggle').click();
  await expect(prompt.locator('strong')).toHaveText('A new version is available');
  await expect(target).toHaveValue('1475');
  await prompt.screenshot({path:info.outputPath('update-en-mobile.png')});
  await page.setViewportSize({width:1440,height:1000});
  expect(await prompt.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight})).toBe(true);
  await prompt.screenshot({path:info.outputPath('update-en-desktop.png')});
  await page.setViewportSize({width:390,height:844});
  const before=await page.evaluate(()=>performance.timeOrigin);
  await prompt.getByRole('button',{name:/稍后|Later/}).click();await expect(prompt).toHaveCount(0);
  expect(await page.evaluate(()=>performance.timeOrigin)).toBe(before);
  await Promise.all([other.waitForEvent('load'),other.locator('.pwa-update-prompt .primary').click()]);
  await expect(other.locator('.page-pantry')).toBeVisible();
  expect(await page.evaluate(()=>performance.timeOrigin)).toBe(before);await expect(target).toHaveValue('1475');
  await expect(page.locator('.pwa-update-prompt')).toBeVisible();
  await Promise.all([page.waitForEvent('load'),page.locator('.pwa-update-prompt .primary').click()]);
  expect(await page.evaluate(()=>performance.timeOrigin)).not.toBe(before);
  const retained=await page.evaluate(()=>new Promise<{value:string;goals:number}>((resolve,reject)=>{const open=indexedDB.open('BetterLumi');open.onsuccess=()=>{const db=open.result;const tx=db.transaction(['settings','goals']);const get=tx.objectStore('settings').get('pagesSyntheticSentinel');const count=tx.objectStore('goals').count();tx.oncomplete=()=>{resolve({value:get.result?.value,goals:count.result});db.close()};tx.onerror=()=>reject(tx.error)}}));
  expect(retained).toEqual({value:'retained',goals:0});
  await openPersonalGoalEditor(page);await expect(target).toHaveValue('1475');
  await other.close();
});
