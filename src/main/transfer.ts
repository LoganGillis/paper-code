import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, extname, join } from 'node:path'
import { dialog, BrowserWindow } from 'electron'
import { docToMarkdown, markdownToDoc } from '../shared/markdown-transfer'
import type { PageType } from '../shared/api'
import type { IconColorId, IconName } from '../shared/icons'
import { getPrisma } from './db'

type Manifest = {
  version: 1
  space: { name: string; icon: IconName; iconColor: IconColorId }
  folders: Array<{ path: string; icon: IconName; iconColor: IconColorId }>
  pages: Array<{
    id: string
    path: string
    type: PageType
    icon: IconName
    iconColor: IconColorId
    description: string
  }>
  secretKeys: string[]
}

function safeSegment(value: string): string {
  let cleaned = ''
  for (const char of value) {
    const code = char.charCodeAt(0)
    cleaned += code < 32 || '<>:"/\\|?*'.includes(char) ? '-' : char
  }
  cleaned = cleaned.trim()
  return cleaned || 'Untitled'
}

function extFor(type: PageType): string {
  if (type === 'javascript') return '.js'
  if (type === 'typescript') return '.ts'
  if (type === 'csv') return '.csv'
  return '.md'
}

function fileBody(type: PageType, content: string): string {
  if (type === 'markdown') return docToMarkdown(content)
  return content
}

function parseBody(type: PageType, raw: string): string {
  if (type === 'markdown') return markdownToDoc(raw)
  return raw
}

function uniquePath(used: Set<string>, dir: string, base: string, ext: string): string {
  let name = `${base}${ext}`
  let path = dir ? `${dir}/${name}` : name
  let n = 2
  while (used.has(path.toLowerCase())) {
    name = `${base}-${n}${ext}`
    path = dir ? `${dir}/${name}` : name
    n += 1
  }
  used.add(path.toLowerCase())
  return path
}

async function pickDirectory(title: string): Promise<string | null> {
  const parent = BrowserWindow.getFocusedWindow()
  const picked = parent
    ? await dialog.showOpenDialog(parent, {
        title,
        properties: ['openDirectory', 'createDirectory']
      })
    : await dialog.showOpenDialog({ title, properties: ['openDirectory', 'createDirectory'] })
  if (picked.canceled || !picked.filePaths[0]) return null
  return picked.filePaths[0]
}

export async function exportSpace(spaceId: string): Promise<string | null> {
  const destRoot = await pickDirectory('Export space')
  if (!destRoot) return null

  const prisma = getPrisma()
  const space = await prisma.space.findUniqueOrThrow({
    where: { id: spaceId },
    include: { folders: true, pages: true, secrets: true }
  })

  const folderById = new Map(space.folders.map((folder) => [folder.id, folder]))
  const folderPath = new Map<string, string>()
  const used = new Set<string>()

  const folderName = (id: string): string => {
    if (folderPath.has(id)) return folderPath.get(id)!
    const folder = folderById.get(id)
    if (!folder) return ''
    const parent = folder.parentId ? folderName(folder.parentId) : ''
    const segment = safeSegment(folder.name)
    const path = uniquePath(used, parent, segment, '')
    folderPath.set(id, path)
    return path
  }

  for (const folder of space.folders) folderName(folder.id)

  const root = join(destRoot, safeSegment(space.name))
  await mkdir(root, { recursive: true })

  const manifest: Manifest = {
    version: 1,
    space: {
      name: space.name,
      icon: space.icon as IconName,
      iconColor: space.iconColor as IconColorId
    },
    folders: space.folders.map((folder) => ({
      path: folderPath.get(folder.id) ?? safeSegment(folder.name),
      icon: folder.icon as IconName,
      iconColor: folder.iconColor as IconColorId
    })),
    pages: [],
    secretKeys: space.secrets.map((secret) => secret.key)
  }

  for (const folder of manifest.folders) {
    await mkdir(join(root, ...folder.path.split('/').filter(Boolean)), { recursive: true })
  }

  for (const page of space.pages) {
    if (page.archived) continue
    const dir = page.folderId ? (folderPath.get(page.folderId) ?? '') : ''
    const path = uniquePath(used, dir, safeSegment(page.title), extFor(page.type as PageType))
    const abs = join(root, ...path.split('/'))
    await mkdir(dirname(abs), { recursive: true })
    await writeFile(abs, fileBody(page.type as PageType, page.content), 'utf8')
    manifest.pages.push({
      id: page.id,
      path,
      type: page.type as PageType,
      icon: page.icon as IconName,
      iconColor: page.iconColor as IconColorId,
      description: page.description
    })
  }

  await writeFile(join(root, 'paper.json'), JSON.stringify(manifest, null, 2), 'utf8')
  return root
}

