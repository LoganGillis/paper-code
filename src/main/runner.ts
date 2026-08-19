import { inspect } from 'node:util'
import vm from 'node:vm'
import { transform } from 'sucrase'
import { installCsvHelpers, resolvePage, tableFromPage } from '../shared/helpers/csv'
import { installDateHelpers } from '../shared/helpers/dates'
import { $Table } from '../shared/helpers/table'
import type { Page, RunLog, RunResult } from '../shared/api'
import { installSecretHelpers } from './secrets'

const RUN_TIMEOUT_MS = 8_000

function isTable(value: unknown): value is $Table {
  return value instanceof $Table
}

function tableGrid(table: $Table): string[][] {
  const columns = table.columns
  return [
    columns,
    ...table.rows.map((row) => columns.map((column) => String(row[column] ?? '')))
  ]
}

function formatArg(value: unknown): string {
  if (typeof value === 'string') return value
  if (isTable(value)) return inspect(value.rows, { colors: false, depth: 4, breakLength: 80 })
  return inspect(value, { colors: false, depth: 4, breakLength: 80 })
}

function logPayload(value: unknown): Pick<RunLog, 'kind' | 'table' | 'object'> {
  if (isTable(value)) return { kind: 'table', table: tableGrid(value) }
  if (value && typeof value === 'object') return { kind: 'object', object: value }
  return { kind: 'text' }
}

function createLogger(logs: RunResult['logs']): {
  log: (...args: unknown[]) => void
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
} {
  return {
    log: (...args: unknown[]) => {
      const first = args.length === 1 ? args[0] : undefined
      logs.push({
        level: 'log',
        message: args.map(formatArg).join(' '),
        ...logPayload(first)
      })
    },
    info: (...args: unknown[]) => {
      logs.push({ level: 'info', message: args.map(formatArg).join(' ') })
    },
    warn: (...args: unknown[]) => {
      logs.push({ level: 'warn', message: args.map(formatArg).join(' ') })
    },
    error: (...args: unknown[]) => {
      logs.push({ level: 'error', message: args.map(formatArg).join(' ') })
    }
  }
}

function compile(source: string, language: 'javascript' | 'typescript'): string {
  return transform(source, {
    transforms: language === 'typescript' ? ['typescript', 'imports'] : ['imports']
  }).code
}

function evaluateModule(
  page: Page,
  pages: Page[],
  logs: RunResult['logs'],
  visiting: Set<string>,
  secrets: Record<string, string>,
  spaces: Array<{ id: string; name: string }>
): unknown {
  if (page.type === 'csv') {
    return tableFromPage(page)
  }
  if (page.type !== 'javascript' && page.type !== 'typescript') {
    throw new Error(`Cannot import "${page.title}" (${page.type})`)
  }
  if (visiting.has(page.id)) {
    throw new Error(`Circular import around "${page.title}"`)
  }
  visiting.add(page.id)

  const compiled = compile(page.content, page.type)
  const module = { exports: {} as Record<string, unknown> }
  const sandbox: Record<string, unknown> = {
    module,
    exports: module.exports,
    console: createLogger(logs),
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    require: (spec: string) => {
      const target = resolvePage(spec, page, pages, spaces)
      if (!target) {
        throw new Error(`Cannot find module "${spec}"`)
      }
      return evaluateModule(target, pages, logs, visiting, secrets, spaces)
    }
  }
  installDateHelpers(sandbox)
  installCsvHelpers(sandbox, { page, pages, spaces })
  installSecretHelpers(sandbox, secrets)
  sandbox.exports = module.exports
  vm.runInNewContext(compiled, sandbox, { timeout: RUN_TIMEOUT_MS, displayErrors: true })
  visiting.delete(page.id)
  return module.exports
}

export async function executeSnippet(
  language: 'javascript' | 'typescript',
  source: string,
  context: {
    page: Page
    pages: Page[]
    spaces?: Array<{ id: string; name: string }>
    secrets?: Record<string, string>
  }
): Promise<RunResult> {
  const spaces = context.spaces ?? []
  const logs: RunResult['logs'] = []
  const current: Page = { ...context.page, content: source, type: language }

  try {
    const compiled = compile(source, language)
    const module = { exports: {} as Record<string, unknown> }
    const sandbox: Record<string, unknown> = {
      module,
      exports: module.exports,
      console: createLogger(logs),
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
      require: (spec: string) => {
        const target = resolvePage(spec, current, context.pages, spaces)
        if (!target) {
          throw new Error(`Cannot find module "${spec}"`)
        }
        return evaluateModule(
          target,
          context.pages,
          logs,
          new Set([current.id]),
          context.secrets ?? {},
          spaces
        )
      }
    }
    installDateHelpers(sandbox)
    installCsvHelpers(sandbox, { page: current, pages: context.pages, spaces })
    installSecretHelpers(sandbox, context.secrets ?? {})
    sandbox.exports = module.exports

    const result = vm.runInNewContext(compiled, sandbox, {
      timeout: RUN_TIMEOUT_MS,
      displayErrors: true
    })

    const value =
      result !== undefined
        ? result
        : module.exports.default !== undefined
          ? module.exports.default
          : Object.keys(module.exports).length > 0
            ? module.exports
            : undefined

    if (
      value !== undefined &&
      value !== null &&
      typeof (value as Promise<unknown>).then === 'function'
    ) {
      const settled = await Promise.race([
        value as Promise<unknown>,
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error(`Timed out after ${RUN_TIMEOUT_MS}ms`)), RUN_TIMEOUT_MS)
        })
      ])
      if (settled === undefined) return { logs }
      if (isTable(settled)) {
        return { logs, result: formatArg(settled), resultKind: 'table', resultTable: tableGrid(settled) }
      }
      if (settled && typeof settled === 'object') {
        return { logs, result: formatArg(settled), resultKind: 'object', resultObject: settled }
      }
      return { logs, result: formatArg(settled), resultKind: 'text' }
    }

    if (value === undefined) return { logs }
    if (isTable(value)) {
      return { logs, result: formatArg(value), resultKind: 'table', resultTable: tableGrid(value) }
    }
    if (value && typeof value === 'object') {
      return { logs, result: formatArg(value), resultKind: 'object', resultObject: value }
    }
    return { logs, result: formatArg(value), resultKind: 'text' }
  } catch (error) {
    return {
      logs,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}
