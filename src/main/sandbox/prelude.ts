// Runs inside the script's vm context. Everything a script can touch is created here, from the
// context's own built-ins, so no host function or constructor is reachable. The host is reached
// only through one bridge function kept in this closure, and only strings cross it.
import { installDateHelpers } from '../../shared/helpers/dates'
import { installSecretHelpers, isSecretBag } from '../../shared/helpers/secret-bag'
import { $Table } from '../../shared/helpers/table'
import { parseLooseJson } from '../../shared/json-text'
import type { RunLog, RunResult } from '../../shared/api'
import { inspect } from './inspect'
import type { Bridge, BridgeCall, BridgeReply, LoadedPage, MainInfo } from './protocol'

type Global = Record<string, unknown>

const global = globalThis as unknown as Global
const bridge = global.__paperBridge as Bridge
delete global.__paperBridge

const { parse, stringify } = JSON
const indirectEval = global.eval as (code: string) => unknown
const defineProperty = Object.defineProperty
const MAX_DEPTH = 24

Object.defineProperty(Error, 'prepareStackTrace', {
  value: undefined,
  writable: false,
  configurable: false
})

function call(message: BridgeCall): unknown {
  let raw: string
  try {
    raw = bridge(stringify(message))
  } catch {
    throw new Error('The script host stopped responding')
  }
  const reply = parse(raw) as BridgeReply
  if (reply.error !== undefined) throw new Error(reply.error)
  return reply.value
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message
  try {
    return String(error)
  } catch {
    return 'Script failed'
  }
}

function tag(value: object): string {
  return Object.prototype.toString.call(value).slice(8, -1)
}

function plain(value: unknown, depth: number, seen: Map<object, unknown>): unknown {
  if (value === null || value === undefined) return value ?? null
  switch (typeof value) {
    case 'string':
    case 'boolean':
      return value
    case 'number':
      return Number.isFinite(value) ? value : String(value)
    case 'bigint':
      return `${value}n`
    case 'symbol':
      return String(value)
    case 'function':
      return '[Function]'
  }
  const object = value as object
  if (isSecretBag(object)) return '[$secrets]'
  if (seen.has(object)) return seen.get(object)
  if (depth >= MAX_DEPTH) return '[Object]'
  if (object instanceof $Table) return plain(object.rows, depth, seen)
  const kind = tag(object)
  if (kind === 'Date') {
    const time = (object as Date).getTime()
    return Number.isNaN(time) ? 'Invalid Date' : new Date(time).toISOString()
  }
  if (kind === 'RegExp') return String(object)
  if (kind === 'Error') return `${(object as Error).name}: ${(object as Error).message}`
  if (kind === 'Promise' || kind === 'WeakMap' || kind === 'WeakSet') return `[${kind}]`
  if (typeof (object as { toJSON?: unknown }).toJSON === 'function' && kind !== 'Object') {
    return read(() => (object as { toJSON: () => unknown }).toJSON(), depth, seen)
  }

  seen.set(object, '[Circular]')
  let out: unknown
  if (Array.isArray(object)) {
    out = object.map((_item, index) => read(() => object[index], depth, seen))
  } else if (kind === 'Map') {
    const entries: Record<string, unknown> = {}
    for (const [key, item] of object as Map<unknown, unknown>) {
      entries[typeof key === 'string' ? key : inspect(key)] = plain(item, depth + 1, seen)
    }
    out = entries
  } else if (kind === 'Set') {
    out = [...(object as Set<unknown>)].map((item) => plain(item, depth + 1, seen))
  } else {
    const entries: Record<string, unknown> = {}
    for (const key of Object.keys(object)) {
      entries[key] = read(() => (object as Record<string, unknown>)[key], depth, seen)
    }
    out = entries
  }
  seen.set(object, out)
  return out
}

function read(get: () => unknown, depth: number, seen: Map<object, unknown>): unknown {
  try {
    return plain(get(), depth + 1, seen)
  } catch {
    return '[Unreadable]'
  }
}

/** A JSON-safe copy of a script value for the output tree. */
function toPlain(value: unknown): unknown {
  return plain(value, 0, new Map())
}

function tableGrid(table: $Table): string[][] {
  const columns = table.columns
  return [columns, ...table.rows.map((row) => columns.map((column) => String(row[column] ?? '')))]
}

function formatArg(value: unknown): string {
  if (typeof value === 'string') return value
  if (value instanceof $Table) return inspect(value.rows, { depth: 4, breakLength: 80 })
  return inspect(value, { depth: 4, breakLength: 80 })
}

function logPayload(value: unknown): Pick<RunLog, 'kind' | 'table' | 'object'> {
  if (value instanceof $Table) return { kind: 'table', table: tableGrid(value) }
  if (value && typeof value === 'object') return { kind: 'object', object: toPlain(value) }
  return { kind: 'text' }
}

function emit(level: RunLog['level'], args: unknown[]): void {
  const message = args.map(formatArg).join(' ')
  const extra = level === 'log' ? logPayload(args.length === 1 ? args[0] : undefined) : {}
  call({ op: 'log', log: { level, message, ...extra } })
}

const consoleObject = {
  log: (...args: unknown[]) => emit('log', args),
  info: (...args: unknown[]) => emit('info', args),
  warn: (...args: unknown[]) => emit('warn', args),
  error: (...args: unknown[]) => emit('error', args),
  debug: (...args: unknown[]) => emit('log', args)
}

let finished = false

function finish(result: Omit<RunResult, 'logs'>): void {
  if (finished) return
  finished = true
  call({ op: 'done', result })
}

