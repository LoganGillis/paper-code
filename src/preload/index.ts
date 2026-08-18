import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { RPC_CHANNEL, type RpcRequest, type RpcResult } from '../shared/api'

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
