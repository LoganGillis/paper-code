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

/** The page type a title's extension names (`Data.json` → `json`), or null for none. */
function typeFromExtension(title: string): PageType | null {
  const lower = title.trim().toLowerCase()
  for (const info of Object.values(PAGE_TYPES)) {
    if (lower.endsWith(info.extension) && lower.length > info.extension.length) return info.id
  }
  return null
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

  /** `count` is the number of pages matched; `matches` lists each distinct full path once. */
  constructor(spec: string, label: string, matches: string[], count = matches.length) {
    const shared =
      matches.length < count ? '. Some share a path; rename one to tell them apart.' : ''
    super(
      `"${spec}" matches ${count} ${label} pages. Use the full path: ${matches
        .map((match) => `"${match}"`)
        .join(', ')}${shared}`
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
  const implied = typeFromExtension(title)
  // `Data.json` picks the JSON page when a CSV and a JSON page are both titled `Data`.
  const found =
    exact.length > 0
      ? exact
      : pool.filter((page) => stemTitle(page, title) && (implied === null || page.type === implied))
  if (found.length > 1 && isGuidePageId(from.id)) {
    const guide = found.filter((page) => isGuideDataPageId(page.id))
    if (guide.length > 0) return guide
  }
  return found
}

/**
 * For a bare title (no space or folder in the spec), the one match in the script's own folder,
 * if there is exactly one. This keeps older scripts that relied on "nearest page wins" working.
 */
function sameFolderMatch(spec: string, from: Page, found: Page[]): Page | null {
  const { spaceName, folderPath } = splitImportSpec(spec)
  if (spaceName !== null || folderPath !== null) return null
  const near = found.filter((page) => page.folderId === from.folderId)
  return near.length === 1 ? near[0] : null
}

/**
 * Finds the one page a `$csv` / `$json` / `require` spec points at. Returns `null` when nothing
 * matches. Several matches for a bare title resolve to the single one in the script's own folder;
 * otherwise more than one page of the wanted type throws {@link AmbiguousPageError}.
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
    const near = sameFolderMatch(spec, from, found)
    if (near) return near
    // Add the extension when the matches differ in type, so every suggestion resolves.
    const mixed = new Set(found.map((page) => page.type)).size > 1
    const suggestions = found.map(
      (page) => fullPageSpec(page, spaces, folders) + (mixed ? PAGE_TYPES[page.type].extension : '')
    )
    throw new AmbiguousPageError(
      spec,
      options.label ?? 'matching',
      [...new Set(suggestions)],
      found.length
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
