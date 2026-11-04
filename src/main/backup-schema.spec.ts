import { describe, expect, it } from 'vitest'
import { parseBackup } from './backup-schema'

const page = {
  id: 'p1',
  folderId: null,
  title: 'Notes',
  type: 'markdown',
  content: '{}',
  sortOrder: 0
}

describe('parseBackup', () => {
  it('accepts a minimal backup and fills cosmetic defaults', () => {
    const out = parseBackup({ version: 1, spaces: [{ name: 'Home', pages: [page] }] })
    expect(out.spaces[0].pages[0]).toMatchObject({ icon: 'FileText', locked: false, runs: [] })
    expect(out.spaces[0].folders).toEqual([])
  })

  it('rejects a wrong version, unknown page type, or bad shape', () => {
    expect(() => parseBackup({ version: 2, spaces: [] })).toThrow(/damaged/)
    expect(() =>
      parseBackup({ version: 1, spaces: [{ name: 'Home', pages: [{ ...page, type: 'exe' }] }] })
    ).toThrow(/spaces\.0\.pages\.0\.type/)
    expect(() => parseBackup({ version: 1, spaces: [{ name: 'Home', pages: 'nope' }] })).toThrow()
    expect(() =>
      parseBackup({
        version: 1,
        spaces: [{ name: 'Home', pages: [{ ...page, content: 42 }] }]
      })
    ).toThrow(/content/)
  })
})
