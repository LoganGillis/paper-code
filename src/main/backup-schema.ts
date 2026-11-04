import { z } from 'zod'
import { ICON_COLOR_IDS, ICON_NAMES } from '../shared/icons'
import { PAGE_TYPE_IDS } from '../shared/page-types'

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
  type: z.enum(PAGE_TYPE_IDS),
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

/**
 * Checks a parsed backup file before anything is written. Missing cosmetic fields get defaults;
 * a wrong shape, unknown page type, or bad date rejects the whole file.
 */
export function parseBackup(raw: unknown): Backup {
  const parsed = backupSchema.safeParse(raw)
  if (parsed.success) return parsed.data
  const issue = parsed.error.issues[0]
  const where = issue?.path.length ? ` at ${issue.path.join('.')}` : ''
  throw new Error(`Unsupported or damaged Paper backup${where}: ${issue?.message ?? 'invalid'}.`)
}
