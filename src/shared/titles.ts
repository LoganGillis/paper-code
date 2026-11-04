import type { PageType } from './api'
import { PAGE_TYPES } from './page-types'

export function pageTypeLabel(type: PageType): string {
  return PAGE_TYPES[type].label
}

export function displayTitle(title: string): string {
  return title.replace(/\.(js|jsx|ts|tsx|mjs|cjs|csv|json|md|markdown)$/i, '')
}

export function defaultPageTitle(type: PageType): string {
  return PAGE_TYPES[type].defaultTitle
}
