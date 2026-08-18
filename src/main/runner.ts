import { inspect } from 'node:util'
import vm from 'node:vm'
import { transform } from 'sucrase'
import { installCsvHelpers, resolvePage, tableFromPage } from '../shared/helpers/csv'
import { installDateHelpers } from '../shared/helpers/dates'
import type { Page, RunResult } from '../shared/api'
import { installSecretHelpers } from './secrets'

const RUN_TIMEOUT_MS = 8_000

function formatArg(value: unknown): string {
  if (typeof value === 'string') return value
  return inspect(value, { colors: false, depth: 4, breakLength: 80 })
}

function createLogger(logs: RunResult['logs']): {
  log: (...args: unknown[]) => void
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
} {
  return {
    log: (...args: unknown[]) => {
      logs.push({ level: 'log', message: args.map(formatArg).join(' ') })
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
  secrets: Record<string, string>
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
      const target = resolvePage(spec, page, pages)
      if (!target) {
        throw new Error(`Cannot find module "${spec}"`)
      }
      return evaluateModule(target, pages, logs, visiting, secrets)
    }
  }
  installDateHelpers(sandbox)
  installCsvHelpers(sandbox, { page, pages })
  installSecretHelpers(sandbox, secrets)
  sandbox.exports = module.exports
  vm.runInNewContext(compiled, sandbox, { timeout: RUN_TIMEOUT_MS, displayErrors: true })
  visiting.delete(page.id)
  return module.exports
}

export async function executeSnippet(
  language: 'javascript' | 'typescript',
  source: string,
  context: { page: Page; pages: Page[]; secrets?: Record<string, string> }
): Promise<RunResult> {
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
        const target = resolvePage(spec, current, context.pages)
        if (!target) {
          throw new Error(`Cannot find module "${spec}"`)
        }
        return evaluateModule(
          target,
          context.pages,
          logs,
          new Set([current.id]),
          context.secrets ?? {}
        )
      }
    }
    installDateHelpers(sandbox)
    installCsvHelpers(sandbox, { page: current, pages: context.pages })
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
      return { logs, result: settled === undefined ? undefined : formatArg(settled) }
    }

    return { logs, result: value === undefined ? undefined : formatArg(value) }
  } catch (error) {
    return {
      logs,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}
