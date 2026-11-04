import { describe, expect, it } from 'vitest'
import { docToMarkdown, markdownToDoc } from '../shared/markdown-transfer'
import { exportedType, extensionForType } from '../shared/page-types'
import { parseBackup, parseManifest } from './backup-schema'

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

  it('imports an unknown page type as Markdown with a warning', () => {
    const warnings: string[] = []
    const out = parseBackup(
      {
        version: 1,
        spaces: [{ name: 'Home', pages: [{ ...page, type: 'sheet', content: 'a,b' }] }]
      },
      warnings
    )
    expect(out.spaces[0].pages[0].type).toBe('markdown')
    expect(docToMarkdown(out.spaces[0].pages[0].content).trim()).toBe('a,b')
    expect(warnings).toEqual([
      '"Notes" has an unknown page type (sheet) and was imported as Markdown.'
    ])
  })

  it('rejects a wrong version or bad shape', () => {
    expect(() => parseBackup({ version: 2, spaces: [] })).toThrow(/damaged/)
    expect(() => parseBackup({ version: 1, spaces: [{ name: 'Home', pages: 'nope' }] })).toThrow()
    expect(() =>
      parseBackup({
        version: 1,
        spaces: [{ name: 'Home', pages: [{ ...page, content: 42 }] }]
      })
    ).toThrow(/content/)
  })
})

describe('parseManifest', () => {
  const manifest = {
    version: 1,
    space: { name: 'Work', icon: 'BookOpen', iconColor: 'slate' },
    folders: [{ path: 'Reports' }],
    pages: [{ id: 'p1', path: 'Reports/Notes.md', type: 'markdown' }],
    secretKeys: []
  }

  it('accepts an export and fills cosmetic defaults', () => {
    const parsed = parseManifest(JSON.stringify(manifest))
    expect(parsed.folders[0]).toEqual({ path: 'Reports', icon: 'Folder', iconColor: 'slate' })
    expect(parsed.pages[0].description).toBe('')
  })

  it('round-trips an unknown page type through export and import as Markdown', () => {
    // What exportSpace writes for a stored page of a type this Paper does not know.
    const stored = { title: 'Sheet', type: 'sheet', content: 'plain text' }
    const type = exportedType(stored.type)
    const path = `${stored.title}${extensionForType(type)}`
    const file = type === 'markdown' ? docToMarkdown(stored.content) : stored.content
    expect({ type, path }).toEqual({ type: 'markdown', path: 'Sheet.md' })

    const warnings: string[] = []
    const written = { ...manifest, pages: [{ id: 'p1', path, type }] }
    expect(parseManifest(JSON.stringify(written), warnings).pages[0].type).toBe('markdown')
    expect(warnings).toEqual([])
    expect(docToMarkdown(markdownToDoc(file)).trim()).toBe('plain text')

    const old = { ...manifest, pages: [{ id: 'p1', path: 'x.md', type: 'exe' }] }
    expect(parseManifest(JSON.stringify(old), warnings).pages[0].type).toBe('markdown')
    expect(warnings).toEqual([
      '"x.md" has an unknown page type (exe) and was imported as Markdown.'
    ])
  })

  it('rejects bad JSON and a page without a path', () => {
    expect(() => parseManifest('{')).toThrow('paper.json is not valid JSON')
    const noPath = { ...manifest, pages: [{ id: 'p1', path: ' ', type: 'markdown' }] }
    expect(() => parseManifest(JSON.stringify(noPath))).toThrow(/at pages\.0\.path/)
  })
})
