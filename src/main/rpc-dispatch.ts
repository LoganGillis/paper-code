import { isRpcPath } from '../shared/rpc-paths'

type Handler = (input?: unknown) => Promise<unknown>

/**
 * Finds the handler for an RPC path. Only allowlisted paths are accepted, and both parts must be
 * own properties, so `__proto__`, `constructor`, and friends never resolve.
 */
export function lookupProcedure(table: object, path: unknown): Handler | null {
  if (!isRpcPath(path)) return null
  const [namespace, method] = path.split('.')
  if (!Object.hasOwn(table, namespace)) return null
  const group = (table as Record<string, unknown>)[namespace]
  if (!group || typeof group !== 'object' || !Object.hasOwn(group, method)) return null
  const handler = (group as Record<string, unknown>)[method]
  return typeof handler === 'function' ? (handler as Handler) : null
}
