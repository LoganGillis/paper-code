import { z } from 'zod'
import { ICON_COLOR_IDS, ICON_NAMES } from '../shared/icons'
import { docToMarkdown, markdownToDoc } from '../shared/markdown-transfer'
import type { PageType } from '../shared/api'
import { isPageType } from '../shared/page-types'

/** Unknown page types (from a newer or older Paper) import as Markdown instead of failing. */
const pageType = z.string().transform((value): PageType => (isPageType(value) ? value : 'markdown'))

const date = z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid date')
const id = z.string().min(1)
const color = z.enum(ICON_COLOR_IDS).catch('slate')

const folder = z.object({
  id,
  parentId: id.nullable().catch(null),
  name: z.string(),
  icon: z.enum(ICON_NAMES).catch('Folder'),
  iconColor: color,
  sortOrder: z.number().int().catch(0)
})

const version = z.object({
  title: z.string(),
  content: z.string(),
  description: z.string().catch(''),
  createdAt: date
})

const run = z.object({
  language: z.string(),
  source: z.string(),
  logs: z.string().catch('[]'),
  result: z.string().nullable().catch(null),
  error: z.string().nullable().catch(null),
  inputs: z.string().catch('{}'),
  createdAt: date
})

const page = z.object({
  id,
  folderId: id.nullable().catch(null),
  title: z.string(),
  type: pageType,
  content: z.string(),
  description: z.string().catch(''),
  icon: z.enum(ICON_NAMES).catch('FileText'),
  iconColor: color,
  sortOrder: z.number().int().catch(0),
  archived: z.boolean().catch(false),
  deletedAt: date.nullable().catch(null),
  locked: z.boolean().catch(false),
  spellcheck: z.boolean().catch(true),
  versions: z.array(version).catch([]),
  runs: z.array(run).catch([])
})

const space = z.object({
  name: z.string().min(1),
  icon: z.enum(ICON_NAMES).catch('BookOpen'),
  iconColor: color,
  secretsExposed: z.boolean().catch(false),
  secretKeys: z.array(z.string()).catch([]),
  folders: z.array(folder).default([]),
  pages: z.array(page).default([])
})

export const backupSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string().optional(),
  spaces: z.array(space)
})

export type Backup = z.infer<typeof backupSchema>

function unknownTypeWarning(name: string, type: unknown): string {
  return `"${name}" has an unknown page type (${String(type)}) and was imported as Markdown.`
}

/**
 * Checks a parsed backup file before anything is written. Missing cosmetic fields get defaults;
 * an unknown page type becomes Markdown (noted in `warnings`); a wrong shape or bad date rejects
 * the whole file.
 */
export function parseBackup(raw: unknown, warnings: string[] = []): Backup {
  const parsed = backupSchema.safeParse(raw)
  if (parsed.success) {
    const input = raw as { spaces: Array<{ pages?: Array<{ type?: unknown }> }> }
    parsed.data.spaces.forEach((space, s) =>
      space.pages.forEach((page, p) => {
        const original = input.spaces[s]?.pages?.[p]?.type
        if (original === page.type) return
        warnings.push(unknownTypeWarning(page.title, original))
        // Keep the text readable in the Markdown editor.
        page.content = markdownToDoc(docToMarkdown(page.content))
      })
    )
    return parsed.data
  }
  const issue = parsed.error.issues[0]
  const where = issue?.path.length ? ` at ${issue.path.join('.')}` : ''
  throw new Error(`Unsupported or damaged Paper backup${where}: ${issue?.message ?? 'invalid'}.`)
}

const manifestFolder = z.object({
  path: z.string().min(1),
  icon: z.enum(ICON_NAMES).catch('Folder'),
  iconColor: color
})

const manifestPage = z.object({
  id,
  path: z.string().trim().min(1),
  type: pageType,
  icon: z.enum(ICON_NAMES).catch('FileText'),
  iconColor: color,
  description: z.string().catch('')
})

export const manifestSchema = z.object({
  version: z.literal(1),
  space: z.object({
    name: z.string().min(1),
    icon: z.enum(ICON_NAMES).catch('BookOpen'),
    iconColor: color
  }),
  folders: z.array(manifestFolder).default([]),
  pages: z.array(manifestPage).default([]),
  secretKeys: z.array(z.string()).catch([])
})

export type Manifest = z.infer<typeof manifestSchema>

/**
 * Checks the `paper.json` of a space export folder before anything is written. Missing cosmetic
 * fields get defaults; an unknown page type becomes Markdown (noted in `warnings`, and the file is
 * the `.md` an export writes for it); a wrong shape rejects the whole import.
 */
export function parseManifest(raw: string, warnings: string[] = []): Manifest {
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    throw new Error('Unsupported or damaged Paper export: paper.json is not valid JSON.')
  }
  const parsed = manifestSchema.safeParse(json)
  if (parsed.success) {
    const input = json as { pages?: Array<{ type?: unknown }> }
    parsed.data.pages.forEach((page, index) => {
      const original = input.pages?.[index]?.type
      if (original !== page.type) warnings.push(unknownTypeWarning(page.path, original))
    })
    return parsed.data
  }
  const issue = parsed.error.issues[0]
  const where = issue?.path.length ? ` at ${issue.path.join('.')}` : ''
  throw new Error(`Unsupported or damaged Paper export${where}: ${issue?.message ?? 'invalid'}.`)
}
