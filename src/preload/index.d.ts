import { ElectronAPI } from '@electron-toolkit/preload'
import type { OutputSnapshot, RpcResult, UpdateStatus } from '../shared/api'

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
      openOutput: (snapshot: OutputSnapshot) => Promise<void>
      updateOutput: (snapshot: OutputSnapshot) => void
      dockOutput: (key: string) => Promise<void>
      outputIsOpen: (key: string) => Promise<boolean>
      outputHello: () => Promise<OutputSnapshot | null>
      clearOutput: () => void
      closeWindow: () => void
      onOutputState: (callback: (snapshot: OutputSnapshot) => void) => () => void
      onOutputClosed: (callback: (key: string) => void) => () => void
      onOutputCleared: (callback: (key: string) => void) => () => void
    }
  }
}

export {}
