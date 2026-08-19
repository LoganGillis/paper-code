import { ElectronAPI } from '@electron-toolkit/preload'
import type { RpcResult, UpdateStatus } from '../shared/api'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      invoke: (path: string, input?: unknown) => Promise<RpcResult>
      onCloseTab: (callback: () => void) => () => void
      onUpdateStatus: (callback: (status: UpdateStatus) => void) => () => void
      setTitle: (title: string) => void
      onSpellContext: (
        callback: (payload: { misspelledWord: string; suggestions: string[] }) => void
      ) => () => void
    }
  }
}

export {}
