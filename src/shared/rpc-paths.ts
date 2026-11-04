import type { AppApi } from './api'

/** Every `namespace.method` the renderer may call. */
export type RpcPath = {
  [N in keyof AppApi]: `${N & string}.${keyof AppApi[N] & string}`
}[keyof AppApi]

/** The explicit list of procedures the RPC channel accepts. */
export const RPC_PATHS = [
  'app.getConfig',
  'app.pickCsv',
  'app.getUpdateStatus',
  'app.checkForUpdates',
  'app.quitAndInstall',
  'app.addToDictionary',
  'spaces.list',
  'spaces.create',
  'spaces.update',
  'spaces.delete',
  'spaces.duplicate',
  'spaces.getTree',
  'spaces.exportToFolder',
  'spaces.importFromFolder',
  'spaces.exportBackup',
  'spaces.importBackup',
  'folders.create',
  'folders.update',
  'folders.delete',
  'folders.duplicate',
  'folders.move',
  'pages.get',
  'pages.create',
  'pages.duplicate',
  'pages.update',
  'pages.delete',
  'pages.restore',
  'pages.purge',
  'pages.move',
  'pages.listVersions',
  'pages.restoreVersion',
  'pages.snapshot',
  'pages.listRuns',
  'run.execute',
  'secrets.encryptionAvailable',
  'secrets.list',
  'secrets.create',
  'secrets.update',
  'secrets.delete'
] as const satisfies readonly RpcPath[]

// Fails to compile if a procedure is added to AppApi but not listed above.
type Missing = Exclude<RpcPath, (typeof RPC_PATHS)[number]>
const everyPathListed: [Missing] extends [never] ? true : Missing = true
void everyPathListed

const allowed: ReadonlySet<string> = new Set(RPC_PATHS)

/** True when `path` is one of {@link RPC_PATHS}. */
export function isRpcPath(path: unknown): path is RpcPath {
  return typeof path === 'string' && allowed.has(path)
}
