import type { PageType } from '../shared/api'
import { isPageType, PAGE_TYPES } from '../shared/page-types'
import { lockedInFolderMessage, lockedMessage, type LockAction } from '../shared/locks'

type PageEdit = {
  title?: string
  content?: string
  description?: string
  type?: PageType
  icon?: string
  iconColor?: string
  archived?: boolean
  spellcheck?: boolean
}

type StoredPage = {
  title: string
  content: string
  description: string
  type: string
  locked: boolean
  icon?: string
  iconColor?: string
  archived?: boolean
  spellcheck?: boolean
  deletedAt?: Date | null
}

const LOCKED_FIELDS = [
  'title',
  'content',
  'description',
  'type',
  'icon',
  'iconColor',
  'archived',
  'spellcheck'
] as const

/**
 * Throws when an update would change anything on a locked page: title, body, description, type,
 * icon, colour, archived, or spellcheck. Unlocking must be its own call: `locked: false` together
 * with any other change is rejected, so one call can never unlock and edit. A page in the trash
 * cannot be locked; restore it first.
 */
export function assertEditable(previous: StoredPage, edit: PageEdit & { locked?: boolean }): void {
  if (edit.locked === true && !previous.locked && previous.deletedAt) {
    throw new Error('Restore this page from the trash before locking it.')
  }
  if (!previous.locked) return
  const changes = LOCKED_FIELDS.some(
    (field) => edit[field] !== undefined && edit[field] !== previous[field]
  )
  if (!changes) return
  if (edit.locked === false) {
    throw new Error('Unlock the page on its own first, then make changes.')
  }
  throw new Error('This page is locked. Unlock it to make changes.')
}

/** Throws a friendly error naming the page when it is locked and `action` would change it. */
export function assertNotLocked(
  page: { title: string; locked: boolean },
  action: LockAction
): void {
  if (page.locked) throw new Error(lockedMessage(page.title, action))
}

/** Throws unless `next` is a known type of the same kind (JS ↔ TS); Markdown never becomes CSV. */
export function assertTypeChange(current: string, next: PageType): void {
  if (current === next) return
  if (!isPageType(current) || PAGE_TYPES[current].kind !== PAGE_TYPES[next].kind) {
    throw new Error(`A ${current} page cannot become ${next}.`)
  }
}

/** `base`, or `base 2`, `base 3`, … — the first one not already in `taken` (case-insensitive). */
export function uniqueTitle(base: string, taken: Iterable<string>): string {
  const used = new Set([...taken].map((title) => title.trim().toLowerCase()))
  if (!used.has(base.toLowerCase())) return base
  let n = 2
  while (used.has(`${base} ${n}`.toLowerCase())) n += 1
  return `${base} ${n}`
}

/** The folder and every folder nested below it, parents first. */
export function folderSubtree(
  folders: Array<{ id: string; parentId: string | null }>,
  rootId: string
): string[] {
  const ids = [rootId]
  for (let index = 0; index < ids.length; index += 1) {
    for (const folder of folders) {
      if (folder.parentId === ids[index] && !ids.includes(folder.id)) ids.push(folder.id)
    }
  }
  return ids
}

type FolderTx = {
  folder: {
    findUniqueOrThrow: (args: {
      where: { id: string }
    }) => Promise<{ id: string; spaceId: string; name: string }>
    findMany: (args: {
      where: { spaceId: string }
    }) => Promise<Array<{ id: string; parentId: string | null }>>
    deleteMany: (args: { where: { id: { in: string[] } } }) => Promise<unknown>
  }
  page: {
    findFirst: (args: {
      where: { folderId: { in: string[] }; locked: true; deletedAt: null }
      select: { title: true }
    }) => Promise<{ title: string } | null>
    updateMany: (args: {
      where: { folderId: { in: string[] }; deletedAt?: null }
      data: { deletedAt?: Date; archived?: boolean; folderId: null }
    }) => Promise<unknown>
  }
}

/**
 * Moves every page under a folder (and its subfolders) to the trash at the space root, then
 * removes the folders. Run it inside one transaction so a failure leaves nothing half-deleted.
 * Refuses, before changing anything, when any page in the tree is locked.
 */
export async function trashFolderTree(tx: FolderTx, folderId: string, now: Date): Promise<number> {
  const folder = await tx.folder.findUniqueOrThrow({ where: { id: folderId } })
  const all = await tx.folder.findMany({ where: { spaceId: folder.spaceId } })
  const ids = folderSubtree(all, folder.id)
  // Pages already in the trash don't block; they stay in the trash.
  const locked = await tx.page.findFirst({
    where: { folderId: { in: ids }, locked: true, deletedAt: null },
    select: { title: true }
  })
  if (locked) throw new Error(lockedInFolderMessage(folder.name, locked.title))
  await tx.page.updateMany({
    where: { folderId: { in: ids }, deletedAt: null },
    data: { deletedAt: now, archived: false, folderId: null }
  })
  await tx.page.updateMany({ where: { folderId: { in: ids } }, data: { folderId: null } })
  await tx.folder.deleteMany({ where: { id: { in: ids } } })
  return ids.length
}
