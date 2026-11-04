import { isSecretBag } from '../shared/helpers/secret-bag'
import { $Table } from '../shared/helpers/table'
import type { RunResult } from '../shared/api'

const MAX_DEPTH = 24

function tag(value: unknown): string {
  return Object.prototype.toString.call(value).slice(8, -1)
}

function walk(value: unknown, depth: number, seen: WeakMap<object, unknown>): unknown {
  if (value === null || value === undefined) return value
  switch (typeof value) {
    case 'string':
    case 'number':
    case 'boolean':
    case 'bigint':
      return value
    case 'symbol':
      return String(value)
    case 'function':
      return '[Function]'
  }
  const object = value as object
  if (isSecretBag(object)) return '[$secrets]'
  if (seen.has(object)) return seen.get(object)
  if (depth >= MAX_DEPTH) return '[Object]'

  if (object instanceof $Table) return walk(object.rows, depth, seen)
  const kind = tag(object)
  if (kind === 'Date') {
    const time = (object as Date).getTime()
    return Number.isNaN(time) ? 'Invalid Date' : new Date(time)
  }
  if (kind === 'RegExp') return String(object)
  if (kind === 'Error') {
    const error = object as Error
    return `${error.name ?? 'Error'}: ${error.message ?? ''}`
  }
  if (kind === 'Promise' || kind === 'WeakMap' || kind === 'WeakSet') return `[${kind}]`

  if (Array.isArray(object)) {
    const out: unknown[] = []
    seen.set(object, '[Circular]')
    for (let index = 0; index < object.length; index += 1) {
      out.push(read(() => object[index], depth, seen))
    }
    seen.set(object, out)
    return out
  }
  if (kind === 'Map') {
    const out = new Map<unknown, unknown>()
    seen.set(object, '[Circular]')
    for (const [key, item] of object as Map<unknown, unknown>) {
      out.set(walk(key, depth + 1, seen), walk(item, depth + 1, seen))
    }
    seen.set(object, out)
    return out
  }
  if (kind === 'Set') {
    const out = new Set<unknown>()
    seen.set(object, '[Circular]')
    for (const item of object as Set<unknown>) out.add(walk(item, depth + 1, seen))
    seen.set(object, out)
    return out
  }

  const out: Record<string, unknown> = {}
  seen.set(object, '[Circular]')
  for (const key of Object.keys(object)) {
    out[key] = read(() => (object as Record<string, unknown>)[key], depth, seen)
  }
  seen.set(object, out)
  return out
}

function read(get: () => unknown, depth: number, seen: WeakMap<object, unknown>): unknown {
  try {
    return walk(get(), depth + 1, seen)
  } catch {
    return '[Unreadable]'
  }
}

/**
 * Returns a structured-clone-safe copy of a script value: functions become `'[Function]'`,
 * the `$secrets` proxy becomes `'[$secrets]'`, and class instances become plain objects.
 */
export function toCloneable(value: unknown): unknown {
  return walk(value, 0, new WeakMap())
}

/** Makes every user value inside a run result safe to post across a process boundary. */
export function cloneableResult(result: RunResult): RunResult {
  return {
    ...result,
    logs: result.logs.map((log) =>
      log.object === undefined ? log : { ...log, object: toCloneable(log.object) }
    ),
    ...(result.resultObject !== undefined ? { resultObject: toCloneable(result.resultObject) } : {})
  }
}
