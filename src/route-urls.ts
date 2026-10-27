/** Logical routes stay independent of the deployment directory and URL transport. */
export function logicalRoute(href: string, base = import.meta.env.BASE_URL): string {
  const url = new URL(href, 'http://local');
  if (url.hash.startsWith('#/')) {
    const route = url.hash.slice(1);
    if (route.startsWith('//')) return '/';
    const parsed = new URL(route, 'http://local');
    return parsed.pathname + parsed.search;
  }
  const prefix = base.replace(/\/$/, '');
  const path = prefix && (url.pathname === prefix || url.pathname.startsWith(prefix + '/'))
    ? url.pathname.slice(prefix.length) || '/'
    : url.pathname;
  // Accept old root-hosted links on development/SPA hosts without losing their query.
  return path + url.search;
}

export function routeHref(route: string, base = import.meta.env.BASE_URL): string {
  if (!route.startsWith('/') || route.startsWith('//')) throw Error('Invalid local route');
  const url = new URL(route, 'http://local');
  if (url.origin !== 'http://local') throw Error('Invalid local route');
  return base + '#' + url.pathname + url.search;
}

export function currentRoute(): string {
  return logicalRoute(location.href);
}
