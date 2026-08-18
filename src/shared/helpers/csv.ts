import type { Page } from '../api'
import { $Table } from './table'

function normalizeSpec(spec: string): string {
  return spec
    .trim()
    .replace(/^\.\//, '')
    .replace(/^\//, '')
    .replace(/\.(js|jsx|ts|tsx|mjs|cjs|csv)$/i, '')
}

export function splitImportSpec(spec: string): { spaceName: string | null; title: string } {
  const cleaned = spec.trim().replace(/^\.\//, '')
  const slash = cleaned.indexOf('/')
  if (slash > 0 && !cleaned.startsWith('.')) {
    return {
      spaceName: cleaned.slice(0, slash).trim(),
      title: cleaned.slice(slash + 1).trim()
    }
  }
  return { spaceName: null, title: cleaned }
}

function matchTitle(page: Page, title: string): boolean {
  const cleaned = title.trim().replace(/^\//, '')
  const stem = normalizeSpec(title)
  const pageTitle = page.title.trim()
  return pageTitle === cleaned || pageTitle === title.trim() || normalizeSpec(pageTitle) === stem
}

export function resolvePage(
  spec: string,
  from: Page,
  pages: Page[],
  spaces: Array<{ id: string; name: string }> = []
): Page | null {
  const { spaceName, title } = splitImportSpec(spec)
  const spaceId = spaceName
    ? (spaces.find((space) => space.name === spaceName)?.id ?? null)
    : from.spaceId
  if (!spaceId) return null

  const pool = pages.filter((page) => page.spaceId === spaceId && !page.archived)
  const ranked = [
    ...pool.filter((page) => page.folderId === from.folderId),
    ...pool.filter((page) => page.folderId !== from.folderId)
  ]
  return ranked.find((page) => matchTitle(page, title)) ?? null
}

export function tableFromPage(page: Page): $Table {
  if (page.type !== 'csv') {
    throw new Error(`"${page.title}" is not a CSV`)
  }
  const table = $Table.fromCsv(page.content)
  Object.defineProperty(table, 'default', {
    configurable: true,
    enumerable: false,
    value: table
  })
  return table
}

export function installCsvHelpers(
  target: Record<string, unknown>,
  context: { page: Page; pages: Page[]; spaces?: Array<{ id: string; name: string }> }
): void {
  const load = (spec: string): $Table => {
    const found = resolvePage(spec, context.page, context.pages, context.spaces ?? [])
    if (!found) throw new Error(`Cannot find CSV "${spec}"`)
    return tableFromPage(found)
  }

  Object.defineProperties(target, {
    $Table: { configurable: true, enumerable: true, value: $Table },
    $csv: { configurable: true, enumerable: true, value: load }
  })
}
