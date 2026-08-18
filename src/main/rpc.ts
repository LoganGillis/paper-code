import { ipcMain } from 'electron'
import { RPC_CHANNEL, type RpcRequest, type RpcResult } from '../shared/api'
import { procedures } from './procedures'

export function registerRpc(): void {
  ipcMain.handle(RPC_CHANNEL, async (_event, request: RpcRequest): Promise<RpcResult> => {
    try {
      const [namespace, method] = request.path.split('.')
      const group = procedures[namespace as keyof typeof procedures]
      const handler = group?.[method as keyof typeof group] as
        ((input?: unknown) => Promise<unknown>) | undefined

      if (typeof handler !== 'function') {
        return { ok: false, error: { message: `Unknown procedure: ${request.path}` } }
      }

      const data = await handler(request.input)
      return { ok: true, data }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Something went wrong'
      return { ok: false, error: { message } }
    }
  })
}
