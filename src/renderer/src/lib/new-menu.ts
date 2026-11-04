import type { PageType } from '@shared/api'
import { PAGE_TYPES } from '@shared/page-types'

export type NewMenuAction =
  | { kind: 'create'; type: PageType }
  | { kind: 'paste-json' }
  | { kind: 'open-file' }
  | { kind: 'new-folder' }

export type NewMenuEntry = { key: string; label: string; action: NewMenuAction }

/**
 * The items of every "New" menu: one per page type from PAGE_TYPES, then the clipboard and
 * file imports. `withFolder` adds "New folder" for menus that live in the file tree.
 */
export function newMenuEntries(options: { withFolder?: boolean } = {}): NewMenuEntry[] {
  const entries: NewMenuEntry[] = Object.values(PAGE_TYPES).map((info) => ({
    key: info.id,
    label: info.menuLabel,
    action: { kind: 'create', type: info.id }
  }))
  entries.push(
    { key: 'paste-json', label: 'JSON from clipboard', action: { kind: 'paste-json' } },
    { key: 'open-file', label: 'Open CSV or JSON', action: { kind: 'open-file' } }
  )
  if (options.withFolder) {
    entries.push({ key: 'new-folder', label: 'New folder', action: { kind: 'new-folder' } })
  }
  return entries
}
