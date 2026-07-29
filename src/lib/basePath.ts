/**
 * Single source of truth for the GitHub Pages project-site base path.
 *
 * `vite.config.ts` reads `process.env.VITE_BASE_PATH` (Node context) to set
 * the build's `base`. This module reads the same variable via
 * `import.meta.env` (browser/app context) so the router's `basename` can
 * never drift from the asset base path — plan US-003 acceptance criterion.
 */
export const basePath: string = import.meta.env.VITE_BASE_PATH ?? '/'

/** react-router's `basename` prop does not accept a trailing slash. */
export const routerBasename: string =
  basePath === '/' ? '/' : basePath.replace(/\/$/, '')

export function withBasePath(relativePath: string): string {
  if (/^(?:https?:)?\/\//.test(relativePath)) return relativePath
  const normalizedBase = basePath.endsWith('/') ? basePath : `${basePath}/`
  return `${normalizedBase}${relativePath.replace(/^\/+/, '')}`
}
