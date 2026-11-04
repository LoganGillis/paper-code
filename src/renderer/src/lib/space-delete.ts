import type { FolderNode, SpaceTree } from '@shared/api'
import type { ConfirmRequest } from '@/lib/confirm'

/** The label of every menu item that deletes a space. */
export const DELETE_SPACE_LABEL = 'Delete space…'

function folderPageCount(folders: FolderNode[]): number {
  return folders.reduce(
    (total, folder) => total + folder.pages.length + folderPageCount(folder.folders),
    0
  )
}

/** Every page in the space from the loaded tree: live, in folders, archived, and in the trash. */
export function spacePageCount(tree: SpaceTree): number {
  return (
    tree.pages.length +
    folderPageCount(tree.folders) +
    (tree.archivedPages?.length ?? 0) +
    (tree.trashedPages?.length ?? 0)
  )
}

/** The confirm dialog for deleting a space for good, naming how many pages go with it. */
export function deleteSpaceConfirm(tree: SpaceTree): ConfirmRequest {
  const count = spacePageCount(tree)
  const name = tree.space.name
  const pages = count === 1 ? '1 page' : `${count} pages`
  return {
    title: count === 0 ? `Delete ${name} forever?` : `Delete ${name} and its ${pages} forever?`,
    description: "This can't be undone.",
    confirmLabel: 'Delete forever'
  }
}
