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
  archived: boolean
  deletedAt: string | null
  locked: boolean
  spellcheck: boolean
  updatedAt: string
}

export type Page = PageSummary & {
  spaceId: string
  content: string
  description: string
  createdAt: string
  updatedAt: string
}

export type PageVersion = {
  id: string
  pageId: string
  title: string
  content: string
  description: string
  createdAt: string
}

export type RunRecord = {
  id: string
  pageId: string
  language: 'javascript' | 'typescript'
  source: string
  logs: RunLog[]
  result?: string
  error?: string
  inputs: string
  createdAt: string
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
  archivedPages: PageSummary[]
  trashedPages: PageSummary[]
}

export type AppConfig = {
  name: string
  version: string
  isDev: boolean
  databasePath: string
  seededThisLaunch: boolean
}

export type UpdateStatus = {
  state: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'ready' | 'error'
  currentVersion: string
  availableVersion?: string
  percent?: number
  error?: string
}

export type RunLog = {
  level: 'log' | 'info' | 'warn' | 'error'
  message: string
  kind?: 'text' | 'table' | 'object'
  table?: string[][]
  object?: unknown
}

export type RunResult = {
  logs: RunLog[]
  result?: string
  resultKind?: 'text' | 'table' | 'object'
  resultTable?: string[][]
  resultObject?: unknown
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
    getUpdateStatus: () => Promise<UpdateStatus>
    checkForUpdates: () => Promise<UpdateStatus>
    quitAndInstall: () => Promise<void>
    addToDictionary: (input: { word: string }) => Promise<void>
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
    exportToFolder: (input: { id: string }) => Promise<string | null>
    importFromFolder: () => Promise<Space | null>
    exportBackup: () => Promise<string | null>
    importBackup: () => Promise<number | null>
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
    move: (input: {
      id: string
      parentId?: string | null
      beforeId?: string | null
    }) => Promise<void>
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
      type?: PageType
      archived?: boolean
      locked?: boolean
      spellcheck?: boolean
      icon?: IconName
      iconColor?: IconColorId
    }) => Promise<Page>
    delete: (input: { id: string }) => Promise<void>
    restore: (input: { id: string }) => Promise<Page>
    purge: (input: { id: string }) => Promise<void>
    move: (input: {
      id: string
      folderId?: string | null
      beforeId?: string | null
    }) => Promise<void>
    listVersions: (input: { id: string }) => Promise<PageVersion[]>
    restoreVersion: (input: { id: string; versionId: string }) => Promise<Page>
    snapshot: (input: { id: string }) => Promise<PageVersion>
    listRuns: (input: { id: string }) => Promise<RunRecord[]>
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
