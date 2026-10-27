import {afterEach,it,expect,vi} from 'vitest';
import {watchForAppUpdate} from './pwa-updates';

afterEach(()=>vi.useRealTimers());
function setup(waiting=true) {
  const worker=Object.assign(new EventTarget(),{postMessage:vi.fn()});
  const registration=Object.assign(new EventTarget(),{waiting:waiting?worker:null,installing:null});
  const serviceWorkers=Object.assign(new EventTarget(),{register:vi.fn().mockResolvedValue(registration)});
  const onAvailable=vi.fn(),onError=vi.fn(),reload=vi.fn();
  const controller=watchForAppUpdate({serviceWorkers:serviceWorkers as unknown as ServiceWorkerContainer,base:'/BetterLumi/',onAvailable,onError,reload});
  return {controller,serviceWorkers,registration,worker,onAvailable,onError,reload};
}
it('registers within the deployment scope and detects an existing waiting worker without applying it',async()=>{
  const x=setup();await Promise.resolve();expect(x.serviceWorkers.register).toHaveBeenCalledWith('/BetterLumi/sw.js',{scope:'/BetterLumi/',updateViaCache:'none'});expect(x.onAvailable).toHaveBeenCalledOnce();expect(x.worker.postMessage).not.toHaveBeenCalled();expect(x.reload).not.toHaveBeenCalled();x.controller.dispose();
});
it('reloads only after this client explicitly approves activation',async()=>{
  const x=setup();await x.controller.applyUpdate();expect(x.worker.postMessage).toHaveBeenCalledWith({type:'SKIP_WAITING'});expect(x.reload).not.toHaveBeenCalled();x.serviceWorkers.dispatchEvent(new Event('controllerchange'));expect(x.reload).toHaveBeenCalledOnce();x.controller.dispose();
});
it('never reloads an editing client when another tab activates an update',async()=>{
  const x=setup();await Promise.resolve();x.serviceWorkers.dispatchEvent(new Event('controllerchange'));expect(x.reload).not.toHaveBeenCalled();expect(x.onAvailable).toHaveBeenCalledTimes(2);x.controller.dispose();
});
it('detects a newly installed update and cleans up listeners without touching storage',async()=>{
  const x=setup(false);await Promise.resolve();const installing=new EventTarget();Object.assign(x.registration,{installing});x.registration.dispatchEvent(new Event('updatefound'));Object.assign(x.registration,{waiting:x.worker});installing.dispatchEvent(new Event('statechange'));expect(x.onAvailable).toHaveBeenCalledOnce();x.controller.dispose();installing.dispatchEvent(new Event('statechange'));x.serviceWorkers.dispatchEvent(new Event('controllerchange'));expect(x.onAvailable).toHaveBeenCalledOnce();expect(x.reload).not.toHaveBeenCalled();
});
it('reports activation timeout and preserves the no-forced-reload rule after failure',async()=>{
  vi.useFakeTimers();const x=setup();await x.controller.applyUpdate();vi.advanceTimersByTime(15000);expect(x.onError).toHaveBeenCalledOnce();x.serviceWorkers.dispatchEvent(new Event('controllerchange'));expect(x.reload).not.toHaveBeenCalled();x.controller.dispose();
});
it('ignores late registration resolution after the component unmounts',async()=>{
  const x=setup();x.controller.dispose();await Promise.resolve();expect(x.onAvailable).not.toHaveBeenCalled();
});
