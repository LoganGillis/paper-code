import type { FolderNode, PageSummary, PageType, SpaceTree } from '@shared/api'
import { displayTitle } from '@shared/titles'

export type PageHit = {
  page: PageSummary
  spaceId: string
  spaceName: string
}

export function collectPages(trees: Record<string, SpaceTree>): PageHit[] {
  const items: PageHit[] = []
  const walk = (tree: SpaceTree, folders: FolderNode[]): void => {
    for (const folder of folders) {
      for (const page of folder.pages) {
        items.push({ page, spaceId: tree.space.id, spaceName: tree.space.name })
      }
      walk(tree, folder.folders)
    }
  }
  for (const tree of Object.values(trees)) {
    for (const page of tree.pages) {
      items.push({ page, spaceId: tree.space.id, spaceName: tree.space.name })
    }
    walk(tree, tree.folders)
  }
  return items
}

export function findPageHit(trees: Record<string, SpaceTree>, pageId: string): PageHit | undefined {
  return collectPages(trees).find((item) => item.page.id === pageId)
}

export function filterPageHits(
  trees: Record<string, SpaceTree>,
  query: string,
  types?: PageType[]
): PageHit[] {
  const needle = query.trim().toLowerCase()
  return collectPages(trees).filter((item) => {
    if (types && !types.includes(item.page.type)) return false
    if (!needle) return true
    return (
      displayTitle(item.page.title).toLowerCase().includes(needle) ||
      item.spaceName.toLowerCase().includes(needle) ||
      item.page.type.includes(needle)
    )
  })
}
