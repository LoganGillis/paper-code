import { describe, expect, it } from 'vitest'
import type { FolderNode, PageSummary } from '@shared/api'
import { lockHint, lockedMessage } from '@shared/locks'
import { firstLockedPage } from './tree-locks'

const page = (title: string, locked = false): PageSummary =>
  ({ id: title, title, locked }) as PageSummary
const folder = (pages: PageSummary[], folders: FolderNode[] = []): FolderNode =>
  ({ id: 'f', name: 'F', pages, folders }) as unknown as FolderNode

describe('firstLockedPage', () => {
  it('finds a locked page in a nested subfolder', () => {
    expect(firstLockedPage(folder([page('a')], [folder([page('b', true)])]))?.title).toBe('b')
  })

  it('is null when nothing is locked', () => {
    expect(firstLockedPage(folder([page('a')], [folder([page('b')])]))).toBeNull()
  })
})

describe('lock wording', () => {
  it('gives a short hint and a friendly error', () => {
    expect(lockHint('delete')).toBe('Unlock to delete')
    expect(lockHint('purge')).toBe('Unlock to delete forever')
    expect(lockedMessage('Notes', 'move')).toBe('"Notes" is locked. Unlock it to move.')
  })
})
