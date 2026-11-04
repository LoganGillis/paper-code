import { ipcMain, type BrowserWindow } from 'electron'
import { RPC_CHANNEL, type RpcRequest, type RpcResult } from '../shared/api'
import { procedures } from './procedures'
import { isTrustedRpcSender, lookupProcedure } from './rpc-dispatch'

const trusted = new Set<number>()

/** Lets a main app window call RPC. Output windows are never trusted; they only get output IPC. */
export function trustRpcWindow(win: BrowserWindow): void {
  const id = win.webContents.id
  trusted.add(id)
  win.webContents.once('destroyed', () => trusted.delete(id))
}

export function registerRpc(): void {
  ipcMain.handle(RPC_CHANNEL, async (event, request: RpcRequest): Promise<RpcResult> => {
    try {
      const fromMainFrame =
        event.senderFrame != null && event.senderFrame === event.sender.mainFrame
      if (!isTrustedRpcSender(trusted, event.sender.id, fromMainFrame)) {
        return { ok: false, error: { message: 'This window cannot use Paper data.' } }
      }
      const path = request?.path
      const handler = lookupProcedure(procedures, path)
      if (!handler) {
        return { ok: false, error: { message: `Unknown procedure: ${String(path)}` } }
      }

      const data = await handler(request.input)
      return { ok: true, data }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Something went wrong'
      return { ok: false, error: { message } }
    }
  })
}
