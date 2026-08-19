import type { Page, PageType } from '@shared/api'

export const BLOCK_PAGE_PREFIX = 'paper:block/'

type DocNode = {
  type?: string
  attrs?: Record<string, unknown>
  content?: DocNode[]
  text?: string
}

export function isBlockPageId(id: string): boolean {
  return id.startsWith(BLOCK_PAGE_PREFIX)
}

export function blockPageId(pageId: string, blockId: string): string {
  return `${BLOCK_PAGE_PREFIX}${pageId}/${blockId}`
}

export function parseBlockPageId(id: string): { pageId: string; blockId: string } | null {
  if (!isBlockPageId(id)) return null
  const rest = id.slice(BLOCK_PAGE_PREFIX.length)
  const slash = rest.indexOf('/')
  if (slash <= 0) return null
  const pageId = rest.slice(0, slash)
  const blockId = rest.slice(slash + 1)
  if (!pageId || !blockId) return null
  return { pageId, blockId }
}

export function newBlockId(): string {
  return crypto.randomUUID()
}

function parseDoc(content: string): DocNode {
  try {
    const parsed = JSON.parse(content) as unknown
    if (parsed && typeof parsed === 'object') return parsed as DocNode
  } catch {
    // plain text
  }
  return { type: 'doc', content: [] }
}

export function blockText(node: DocNode): string {
  if (!node.content?.length) return ''
  return node.content.map((child) => child.text ?? blockText(child)).join('')
}

export function findRunBlock(content: string, blockId: string): DocNode | null {
  const walk = (node: DocNode): DocNode | null => {
    if (node.type === 'runnableCode' && String(node.attrs?.blockId ?? '') === blockId) return node
    for (const child of node.content ?? []) {
      const hit = walk(child)
      if (hit) return hit
    }
    return null
  }
  return walk(parseDoc(content))
}

export function writeRunBlock(
  content: string,
  blockId: string,
  patch: { source?: string; language?: 'javascript' | 'typescript' }
): string | null {
  const doc = parseDoc(content)
  let found = false
  const walk = (node: DocNode): void => {
    if (node.type === 'runnableCode' && String(node.attrs?.blockId ?? '') === blockId) {
      found = true
      if (patch.language) {
        node.attrs = { ...node.attrs, language: patch.language, blockId }
      }
      if (patch.source !== undefined) {
        node.content = patch.source ? [{ type: 'text', text: patch.source }] : []
      }
      return
    }
    for (const child of node.content ?? []) walk(child)
  }
  walk(doc)
  return found ? JSON.stringify(doc) : null
}

export function blockTitle(source: string): string {
  const line = source.split('\n').find((row) => row.trim())
  if (!line) return 'Script'
  return line.replace(/^\/\/\s*/, '').trim().slice(0, 48) || 'Script'
}

export function buildBlockPage(
  parent: Page,
  blockId: string,
  language: 'javascript' | 'typescript',
  source: string
): Page {
  const now = new Date().toISOString()
  const type: PageType = language
  return {
    id: blockPageId(parent.id, blockId),
    spaceId: parent.spaceId,
    folderId: parent.folderId,
    title: blockTitle(source),
    type,
    content: source,
    description: '',
    icon: language === 'typescript' ? 'FileCode2' : 'FileCode',
    iconColor: parent.iconColor,
    sortOrder: 0,
    archived: false,
    deletedAt: null,
    locked: false,
    spellcheck: false,
    createdAt: now,
    updatedAt: now
  }
}
