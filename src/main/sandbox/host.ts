import vm from 'node:vm'
import { transform } from 'sucrase'
import { requirePage } from '../../shared/helpers/csv'
import { redactRunResult } from '../../shared/redact'
import type { Page, PageType, RunLog, RunResult } from '../../shared/api'
import {
  RUN_TIMEOUT_MS,
  type Bridge,
  type BridgeCall,
  type LoadedPage,
  type MainInfo,
  type RunRequest
} from './protocol'

const MODULE_TYPES: readonly PageType[] = ['javascript', 'typescript', 'csv', 'json']
const LOG_LEVELS = new Set(['log', 'info', 'warn', 'error'])

function describe(error: unknown): string {
  try {
    const message = (error as { message?: unknown } | null)?.message
    return typeof message === 'string' ? message : String(error)
  } catch {
    return 'Script failed'
  }
}

function compile(source: string, language: 'javascript' | 'typescript'): string {
  return transform(source, {
    transforms: language === 'typescript' ? ['typescript', 'imports'] : ['imports']
  }).code
}

function isTimeout(error: unknown): boolean {
  try {
    const code = (error as { code?: unknown } | null)?.code
    return code === 'ERR_SCRIPT_EXECUTION_TIMEOUT' || /execution timed out/i.test(String(error))
  } catch {
    return false
  }
}

function cleanLog(raw: unknown): RunLog {
  const log = (raw ?? {}) as Partial<RunLog>
  const level = LOG_LEVELS.has(String(log.level)) ? (log.level as RunLog['level']) : 'log'
  const out: RunLog = { level, message: String(log.message ?? '') }
  if (log.kind === 'text' || log.kind === 'table' || log.kind === 'object') out.kind = log.kind
  if (Array.isArray(log.table)) out.table = log.table.map((row) => row.map(String))
  if (log.object !== undefined) out.object = log.object
  return out
}

/**
 * Runs one snippet in a fresh vm context that holds only the prelude's helpers. Call this only
 * inside the isolated script process: the context has no Node built-ins, and the host side never
 * passes a host object into it (only strings, through one bridge function).
 */
export function runInSandbox(
  request: RunRequest,
  prelude: string,
  timeoutMs = RUN_TIMEOUT_MS
): Promise<RunResult> {
  const { language, source, context } = request
  const secrets = context.secrets ?? {}
  const current: Page = { ...context.page, content: source, type: language }
  const spaces = context.spaces ?? []
  const folders = context.folders ?? []
  const logs: RunLog[] = []
  const timers = new Map<number, ReturnType<typeof setTimeout>>()
  const started = Date.now()

  return new Promise((resolve) => {
    let done = false
    const finish = (result: Omit<RunResult, 'logs'>): void => {
      if (done) return
      done = true
      clearTimeout(deadline)
      for (const timer of timers.values()) clearTimeout(timer)
      timers.clear()
      resolve(redactRunResult({ logs, ...result }, secrets))
    }
    const timedOut = (): void => finish({ error: `Timed out after ${timeoutMs}ms` })
    const deadline = setTimeout(timedOut, timeoutMs)
    const remaining = (): number => timeoutMs - (Date.now() - started)

    let code: string
    try {
      code = compile(source, language)
    } catch (error) {
      finish({ error: describe(error) })
      return
    }

    const pageFor = (id: string): Page =>
      id === current.id ? current : (context.pages.find((page) => page.id === id) ?? current)

    const load = (call: Extract<BridgeCall, { op: 'page' }>): LoadedPage => {
      const from = pageFor(String(call.from))
      const spec = String(call.spec)
      const options =
        call.kind === 'csv'
          ? { types: ['csv'] as PageType[], label: 'CSV', missing: `Cannot find CSV "${spec}"` }
          : call.kind === 'json'
            ? {
                types: ['json'] as PageType[],
                label: 'JSON',
                missing: `Cannot find JSON "${spec}"`
              }
            : { types: MODULE_TYPES, label: 'importable', missing: `Cannot find module "${spec}"` }
      const page = requirePage(spec, from, context.pages, spaces, { ...options, folders })
      const content =
        page.type === 'javascript' || page.type === 'typescript'
          ? compile(page.content, page.type)
          : page.content
      return { id: page.id, title: page.title, type: page.type, content }
    }

    const run = (script: string): void => {
      if (done) return
      const budget = remaining()
      if (budget <= 0) {
        timedOut()
        return
      }
      try {
        vm.runInContext(script, sandbox, { timeout: budget, displayErrors: false })
      } catch (error) {
        if (isTimeout(error)) timedOut()
        else finish({ error: describe(error) })
      }
    }

    const handle = (call: BridgeCall): unknown => {
      switch (call.op) {
        case 'main':
          return { code, pageId: current.id, secrets } satisfies MainInfo
        case 'page':
          return load(call)
        case 'log':
          if (!done) logs.push(cleanLog(call.log))
          return null
        case 'timer': {
          const id = Number(call.id)
          clearTimeout(timers.get(id))
          timers.set(
            id,
            setTimeout(
              () => {
                timers.delete(id)
                run(`__paperFire(${id})`)
              },
              Math.max(0, Number(call.ms) || 0)
            )
          )
          return null
        }
        case 'clearTimer':
          clearTimeout(timers.get(Number(call.id)))
          timers.delete(Number(call.id))
          return null
        case 'done':
          finish(call.result ?? {})
          return null
        default:
          throw new Error('Unknown script host call')
      }
    }

    const bridge: Bridge = (raw) => {
      try {
        return JSON.stringify({ value: handle(JSON.parse(String(raw)) as BridgeCall) ?? null })
      } catch (error) {
        try {
          return JSON.stringify({ error: describe(error) })
        } catch {
          return '{"error":"Script host error"}'
        }
      }
    }

    const sandbox = vm.createContext(vm.constants.DONT_CONTEXTIFY, {
      name: 'Paper script',
      codeGeneration: { strings: true, wasm: false }
    }) as Record<string, unknown>
    sandbox.__paperBridge = bridge
    try {
      vm.runInContext(prelude, sandbox, { timeout: timeoutMs, displayErrors: false })
    } catch (error) {
      finish({ error: `The script helpers failed to load (${describe(error)})` })
      return
    }
    run('__paperMain()')
  })
}
