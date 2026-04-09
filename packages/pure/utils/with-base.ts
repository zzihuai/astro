import isAbsoluteUrl from './is-absolute-url'

export function withBase(path: string): string
export function withBase(path?: string) {
  if (!path || isAbsoluteUrl(path) || path.startsWith('//') || path.startsWith('#')) {
    return path
  }

  const base = import.meta.env.BASE_URL || '/'
  if (path === '/') {
    return base
  }

  if (path.startsWith('/')) {
    return `${base.replace(/\/$/, '')}${path}`
  }

  return path
}

export function withSite(path: string, site: string | URL): string
export function withSite(path: string | undefined, site: string | URL) {
  if (!path) {
    return path
  }

  if (isAbsoluteUrl(path) || path.startsWith('//')) {
    return path
  }

  const basePath = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`
  const siteRoot = new URL(basePath, site)
  return new URL(path.replace(/^\//, ''), siteRoot).href
}
