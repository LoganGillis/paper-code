import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { RPC_CHANNEL, type RpcRequest, type RpcResult, type UpdateStatus } from '../shared/api'

const api = {
  invoke: (path: string, input?: unknown): Promise<RpcResult> => {
    const request: RpcRequest = { path, input }
    return ipcRenderer.invoke(RPC_CHANNEL, request)
  },
  onCloseTab: (callback: () => void): (() => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('paper:close-tab', listener)
    return () => {
      ipcRenderer.removeListener('paper:close-tab', listener)
    }
  },
  onUpdateStatus: (callback: (status: UpdateStatus) => void): (() => void) => {
    const listener = (_event: unknown, status: UpdateStatus): void => callback(status)
    ipcRenderer.on('paper:update-status', listener)
    return () => {
      ipcRenderer.removeListener('paper:update-status', listener)
    }
  },
  setTitle: (title: string): void => {
    ipcRenderer.send('paper:set-title', title)
  },
  onSpellContext: (
    callback: (payload: { misspelledWord: string; suggestions: string[] }) => void
  ): (() => void) => {
    const listener = (
      _event: unknown,
      payload: { misspelledWord: string; suggestions: string[] }
    ): void => callback(payload)
    ipcRenderer.on('paper:spell-context', listener)
    return () => {
      ipcRenderer.removeListener('paper:spell-context', listener)
    }
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-expect-error defined in dts
  window.electron = electronAPI
  // @ts-expect-error defined in dts
  window.api = api
}
