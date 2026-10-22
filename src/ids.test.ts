import {it,expect,vi,afterEach} from 'vitest';
import {newId} from './ids';
afterEach(()=>vi.unstubAllGlobals());
it('keeps the native UUID API when available',()=>{const native=vi.fn(()=> '12345678-1234-4123-8123-123456789abc');vi.stubGlobal('crypto',{randomUUID:native});expect(newId()).toBe('12345678-1234-4123-8123-123456789abc');expect(native).toHaveBeenCalledOnce()});
it('LAN HTTP fallback produces secure-random UUID v4 values, including valid version and variant bits',()=>{const getRandomValues=globalThis.crypto.getRandomValues.bind(globalThis.crypto);vi.stubGlobal('crypto',{getRandomValues});const values=Array.from({length:100},()=>newId());for(const id of values)expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);expect(new Set(values).size).toBe(100)});
