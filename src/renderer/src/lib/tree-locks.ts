import type { FolderNode, PageSummary } from '@shared/api'

/** The first locked page in a folder or any of its subfolders, or null when none is locked. */
export function firstLockedPage(folder: FolderNode): PageSummary | null {
  const own = folder.pages.find((page) => page.locked)
  if (own) return own
  for (const child of folder.folders) {
    const nested = firstLockedPage(child)
    if (nested) return nested
  }
  return null
}
