import { describe, expect, it, vi } from 'vitest'
import {
  assertEditable,
  assertNotLocked,
  assertTypeChange,
  folderSubtree,
  trashFolderTree,
  uniqueTitle
} from './page-rules'

const locked = {
  title: 'T',
  content: 'c',
  description: 'd',
  type: 'json',
  locked: true,
  icon: 'FileText',
  iconColor: 'slate',
  archived: false,
  spellcheck: true
}

describe('assertEditable', () => {
  it('blocks content, title, description, and type changes on a locked page', () => {
    expect(() => assertEditable(locked, { content: 'x' })).toThrow(/locked/)
    expect(() => assertEditable(locked, { title: 'x' })).toThrow(/locked/)
    expect(() => assertEditable(locked, { description: 'x' })).toThrow(/locked/)
    expect(() => assertEditable(locked, { type: 'csv' })).toThrow(/locked/)
  })

  it('refuses to unlock and edit in one call', () => {
    expect(() => assertEditable(locked, { locked: false, content: 'x' })).toThrow(/on its own/)
    expect(() => assertEditable(locked, { locked: false, title: 'x' })).toThrow(/on its own/)
    expect(() => assertEditable(locked, { locked: false, icon: 'Star' })).toThrow(/on its own/)
    expect(() => assertEditable(locked, { locked: false, archived: true })).toThrow(/on its own/)
  })

  it('blocks icon, colour, archive, and spellcheck changes on a locked page', () => {
    expect(() => assertEditable(locked, { archived: true })).toThrow(/locked/)
    expect(() => assertEditable(locked, { icon: 'Star' })).toThrow(/locked/)
    expect(() => assertEditable(locked, { iconColor: 'red' })).toThrow(/locked/)
    expect(() => assertEditable(locked, { spellcheck: false })).toThrow(/locked/)
    expect(() => assertEditable(locked, { icon: 'FileText', archived: false })).not.toThrow()
  })

  it('allows unlocking, unchanged saves, and unlocked pages', () => {
    expect(() => assertEditable(locked, { locked: false })).not.toThrow()
    expect(() => assertEditable(locked, { locked: false, content: 'c' })).not.toThrow()
    expect(() => assertEditable(locked, { content: 'c' })).not.toThrow()
    expect(() => assertEditable({ ...locked, locked: false }, { content: 'x' })).not.toThrow()
  })

  it('refuses to lock a page in the trash', () => {
    const trashed = { ...locked, locked: false, deletedAt: new Date() }
    expect(() => assertEditable(trashed, { locked: true })).toThrow(
      'Restore this page from the trash before locking it.'
    )
    expect(() => assertEditable({ ...trashed, deletedAt: null }, { locked: true })).not.toThrow()
  })
})

describe('assertNotLocked', () => {
  it('names the page and the action', () => {
    expect(() => assertNotLocked({ title: 'Notes', locked: true }, 'delete')).toThrow(
      '"Notes" is locked. Unlock it to delete.'
    )
    expect(() => assertNotLocked({ title: 'Notes', locked: true }, 'move')).toThrow(
      /Unlock it to move/
    )
    expect(() => assertNotLocked({ title: 'Notes', locked: true }, 'purge')).toThrow(
      /Unlock it to delete forever/
    )
    expect(() => assertNotLocked({ title: 'Notes', locked: false }, 'delete')).not.toThrow()
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
        findUniqueOrThrow: vi.fn(async () => ({ id: 'a', spaceId: 's', name: 'Top' })),
        findMany: vi.fn(async () => folders),
        deleteMany: vi.fn(async () => calls.push('folders'))
      },
      page: {
        findFirst: vi.fn(async () => null),
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

  it('refuses before touching anything when a page inside is locked', async () => {
    const tx = {
      folder: {
        findUniqueOrThrow: vi.fn(async () => ({ id: 'a', spaceId: 's', name: 'Top' })),
        findMany: vi.fn(async () => folders),
        deleteMany: vi.fn(async () => undefined)
      },
      page: {
        findFirst: vi.fn(async () => ({ title: 'Plan' })),
        updateMany: vi.fn(async () => undefined)
      }
    }
    await expect(trashFolderTree(tx, 'a', new Date())).rejects.toThrow(
      '"Top" has a locked page, "Plan". Unlock it to delete the folder.'
    )
    expect(tx.page.findFirst).toHaveBeenCalledWith({
      where: { folderId: { in: ['a', 'b', 'c'] }, locked: true, deletedAt: null },
      select: { title: true }
    })
    expect(tx.page.updateMany).not.toHaveBeenCalled()
    expect(tx.folder.deleteMany).not.toHaveBeenCalled()
  })
})
