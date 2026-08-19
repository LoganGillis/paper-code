import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { app, BrowserWindow, dialog } from 'electron'
import { z } from 'zod'
import { is } from '@electron-toolkit/utils'
import { getDatabasePath, getPrisma } from './db'
import { didSeedThisLaunch } from './seed'
import { checkForUpdates, getUpdateStatus, quitAndInstall } from './updates'
import { executeSnippet } from './runner'
import { exportBackup, exportSpace, importBackup, importSpace } from './transfer'
import { isSecretEncryptionAvailable, sealSecret, unsealSecret } from './secrets'
import {
  defaultColorForPage,
  defaultIconForPage,
  ICON_COLOR_IDS,
  ICON_NAMES,
  normalizeColor,
  normalizeIcon
} from '../shared/icons'
import type {
  AppApi,
  FolderNode,
  Page,
  PageSummary,
  PageType,
  PageVersion,
  RunRecord,
  Space,
  SpaceTree
} from '../shared/api'
import { buildGuideDataPages, isGuideDataPageId, isGuidePageId } from '../shared/guide-data'

const idInput = z.object({ id: z.string().min(1) })
const pageTypes = ['markdown', 'javascript', 'typescript', 'csv'] as const
const iconName = z.enum(ICON_NAMES)
const iconColor = z.enum(ICON_COLOR_IDS)

function serializeSpace(space: {
  id: string
  name: string
  icon: string
  iconColor: string
  secretsExposed: boolean
  createdAt: Date
  updatedAt: Date
}): Space {
  return {
    id: space.id,
    name: space.name,
    icon: normalizeIcon(space.icon, 'BookOpen'),
    iconColor: normalizeColor(space.iconColor),
    secretsExposed: space.secretsExposed,
    createdAt: space.createdAt.toISOString(),
    updatedAt: space.updatedAt.toISOString()
  }
}

function serializePageSummary(page: {
  id: string
  title: string
  type: string
  folderId: string | null
  sortOrder: number
  archived?: boolean
  deletedAt?: Date | null
  locked?: boolean
  spellcheck?: boolean
  icon: string
  iconColor: string
  updatedAt: Date
}): PageSummary {
  const type = page.type as PageType
  return {
    id: page.id,
    title: page.title,
    type,
    folderId: page.folderId,
    sortOrder: page.sortOrder,
    archived: Boolean(page.archived),
    deletedAt: page.deletedAt ? page.deletedAt.toISOString() : null,
    locked: Boolean(page.locked),
    spellcheck: page.spellcheck !== false,
    icon: normalizeIcon(page.icon, defaultIconForPage(type)),
    iconColor: normalizeColor(page.iconColor, defaultColorForPage(type)),
    updatedAt: page.updatedAt.toISOString()
  }
}

function serializePage(page: {
  id: string
  title: string
  type: string
  content: string
  description: string
  folderId: string | null
  spaceId: string
  sortOrder: number
  archived?: boolean
  deletedAt?: Date | null
  locked?: boolean
  spellcheck?: boolean
  icon: string
  iconColor: string
  createdAt: Date
  updatedAt: Date
}): Page {
  return {
    ...serializePageSummary(page),
    spaceId: page.spaceId,
    content: page.content,
    description: page.description,
    createdAt: page.createdAt.toISOString(),
    updatedAt: page.updatedAt.toISOString()
  }
}

function serializeFolder(folder: {
  id: string
  name: string
  parentId: string | null
  sortOrder: number
  icon: string
  iconColor: string
}): FolderNode {
  return {
    id: folder.id,
    name: folder.name,
    parentId: folder.parentId,
    sortOrder: folder.sortOrder,
    icon: normalizeIcon(folder.icon, 'Folder'),
    iconColor: normalizeColor(folder.iconColor),
    folders: [],
    pages: []
  }
}

