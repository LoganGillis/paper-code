import { ElectronAPI } from '@electron-toolkit/preload'
import type { RpcResult } from '../shared/api'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      invoke: (path: string, input?: unknown) => Promise<RpcResult>
      onCloseTab: (callback: () => void) => () => void
    }
  }
}

export {}
