import type { AppApi, RpcResult } from '@shared/api'

async function invoke<T>(path: string, input?: unknown): Promise<T> {
  if (!window.api?.invoke) {
    throw new Error('Preload RPC bridge is missing. Is the BrowserWindow preload script loaded?')
  }

  const result = (await window.api.invoke(path, input)) as RpcResult<T>
  if (!result.ok) {
    throw new Error(result.error.message)
  }
  return result.data
}

export const api: AppApi = {
  app: {
    getConfig: () => invoke('app.getConfig'),
    pickCsv: () => invoke('app.pickCsv'),
    getUpdateStatus: () => invoke('app.getUpdateStatus'),
    checkForUpdates: () => invoke('app.checkForUpdates'),
    quitAndInstall: () => invoke('app.quitAndInstall')
  },
  spaces: {
    list: () => invoke('spaces.list'),
    create: (input) => invoke('spaces.create', input),
    update: (input) => invoke('spaces.update', input),
    delete: (input) => invoke('spaces.delete', input),
    duplicate: (input) => invoke('spaces.duplicate', input),
    getTree: (input) => invoke('spaces.getTree', input)
  },
  folders: {
    create: (input) => invoke('folders.create', input),
    update: (input) => invoke('folders.update', input),
    delete: (input) => invoke('folders.delete', input),
    duplicate: (input) => invoke('folders.duplicate', input)
  },
  pages: {
    get: (input) => invoke('pages.get', input),
    create: (input) => invoke('pages.create', input),
    update: (input) => invoke('pages.update', input),
    delete: (input) => invoke('pages.delete', input),
    duplicate: (input) => invoke('pages.duplicate', input)
  },
  run: {
    execute: (input) => invoke('run.execute', input)
  },
  secrets: {
    encryptionAvailable: () => invoke('secrets.encryptionAvailable'),
    list: (input) => invoke('secrets.list', input),
    create: (input) => invoke('secrets.create', input),
    update: (input) => invoke('secrets.update', input),
    delete: (input) => invoke('secrets.delete', input)
  }
}
