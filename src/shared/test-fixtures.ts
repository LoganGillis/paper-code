import type { Page } from './api'

/** A stored page with sensible defaults for tests. */
export function makePage(input: Partial<Page> & Pick<Page, 'id' | 'title' | 'spaceId'>): Page {
  return {
    type: 'csv',
    folderId: null,
    sortOrder: 0,
    archived: false,
    deletedAt: null,
    locked: false,
    spellcheck: true,
    icon: 'Table2',
    iconColor: 'slate',
    content: 'a,b\n1,2\n',
    description: '',
    createdAt: '',
    updatedAt: '',
    ...input
  }
}
