import { describe, expect, it } from 'vitest'
import type { FolderNode, PageSummary, SpaceTree } from '@shared/api'
import { deleteSpaceConfirm, spacePageCount } from './space-delete'

const page = (id: string): PageSummary => ({ id }) as PageSummary
const folder = (pages: PageSummary[], folders: FolderNode[] = []): FolderNode =>
  ({ pages, folders }) as unknown as FolderNode
const tree = (parts: Partial<SpaceTree>): SpaceTree =>
  ({
    space: { name: 'Work' },
    folders: [],
    pages: [],
    archivedPages: [],
    trashedPages: [],
    ...parts
  }) as unknown as SpaceTree

describe('deleteSpaceConfirm', () => {
  it('counts root, nested folder, archived and trashed pages', () => {
    const full = tree({
      pages: [page('a')],
      folders: [folder([page('b')], [folder([page('c'), page('d')])])],
      archivedPages: [page('e')],
      trashedPages: [page('f'), page('g')]
    })
    expect(spacePageCount(full)).toBe(7)
    expect(deleteSpaceConfirm(full)).toEqual({
      title: 'Delete Work and its 7 pages forever?',
      description: "This can't be undone.",
      confirmLabel: 'Delete forever'
    })
  })

  it('says "1 page" for one, and leaves the count out for none', () => {
    expect(deleteSpaceConfirm(tree({ trashedPages: [page('a')] })).title).toBe(
      'Delete Work and its 1 page forever?'
    )
    expect(deleteSpaceConfirm(tree({})).title).toBe('Delete Work forever?')
  })
})