export async function importSpace(): Promise<string | null> {
  const source = await pickDirectory('Import space')
  if (!source) return null

  const raw = await readFile(join(source, 'paper.json'), 'utf8').catch(() => null)
  if (!raw) throw new Error('This folder is not a Paper export (missing paper.json).')
  const manifest = JSON.parse(raw) as Manifest
  if (manifest.version !== 1 || !manifest.space?.name) {
    throw new Error('Unsupported or damaged Paper export.')
  }

  const prisma = getPrisma()
  const space = await prisma.space.create({
    data: {
      name: manifest.space.name,
      icon: manifest.space.icon,
      iconColor: manifest.space.iconColor
    }
  })

  const folderIds = new Map<string, string>()
  const sortedFolders = [...(manifest.folders ?? [])].sort(
    (a, b) => a.path.split('/').length - b.path.split('/').length
  )
  for (const folder of sortedFolders) {
    const parts = folder.path.split('/').filter(Boolean)
    const parentPath = parts.slice(0, -1).join('/')
    const created = await prisma.folder.create({
      data: {
        name: parts[parts.length - 1] ?? folder.path,
        icon: folder.icon,
        iconColor: folder.iconColor,
        spaceId: space.id,
        parentId: parentPath ? (folderIds.get(parentPath) ?? null) : null
      }
    })
    folderIds.set(folder.path, created.id)
  }

  const pageIds = new Map<string, string>()
  for (const item of manifest.pages ?? []) {
    const abs = join(source, ...item.path.split('/'))
    const rawFile = await readFile(abs, 'utf8').catch(() => '')
    const dir = dirname(item.path).replace(/^\.$/, '')
    const created = await prisma.page.create({
      data: {
        title: item.path.split('/').pop()?.replace(extname(item.path), '') ?? 'Untitled',
        type: item.type,
        content: parseBody(item.type, rawFile),
        description: item.description ?? '',
        icon: item.icon,
        iconColor: item.iconColor,
        spaceId: space.id,
        folderId: dir && dir !== '.' ? (folderIds.get(dir) ?? null) : null
      }
    })
    pageIds.set(item.id, created.id)
    pageIds.set(item.path, created.id)
  }

  const remap = (content: string): string => {
    let next = content
    for (const item of manifest.pages ?? []) {
      const mapped = pageIds.get(item.id)
      if (!mapped || mapped === item.id) continue
      next = next.split(item.id).join(mapped)
    }
    return next
  }

  for (const item of manifest.pages ?? []) {
    const id = pageIds.get(item.path)
    if (!id) continue
    const page = await prisma.page.findUniqueOrThrow({ where: { id } })
    if (page.type !== 'markdown') continue
    const next = remap(page.content)
    if (next !== page.content) {
      await prisma.page.update({ where: { id }, data: { content: next } })
    }
  }

  return space.id
}

type Backup = {
  version: 1
  exportedAt: string
  spaces: Array<{
    name: string
    icon: IconName
    iconColor: IconColorId
    secretsExposed: boolean
    secretKeys: string[]
    folders: Array<{
      id: string
      parentId: string | null
      name: string
      icon: IconName
      iconColor: IconColorId
      sortOrder: number
    }>
    pages: Array<{
      id: string
      folderId: string | null
      title: string
      type: PageType
      content: string
      description: string
      icon: IconName
      iconColor: IconColorId
      sortOrder: number
      archived: boolean
      deletedAt: string | null
      locked: boolean
      spellcheck: boolean
      versions: Array<{ title: string; content: string; description: string; createdAt: string }>
      runs: Array<{
        language: string
        source: string
        logs: string
        result: string | null
        error: string | null
        inputs: string
        createdAt: string
      }>
    }>
  }>
}

export async function exportBackup(): Promise<string | null> {
  const destRoot = await pickDirectory('Export Paper backup')
  if (!destRoot) return null
  const prisma = getPrisma()
  const spaces = await prisma.space.findMany({
    include: {
      secrets: true,
      folders: true,
      pages: { include: { versions: true, runs: true } }
    },
    orderBy: { createdAt: 'asc' }
  })
  const backup: Backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    spaces: spaces.map((space) => ({
      name: space.name,
      icon: space.icon as IconName,
      iconColor: space.iconColor as IconColorId,
      secretsExposed: space.secretsExposed,
      secretKeys: space.secrets.map((secret) => secret.key),
      folders: space.folders.map((folder) => ({
        id: folder.id,
        parentId: folder.parentId,
        name: folder.name,
        icon: folder.icon as IconName,
        iconColor: folder.iconColor as IconColorId,
        sortOrder: folder.sortOrder
      })),
      pages: space.pages.map((page) => ({
        id: page.id,
        folderId: page.folderId,
        title: page.title,
        type: page.type as PageType,
        content: page.content,
        description: page.description,
        icon: page.icon as IconName,
        iconColor: page.iconColor as IconColorId,
        sortOrder: page.sortOrder,
        archived: page.archived,
        deletedAt: page.deletedAt ? page.deletedAt.toISOString() : null,
        locked: page.locked,
        spellcheck: page.spellcheck,
        versions: page.versions.map((version) => ({
          title: version.title,
          content: version.content,
          description: version.description,
          createdAt: version.createdAt.toISOString()
        })),
        runs: page.runs.map((run) => ({
          language: run.language,
          source: run.source,
          logs: run.logs,
          result: run.result,
          error: run.error,
          inputs: run.inputs,
          createdAt: run.createdAt.toISOString()
        }))
      }))
    }))
  }
  const dest = join(destRoot, 'paper-backup.json')
  await writeFile(dest, JSON.stringify(backup, null, 2), 'utf8')
  return dest
}