async function buildTree(spaceId: string): Promise<SpaceTree> {
  const prisma = getPrisma()
  const space = await prisma.space.findUniqueOrThrow({ where: { id: spaceId } })
  const folders = await prisma.folder.findMany({
    where: { spaceId },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
  })
  const pages = await prisma.page.findMany({
    where: { spaceId },
    orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }]
  })
  const live = pages.filter((page) => !page.archived && !page.deletedAt)
  const archived = pages.filter((page) => page.archived && !page.deletedAt)
  const trashed = pages.filter((page) => Boolean(page.deletedAt))

  const folderNodes = new Map<string, FolderNode>()
  for (const folder of folders) {
    folderNodes.set(folder.id, serializeFolder(folder))
  }

  for (const page of live) {
    const summary = serializePageSummary(page)
    if (page.folderId && folderNodes.has(page.folderId)) {
      folderNodes.get(page.folderId)!.pages.push(summary)
    }
  }

  const roots: FolderNode[] = []
  for (const folder of folders) {
    const node = folderNodes.get(folder.id)!
    if (folder.parentId && folderNodes.has(folder.parentId)) {
      folderNodes.get(folder.parentId)!.folders.push(node)
    } else {
      roots.push(node)
    }
  }

  return {
    space: serializeSpace(space),
    folders: roots,
    pages: live.filter((page) => !page.folderId).map(serializePageSummary),
    archivedPages: archived.map(serializePageSummary),
    trashedPages: trashed.map(serializePageSummary)
  }
}

function copyName(name: string): string {
  return `${name} copy`
}

async function duplicateFolderTree(
  folderId: string,
  spaceId: string,
  parentId: string | null,
  rename: boolean
): Promise<FolderNode> {
  const prisma = getPrisma()
  const folder = await prisma.folder.findUniqueOrThrow({
    where: { id: folderId },
    include: { children: true, pages: true }
  })
  const created = await prisma.folder.create({
    data: {
      name: rename ? copyName(folder.name) : folder.name,
      icon: folder.icon,
      iconColor: folder.iconColor,
      sortOrder: folder.sortOrder,
      spaceId,
      parentId
    }
  })

  for (const page of folder.pages) {
    await prisma.page.create({
      data: {
        title: page.title,
        type: page.type,
        content: page.content,
        description: page.description,
        icon: page.icon,
        iconColor: page.iconColor,
        sortOrder: page.sortOrder,
        spaceId,
        folderId: created.id
      }
    })
  }

  for (const child of folder.children) {
    await duplicateFolderTree(child.id, spaceId, created.id, false)
  }

  return serializeFolder(created)
}

function isUniqueConstraint(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'P2002'
  )
}

function serializeSecret(secret: { id: string; key: string; spaceId: string; updatedAt: Date }): {
  id: string
  key: string
  spaceId: string
  updatedAt: string
} {
  return {
    id: secret.id,
    key: secret.key,
    spaceId: secret.spaceId,
    updatedAt: secret.updatedAt.toISOString()
  }
}

function serializeVersion(row: {
  id: string
  pageId: string
  title: string
  content: string
  description: string
  createdAt: Date
}): PageVersion {
  return {
    id: row.id,
    pageId: row.pageId,
    title: row.title,
    content: row.content,
    description: row.description,
    createdAt: row.createdAt.toISOString()
  }
}

function serializeRun(row: {
  id: string
  pageId: string
  language: string
  source: string
  logs: string
  result: string | null
  error: string | null
  inputs: string
  createdAt: Date
}): RunRecord {
  let logs: RunRecord['logs'] = []
  try {
    logs = JSON.parse(row.logs) as RunRecord['logs']
  } catch {
    logs = []
  }
  return {
    id: row.id,
    pageId: row.pageId,
    language: row.language === 'typescript' ? 'typescript' : 'javascript',
    source: row.source,
    logs,
    result: row.result ?? undefined,
    error: row.error ?? undefined,
    inputs: row.inputs,
    createdAt: row.createdAt.toISOString()
  }
}

