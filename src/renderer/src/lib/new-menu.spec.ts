import { describe, expect, it } from 'vitest'
import { PAGE_TYPE_IDS } from '@shared/page-types'
import { newMenuEntries } from './new-menu'

describe('newMenuEntries', () => {
  it('lists every page type, then the imports', () => {
    const entries = newMenuEntries()
    expect(entries.map((entry) => entry.key)).toEqual([...PAGE_TYPE_IDS, 'paste-json', 'open-file'])
    expect(entries[0].label).toBe('New page')
  })

  it('adds New folder only when asked', () => {
    expect(newMenuEntries({ withFolder: true }).at(-1)?.label).toBe('New folder')
  })
})
