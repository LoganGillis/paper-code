import type { Page, PageType } from '../api'
import { PAGE_TYPES } from '../page-types'
import { isGuideDataPageId, isGuidePageId } from '../guide-data'
import { $Table } from './table'

export type SpaceRef = { id: string; name: string }
export type FolderRef = { id: string; name: string; parentId: string | null; spaceId: string }

export type ImportSpec = {
  spaceName: string | null
  /** `null` searches the whole space; `[]` means the space root. */
  folderPath: string[] | null
  title: string
}

export type ResolveOptions = {
  /** Only pages of these types match. Omit to match any type. */
  types?: readonly PageType[]
  folders?: FolderRef[]
  /** Word used in errors, like `CSV` or `module`. */
  label?: string
}

function normalizeSpec(spec: string): string {
  return spec
    .trim()
    .replace(/^\.\//, '')
    .replace(/^\//, '')
    .replace(/\.(js|jsx|ts|tsx|mjs|cjs|csv|json)$/i, '')
}

/**
 * Splits an import spec. `Title` and `Space/Title` keep their meaning; a folder is read only
 * when there are two or more slashes (`Space/Folder/Title`, `Space/A/B/Title`, `Space//Title`
 * for the space root).
 */
export function splitImportSpec(spec: string): ImportSpec {
  const cleaned = spec.trim().replace(/^\.\//, '')
  if (cleaned.startsWith('.') || cleaned.indexOf('/') <= 0) {
    return { spaceName: null, folderPath: null, title: cleaned }
  }
  const parts = cleaned.split('/')
  if (parts.length === 2) {
    return { spaceName: parts[0].trim(), folderPath: null, title: parts[1].trim() }
  }
  return {
    spaceName: parts[0].trim(),
    folderPath: parts
      .slice(1, -1)
      .map((part) => part.trim())
      .filter(Boolean),
    title: parts[parts.length - 1].trim()
  }
}

function exactTitle(page: Page, title: string): boolean {
  const cleaned = title.trim().replace(/^\//, '')
  return page.title.trim() === cleaned
}

function stemTitle(page: Page, title: string): boolean {
  return normalizeSpec(page.title) === normalizeSpec(title)
}

function folderChain(folderId: string | null, folders: Map<string, FolderRef>): string[] {
  const chain: string[] = []
  const seen = new Set<string>()
  let current = folderId ? folders.get(folderId) : undefined
  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    chain.unshift(current.name)
    current = current.parentId ? folders.get(current.parentId) : undefined
  }
  return chain
}

function sameFolderPath(chain: string[], wanted: string[]): boolean {
  return chain.length === wanted.length && chain.every((name, index) => name === wanted[index])
}

/** The full `Space/Folder/Title` spec that points at exactly this page. */
export function fullPageSpec(
  page: Page,
  spaces: SpaceRef[] = [],
  folders: FolderRef[] = []
): string {
  const spaceName = spaces.find((space) => space.id === page.spaceId)?.name ?? ''
  const chain = folderChain(page.folderId, new Map(folders.map((folder) => [folder.id, folder])))
  return chain.length > 0
    ? `${spaceName}/${chain.join('/')}/${page.title}`
    : `${spaceName}//${page.title}`
}

export class AmbiguousPageError extends Error {
  readonly matches: string[]

  constructor(spec: string, label: string, matches: string[]) {
    super(
      `"${spec}" matches ${matches.length} ${label} pages. Use the full path: ${matches
        .map((match) => `"${match}"`)
        .join(', ')}`
    )
    this.name = 'AmbiguousPageError'
    this.matches = matches
  }
}

function candidates(
  spec: string,
  from: Page,
  pages: Page[],
  spaces: SpaceRef[],
  folders: FolderRef[]
): Page[] {
  const { spaceName, folderPath, title } = splitImportSpec(spec)
  const spaceId = spaceName
    ? (spaces.find((space) => space.name === spaceName)?.id ?? null)
    : from.spaceId
  if (!spaceId) return []

  const folderMap = new Map(folders.map((folder) => [folder.id, folder]))
  const pool = pages.filter(
    (page) =>
      page.spaceId === spaceId &&
      !page.archived &&
      page.id !== from.id &&
      (folderPath === null || sameFolderPath(folderChain(page.folderId, folderMap), folderPath))
  )
  const exact = pool.filter((page) => exactTitle(page, title))
  const found = exact.length > 0 ? exact : pool.filter((page) => stemTitle(page, title))
  if (found.length > 1 && isGuidePageId(from.id)) {
    const guide = found.filter((page) => isGuideDataPageId(page.id))
    if (guide.length > 0) return guide
  }
  return found
}

/**
 * Finds the one page a `$csv` / `$json` / `require` spec points at. Returns `null` when nothing
 * matches and throws {@link AmbiguousPageError} when more than one page of the wanted type does.
 */
export function resolvePage(
  spec: string,
  from: Page,
  pages: Page[],
  spaces: SpaceRef[] = [],
  options: ResolveOptions = {}
): Page | null {
  const folders = options.folders ?? []
  const found = candidates(spec, from, pages, spaces, folders).filter(
    (page) => !options.types || options.types.includes(page.type)
  )
  if (found.length > 1) {
    throw new AmbiguousPageError(
      spec,
      options.label ?? 'matching',
      found.map((page) => fullPageSpec(page, spaces, folders))
    )
  }
  return found[0] ?? null
}

/**
 * Like {@link resolvePage} but throws a readable error when nothing of the wanted type matches,
 * naming the type of a same-titled page if there is one.
 */
export function requirePage(
  spec: string,
  from: Page,
  pages: Page[],
  spaces: SpaceRef[],
  options: ResolveOptions & { label: string; missing: string }
): Page {
  const found = resolvePage(spec, from, pages, spaces, options)
  if (found) return found
  const other = candidates(spec, from, pages, spaces, options.folders ?? [])[0]
  if (other) {
    throw new Error(`"${spec}" is a ${PAGE_TYPES[other.type].label} page, not ${options.label}`)
  }
  throw new Error(options.missing)
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
  context: { page: Page; pages: Page[]; spaces?: SpaceRef[]; folders?: FolderRef[] }
): void {
  const load = (spec: string): $Table =>
    tableFromPage(
      requirePage(spec, context.page, context.pages, context.spaces ?? [], {
        types: ['csv'],
        folders: context.folders,
        label: 'CSV',
        missing: `Cannot find CSV "${spec}"`
      })
    )

  Object.defineProperties(target, {
    $Table: { configurable: true, enumerable: true, value: $Table },
    $csv: { configurable: true, enumerable: true, value: load }
  })
}
