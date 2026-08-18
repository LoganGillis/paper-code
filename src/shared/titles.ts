import type { PageType } from './api'

export function pageTypeLabel(type: PageType): string {
  if (type === 'javascript') return 'JS'
  if (type === 'typescript') return 'TS'
  if (type === 'csv') return 'CSV'
  return 'MD'
}

export function displayTitle(title: string): string {
  return title.replace(/\.(js|jsx|ts|tsx|mjs|cjs|csv|md|markdown)$/i, '')
}

export function defaultPageTitle(type: PageType): string {
  if (type === 'javascript' || type === 'typescript') return 'Script'
  if (type === 'csv') return 'Table'
  return 'Untitled'
}
