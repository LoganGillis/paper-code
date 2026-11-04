import { describe, expect, it, vi } from 'vitest'
import {
  assertEditable,
  assertTypeChange,
  folderSubtree,
  trashFolderTree,
  uniqueTitle
} from './page-rules'

const locked = { title: 'T', content: 'c', description: 'd', type: 'json', locked: true }

describe('assertEditable', () => {
  it('blocks content, title, description, and type changes on a locked page', () => {
    expect(() => assertEditable(locked, { content: 'x' })).toThrow(/locked/)
    expect(() => assertEditable(locked, { title: 'x' })).toThrow(/locked/)
    expect(() => assertEditable(locked, { description: 'x' })).toThrow(/locked/)
    expect(() => assertEditable(locked, { type: 'csv' })).toThrow(/locked/)
  })

  it('allows unlocking, unchanged saves, and unlocked pages', () => {
    expect(() => assertEditable(locked, { locked: false, content: 'x' })).not.toThrow()
    expect(() => assertEditable(locked, { content: 'c' })).not.toThrow()
    expect(() => assertEditable({ ...locked, locked: false }, { content: 'x' })).not.toThrow()
  })
})

describe('assertTypeChange', () => {
  it('allows JS ↔ TS only', () => {
    expect(() => assertTypeChange('javascript', 'typescript')).not.toThrow()
    expect(() => assertTypeChange('markdown', 'csv')).toThrow()
    expect(() => assertTypeChange('json', 'javascript')).toThrow()
    expect(() => assertTypeChange('__proto__', 'json')).toThrow()
  })
})

describe('uniqueTitle', () => {
  it('numbers default titles that are taken', () => {
    expect(uniqueTitle('Data', [])).toBe('Data')
    expect(uniqueTitle('Data', ['data'])).toBe('Data 2')
    expect(uniqueTitle('Data', ['Data', 'Data 2', 'Data 4'])).toBe('Data 3')
  })
})

describe('folder delete', () => {
  const folders = [
    { id: 'a', parentId: null },
    { id: 'b', parentId: 'a' },
    { id: 'c', parentId: 'b' },
    { id: 'z', parentId: null }
  ]

  it('collects nested subfolders', () => {
    expect(folderSubtree(folders, 'a')).toEqual(['a', 'b', 'c'])
  })

  it('trashes pages before removing folders', async () => {
    const calls: string[] = []
    const tx = {
      folder: {
        findUniqueOrThrow: vi.fn(async () => ({ id: 'a', spaceId: 's' })),
        findMany: vi.fn(async () => folders),
        deleteMany: vi.fn(async () => calls.push('folders'))
      },
      page: {
        updateMany: vi.fn(async () => calls.push('pages'))
      }
    }
    const now = new Date(0)
    await trashFolderTree(tx, 'a', now)
    expect(tx.page.updateMany).toHaveBeenNthCalledWith(1, {
      where: { folderId: { in: ['a', 'b', 'c'] }, deletedAt: null },
      data: { deletedAt: now, archived: false, folderId: null }
    })
    expect(tx.folder.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['a', 'b', 'c'] } } })
    expect(calls).toEqual(['pages', 'pages', 'folders'])
  })
})
