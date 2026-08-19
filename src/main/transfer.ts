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
