import type { PageType } from './api'
import type { IconColorId, IconName } from './icons'

/** One entry per page type. Editors, menus, and script imports read this list. */
export type PageTypeKind = 'markdown' | 'code' | 'table' | 'json'

export type PageTypeInfo = {
  id: PageType
  label: string
  menuLabel: string
  defaultTitle: string
  icon: IconName
  color: IconColorId
  extension: string
  kind: PageTypeKind
}

export const PAGE_TYPES: Record<PageType, PageTypeInfo> = {
  markdown: {
    id: 'markdown',
    label: 'MD',
    menuLabel: 'New page',
    defaultTitle: 'Untitled',
    icon: 'FileText',
    color: 'slate',
    extension: '.md',
    kind: 'markdown'
  },
  javascript: {
    id: 'javascript',
    label: 'JS',
    menuLabel: 'New JavaScript',
    defaultTitle: 'Script',
    icon: 'FileCode',
    color: 'peach',
    extension: '.js',
    kind: 'code'
  },
  typescript: {
    id: 'typescript',
    label: 'TS',
    menuLabel: 'New TypeScript',
    defaultTitle: 'Script',
    icon: 'FileCode2',
    color: 'sky',
    extension: '.ts',
    kind: 'code'
  },
  csv: {
    id: 'csv',
    label: 'CSV',
    menuLabel: 'New CSV',
    defaultTitle: 'Table',
    icon: 'Table2',
    color: 'sage',
    extension: '.csv',
    kind: 'table'
  },
  json: {
    id: 'json',
    label: 'JSON',
    menuLabel: 'New JSON',
    defaultTitle: 'Data',
    icon: 'FileJson',
    color: 'amber',
    extension: '.json',
    kind: 'json'
  }
}

export const PAGE_TYPE_IDS = ['markdown', 'javascript', 'typescript', 'csv', 'json'] as const
