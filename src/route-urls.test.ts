import {describe,it,expect} from 'vitest';
import {logicalRoute,routeHref} from './route-urls';

describe.each(['/', '/BetterLumi/'])('deployment routes at %s',base=>{
  it('keeps logical routes, dates and encoded recipe IDs independent of the base',()=>{
    for(const route of ['/today?date=2037-10-20','/recipes','/recipes/fictional%20recipe%2Fid','/pantry','/weight']) {
      expect(routeHref(route,base)).toBe(base+'#'+route);
      expect(logicalRoute('https://example.test'+routeHref(route,base),base)).toBe(route);
    }
  });
  it('reads the default entry and legacy links without losing query parameters',()=>{
    expect(logicalRoute('https://example.test'+base,base)).toBe('/');
    expect(logicalRoute('https://example.test'+base+'?date=2037-10-20',base)).toBe('/?date=2037-10-20');
    expect(logicalRoute('/today?date=2037-10-20',base)).toBe('/today?date=2037-10-20');
  });
  it('rejects external/protocol-relative route generation and malformed hash authority',()=>{
    for(const route of ['//example.test','https://example.test','recipes'])expect(()=>routeHref(route,base)).toThrow();
    expect(logicalRoute('https://example.test'+base+'#//untrusted.test',base)).toBe('/');
  });
});
