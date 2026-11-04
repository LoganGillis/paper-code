import { join } from 'node:path'
import { utilityProcess, type UtilityProcess } from 'electron'
import type { RunResult } from '../shared/api'
import { RUN_TIMEOUT_MS, type RunContext } from './sandbox/protocol'

/** Extra time the process gets to report its own timeout before it is killed. */
const KILL_GRACE_MS = 500

type HostReply = { ok: boolean; result?: RunResult; error?: string }

function failure(error: string): RunResult {
  return { logs: [], error }
}

function describe(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

/**
 * Runs a snippet in its own short-lived utility process. Scripts never run in the main process:
 * if the process cannot start, crashes, or exits early, the run fails with an error. The process
 * is killed after the run timeout even when the script is stuck in async work.
 */
export function executeSnippetAsync(
  language: 'javascript' | 'typescript',
  source: string,
  context: RunContext
): Promise<RunResult> {
  return new Promise((resolve) => {
    let child: UtilityProcess
    try {
      child = utilityProcess.fork(join(__dirname, 'run-host.js'), [], {
        serviceName: 'Paper script runner',
        stdio: 'ignore'
      })
    } catch (cause) {
      console.error('Script process failed to start', cause)
      resolve(failure(`The script runner could not start (${describe(cause)})`))
      return
    }

    let settled = false
    const finish = (result: RunResult): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      child.kill()
      resolve(result)
    }

    const timer = setTimeout(() => {
      finish(failure(`Timed out after ${RUN_TIMEOUT_MS}ms`))
    }, RUN_TIMEOUT_MS + KILL_GRACE_MS)

    child.once('spawn', () => {
      try {
        child.postMessage({ language, source, context })
      } catch (cause) {
        finish(failure(`The script could not be sent to the runner (${describe(cause)})`))
      }
    })
    child.once('message', (message: HostReply) => {
      if (message?.ok && message.result) finish(message.result)
      else finish(failure(message?.error ?? 'Script failed'))
    })
    child.once('error', (type: string) => {
      console.error('Script process error', type)
      finish(failure(`The script runner crashed (${type})`))
    })
    child.once('exit', (code) => {
      finish(failure(`The script runner stopped unexpectedly (exit code ${code})`))
    })
  })
}
