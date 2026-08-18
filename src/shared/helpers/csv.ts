import type { Page } from '../api'
import { $Table } from './table'

function normalizeSpec(spec: string): string {
  return spec
    .trim()
    .replace(/^\.\//, '')
    .replace(/^\//, '')
    .replace(/\.(js|jsx|ts|tsx|mjs|cjs|csv)$/i, '')
}

export function resolvePage(spec: string, from: Page, pages: Page[]): Page | null {
  const cleaned = spec.trim().replace(/^\.\//, '').replace(/^\//, '')
  const stem = normalizeSpec(spec)
  const ranked = [
    ...pages.filter((page) => page.folderId === from.folderId),
    ...pages.filter((page) => page.folderId !== from.folderId)
  ]
  return (
    ranked.find((page) => {
      const title = page.title.trim()
      const titleStem = normalizeSpec(title)
      return title === cleaned || title === spec.trim() || titleStem === stem
    }) ?? null
  )
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
  context: { page: Page; pages: Page[] }
): void {
  const load = (spec: string): $Table => {
    const found = resolvePage(spec, context.page, context.pages)
    if (!found) throw new Error(`Cannot find CSV "${spec}"`)
    return tableFromPage(found)
  }

  Object.defineProperties(target, {
    $Table: { configurable: true, enumerable: true, value: $Table },
    $csv: { configurable: true, enumerable: true, value: load }
  })
}