function describeValue(value: unknown): Omit<RunResult, 'logs'> {
  if (value === undefined) return {}
  if (value instanceof $Table) {
    return { result: formatArg(value), resultKind: 'table', resultTable: tableGrid(value) }
  }
  if (value && typeof value === 'object') {
    return { result: formatArg(value), resultKind: 'object', resultObject: toPlain(value) }
  }
  return { result: formatArg(value), resultKind: 'text' }
}

type Timer = { fn: (...args: unknown[]) => unknown; args: unknown[]; ms: number; repeat: boolean }
const timers = new Map<number, Timer>()
let nextTimer = 1

function schedule(repeat: boolean, fn: unknown, ms: unknown, args: unknown[]): number {
  if (typeof fn !== 'function') throw new TypeError('The callback must be a function')
  const id = nextTimer++
  const delay = Math.max(0, Number(ms) || 0)
  timers.set(id, { fn: fn as Timer['fn'], args, ms: delay, repeat })
  call({ op: 'timer', id, ms: delay })
  return id
}

function cancel(id: unknown): void {
  if (typeof id !== 'number' || !timers.has(id)) return
  timers.delete(id)
  call({ op: 'clearTimer', id })
}

function fire(id: number): void {
  const timer = timers.get(id)
  if (!timer) return
  if (!timer.repeat) timers.delete(id)
  try {
    timer.fn(...timer.args)
  } catch (error) {
    if (finished) emit('error', [`Uncaught ${errorText(error)}`])
    else finish({ error: errorText(error) })
    return
  }
  if (timer.repeat && timers.has(id)) call({ op: 'timer', id, ms: timer.ms })
}

const visiting = new Set<string>()
/** The page whose code is running now; `$csv` and `$json` resolve from it. */
let currentPage = ''

function loadPage(kind: 'csv' | 'json' | 'module', spec: unknown, from: string): LoadedPage {
  if (typeof spec !== 'string') throw new TypeError('Pass a page name as a string')
  return call({ op: 'page', kind, spec, from }) as LoadedPage
}

function tableFrom(page: LoadedPage): $Table {
  const table = $Table.fromCsv(page.content)
  defineProperty(table, 'default', { configurable: true, enumerable: false, value: table })
  return table
}

function jsonFrom(page: LoadedPage): unknown {
  try {
    return parseLooseJson(page.content)
  } catch (cause) {
    throw new Error(`"${page.title}" is not valid JSON (${errorText(cause)})`)
  }
}

function requireFrom(from: string): (spec: unknown) => unknown {
  return (spec) => {
    const page = loadPage('module', spec, from)
    if (page.type === 'csv') return tableFrom(page)
    if (page.type === 'json') return jsonFrom(page)
    if (visiting.has(page.id)) throw new Error(`Circular import around "${page.title}"`)
    visiting.add(page.id)
    try {
      const module = { exports: {} as Record<string, unknown> }
      const body = new Function('module', 'exports', 'require', page.content) as (
        module: unknown,
        exports: unknown,
        require: unknown
      ) => void
      const outer = currentPage
      currentPage = page.id
      try {
        body(module, module.exports, requireFrom(page.id))
      } finally {
        currentPage = outer
      }
      return module.exports
    } finally {
      visiting.delete(page.id)
    }
  }
}

function hide(name: string, value: unknown): void {
  defineProperty(global, name, { configurable: true, enumerable: false, writable: true, value })
}

function expose(name: string, value: unknown): void {
  defineProperty(global, name, { configurable: true, enumerable: true, writable: true, value })
}

function main(): void {
  delete global.__paperMain
  const info = call({ op: 'main' }) as MainInfo
  visiting.add(info.pageId)
  currentPage = info.pageId
  const module = { exports: {} as Record<string, unknown> }
  expose('module', module)
  expose('exports', module.exports)
  expose('require', requireFrom(info.pageId))
  installSecretHelpers(global, info.secrets)

  let value: unknown
  try {
    const completion = indirectEval(info.code)
    const exported = module.exports
    value =
      completion !== undefined
        ? completion
        : exported.default !== undefined
          ? exported.default
          : Object.keys(exported).length > 0
            ? exported
            : undefined
  } catch (error) {
    finish({ error: errorText(error) })
    return
  }

  let thenable = false
  try {
    thenable =
      value !== null &&
      (typeof value === 'object' || typeof value === 'function') &&
      typeof (value as { then?: unknown }).then === 'function'
  } catch (error) {
    finish({ error: errorText(error) })
    return
  }
  if (!thenable) {
    finish(describeValue(value))
    return
  }
  Promise.resolve(value).then(
    (settled) => finish(describeValue(settled)),
    (error: unknown) => finish({ error: errorText(error) })
  )
}

expose('console', consoleObject)
expose('setTimeout', (fn: unknown, ms?: unknown, ...args: unknown[]) =>
  schedule(false, fn, ms, args)
)
expose('setInterval', (fn: unknown, ms?: unknown, ...args: unknown[]) =>
  schedule(true, fn, ms, args)
)
expose('clearTimeout', cancel)
expose('clearInterval', cancel)
expose('queueMicrotask', (fn: unknown) => {
  if (typeof fn !== 'function') throw new TypeError('The callback must be a function')
  void Promise.resolve().then(fn as () => void)
})
expose('$csv', (spec: unknown) => tableFrom(loadPage('csv', spec, currentPage)))
expose('$json', (spec: unknown) => jsonFrom(loadPage('json', spec, currentPage)))
installDateHelpers(global)
defineProperty(global, '$Table', { configurable: true, enumerable: true, value: $Table })
hide('__paperMain', main)
defineProperty(global, '__paperFire', {
  configurable: false,
  enumerable: false,
  writable: false,
  value: fire
})
