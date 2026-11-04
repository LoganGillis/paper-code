import { ipcMain } from 'electron'
import { RPC_CHANNEL, type RpcRequest, type RpcResult } from '../shared/api'
import { procedures } from './procedures'
import { lookupProcedure } from './rpc-dispatch'

export function registerRpc(): void {
  ipcMain.handle(RPC_CHANNEL, async (_event, request: RpcRequest): Promise<RpcResult> => {
    try {
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
