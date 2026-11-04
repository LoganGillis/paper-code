import { realpath } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'

/** True when `target` is `root` itself or somewhere below it (both already absolute). */
export function isInside(root: string, target: string): boolean {
  const rel = relative(root, target)
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`))
}

/**
 * Resolves a manifest path against the chosen folder and rejects anything that lands outside
 * it, including through `..`, absolute paths, drive letters, or symlinks.
 */
export async function resolveInside(root: string, manifestPath: string): Promise<string> {
  const base = resolve(root)
  const target = resolve(base, manifestPath)
  if (!isInside(base, target)) {
    throw new Error(`"${manifestPath}" points outside the export folder.`)
  }
  const [realBase, realTarget] = await Promise.all([
    realpath(base),
    realpath(target).catch(() => null)
  ])
  if (realTarget && !isInside(realBase, realTarget)) {
    throw new Error(`"${manifestPath}" points outside the export folder.`)
  }
  return target
}
