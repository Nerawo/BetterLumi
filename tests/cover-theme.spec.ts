import {test,expect} from '@playwright/test';
for(const width of [390,430])for(const language of ['zh','en'])test(`cover theme tokens ${width} ${language}`,async({page})=>{
 await page.setViewportSize({width,height:844});await page.goto('/today');
 await page.evaluate(async language=>{const {db}=await import('/src/domain.ts');await db.settings.put({key:'language',value:language});},language);await page.reload();await page.evaluate(()=>document.fonts.ready);
 let geometry:string|undefined;const palettes:string[]=[];
 for(const theme of ['misty','apricot','lavender','olive']){
  await page.evaluate(async theme=>{const {applyTheme}=await import('/src/themes.ts');applyTheme(theme);},theme);
  const result=await page.locator('.graphic-cover-composition').evaluate((element,theme)=>{
   const color=(value:string)=>{const probe=document.createElement('span');probe.style.color=value;element.append(probe);const result=getComputedStyle(probe).color;probe.remove();return result;};
   const h=element.querySelector('h1')!,art=element.querySelector('svg')!;
   const expected=theme==='olive'?['var(--ink)','var(--graphic-orange)','var(--graphic-gold)','var(--graphic-forest)','var(--graphic-peach)']:['var(--ink)','color-mix(in srgb,var(--warm) 75%,var(--action))','color-mix(in srgb,var(--warm) 75%,var(--olive))','var(--action)','color-mix(in srgb,var(--warm) 45%,var(--soft))'];
   const actual=[getComputedStyle(h).color,getComputedStyle(h.querySelector('em')!).color,...['gold','forest','peach'].map(name=>getComputedStyle(art.querySelector('.graphic-art-'+name)!).fill)];
   return {actual,expected:expected.map(color),geometry:JSON.stringify([h,art,...h.children].map(node=>{const r=node.getBoundingClientRect(),s=getComputedStyle(node);return [r.x,r.y,r.width,r.height,s.font,s.letterSpacing];}))};
  },theme);
  expect(result.actual).toEqual(result.expected);if(geometry)expect(result.geometry).toBe(geometry);geometry=result.geometry;palettes.push(JSON.stringify(result.actual));
  await expect(page.locator('.graphic-headline > span,.graphic-headline > em')).toHaveText(['A','BRIGHTER','YOU','TODAY']);expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  if(width===390)await page.locator('.graphic-introduction').screenshot({path:`./work/screenshots/cover-${theme}-${language}.png`});
 }
 expect(new Set(palettes).size).toBe(4);
});