async function snapshotPage(
  page: { id: string; title: string; content: string; description: string },
  force = false
): Promise<{
  id: string
  pageId: string
  title: string
  content: string
  description: string
  createdAt: Date
}> {
  const prisma = getPrisma()
  const last = await prisma.pageVersion.findFirst({
    where: { pageId: page.id },
    orderBy: { createdAt: 'desc' }
  })
  if (
    !force &&
    last &&
    last.content === page.content &&
    last.title === page.title &&
    last.description === page.description
  ) {
    return last
  }
  if (
    !force &&
    last &&
    Date.now() - last.createdAt.getTime() < 20_000 &&
    last.content === page.content
  ) {
    return last
  }
  return prisma.pageVersion.create({
    data: {
      pageId: page.id,
      title: page.title,
      content: page.content,
      description: page.description
    }
  })
}

async function loadSecretsForRun(spaceId: string): Promise<Record<string, string>> {
  const spaces = await getPrisma().space.findMany({ include: { secrets: true } })
  const bag: Record<string, string> = {}
  for (const space of spaces) {
    if (space.id !== spaceId && !space.secretsExposed) continue
    for (const secret of space.secrets) {
      if (space.id !== spaceId && bag[secret.key] !== undefined) continue
      bag[secret.key] = unsealSecret(secret.valueEnc)
    }
  }
  const current = spaces.find((space) => space.id === spaceId)
  if (current) {
    for (const secret of current.secrets) {
      bag[secret.key] = unsealSecret(secret.valueEnc)
    }
  }
  return bag
}

