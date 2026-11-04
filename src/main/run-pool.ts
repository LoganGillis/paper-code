import { Worker } from 'node:worker_threads'
import { join } from 'node:path'
import type { RunResult } from '../shared/api'
import type { RunContext } from './runner'

const RUN_TIMEOUT_MS = 8_000

type WorkerReply = { ok: boolean; result?: RunResult; error?: string }

function failure(error: string): RunResult {
  return { logs: [], error }
}

function describe(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

/**
 * Runs a snippet in a dedicated worker. Scripts never run in the main process: if the worker
 * cannot start, crashes, or cannot send its result, the run fails with an error instead.
 */
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
      resolve(failure(`The script runner could not start (${describe(cause)})`))
      return
    }

    let settled = false
    const finish = (result: RunResult): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      void worker.terminate()
      resolve(result)
    }

    const timer = setTimeout(() => {
      finish(failure(`Timed out after ${RUN_TIMEOUT_MS}ms`))
    }, RUN_TIMEOUT_MS + 500)

    worker.once('message', (message: WorkerReply) => {
      if (message.ok && message.result) finish(message.result)
      else finish(failure(message.error ?? 'Script failed'))
    })
    worker.once('messageerror', (error) => {
      finish(failure(`The script result could not be read (${describe(error)})`))
    })
    worker.once('error', (error) => {
      console.error('Script worker error', error)
      finish(failure(`The script runner crashed (${describe(error)})`))
    })
    worker.once('exit', (code) => {
      finish(failure(`The script runner stopped unexpectedly (exit code ${code})`))
    })

    try {
      worker.postMessage({ language, source, context })
    } catch (cause) {
      finish(failure(`The script could not be sent to the runner (${describe(cause)})`))
    }
  })
}