export async function importBackup(): Promise<number | null> {
  const parent = BrowserWindow.getFocusedWindow()
  const picked = parent
    ? await dialog.showOpenDialog(parent, {
        title: 'Import Paper backup',
        properties: ['openFile'],
        filters: [{ name: 'Paper backup', extensions: ['json'] }]
      })
    : await dialog.showOpenDialog({
        title: 'Import Paper backup',
        properties: ['openFile'],
        filters: [{ name: 'Paper backup', extensions: ['json'] }]
      })
  const filePath = picked.filePaths[0]
  if (picked.canceled || !filePath) return null
  const raw = await readFile(filePath, 'utf8')
  const backup = JSON.parse(raw) as Backup
  if (backup.version !== 1 || !Array.isArray(backup.spaces)) {
    throw new Error('Unsupported or damaged Paper backup.')
  }
  const prisma = getPrisma()
  let count = 0
  for (const item of backup.spaces) {
    const space = await prisma.space.create({
      data: {
        name: item.name,
        icon: item.icon,
        iconColor: item.iconColor,
        secretsExposed: Boolean(item.secretsExposed)
      }
    })
    count += 1
    const folderIds = new Map<string, string>()
    const folders = [...(item.folders ?? [])].sort((a, b) => {
      const ad = a.parentId ? 1 : 0
      const bd = b.parentId ? 1 : 0
      return ad - bd
    })
    let remaining = [...folders]
    while (remaining.length > 0) {
      const next = remaining.filter(
        (folder) => !folder.parentId || folderIds.has(folder.parentId)
      )
      if (next.length === 0) break
      for (const folder of next) {
        const created = await prisma.folder.create({
          data: {
            name: folder.name,
            icon: folder.icon,
            iconColor: folder.iconColor,
            sortOrder: folder.sortOrder,
            spaceId: space.id,
            parentId: folder.parentId ? (folderIds.get(folder.parentId) ?? null) : null
          }
        })
        folderIds.set(folder.id, created.id)
      }
      remaining = remaining.filter((folder) => !folderIds.has(folder.id))
    }
    const pageIds = new Map<string, string>()
    for (const page of item.pages ?? []) {
      const created = await prisma.page.create({
        data: {
          title: page.title,
          type: page.type,
          content: page.content,
          description: page.description ?? '',
          icon: page.icon,
          iconColor: page.iconColor,
          sortOrder: page.sortOrder,
          archived: Boolean(page.archived),
          deletedAt: page.deletedAt ? new Date(page.deletedAt) : null,
          locked: Boolean(page.locked),
          spellcheck: page.spellcheck !== false,
          spaceId: space.id,
          folderId: page.folderId ? (folderIds.get(page.folderId) ?? null) : null
        }
      })
      pageIds.set(page.id, created.id)
      for (const version of page.versions ?? []) {
        await prisma.pageVersion.create({
          data: {
            pageId: created.id,
            title: version.title,
            content: version.content,
            description: version.description,
            createdAt: new Date(version.createdAt)
          }
        })
      }
      for (const run of page.runs ?? []) {
        await prisma.runRecord.create({
          data: {
            pageId: created.id,
            language: run.language,
            source: run.source,
            logs: run.logs,
            result: run.result,
            error: run.error,
            inputs: run.inputs ?? '{}',
            createdAt: new Date(run.createdAt)
          }
        })
      }
    }
    for (const page of item.pages ?? []) {
      const id = pageIds.get(page.id)
      if (!id || page.type !== 'markdown') continue
      let next = page.content
      for (const [oldId, mapped] of pageIds) {
        if (mapped === oldId) continue
        next = next.split(oldId).join(mapped)
      }
      if (next !== page.content) {
        await prisma.page.update({ where: { id }, data: { content: next } })
      }
    }
  }
  return count
}
