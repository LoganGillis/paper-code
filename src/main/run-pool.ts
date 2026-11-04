import { Worker } from 'node:worker_threads'
import { join } from 'node:path'
import type { Page, RunResult } from '../shared/api'
import { executeSnippet } from './runner'

const RUN_TIMEOUT_MS = 8_000

type RunContext = {
  page: Page
  pages: Page[]
  spaces?: Array<{ id: string; name: string }>
  secrets?: Record<string, string>
}

export function executeSnippetAsync(
  language: 'javascript' | 'typescript',
  source: string,
  context: RunContext
): Promise<RunResult> {
  return new Promise((resolve) => {
    let worker: Worker
    try {
      worker = new Worker(join(__dirname, 'run-worker.js'))
    } catch (cause) {
      console.error('Script worker failed to start', cause)
      void executeSnippet(language, source, context).then(resolve)
      return
    }

    const timer = setTimeout(() => {
      void worker.terminate()
      resolve({ logs: [], error: `Timed out after ${RUN_TIMEOUT_MS}ms` })
    }, RUN_TIMEOUT_MS + 500)

    worker.once('message', (message: { ok: boolean; result?: RunResult; error?: string }) => {
      clearTimeout(timer)
      void worker.terminate()
      if (message.ok && message.result) resolve(message.result)
      else resolve({ logs: [], error: message.error ?? 'Script failed' })
    })
    worker.once('error', (error) => {
      clearTimeout(timer)
      console.error('Script worker error', error)
      void executeSnippet(language, source, context).then(resolve)
    })
    worker.postMessage({ language, source, context })
  })
}
