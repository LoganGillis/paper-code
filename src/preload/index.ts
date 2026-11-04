import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import {
  RPC_CHANNEL,
  type OutputSnapshot,
  type RpcRequest,
  type RpcResult,
  type UpdateStatus
} from '../shared/api'

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
  },
  openOutput: (snapshot: OutputSnapshot): Promise<void> =>
    ipcRenderer.invoke('paper:output-open', snapshot),
  updateOutput: (snapshot: OutputSnapshot): void => {
    ipcRenderer.send('paper:output-update', snapshot)
  },
  dockOutput: (key: string): Promise<void> => ipcRenderer.invoke('paper:output-dock', key),
  outputIsOpen: (key: string): Promise<boolean> => ipcRenderer.invoke('paper:output-is-open', key),
  outputHello: (): Promise<OutputSnapshot | null> => ipcRenderer.invoke('paper:output-hello'),
  clearOutput: (): void => {
    ipcRenderer.send('paper:output-clear')
  },
  closeWindow: (): void => {
    ipcRenderer.send('paper:close-window')
  },
  onOutputState: (callback: (snapshot: OutputSnapshot) => void): (() => void) => {
    const listener = (_event: unknown, snapshot: OutputSnapshot): void => callback(snapshot)
    ipcRenderer.on('paper:output-state', listener)
    return () => ipcRenderer.removeListener('paper:output-state', listener)
  },
  onOutputClosed: (callback: (key: string) => void): (() => void) => {
    const listener = (_event: unknown, key: string): void => callback(key)
    ipcRenderer.on('paper:output-closed', listener)
    return () => ipcRenderer.removeListener('paper:output-closed', listener)
  },
  onOutputCleared: (callback: (key: string) => void): (() => void) => {
    const listener = (_event: unknown, key: string): void => callback(key)
    ipcRenderer.on('paper:output-cleared', listener)
    return () => ipcRenderer.removeListener('paper:output-cleared', listener)
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
