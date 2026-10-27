import {test,expect,type Page} from '@playwright/test';
test.use({isMobile:true,hasTouch:true,viewport:{width:390,height:844}});
async function open(page:Page){await page.goto('/pantry');await page.evaluate(()=>{const v=new EventTarget();Object.assign(v,{height:innerHeight,width:innerWidth,offsetTop:0,offsetLeft:0,scale:1});Object.defineProperty(window,'visualViewport',{value:v,configurable:true})});await page.locator('.pantry-fab').click();await page.locator('.consumption-unit-editor summary').click()}
async function inside(page:Page){await expect.poll(()=>page.evaluate(()=>{const field=document.activeElement!,body=document.querySelector('.pantry-editor-body')!,a=field.getBoundingClientRect(),b=body.getBoundingClientRect();return a.top>=b.top+10&&a.bottom<=b.bottom-10})).toBe(true)}
test('focus is rechecked after delayed viewport and later footer layout settling',async({page})=>{
 await open(page);const originalY=await page.evaluate(()=>scrollY);await page.locator('[name=conversionAmount]').focus();
 await page.evaluate(async()=>{await new Promise(r=>setTimeout(r,150));Object.assign(window.visualViewport!,{height:350,offsetTop:70});window.visualViewport!.dispatchEvent(new Event('resize'));await new Promise(r=>setTimeout(r,250));(document.querySelector('.pantry-editor-modal .form-actions') as HTMLElement).style.minHeight='140px';await new Promise(r=>setTimeout(r,180))});
 await inside(page);expect(await page.evaluate(()=>scrollY)).toBe(originalY);
});
test('deliberate modal scrolling cancels settling until another input receives focus',async({page})=>{
 await open(page);await page.locator('[name=conversionAmount]').focus();await page.evaluate(()=>{Object.assign(window.visualViewport!,{height:350,offsetTop:70});window.visualViewport!.dispatchEvent(new Event('resize'))});await inside(page);
 await page.evaluate(()=>{const body=document.querySelector('.pantry-editor-body')!;body.dispatchEvent(new Event('touchmove',{bubbles:true}));body.scrollTop=0;Object.assign(window.visualViewport!,{height:340,offsetTop:75});window.visualViewport!.dispatchEvent(new Event('resize'))});
 await page.waitForTimeout(1000);expect(await page.locator('.pantry-editor-body').evaluate(el=>el.scrollTop)).toBe(0);
 await page.locator('[name=brand]').focus();await inside(page);await page.locator('[name=conversionAmount]').focus();await inside(page);
});
test('visible inputs do not trigger scrolling and unmount clears pending work/listeners',async({page})=>{
 await open(page);await page.evaluate(()=>{const body=document.querySelector('.pantry-editor-body') as HTMLElement,original=body.scrollTo.bind(body);(window as any).__scrollCalls=0;body.scrollTop=0;body.scrollTo=((options:ScrollToOptions)=>{(window as any).__scrollCalls++;original(options)}) as typeof body.scrollTo});await page.locator('[name=name]').focus();
 await page.evaluate(()=>{Object.assign(window.visualViewport!,{height:350,offsetTop:60});window.visualViewport!.dispatchEvent(new Event('resize'))});await inside(page);await page.waitForTimeout(1000);expect(await page.evaluate(()=>(window as any).__scrollCalls)).toBe(0);
 await page.locator('[name=conversionAmount]').focus();await inside(page);
 await page.evaluate(()=>{(window as any).__detachedModal=document.querySelector('.pantry-editor-modal');const original=requestAnimationFrame;(window as any).__settleCalls=0;window.requestAnimationFrame=callback=>original(time=>{if(callback.name==='settle')(window as any).__settleCalls++;callback(time)})});
 await page.locator('.pantry-editor-modal .modal-head button').click();await expect(page.locator('.pantry-editor-modal')).toHaveCount(0);const before=await page.evaluate(()=>({calls:(window as any).__settleCalls,height:(window as any).__detachedModal.style.getPropertyValue('--food-viewport-height')}));
 await page.evaluate(()=>{Object.assign(window.visualViewport!,{height:844,offsetTop:0});window.visualViewport!.dispatchEvent(new Event('resize'));window.dispatchEvent(new Event('resize'))});await page.waitForTimeout(1000);expect(await page.evaluate(()=>({calls:(window as any).__settleCalls,height:(window as any).__detachedModal.style.getPropertyValue('--food-viewport-height')}))).toEqual(before);
});
test('switching fields during keyboard animation and closing keyboard rechecks the current field',async({page})=>{
 await open(page);await page.locator('[name=name]').focus();await page.evaluate(()=>{Object.assign(window.visualViewport!,{height:460,offsetTop:30});window.visualViewport!.dispatchEvent(new Event('resize'))});await page.locator('[name=conversionName]').focus();await page.evaluate(()=>{Object.assign(window.visualViewport!,{height:350,offsetTop:70});window.visualViewport!.dispatchEvent(new Event('resize'))});await inside(page);await expect(page.locator('[name=conversionName]')).toBeFocused();
 await page.evaluate(()=>{Object.assign(window.visualViewport!,{height:844,offsetTop:0});window.visualViewport!.dispatchEvent(new Event('resize'))});await inside(page);await expect.poll(()=>page.locator('.pantry-editor-modal').evaluate(el=>el.style.getPropertyValue('--food-viewport-height'))).toBe('844px');
});
