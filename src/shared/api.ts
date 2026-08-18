import type { IconColorId, IconName } from './icons'

export const RPC_CHANNEL = 'desktop:rpc'

export type PageType = 'markdown' | 'javascript' | 'typescript' | 'csv'

export type Appearance = {
  icon: IconName
  iconColor: IconColorId
}

export type Space = Appearance & {
  id: string
  name: string
  secretsExposed: boolean
  createdAt: string
  updatedAt: string
}

export type PageSummary = Appearance & {
  id: string
  title: string
  type: PageType
  folderId: string | null
  sortOrder: number
  updatedAt: string
}

export type Page = PageSummary & {
  spaceId: string
  content: string
  description: string
  createdAt: string
  updatedAt: string
}

export type FolderNode = Appearance & {
  id: string
  name: string
  parentId: string | null
  sortOrder: number
  folders: FolderNode[]
  pages: PageSummary[]
}

export type SpaceTree = {
  space: Space
  folders: FolderNode[]
  pages: PageSummary[]
}

export type AppConfig = {
  databasePath: string
}

export type RunResult = {
  logs: Array<{ level: 'log' | 'info' | 'warn' | 'error'; message: string }>
  result?: string
  error?: string
}

export type SecretSummary = {
  id: string
  key: string
  spaceId: string
  updatedAt: string
}

export type TabRef = {
  pageId: string
  spaceId: string
}

export type AppApi = {
  app: {
    getConfig: () => Promise<AppConfig>
    pickCsv: () => Promise<{ name: string; content: string } | null>
  }
  spaces: {
    list: () => Promise<Space[]>
    create: (input: { name: string; icon?: IconName; iconColor?: IconColorId }) => Promise<Space>
    update: (input: {
      id: string
      name?: string
      icon?: IconName
      iconColor?: IconColorId
      secretsExposed?: boolean
    }) => Promise<Space>
    delete: (input: { id: string }) => Promise<void>
    duplicate: (input: { id: string }) => Promise<Space>
    getTree: (input: { id: string }) => Promise<SpaceTree>
  }
  folders: {
    create: (input: {
      spaceId: string
      parentId?: string | null
      name: string
    }) => Promise<FolderNode>
    update: (input: {
      id: string
      name?: string
      icon?: IconName
      iconColor?: IconColorId
    }) => Promise<FolderNode>
    delete: (input: { id: string }) => Promise<void>
    duplicate: (input: { id: string }) => Promise<FolderNode>
  }
  pages: {
    get: (input: { id: string }) => Promise<Page>
    create: (input: {
      spaceId: string
      folderId?: string | null
      type: PageType
      title: string
      content?: string
    }) => Promise<Page>
    duplicate: (input: { id: string }) => Promise<Page>
    update: (input: {
      id: string
      title?: string
      content?: string
      description?: string
      icon?: IconName
      iconColor?: IconColorId
    }) => Promise<Page>
    delete: (input: { id: string }) => Promise<void>
  }
  run: {
    execute: (input: {
      language: 'javascript' | 'typescript'
      source: string
      spaceId: string
      pageId: string
    }) => Promise<RunResult>
  }
  secrets: {
    encryptionAvailable: () => Promise<boolean>
    list: (input: { spaceId: string }) => Promise<SecretSummary[]>
    create: (input: { spaceId: string; key: string; value: string }) => Promise<SecretSummary>
    update: (input: { id: string; key?: string; value?: string }) => Promise<SecretSummary>
    delete: (input: { id: string }) => Promise<void>
  }
}

export type RpcRequest = {
  path: string
  input?: unknown
}

export type RpcSuccess<T = unknown> = {
  ok: true
  data: T
}

export type RpcFailure = {
  ok: false
  error: { message: string }
}

export type RpcResult<T = unknown> = RpcSuccess<T> | RpcFailure