export const procedures: AppApi = {
  app: {
    getConfig: async () => {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      await getPrisma().page.deleteMany({ where: { deletedAt: { lt: cutoff } } })
      return {
        name: app.getName(),
        version: app.getVersion(),
        isDev: is.dev,
        databasePath: is.dev ? 'prisma/dev.db' : getDatabasePath(),
        seededThisLaunch: didSeedThisLaunch()
      }
    },
    getUpdateStatus: async () => getUpdateStatus(),
    checkForUpdates: async () => {
      checkForUpdates()
      return getUpdateStatus()
    },
    quitAndInstall: async () => {
      quitAndInstall()
    },
    addToDictionary: async (input) => {
      const data = z.object({ word: z.string().trim().min(1) }).parse(input)
      const win = BrowserWindow.getFocusedWindow()
      win?.webContents.session.addWordToSpellCheckerDictionary(data.word)
    },
    pickCsv: async () => {
      const parent = BrowserWindow.getFocusedWindow()
      const picked = parent
        ? await dialog.showOpenDialog(parent, {
            title: 'Open CSV',
            properties: ['openFile'],
            filters: [{ name: 'CSV', extensions: ['csv', 'tsv', 'txt'] }]
          })
        : await dialog.showOpenDialog({
            title: 'Open CSV',
            properties: ['openFile'],
            filters: [{ name: 'CSV', extensions: ['csv', 'tsv', 'txt'] }]
          })
      const filePath = picked.filePaths[0]
      if (picked.canceled || !filePath) return null
      return {
        name: basename(filePath).replace(/\.(csv|tsv|txt)$/i, ''),
        content: await readFile(filePath, 'utf8')
      }
    }
  },
  spaces: {
    list: async () => {
      const spaces = await getPrisma().space.findMany({
        orderBy: { createdAt: 'asc' }
      })
      return spaces.map(serializeSpace)
    },
    create: async (input) => {
      const data = z
        .object({
          name: z.string().trim().min(1).max(80),
          icon: iconName.optional(),
          iconColor: iconColor.optional()
        })
        .parse(input)
      const space = await getPrisma().space.create({
        data: {
          name: data.name,
          icon: data.icon ?? 'BookOpen',
          iconColor: data.iconColor ?? 'slate'
        }
      })
      return serializeSpace(space)
    },
    update: async (input) => {
      const data = z
        .object({
          id: z.string().min(1),
          name: z.string().trim().min(1).max(80).optional(),
          icon: iconName.optional(),
          iconColor: iconColor.optional(),
          secretsExposed: z.boolean().optional()
        })
        .parse(input)
      const space = await getPrisma().space.update({
        where: { id: data.id },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.icon !== undefined ? { icon: data.icon } : {}),
          ...(data.iconColor !== undefined ? { iconColor: data.iconColor } : {}),
          ...(data.secretsExposed !== undefined ? { secretsExposed: data.secretsExposed } : {})
        }
      })
      return serializeSpace(space)
    },
    delete: async (input) => {
      const data = idInput.parse(input)
      await getPrisma().space.delete({ where: { id: data.id } })
    },
    duplicate: async (input) => {
      const data = idInput.parse(input)
      const prisma = getPrisma()
      const source = await prisma.space.findUniqueOrThrow({
        where: { id: data.id },
        include: {
          folders: true,
          pages: true,
          secrets: true
        }
      })
      const copy = await prisma.space.create({
        data: {
          name: copyName(source.name),
          icon: source.icon,
          iconColor: source.iconColor,
          secretsExposed: source.secretsExposed
        }
      })

      const folderIds = new Map<string, string>()
      const roots = source.folders.filter((folder) => !folder.parentId)
      const walk = async (folderId: string, parentId: string | null): Promise<void> => {
        const folder = source.folders.find((item) => item.id === folderId)
        if (!folder) return
        const created = await prisma.folder.create({
          data: {
            name: folder.name,
            icon: folder.icon,
            iconColor: folder.iconColor,
            sortOrder: folder.sortOrder,
            spaceId: copy.id,
            parentId
          }
        })
        folderIds.set(folder.id, created.id)
        for (const child of source.folders.filter((item) => item.parentId === folder.id)) {
          await walk(child.id, created.id)
        }
      }
      for (const root of roots) {
        await walk(root.id, null)
      }

      for (const page of source.pages) {
        await prisma.page.create({
          data: {
            title: page.title,
            type: page.type,
            content: page.content,
            description: page.description,
            icon: page.icon,
            iconColor: page.iconColor,
            sortOrder: page.sortOrder,
            spaceId: copy.id,
            folderId: page.folderId ? (folderIds.get(page.folderId) ?? null) : null
          }
        })
      }

      for (const secret of source.secrets) {
        await prisma.secret.create({
          data: {
            spaceId: copy.id,
            key: secret.key,
            valueEnc: secret.valueEnc
          }
        })
      }

      return serializeSpace(copy)
    },
    getTree: async (input) => {
      const data = idInput.parse(input)
      return buildTree(data.id)
    },
    exportToFolder: async (input) => {
      const data = idInput.parse(input)
      return exportSpace(data.id)
    },
    importFromFolder: async () => {
      const id = await importSpace()
      if (!id) return null
      const space = await getPrisma().space.findUniqueOrThrow({ where: { id } })
      return serializeSpace(space)
    },
    exportBackup: async () => exportBackup(),
    importBackup: async () => importBackup()
  },
  folders: {
    create: async (input) => {
      const data = z
        .object({
          spaceId: z.string().min(1),
          parentId: z.string().min(1).nullable().optional(),
          name: z.string().trim().min(1).max(80)
        })
        .parse(input)
      const parent = data.parentId
        ? await getPrisma().folder.findUnique({ where: { id: data.parentId } })
        : await getPrisma().space.findUnique({ where: { id: data.spaceId } })
      const folder = await getPrisma().folder.create({
        data: {
          name: data.name,
          spaceId: data.spaceId,
          parentId: data.parentId ?? null,
          icon: 'Folder',
          iconColor: normalizeColor(parent?.iconColor ?? 'slate')
        }
      })
      return serializeFolder(folder)
    },
    update: async (input) => {
      const data = z
        .object({
          id: z.string().min(1),
          name: z.string().trim().min(1).max(80).optional(),
          icon: iconName.optional(),
          iconColor: iconColor.optional()
        })
        .parse(input)
      const folder = await getPrisma().folder.update({
        where: { id: data.id },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.icon !== undefined ? { icon: data.icon } : {}),
          ...(data.iconColor !== undefined ? { iconColor: data.iconColor } : {})
        }
      })
      return serializeFolder(folder)
    },
    delete: async (input) => {
      const data = idInput.parse(input)
      await getPrisma().folder.delete({ where: { id: data.id } })
    },
    duplicate: async (input) => {
      const data = idInput.parse(input)
      const folder = await getPrisma().folder.findUniqueOrThrow({ where: { id: data.id } })
      return duplicateFolderTree(folder.id, folder.spaceId, folder.parentId, true)
    },
    move: async (input) => {
      const data = z
        .object({
          id: z.string().min(1),
          parentId: z.string().min(1).nullable().optional(),
          beforeId: z.string().min(1).nullable().optional()
        })
        .parse(input)
      const prisma = getPrisma()
      const folder = await prisma.folder.findUniqueOrThrow({ where: { id: data.id } })
      const parentId = data.parentId === undefined ? folder.parentId : data.parentId
      if (parentId === folder.id) throw new Error('A folder cannot go inside itself.')
      await prisma.folder.update({ where: { id: folder.id }, data: { parentId } })
      const siblings = await prisma.folder.findMany({
        where: { spaceId: folder.spaceId, parentId },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
      })
      const rest = siblings.filter((item) => item.id !== folder.id)
      const at =
        data.beforeId != null
          ? Math.max(
              0,
              rest.findIndex((item) => item.id === data.beforeId)
            )
          : rest.length
      const insertAt = data.beforeId && at < 0 ? rest.length : at
      rest.splice(insertAt, 0, folder)
      await Promise.all(
        rest.map((item, index) =>
          prisma.folder.update({ where: { id: item.id }, data: { sortOrder: index } })
        )
      )
    }
  },
  pages: {
    get: async (input) => {
      const data = idInput.parse(input)
      if (isGuideDataPageId(data.id)) {
        const host =
          (await getPrisma().space.findFirst({ orderBy: { createdAt: 'asc' } }))?.id ?? ''
        const found = buildGuideDataPages(host).find((page) => page.id === data.id)
        if (found) return found
      }
      const page = await getPrisma().page.findUniqueOrThrow({ where: { id: data.id } })
      return serializePage(page)
    },
    create: async (input) => {
      const data = z
        .object({
          spaceId: z.string().min(1),
          folderId: z.string().min(1).nullable().optional(),
          type: z.enum(pageTypes),
          title: z.string().trim().min(1).max(120),
          content: z.string().optional()
        })
        .parse(input)

      const content =
        data.content ??
        (data.type === 'markdown'
          ? JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] })
          : data.type === 'typescript'
            ? 'const value: string = "Hello, Paper"\nconsole.log(value)\n'
            : data.type === 'csv'
              ? 'column,value\n,'
              : 'console.log("Hello, Paper")\n')

      const parent = data.folderId
        ? await getPrisma().folder.findUnique({ where: { id: data.folderId } })
        : await getPrisma().space.findUnique({ where: { id: data.spaceId } })
      const page = await getPrisma().page.create({
        data: {
          title: data.title,
          type: data.type,
          content,
          description: '',
          icon: defaultIconForPage(data.type),
          iconColor: normalizeColor(parent?.iconColor ?? 'slate', defaultColorForPage(data.type)),
          spaceId: data.spaceId,
          folderId: data.folderId ?? null
        }
      })
      return serializePage(page)
    },
    duplicate: async (input) => {
      const data = idInput.parse(input)
      const page = await getPrisma().page.findUniqueOrThrow({ where: { id: data.id } })
      const copy = await getPrisma().page.create({
        data: {
          title: copyName(page.title),
          type: page.type,
          content: page.content,
          description: page.description,
          icon: page.icon,
          iconColor: page.iconColor,
          sortOrder: page.sortOrder,
          spaceId: page.spaceId,
          folderId: page.folderId
        }
      })
      return serializePage(copy)
    },
    update: async (input) => {
      const data = z
        .object({
          id: z.string().min(1),
          title: z.string().trim().min(1).max(120).optional(),
          content: z.string().optional(),
          description: z.string().optional(),
          type: z.enum(pageTypes).optional(),
          archived: z.boolean().optional(),
          locked: z.boolean().optional(),
          spellcheck: z.boolean().optional(),
          icon: iconName.optional(),
          iconColor: iconColor.optional()
        })
        .parse(input)
      const prisma = getPrisma()
      const previous = await prisma.page.findUniqueOrThrow({ where: { id: data.id } })
      if (
        data.content !== undefined &&
        data.content !== previous.content &&
        !previous.deletedAt
      ) {
        await snapshotPage(previous)
      }
      const page = await prisma.page.update({
        where: { id: data.id },
        data: {
          ...(data.title !== undefined ? { title: data.title } : {}),
          ...(data.content !== undefined ? { content: data.content } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.type !== undefined ? { type: data.type } : {}),
          ...(data.archived !== undefined ? { archived: data.archived } : {}),
          ...(data.locked !== undefined ? { locked: data.locked } : {}),
          ...(data.spellcheck !== undefined ? { spellcheck: data.spellcheck } : {}),
          ...(data.icon !== undefined ? { icon: data.icon } : {}),
          ...(data.iconColor !== undefined ? { iconColor: data.iconColor } : {})
        }
      })
      return serializePage(page)
    },
    delete: async (input) => {
      const data = idInput.parse(input)
      await getPrisma().page.update({
        where: { id: data.id },
        data: { deletedAt: new Date(), archived: false }
      })
    },
    restore: async (input) => {
      const data = idInput.parse(input)
      const page = await getPrisma().page.update({
        where: { id: data.id },
        data: { deletedAt: null }
      })
      return serializePage(page)
    },
    purge: async (input) => {
      const data = idInput.parse(input)
      await getPrisma().page.delete({ where: { id: data.id } })
    },
    listVersions: async (input) => {
      const data = idInput.parse(input)
      const rows = await getPrisma().pageVersion.findMany({
        where: { pageId: data.id },
        orderBy: { createdAt: 'desc' },
        take: 80
      })
      return rows.map(serializeVersion)
    },
    snapshot: async (input) => {
      const data = idInput.parse(input)
      const page = await getPrisma().page.findUniqueOrThrow({ where: { id: data.id } })
      return serializeVersion(await snapshotPage(page, true))
    },
    restoreVersion: async (input) => {
      const data = z
        .object({ id: z.string().min(1), versionId: z.string().min(1) })
        .parse(input)
      const prisma = getPrisma()
      const page = await prisma.page.findUniqueOrThrow({ where: { id: data.id } })
      const version = await prisma.pageVersion.findUniqueOrThrow({ where: { id: data.versionId } })
      if (version.pageId !== page.id) throw new Error('Version does not belong to this page.')
      await snapshotPage(page, true)
      const updated = await prisma.page.update({
        where: { id: page.id },
        data: { title: version.title, content: version.content, description: version.description }
      })
      return serializePage(updated)
    },
    listRuns: async (input) => {
      const data = idInput.parse(input)
      const rows = await getPrisma().runRecord.findMany({
        where: { pageId: data.id },
        orderBy: { createdAt: 'desc' },
        take: 50
      })
      return rows.map(serializeRun)
    },
    move: async (input) => {
      const data = z
        .object({
          id: z.string().min(1),
          folderId: z.string().min(1).nullable().optional(),
          beforeId: z.string().min(1).nullable().optional()
        })
        .parse(input)
      const prisma = getPrisma()
      const page = await prisma.page.findUniqueOrThrow({ where: { id: data.id } })
      const folderId = data.folderId === undefined ? page.folderId : data.folderId
      await prisma.page.update({ where: { id: page.id }, data: { folderId } })
      const siblings = await prisma.page.findMany({
        where: { spaceId: page.spaceId, folderId, archived: false, deletedAt: null },
        orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }]
      })
      const rest = siblings.filter((item) => item.id !== page.id)
      const at =
        data.beforeId != null ? rest.findIndex((item) => item.id === data.beforeId) : rest.length
      const insertAt = data.beforeId != null && at < 0 ? rest.length : Math.max(0, at)
      rest.splice(insertAt, 0, page)
      await Promise.all(
        rest.map((item, index) =>
          prisma.page.update({ where: { id: item.id }, data: { sortOrder: index } })
        )
      )
    }
  },
  run: {
    execute: async (input) => {
      const data = z
        .object({
          language: z.enum(['javascript', 'typescript']),
          source: z.string(),
          spaceId: z.string().min(1),
          pageId: z.string().min(1)
        })
        .parse(input)
      const [spacePages, allPages, spaces] = await Promise.all([
        getPrisma().page.findMany({
          where: { spaceId: data.spaceId, archived: false, deletedAt: null }
        }),
        getPrisma().page.findMany({ where: { archived: false, deletedAt: null } }),
        getPrisma().space.findMany()
      ])
      const page = spacePages.find((item) => item.id === data.pageId)
      const serialized = allPages.map(serializePage)
      const guideData = buildGuideDataPages(data.spaceId)
      const pagesForRun = isGuidePageId(data.pageId) ? [...guideData, ...serialized] : serialized
      const current = page
        ? serializePage(page)
        : {
            id: data.pageId,
            spaceId: data.spaceId,
            folderId: null,
            title: isGuidePageId(data.pageId) ? 'Guide' : 'Untitled',
            type: data.language,
            content: data.source,
            description: '',
            icon: 'BookOpen' as const,
            iconColor: 'slate' as const,
            sortOrder: 0,
            archived: false,
            deletedAt: null,
            locked: false,
            spellcheck: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
      const outcome = await executeSnippet(data.language, data.source, {
        page: current,
        pages: pagesForRun,
        spaces: spaces.map((space) => ({ id: space.id, name: space.name })),
        secrets: await loadSecretsForRun(data.spaceId)
      })
      if (
        page &&
        (page.type === 'javascript' || page.type === 'typescript') &&
        page.content === data.source
      ) {
        await getPrisma().runRecord.create({
          data: {
            pageId: page.id,
            language: data.language,
            source: data.source,
            logs: JSON.stringify(outcome.logs),
            result: outcome.result ?? null,
            error: outcome.error ?? null,
            inputs: '{}'
          }
        })
      }
      return outcome
    }
  },
  secrets: {
    encryptionAvailable: async () => isSecretEncryptionAvailable(),
    list: async (input) => {
      const data = z.object({ spaceId: z.string().min(1) }).parse(input)
      const secrets = await getPrisma().secret.findMany({
        where: { spaceId: data.spaceId },
        orderBy: { key: 'asc' }
      })
      return secrets.map(serializeSecret)
    },
    create: async (input) => {
      const data = z
        .object({
          spaceId: z.string().min(1),
          key: z
            .string()
            .trim()
            .min(1)
            .max(80)
            .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, 'Use a name like API_KEY'),
          value: z.string().min(1)
        })
        .parse(input)
      try {
        const secret = await getPrisma().secret.create({
          data: { spaceId: data.spaceId, key: data.key, valueEnc: sealSecret(data.value) }
        })
        return serializeSecret(secret)
      } catch (error) {
        if (isUniqueConstraint(error)) {
          throw new Error(`A secret named ${data.key} already exists. Replace it instead.`)
        }
        throw error
      }
    },
    update: async (input) => {
      const data = z
        .object({
          id: z.string().min(1),
          key: z
            .string()
            .trim()
            .min(1)
            .max(80)
            .regex(/^[A-Za-z_][A-Za-z0-9_]*$/)
            .optional(),
          value: z.string().min(1).optional()
        })
        .parse(input)
      try {
        const secret = await getPrisma().secret.update({
          where: { id: data.id },
          data: {
            ...(data.key !== undefined ? { key: data.key } : {}),
            ...(data.value !== undefined ? { valueEnc: sealSecret(data.value) } : {})
          }
        })
        return serializeSecret(secret)
      } catch (error) {
        if (isUniqueConstraint(error)) {
          throw new Error('A secret with that name already exists in this space.')
        }
        throw error
      }
    },
    delete: async (input) => {
      const data = idInput.parse(input)
      await getPrisma().secret.delete({ where: { id: data.id } })
    }
  }
}
