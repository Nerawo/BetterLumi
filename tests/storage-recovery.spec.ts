import {expect,test} from '@playwright/test';

test.use({browserName:'webkit',channel:'',isMobile:true,viewport:{width:390,height:844}});
for(const failure of ['denied','rejected','blocked','initialization'] as const){
 test('storage recovery on '+failure+' preserves the database and permits retry',async({page})=>{
  await page.goto('/today');
  await expect(page.locator('#today-tab-food')).toBeVisible();
  await page.evaluate(async()=>{
   const {db}=await import('/src/domain.ts');
   await db.settings.put({key:'recoverySentinel',value:'retained'});
  });
  await page.addInitScript(mode=>{
   if(sessionStorage.getItem('retried'))return;
   sessionStorage.setItem('retried','1');
   if(mode==='denied')Object.defineProperty(window,'indexedDB',{get:()=>undefined});
   else if(mode==='rejected'){
    const open=IDBFactory.prototype.open;
    IDBFactory.prototype.open=function(name){return open.call(this,name,1)};
   }else if(mode==='initialization')IDBFactory.prototype.open=()=>{throw new Error('Initialization failed')};
   else {
    IDBFactory.prototype.open=function(){
     const request=new EventTarget() as IDBOpenDBRequest;
     setTimeout(()=>request.onblocked?.call(request,new IDBVersionChangeEvent('blocked',{oldVersion:70,newVersion:80})),0);
     return request;
    };
   }
  },failure);
  await page.reload();
  await expect(page.getByText(/Unable to open local data/)).toBeVisible();
  await expect(page.getByText(/未备份的记录/)).toBeVisible();
  await page.getByRole('button',{name:/Reload/}).click();
  await expect(page.locator('#today-tab-food')).toBeVisible();
  expect(await page.evaluate(async()=>(await (await import('/src/domain.ts')).db.settings.get('recoverySentinel'))?.value)).toBe('retained');
 });
}
