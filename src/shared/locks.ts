export type LockAction = 'delete' | 'move' | 'purge' | 'archive' | 'unarchive' | 'change'

const VERB: Record<LockAction, string> = {
  delete: 'delete',
  move: 'move',
  purge: 'delete forever',
  archive: 'archive',
  unarchive: 'unarchive',
  change: 'change'
}

/** The short hint shown on a disabled menu item, e.g. "Unlock to delete". */
export function lockHint(action: LockAction): string {
  return `Unlock to ${VERB[action]}`
}

/** The error a locked page gives for `action`, e.g. `"Notes" is locked. Unlock it to delete.` */
export function lockedMessage(title: string, action: LockAction): string {
  return `"${title || 'Untitled'}" is locked. Unlock it to ${VERB[action]}.`
}

/** The error a folder gives when a page inside it (or a subfolder) is locked. */
export function lockedInFolderMessage(
  folder: string,
  page: string,
  action: 'delete' | 'move' = 'delete'
): string {
  return `"${folder}" has a locked page, "${page || 'Untitled'}". Unlock it to ${action} the folder.`
}

/** Why a space with a locked page cannot be deleted. */
export function lockedInSpaceMessage(space: string, page: string): string {
  return `"${space}" has a locked page, "${page || 'Untitled'}". Unlock it to delete the space.`
}
